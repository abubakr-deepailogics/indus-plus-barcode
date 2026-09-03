import { getPool, sql, CUT_DETAIL_VIEW } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CutReportInfo {
  customer: string | null;
  saleOrderNo: string | null;
}

async function fetchCutReportInfo(
  workOrders: string[],
): Promise<Map<string, CutReportInfo>> {
  if (workOrders.length === 0) return new Map();
  const pool = await getPool("indusPlus");
  const request = pool.request();
  const placeholders = workOrders.map((wo, i) => {
    request.input(`wo${i}`, sql.NVarChar, wo);
    return `@wo${i}`;
  });
  const result = await request.query(`
    SELECT DISTINCT
      [Work Order #] AS workOrder,
      [Customer Name] AS customer,
      [Sale Order No] AS saleOrderNo
    FROM ${CUT_DETAIL_VIEW}
    WHERE [Work Order #] IN (${placeholders.join(", ")})
  `);
  return new Map(
    result.recordset.map((r) => [
      r.workOrder as string,
      { customer: r.customer, saleOrderNo: r.saleOrderNo },
    ]),
  );
}

// Backs the shared Work Order search modal (src/components/work-order-search-modal.tsx)
// for Coupon Tracing — scoped to dbo.QrCode_Coupon (pitSystem), i.e. only
// work orders that actually have generated coupons, same scope as the
// existing ?only_generated=true branch of /api/open-order/suggestions.
//
// Customer/Sale Order No are always filled in from indusPlus's cut-detail
// view for display, but which query resolves the work order LIST differs:
// - customer/sale-order search present: indusPlus resolves the candidate
//   work orders first (it's the only side that has those columns to filter
//   on), then intersected against QrCode_Coupon so only work orders that
//   actually have generated coupons come back.
// - plain (or empty) work-order search: QrCode_Coupon resolves the list
//   directly (the common, cheap case), then indusPlus is queried once more
//   just to label those same ≤40 rows with Customer/Sale Order No.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();
  const customer = (searchParams.get("customer") || "").trim();
  const saleOrderNo = (searchParams.get("sale_order_no") || "").trim();

  try {
    const pitPool = await getPool("pitSystem");

    if (customer || saleOrderNo) {
      const indusPool = await getPool("indusPlus");
      const indusRequest = indusPool.request();
      const conditions: string[] = [];
      if (workOrder) {
        indusRequest.input("workOrder", sql.NVarChar, `%${workOrder}%`);
        conditions.push("[Work Order #] LIKE @workOrder");
      }
      if (customer) {
        indusRequest.input("customer", sql.NVarChar, `%${customer}%`);
        conditions.push("UPPER([Customer Name]) LIKE UPPER(@customer)");
      }
      if (saleOrderNo) {
        indusRequest.input("saleOrderNo", sql.NVarChar, `%${saleOrderNo}%`);
        conditions.push("[Sale Order No] LIKE @saleOrderNo");
      }

      const candidates = await indusRequest.query(`
        SELECT DISTINCT TOP 200
          [Work Order #] AS workOrder,
          [Customer Name] AS customer,
          [Sale Order No] AS saleOrderNo
        FROM ${CUT_DETAIL_VIEW}
        WHERE ${conditions.join(" AND ")}
        ORDER BY [Work Order #] DESC
      `);
      if (candidates.recordset.length === 0) return Response.json([]);

      const infoByWorkOrder = new Map<string, CutReportInfo>(
        candidates.recordset.map((r) => [
          r.workOrder as string,
          { customer: r.customer, saleOrderNo: r.saleOrderNo },
        ]),
      );

      const pitRequest = pitPool.request();
      const placeholders = candidates.recordset.map((r, i) => {
        pitRequest.input(`wo${i}`, sql.NVarChar, r.workOrder);
        return `@wo${i}`;
      });
      const matched = await pitRequest.query(`
        SELECT DISTINCT TOP 40 WorkOrder
        FROM dbo.QrCode_Coupon
        WHERE WorkOrder IN (${placeholders.join(", ")})
        ORDER BY WorkOrder DESC
      `);

      const rows = matched.recordset.map((r) => {
        const info = infoByWorkOrder.get(r.WorkOrder as string);
        return {
          workOrder: r.WorkOrder as string,
          customer: info?.customer ?? null,
          saleOrderNo: info?.saleOrderNo ?? null,
        };
      });
      return Response.json(rows);
    }

    const request_ = pitPool.request();
    if (workOrder) {
      request_.input("workOrder", sql.NVarChar, `%${workOrder}%`);
    }
    const result = await request_.query(`
      SELECT DISTINCT TOP 40 WorkOrder AS workOrder
      FROM dbo.QrCode_Coupon
      ${workOrder ? "WHERE WorkOrder LIKE @workOrder" : ""}
      ORDER BY WorkOrder ${workOrder ? "ASC" : "DESC"}
    `);

    const infoByWorkOrder = await fetchCutReportInfo(
      result.recordset.map((r) => r.workOrder as string),
    );
    const rows = result.recordset.map((r) => {
      const info = infoByWorkOrder.get(r.workOrder as string);
      return {
        workOrder: r.workOrder as string,
        customer: info?.customer ?? null,
        saleOrderNo: info?.saleOrderNo ?? null,
      };
    });

    return Response.json(rows);
  } catch (err: unknown) {
    console.error("Coupon work orders search API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
