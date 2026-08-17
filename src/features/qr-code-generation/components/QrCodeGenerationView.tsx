"use client";

import { useQrCodeGenerationFacade } from "../hooks/useQrCodeGenerationFacade";
import { ParametersPanel } from "./ParametersPanel";
import { OperationsDetailTable } from "./OperationsDetailTable";
import { BundleDetailTable } from "./BundleDetailTable";
import { StyleSearchModal } from "./StyleSearchModal";
import { PageSetupModal } from "./PageSetupModal";

export function QrCodeGenerationView() {
  const facade = useQrCodeGenerationFacade();

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-345 mx-auto text-xs text-[#334155] animate-fade-in relative pb-16">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
            <span>Industrial Engineering</span>
            <span className="text-[#94a3b8] font-light">/</span>
            <span className="text-[#4f46e5] font-bold">
              QR Code Generation
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
              QR Code Generation
            </h1>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Generate and manage QR code finishing bundles
            </p>
          </div>
        </div>

        {/* Main Parameters Panel */}
        <ParametersPanel
          activeStyle={facade.activeStyle}
          onWorkOrderInputChange={facade.handleWorkOrderInputChange}
          onOpenSearchModal={facade.openSearchModal}
          onOpenPageSetupModal={() => facade.setShowPageSetupModal(true)}
          onFieldChange={facade.handleFieldChange}
          onGenerateCoupons={facade.handleGenerateCoupons}
          generatingCoupons={facade.generatingCoupons}
          customersList={facade.customersList}
          workersList={facade.workersList}
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
    </>
  );
}
