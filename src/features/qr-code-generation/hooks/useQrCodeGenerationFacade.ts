"use client";

import { useState, useMemo } from "react";
import type { QrCodeStyleData, PageSetupConfig } from "../types";
import { MOCK_QR_CODE_STYLES } from "../data/mock-qr-code-styles";
import { useGenerateCouponPdf } from "./useGenerateCouponPdf";

interface QrCodeGenerationFacade {
  activeStyle: QrCodeStyleData;
  showSearchModal: boolean;
  searchQuery: string;
  selectedIdx: number;
  showPageSetupModal: boolean;
  pageSetup: PageSetupConfig;
  filteredStyles: QrCodeStyleData[];
  handleModalSearch: () => void;
  handleAnlInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSearchQuery: (value: string) => void;
  setSelectedIdx: (idx: number) => void;
  setShowSearchModal: (show: boolean) => void;
  setShowPageSetupModal: (show: boolean) => void;
  setPageSetup: (config: PageSetupConfig) => void;
  openSearchModal: () => void;
  handleFieldChange: (field: keyof QrCodeStyleData, value: string) => void;
  handleOperationChange: (id: number, field: string, value: boolean) => void;
  handleBundleSelChange: (id: number, checked: boolean) => void;
  handleReworkQtyBundleChange: (value: string) => void;
  handlePrint: () => void;
  handleGeneratePdf: () => Promise<void>;
  generatingPdf: boolean;
}

export function useQrCodeGenerationFacade(): QrCodeGenerationFacade {
  const [activeStyle, setActiveStyle] = useState<QrCodeStyleData>(
    MOCK_QR_CODE_STYLES[0],
  );
  const [showSearchModal, setShowSearchModal] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
  });

  const filteredStyles = useMemo(
    () =>
      MOCK_QR_CODE_STYLES.filter(
        (s) =>
          s.anlNo.includes(searchQuery) ||
          s.styleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.customer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery],
  );

  const handleModalSearch = () => {
    setActiveStyle(MOCK_QR_CODE_STYLES[selectedIdx]);
    setShowSearchModal(false);
  };

  const handleAnlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const found = MOCK_QR_CODE_STYLES.find((s) => s.anlNo === value);
    if (found) {
      setActiveStyle(found);
    } else {
      setActiveStyle((prev) => ({ ...prev, anlNo: value }));
    }
  };

  const openSearchModal = () => {
    setSearchQuery("");
    setShowSearchModal(true);
  };

  const handleFieldChange = (field: keyof QrCodeStyleData, value: string) => {
    setActiveStyle((prev) => ({ ...prev, [field]: value }));
  };

  const handleOperationChange = (id: number, field: string, value: boolean) => {
    const updated = activeStyle.operations.map((o) =>
      o.id === id ? { ...o, [field]: value } : o,
    );
    setActiveStyle((prev) => ({ ...prev, operations: updated }));
  };

  const handleBundleSelChange = (id: number, checked: boolean) => {
    const updated = activeStyle.bundles.map((b) =>
      b.id === id ? { ...b, sel: checked } : b,
    );
    setActiveStyle((prev) => ({ ...prev, bundles: updated }));
  };

  const handleReworkQtyBundleChange = (value: string) => {
    setActiveStyle((prev) => ({ ...prev, reworkQtyBundle: value }));
  };

  const handlePrint = () => {
    setShowPageSetupModal(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const { handleGeneratePdf: generatePdf, generatingPdf } = useGenerateCouponPdf(activeStyle);
  const handleGeneratePdf = async () => {
    await generatePdf();
    setShowPageSetupModal(false);
  };

  return {
    activeStyle,
    showSearchModal,
    searchQuery,
    selectedIdx,
    showPageSetupModal,
    pageSetup,
    filteredStyles,
    handleModalSearch,
    handleAnlInputChange,
    setSearchQuery,
    setSelectedIdx,
    setShowSearchModal,
    setShowPageSetupModal,
    setPageSetup,
    openSearchModal,
    handleFieldChange,
    handleOperationChange,
    handleBundleSelChange,
    handleReworkQtyBundleChange,
    handlePrint,
    handleGeneratePdf,
    generatingPdf,
  };
}
