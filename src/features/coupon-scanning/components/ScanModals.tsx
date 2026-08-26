"use client";

import type { useCouponScanning } from "../hooks/useCouponScanning";

type Facade = ReturnType<typeof useCouponScanning>;

export function ScanModals(props: Facade) {
  const {
    showConfirmModal,
    setShowConfirmModal,
    rows,
    employeeCode,
    executeScanCoupon,
    showSuccessModal,
    setShowSuccessModal,
    successMessage,
    showErrorModal,
    setShowErrorModal,
    errorMessage,
  } = props;

  return (
    <>
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 animate-scale-up">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5 text-indigo-600">
              <span>🔍</span> Confirm Coupon Scan
            </h3>
            <div className="text-xs text-slate-600 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2">
              <div>
                <strong className="text-slate-800">Coupons to scan:</strong>{" "}
                {rows.filter((row) => row.barCode && !row.scanned).length}
              </div>
              <div>
                <strong className="text-slate-800">Employee Code:</strong>{" "}
                {employeeCode}
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to scan these coupons? This will update the
              database records.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeScanCoupon}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Confirm Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ✓
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Scan Successful
            </h3>
            <p className="text-xs text-slate-500 mb-6">{successMessage}</p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Scan Error
            </h3>
            <p className="text-xs text-rose-600 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50 mb-6 font-semibold">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setShowErrorModal(false)}
              className="w-full py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
