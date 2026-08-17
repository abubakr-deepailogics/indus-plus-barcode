"use client";

import React, { useState } from "react";
import type { OperationsDetailRow } from "../types";

interface OperationsDetailTableProps {
  operations: OperationsDetailRow[];
  remarks: string;
  reworkQtyMain: string;
  onOperationChange: (id: number, field: string, value: boolean) => void;
  onAllOperationsSelChange: (checked: boolean) => void;
  onRemarksChange: (value: string) => void;
  onReworkQtyMainChange: (value: string) => void;
}

export function OperationsDetailTable({
  operations,
  remarks,
  reworkQtyMain,
  onOperationChange,
  onAllOperationsSelChange,
  onRemarksChange,
  onReworkQtyMainChange,
}: OperationsDetailTableProps) {
  const [isSectionWise, setIsSectionWise] = useState(false);

  return (
    <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
        <h3 className="text-sm font-extrabold text-[#4f46e5]">Operations Detail</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Complete selection
            </span>
            <input
              type="checkbox"
              onChange={(e) => {
                onAllOperationsSelChange(e.target.checked);
              }}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Section Wise selection
            </span>
            <input
              type="checkbox"
              checked={isSectionWise}
              onChange={(e) => setIsSectionWise(e.target.checked)}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">
                Section
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Seq #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Op #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">
                Operation
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                SMV
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Rate
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Inc.
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Sdl#
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Last Op Selection
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {operations.map((op) => (
              <tr key={op.id} className="hover:bg-[#f8fafc] border-b border-[#f1f5f9] transition-colors text-[11px] font-semibold text-slate-700">
                <td className="py-2.5 text-left text-[#64748b] font-bold uppercase">
                  {op.section}
                </td>
                <td className="py-2.5 text-center text-[#4f46e5] font-bold">
                  {op.seqNo}
                </td>
                <td className="py-2.5 text-center text-purple-600 font-bold font-mono">
                  {op.opNo}
                </td>
                <td className="py-2.5 text-left text-slate-800 font-medium">
                  {op.operationName}
                </td>
                <td className="py-2.5 text-center font-bold text-slate-700">
                  {op.smv}
                </td>
                <td className="py-2.5 text-center font-bold text-slate-700">
                  {op.rate}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-medium">
                  {op.inc || "-"}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-medium">
                  {op.sdl || "-"}
                </td>
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={op.lastOpSection}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      if (isSectionWise) {
                        operations.forEach((opItem) => {
                          if (opItem.section === op.section) {
                            onOperationChange(opItem.id, "lastOpSection", isChecked);
                          }
                        });
                      } else {
                        onOperationChange(op.id, "lastOpSection", isChecked);
                      }
                    }}
                    className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-[#f1f5f9] pt-4 mt-1">
        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            Remarks
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => onRemarksChange(e.target.value)}
            placeholder="Enter remarks (optional)"
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5 w-32 self-end">
          <label className="font-bold text-[#475569] text-[11px]">
            Rework Qty
          </label>
          <input
            type="text"
            value={reworkQtyMain}
            onChange={(e) => onReworkQtyMainChange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
          />
        </div>
      </div>
    </div>
  );
}
