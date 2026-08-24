"use client";

import { useQrCodeGenerationFacade } from "../hooks/useQrCodeGenerationFacade";
import { ParametersPanel } from "./ParametersPanel";
import { OperationsDetailTable } from "./OperationsDetailTable";
import { BundleDetailTable } from "./BundleDetailTable";
import { StyleSearchModal } from "./StyleSearchModal";
import { PageSetupModal } from "./PageSetupModal";
import { GenerateCouponsModal } from "./GenerateCouponsModal";
import { CodeTypeSelectionModal } from "./CodeTypeSelectionModal";
import { Loader2 } from "lucide-react";

export function QrCodeGenerationView() {
  const facade = useQrCodeGenerationFacade();

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-345 mx-auto text-xs text-[#334155] animate-fade-in relative pb-16">

        {/* Main Parameters Panel */}
        <ParametersPanel
          activeStyle={facade.activeStyle}
          onWorkOrderInputChange={facade.handleWorkOrderInputChange}
          onOpenSearchModal={facade.openSearchModal}
          onOpenPageSetupModal={() => facade.setShowCodeTypeModal(true)}
          onFieldChange={facade.handleFieldChange}
          onGenerateCoupons={facade.handleGenerateCoupons}
          generatingCoupons={facade.generatingCoupons}
          customersList={facade.customersList}
          workersList={facade.workersList}
          isSelectionGenerated={facade.isSelectionGenerated}
        />

        {/* Main Grid: Bundle Detail (left) + Operations (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          <BundleDetailTable
            bundles={facade.activeStyle.bundles}
            reworkQtyBundle={facade.activeStyle.reworkQtyBundle}
            subTotal={facade.activeStyle.subTotal}
            total={facade.activeStyle.total}
            onBundleSelChange={facade.handleBundleSelChange}
            onAllBundlesSelChange={facade.handleAllBundlesSelChange}
            onReworkQtyBundleChange={facade.handleReworkQtyBundleChange}
          />

          <OperationsDetailTable
            operations={facade.activeStyle.operations}
            remarks={facade.activeStyle.remarks}
            reworkQtyMain={facade.activeStyle.reworkQtyMain}
            onOperationChange={facade.handleOperationChange}
            onAllOperationsSelChange={facade.handleAllOperationsSelChange}
            onRemarksChange={(v) => facade.handleFieldChange("remarks", v)}
            onReworkQtyMainChange={(v) =>
              facade.handleFieldChange("reworkQtyMain", v)
            }
          />
        </div>

        {/* Footer bar */}
        <footer className="fixed bottom-0 left-0 right-0 bg-[#f8fafc] border-t border-[#e2e8f0] px-6 py-2.5 flex items-center justify-between text-[11px] text-[#64748b] font-semibold z-35">
          <div>
            Record: <span className="text-[#334155]">1/1</span> | Choices in
            list: <span className="text-[#334155]">1</span> | Choices in full
            list: <span className="text-[#334155]">36863</span>
          </div>
          <div>
            <span>Enter-Query</span>
          </div>
          <div className="flex gap-4">
            <span className="font-bold text-[#475569]">&lt;OSC&gt;</span>
            <span className="font-bold text-[#475569]">&lt;DBG&gt;</span>
          </div>
        </footer>

        {/* Search Modal */}
        {facade.showSearchModal && (
          <StyleSearchModal
            searchQuery={facade.searchQuery}
            onSearchQueryChange={facade.setSearchQuery}
            filteredStyles={facade.filteredStyles}
            allStyles={facade.filteredStyles}
            selectedIdx={facade.selectedIdx}
            onSelectIdx={facade.setSelectedIdx}
            onConfirm={facade.handleModalSearch}
            onClose={() => facade.setShowSearchModal(false)}
          />
        )}
      </div>

      {/* Page Setup Modal */}
      {facade.showPageSetupModal && (
        <PageSetupModal
          pageSetup={facade.pageSetup}
          onPageSetupChange={facade.setPageSetup}
          onClose={() => facade.setShowPageSetupModal(false)}
          onGeneratePdf={facade.handleGeneratePdf}
          generatingPdf={facade.generatingPdf}
        />
      )}

      {/* Code Type Selection Modal */}
      <CodeTypeSelectionModal
        isOpen={facade.showCodeTypeModal}
        onClose={() => facade.setShowCodeTypeModal(false)}
        onSelect={(type) => {
          facade.setPageSetup({ ...facade.pageSetup, codeType: type });
          facade.setShowCodeTypeModal(false);
          facade.setShowPageSetupModal(true);
        }}
      />

      {/* Generate Coupons Modal */}
      {facade.showGenerateModal && (
        <GenerateCouponsModal
          state={facade.generateModalState}
          selectedBundlesCount={facade.activeStyle.bundles.filter((b) => b.sel).length}
          selectedOperationsCount={facade.activeStyle.operations.filter((op) => op.lastOpSection).length}
          generatedCount={facade.generatedCount}
          errorMessage={facade.couponModalError}
          onClose={() => facade.setShowGenerateModal(false)}
          onConfirm={facade.confirmGenerateCoupons}
        />
      )}

      {/* Generating PDF Loader Overlay */}
      {facade.generatingPdf && (
        <div className="fixed inset-0 bg-[#0f172a]/30 backdrop-blur-sm flex flex-col items-center justify-center z-[9999] animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] flex flex-col items-center max-w-[280px] text-center">
            <Loader2 className="w-8 h-8 text-[#4f46e5] animate-spin mb-3" />
            <h4 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-wider mb-1">Generating PDF...</h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">Preparing coupon sheets. Please wait.</p>
          </div>
        </div>
      )}
    </>
  );
}
