"use client";

import { useState, useMemo } from "react";
import type { StyleBulletinData } from "../types";
import { MOCK_BULLETIN_STYLES } from "../data/mock-bulletin-styles";

interface OrderStyleBulletinFacade {
  activeData: StyleBulletinData;
  showSearchModal: boolean;
  findQuery: string;
  selectedModalIndex: number;
  filteredModalStyles: StyleBulletinData[];
  allStyles: StyleBulletinData[];
  handleSelectRow: () => void;
  handleStyleDropdownChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleAMNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAttachFile: (e: React.ChangeEvent<HTMLInputElement>, rowId: number) => void;
  handleRemoveAttachment: (rowId: number) => void;
  setActiveData: React.Dispatch<React.SetStateAction<StyleBulletinData>>;
  setShowSearchModal: (show: boolean) => void;
  setFindQuery: (query: string) => void;
  setSelectedModalIndex: (idx: number) => void;
  openSearchModal: () => void;
  updateField: (field: keyof StyleBulletinData, value: string) => void;
  updateOperationField: (rowId: number, field: string, value: string | boolean) => void;
}

export function useOrderStyleBulletinFacade(): OrderStyleBulletinFacade {
  const [activeData, setActiveData] = useState<StyleBulletinData>(MOCK_BULLETIN_STYLES[0]);
  const [showSearchModal, setShowSearchModal] = useState(true);
  const [findQuery, setFindQuery] = useState("");
  const [selectedModalIndex, setSelectedModalIndex] = useState(0);

  const filteredModalStyles = useMemo(
    () =>
      MOCK_BULLETIN_STYLES.filter(
        (style) =>
          style.amNo.toLowerCase().includes(findQuery.replace("%", "").toLowerCase()) ||
          style.styleCode.toLowerCase().includes(findQuery.replace("%", "").toLowerCase()),
      ),
    [findQuery],
  );

  const handleSelectRow = () => {
    setActiveData(MOCK_BULLETIN_STYLES[selectedModalIndex]);
    setShowSearchModal(false);
  };

  const handleStyleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const matched = MOCK_BULLETIN_STYLES.find((style) => style.styleCode === e.target.value);
    if (matched) {
      setActiveData(matched);
    }
  };

  const handleAMNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const matched = MOCK_BULLETIN_STYLES.find((style) => style.amNo === value);
    if (matched) {
      setActiveData(matched);
    } else {
      setActiveData((prev) => ({ ...prev, amNo: value }));
    }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>, rowId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const updatedOps = activeData.operations.map((o) =>
        o.id === rowId ? { ...o, attachedFileName: file.name } : o,
      );
      setActiveData({ ...activeData, operations: updatedOps });
    }
  };

  const handleRemoveAttachment = (rowId: number) => {
    const updatedOps = activeData.operations.map((o) =>
      o.id === rowId ? { ...o, attachedFileName: undefined } : o,
    );
    setActiveData({ ...activeData, operations: updatedOps });
  };

  const openSearchModal = () => {
    setFindQuery("");
    setShowSearchModal(true);
  };

  const updateField = (field: keyof StyleBulletinData, value: string) => {
    setActiveData((prev) => ({ ...prev, [field]: value }));
  };

  const updateOperationField = (rowId: number, field: string, value: string | boolean) => {
    const updatedOps = activeData.operations.map((o) =>
      o.id === rowId ? { ...o, [field]: value } : o,
    );
    setActiveData((prev) => ({ ...prev, operations: updatedOps }));
  };

  return {
    activeData,
    showSearchModal,
    findQuery,
    selectedModalIndex,
    filteredModalStyles,
    allStyles: MOCK_BULLETIN_STYLES,
    handleSelectRow,
    handleStyleDropdownChange,
    handleAMNumberChange,
    handleAttachFile,
    handleRemoveAttachment,
    setActiveData,
    setShowSearchModal,
    setFindQuery,
    setSelectedModalIndex,
    openSearchModal,
    updateField,
    updateOperationField,
  };
}
