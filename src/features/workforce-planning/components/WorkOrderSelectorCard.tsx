"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Layers,
  Scissors,
  Sparkles,
  Search,
  Package,
  ChevronDown,
  Check,
  Building,
} from "lucide-react";
import type { AvailableWorkOrder } from "../types";

interface WorkOrderSelectorCardProps {
  orders: AvailableWorkOrder[];
  selectedOrder: string;
  onSelectOrder: (orderNo: string) => void;
  isLoading: boolean;
  plannedQuantity?: number;
}

export function WorkOrderSelectorCard({
  orders,
  selectedOrder,
  onSelectOrder,
  isLoading,
  plannedQuantity,
}: WorkOrderSelectorCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = orders.find((o) => o.workOrder === selectedOrder);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter orders by search term
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const query = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        o.workOrder.toLowerCase().includes(query) ||
        (o.customerName && o.customerName.toLowerCase().includes(query)) ||
        (o.saleOrderNo && o.saleOrderNo.toLowerCase().includes(query))
    );
  }, [orders, searchTerm]);

  const handleSelect = (wo: string) => {
    onSelectOrder(wo);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
              Target Style Bulletin & Work Order
            </h2>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Select or search an active manufacturing order to balance production line and optimize operator allocation
          </p>
        </div>

        {/* Searchable Dropdown */}
        <div className="w-full md:w-80 relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={isLoading || orders.length === 0}
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) {
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold bg-[#f8fafc] border border-[#cbd5e1] hover:border-indigo-400 rounded-xl text-[#0f172a] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50 text-left shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              {active ? (
                <span className="truncate">
                  <span className="font-bold text-[#0f172a]">{active.workOrder}</span>
                  {active.customerName && (
                    <span className="text-[#64748b] ml-1.5 font-normal">
                      — {active.customerName}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[#94a3b8]">
                  {isLoading ? "Loading work orders..." : "Search / Select Work Order..."}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[#94a3b8] shrink-0 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-indigo-600" : ""
              }`}
            />
          </button>

          {/* Search Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-full sm:w-96 bg-white rounded-2xl shadow-xl border border-[#e2e8f0] p-2 z-50 animate-fade-in divide-y divide-[#f1f5f9]">
              {/* Search input field inside dropdown */}
              <div className="p-1 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type to search Work Order or Customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              {/* Order options list */}
              <div className="max-h-64 overflow-y-auto p-1 space-y-1 scrollbar-thin">
                {filteredOrders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#94a3b8]">
                    No work orders found matching &ldquo;{searchTerm}&rdquo;
                  </div>
                ) : (
                  filteredOrders.map((o) => {
                    const isSelected = o.workOrder === selectedOrder;
                    return (
                      <button
                        key={o.workOrder}
                        type="button"
                        onClick={() => handleSelect(o.workOrder)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold"
                            : "hover:bg-[#f8fafc] text-[#334155]"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#0f172a]">
                              {o.workOrder}
                            </span>
                            <span className="text-[10px] bg-white border border-[#e2e8f0] text-indigo-700 px-1.5 py-0.2 rounded-md font-semibold shrink-0">
                              {o.totalOperations} ops
                            </span>
                          </div>
                          {o.customerName && (
                            <span className="text-[11px] text-[#64748b] truncate mt-0.5 flex items-center gap-1">
                              <Building className="w-3 h-3 text-[#94a3b8] shrink-0" />
                              {o.customerName}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span className="p-1 rounded-full bg-indigo-600 text-white shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {active && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#f1f5f9]">
            <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block">
              Customer / Brand
            </span>
            <span className="text-xs font-bold text-[#0f172a] truncate block mt-0.5">
              {active.customerName || "Standard Export"}
            </span>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#f1f5f9]">
            <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block">
              Operations Count
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-bold text-[#0f172a]">
                {active.totalOperations} Operations
              </span>
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#f1f5f9]">
            <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block">
              Total Garment SMV
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Scissors className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-bold text-[#0f172a]">
                {active.totalSmv} min / piece
              </span>
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#f1f5f9]">
            <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block">
              Order Planned Batch
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-[#0f172a]">
                {(plannedQuantity || active.totalCutQuantity || 1200).toLocaleString()} Pcs
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
