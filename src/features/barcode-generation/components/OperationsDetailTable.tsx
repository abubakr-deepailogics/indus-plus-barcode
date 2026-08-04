"use client";

import React from "react";
import type { OperationsDetailRow } from "../types";

interface OperationsDetailTableProps {
  operations: OperationsDetailRow[];
  remarks: string;
  reworkQtyMain: string;
  onOperationChange: (id: number, field: string, value: boolean) => void;
  onRemarksChange: (value: string) => void;
  onReworkQtyMainChange: (value: string) => void;
}

export function OperationsDetailTable({
  operations,
  remarks,
  reworkQtyMain,
  onOperationChange,
  onRemarksChange,
  onReworkQtyMainChange,
}: OperationsDetailTableProps) {
  return (
    <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <h3 className="text-sm font-extrabold text-[#4f46e5] border-b border-[#f1f5f9] pb-2">
        Operations Detail
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Section
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Seq #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Op #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Operation
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                SMV
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Rate
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Skills
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Last Op Section
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {operations.map((op) => (
              <tr
                key={op.id}
                className="hover:bg-[#f8fafc] transition-colors"
              >
                <td className="py-2">
                  <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none">
                    <option value={op.section}>
                      {op.section || "Select"}
                    </option>
                    <option value="500 - PRE FINISHING">
                      500 - PRE FINISHING
                    </option>
                    <option value="501 - FINISHING">
                      501 - FINISHING
                    </option>
                    <option value="502 - PACKING">502 - PACKING</option>
                  </select>
                </td>
                <td className="py-2 text-center">
                  <input
                    type="text"
                    value={op.seqNo}
                    readOnly
                    className="w-10 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 text-center font-bold text-[#64748b]">
                  <input
                    type="text"
                    value={op.opNo}
                    readOnly
                    className="w-14 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    value={op.operationName}
                    readOnly
                    className="w-full px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 text-center font-semibold">
                  <input
                    type="text"
                    value={op.smv}
                    readOnly
                    className="w-12 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 text-center font-semibold">
                  <input
                    type="text"
                    value={op.rate}
                    readOnly
                    className="w-12 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2">
                  <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none font-semibold">
                    <option value={op.skills}>{op.skills}</option>
                    <option value="Skilled">Skilled</option>
                    <option value="Semi-Skilled">Semi-Skilled</option>
                    <option value="Un-Skilled">Un-Skilled</option>
                  </select>
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={op.lastOpSection}
                    onChange={(e) =>
                      onOperationChange(op.id, "lastOpSection", e.target.checked)
                    }
                    className="rounded border-[#e2e8f0] text-[#4f46e5]"
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
