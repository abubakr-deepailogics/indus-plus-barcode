import { getPool, sql, WORKERS_VIEW } from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";

export const dynamic = "force-dynamic";

// Raw QrCode_Coupon shape needed by enrichCouponRows (WorkOrder/BundleNo/OpNo)
// plus the extra columns this report surfaces per row.
interface ScannedCouponRow {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  ScannedAt: string | null;
}

// GET /api/reports/employee-summary?code=<EmployeeID>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>
//
// `from`/`to` are optional and inclusive on both ends; omitting either (or
// both) reports all-time totals. Employee identity lives on hrms, scanned
// coupons live on pitSystem, and the per-operation rate (needed to price
// each scan) lives on indusPlus — three separate SQL Server instances, so
// this fetches each side separately and merges in JS (same reasoning as
// /api/workers and coupon-enrichment.service.ts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  if (!code) {
    return Response.json({ error: "Employee code is required." }, { status: 400 });
  }

  const codeNum = parseInt(code, 10);
  if (isNaN(codeNum)) {
    return Response.json({ error: "Invalid employee code format." }, { status: 400 });
  }

  try {
    const [hrmsPool, pitPool] = await Promise.all([
      getPool("hrms"),
      getPool("pitSystem"),
    ]);

    const couponConditions = ["EmployeeCode = @code", "IsScanned = 1"];
    const couponRequest = pitPool.request().input("code", sql.NVarChar, String(codeNum));
    if (from) {
      couponRequest.input("from", sql.Date, from);
      couponConditions.push("ScannedAt >= @from");
    }
    if (to) {
      couponRequest.input("to", sql.Date, to);
      // Exclusive upper bound one day out, so the `to` day itself is fully
      // included regardless of the time-of-day portion of ScannedAt.
      couponConditions.push("ScannedAt < DATEADD(day, 1, @to)");
    }

    const [workerResult, couponResult, scanCountsResult] = await Promise.all([
      hrmsPool
        .request()
        .input("code", sql.Int, codeNum)
        .query(`
          SELECT TOP 1 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
          FROM ${WORKERS_VIEW}
          WHERE EmployeeID = @code
        `),
      couponRequest.query(`
        SELECT CouponCode, WorkOrder, BundleNo, OpNo, ScannedAt
        FROM dbo.QrCode_Coupon
        WHERE ${couponConditions.join(" AND ")}
        ORDER BY ScannedAt DESC
      `),
      pitPool
        .request()
        .input("code", sql.NVarChar, String(codeNum))
        .query(`
          SELECT
            (
              SELECT COUNT(*)
              FROM dbo.QrCode_Coupon
              WHERE EmployeeCode = @code
                AND IsScanned = 1
                AND ScannedAt IS NOT NULL
                AND CAST(ScannedAt AS DATE) = CAST(GETDATE() AS DATE)
            ) AS TodayScans,
            (
              SELECT COUNT(*)
              FROM dbo.QrCode_Coupon
              WHERE EmployeeCode = @code
                AND IsScanned = 1
                AND ScannedAt IS NOT NULL
                AND ScannedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
            ) AS MonthScans
        `),
    ]);

    if (workerResult.recordset.length === 0) {
      return Response.json({ error: "Employee not found." }, { status: 404 });
    }

    const rows = couponResult.recordset as ScannedCouponRow[];
    const enriched = await enrichCouponRows(rows);

    const totalAmount = enriched.reduce((sum, row) => sum + (row.Value ?? 0), 0);
    const totalWorkOrders = new Set(enriched.map((row) => row.WorkOrder)).size;
    const totalQty = enriched.reduce((sum, row) => sum + (Number(row.Qty) || 0), 0);
    const totalSam = enriched.reduce((sum, row) => {
      const qty = Number(row.Qty) || 0;
      const smv = Number(row.Smv) || 0;
      return sum + qty * smv;
    }, 0);
    const avgRatePerPiece = totalQty > 0 ? totalAmount / totalQty : 0;

    const latest = enriched.length > 0 ? enriched[0] : null;

    // Operations breakdown aggregation
    const opMap = new Map<
      string,
      {
        operationCode: string;
        operationName: string;
        section: string;
        rate: number | null;
        smv: number | null;
        couponCount: number;
        totalQty: number;
        totalSam: number;
        totalAmount: number;
      }
    >();

    // Work Orders breakdown aggregation
    const woMap = new Map<
      string,
      {
        workOrder: string;
        couponCount: number;
        totalQty: number;
        totalSam: number;
        totalAmount: number;
        operations: Set<string>;
      }
    >();

    // Section counts for primary section calculation
    const sectionCounts = new Map<string, number>();

    const couponItems = enriched.map((row) => {
      const qty = row.Qty != null ? Number(row.Qty) : null;
      const rate = row.Rate != null ? Number(row.Rate) : null;
      const smv = row.Smv != null ? Number(row.Smv) : null;
      const val = row.Value != null ? Number(row.Value) : null;
      const opCode = row.OprCode || row.OpNo || "UNKNOWN";
      const opName = row.OperationName != null ? String(row.OperationName) : opCode;
      const section = row.SectionName != null ? String(row.SectionName) : "General";

      if (section && section !== "General") {
        sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
      }

      // Aggregate Operation
      const existingOp = opMap.get(opCode);
      if (!existingOp) {
        opMap.set(opCode, {
          operationCode: opCode,
          operationName: opName,
          section,
          rate,
          smv,
          couponCount: 1,
          totalQty: qty || 0,
          totalSam: (qty || 0) * (smv || 0),
          totalAmount: val || 0,
        });
      } else {
        existingOp.couponCount += 1;
        existingOp.totalQty += qty || 0;
        existingOp.totalSam += (qty || 0) * (smv || 0);
        existingOp.totalAmount += val || 0;
        if (!existingOp.rate && rate) existingOp.rate = rate;
        if (!existingOp.smv && smv) existingOp.smv = smv;
      }

      // Aggregate Work Order
      const existingWo = woMap.get(row.WorkOrder);
      if (!existingWo) {
        woMap.set(row.WorkOrder, {
          workOrder: row.WorkOrder,
          couponCount: 1,
          totalQty: qty || 0,
          totalSam: (qty || 0) * (smv || 0),
          totalAmount: val || 0,
          operations: new Set([opCode]),
        });
      } else {
        existingWo.couponCount += 1;
        existingWo.totalQty += qty || 0;
        existingWo.totalSam += (qty || 0) * (smv || 0);
        existingWo.totalAmount += val || 0;
        existingWo.operations.add(opCode);
      }

      return {
        couponCode: row.CouponCode,
        workOrder: row.WorkOrder,
        bundleNo: row.BundleNo,
        cutNo: row.CutNo != null ? String(row.CutNo) : null,
        qty,
        size: row.SizeCode != null ? String(row.SizeCode) : null,
        inseam: row.Inseam != null ? String(row.Inseam) : null,
        section,
        operationCode: opCode,
        operationName: opName,
        smv,
        rate,
        value: val,
        scannedAt: row.ScannedAt,
      };
    });

    let primarySection: string | null = null;
    let maxSectionCount = 0;
    for (const [sec, count] of sectionCounts.entries()) {
      if (count > maxSectionCount) {
        maxSectionCount = count;
        primarySection = sec;
      }
    }

    const operations = Array.from(opMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const workOrders = Array.from(woMap.values())
      .map((w) => ({
        workOrder: w.workOrder,
        couponCount: w.couponCount,
        totalQty: w.totalQty,
        totalSam: w.totalSam,
        totalAmount: w.totalAmount,
        operationsCount: w.operations.size,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const scanCounts = scanCountsResult.recordset[0] || {};
    const todayScans = Number(scanCounts.TodayScans) || 0;
    const monthScans = Number(scanCounts.MonthScans) || 0;

    return Response.json({
      employee: workerResult.recordset[0],
      todayScans,
      monthScans,
      primarySection,

      totalCoupons: enriched.length,
      lastScannedCoupon: latest?.CouponCode ?? null,
      lastScannedAt: latest?.ScannedAt ?? null,

      totalWorkOrders,
      recentWorkOrder: latest?.WorkOrder ?? null,
      recentCutNo: latest?.CutNo != null ? String(latest.CutNo) : null,
      recentBundleNo: latest?.BundleNo != null ? String(latest.BundleNo) : null,
      recentOperationName: latest?.OperationName != null ? String(latest.OperationName) : null,
      recentOperationCode: latest?.OprCode ?? latest?.OpNo ?? null,

      totalAmount,
      totalQty,
      totalSam,
      avgRatePerPiece,

      operations,
      workOrders,
      coupons: couponItems,
    });
  } catch (err: unknown) {
    console.error("Employee report API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
