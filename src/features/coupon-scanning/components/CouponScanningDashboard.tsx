"use client";

import { useEffect } from "react";
import { useCouponScanning } from "@/features/coupon-scanning/hooks/useCouponScanning";
import { InformationPanel } from "@/features/coupon-scanning/components/InformationPanel";
import { ScanningDetailsTable } from "@/features/coupon-scanning/components/ScanningDetailsTable";
import { ScanModals } from "@/features/coupon-scanning/components/ScanModals";
import { format } from "date-fns";

export function CouponScanningDashboard() {
  const couponScanning = useCouponScanning();
  const {
    employeeCode,
    employeeName,
    department,
    designation,
    dated,
    shift,
    section,
    lineId,
    scanBy,
    rows,
  } = couponScanning;

  useEffect(() => {
    if (employeeName && dated) {
      const inputEl = document.getElementById("scanner-input");
      if (inputEl) {
        inputEl.focus();
      }
    }
  }, [employeeName, dated]);

  const scannedCoupons = rows.filter((row) => row.barCode && row.scanned);

  const scannedTotalQty = scannedCoupons.reduce((sum, row) => sum + (parseInt(row.qty, 10) || 0), 0);
  const scannedTotalRecords = scannedCoupons.length;
  const scannedTotalSam = scannedCoupons.reduce((sum, row) => sum + (parseFloat(row.smv) || 0), 0).toFixed(2);
  const scannedTotalValue = scannedCoupons.reduce((sum, row) => sum + (parseFloat(row.value) || 0), 0).toFixed(2);

  return (
    <>
      <div className="flex flex-col gap-6 w-full text-xs text-[#334155] animate-fade-in pb-16 px-4 max-w-350 mx-auto no-print">
        <InformationPanel {...couponScanning} />
        <ScanningDetailsTable {...couponScanning} />
        <ScanModals {...couponScanning} />
      </div>

      {/* Print-only container */}
      <div className="hidden print-only print-container">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold uppercase tracking-wider">Scanned Coupons Report</h1>
          <p className="text-[10px] text-gray-500 mt-1">
            Generated on {format(new Date(), "dd-MM-yyyy HH:mm:ss")}
          </p>
        </div>

        {/* Metadata section */}
        <table className="print-header-table">
          <tbody>
            <tr>
              <td style={{ width: "33%" }}>
                <strong>Employee:</strong> {employeeCode ? `${employeeCode} - ${employeeName}` : "N/A"}
              </td>
              <td style={{ width: "33%" }}>
                <strong>Department:</strong> {department || "N/A"}
              </td>
              <td style={{ width: "33%" }}>
                <strong>Designation:</strong> {designation || "N/A"}
              </td>
            </tr>
            <tr>
              <td>
                <strong>Dated:</strong> {dated ? format(new Date(dated), "dd-MM-yyyy") : "N/A"}
              </td>
              <td>
                <strong>Shift:</strong> {shift || "N/A"}
              </td>
              <td>
                <strong>Section / Line:</strong> {section || "N/A"} {lineId ? `/ Line ${lineId}` : ""}
              </td>
            </tr>
            <tr>
              <td colSpan={3}>
                <strong>Scan By:</strong> {scanBy || "N/A"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Coupons table */}
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }} className="text-center">#</th>
              <th>Coupon Code</th>
              <th>W/O #</th>
              <th className="text-center">Cut #</th>
              <th className="text-center">Bundle #</th>
              <th className="text-center">Inseam</th>
              <th className="text-center">Size #</th>
              <th>Section Name</th>
              <th>Operation Name</th>
              <th style={{ width: "50px" }} className="text-center">Qty</th>
              <th style={{ width: "50px" }} className="text-center">SMV</th>
              <th style={{ width: "60px" }} className="text-center">Rate</th>
              <th style={{ width: "70px" }} className="text-center">Value</th>
            </tr>
          </thead>
          <tbody>
            {scannedCoupons.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-4 font-bold text-gray-400">
                  No scanned coupons available for print.
                </td>
              </tr>
            ) : (
              scannedCoupons.map((row, idx) => (
                <tr key={row.barCode || idx}>
                  <td className="text-center">{idx + 1}</td>
                  <td className="font-mono">{row.barCode}</td>
                  <td>{row.anlCode || "-"}</td>
                  <td className="text-center">{row.cutNo || "-"}</td>
                  <td className="text-center">{row.bundleNo || "-"}</td>
                  <td className="text-center">{row.inseam || "-"}</td>
                  <td className="text-center">{row.sizeCode || "-"}</td>
                  <td>{row.sectionName || "-"}</td>
                  <td>{row.operationName || "-"}</td>
                  <td className="text-center">{row.qty || "0"}</td>
                  <td className="text-center">{row.smv || "0.00"}</td>
                  <td className="text-center">{row.rate || "0.00"}</td>
                  <td className="text-center">{row.value || "0.00"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Summary block */}
        <table className="print-summary-table">
          <tbody>
            <tr>
              <td style={{ width: "25%" }}>
                TOTAL QTY: {scannedTotalQty}
              </td>
              <td style={{ width: "25%" }}>
                TOTAL RECORDS: {scannedTotalRecords}
              </td>
              <td style={{ width: "25%" }}>
                TOTAL SAM: {scannedTotalSam}
              </td>
              <td style={{ width: "25%" }}>
                TOTAL VALUE: {scannedTotalValue}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
          .print-container {
            width: 100%;
            font-family: Arial, sans-serif;
            color: black;
          }
          .print-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            border: 1.5px solid #000;
          }
          .print-header-table td {
            padding: 6px 10px;
            border: 1px solid #000;
            vertical-align: top;
            font-size: 11px;
            line-height: 1.4;
            color: black !important;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            color: black !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #000;
            padding: 5px;
            text-align: left;
            color: black !important;
          }
          .print-table th {
            background-color: #cbd5e1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: bold;
          }
          .print-table td.text-right {
            text-align: right;
          }
          .print-table td.text-center, .print-table th.text-center {
            text-align: center;
          }
          .print-summary-table {
            width: 100%;
            margin-top: 15px;
            border-collapse: collapse;
            font-size: 11px;
            color: black !important;
          }
          .print-summary-table td {
            padding: 6px 10px;
            border: 1.5px solid #000;
            font-weight: bold;
            color: black !important;
          }
        }
      `}</style>
    </>
  );
}
