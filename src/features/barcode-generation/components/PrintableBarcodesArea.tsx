"use client";

import React from "react";
import type { BarcodeStyleData, BundleDetailRow, OperationsDetailRow, PageSetupConfig } from "../types";
import { BarcodeCard } from "./BarcodeCard";

interface PrintableBarcodesAreaProps {
  activeStyle: BarcodeStyleData;
  pageSetup: PageSetupConfig;
}

export function PrintableBarcodesArea({
  activeStyle,
  pageSetup,
}: PrintableBarcodesAreaProps) {
  const selectedBundles = activeStyle.bundles.filter((b) => b.sel);
  const hasContent = selectedBundles.length > 0 && activeStyle.operations.length > 0;

  if (!hasContent) {
    return (
      <div id="printable-barcode-area" className="hidden print:block">
        <div className="p-8 text-center text-gray-500 font-bold border border-gray-300 rounded">
          No bundles selected or no operations found to print barcodes.
        </div>
      </div>
    );
  }

  const totalCardsList = selectedBundles.flatMap((bundle) =>
    activeStyle.operations.map((op) => ({ bundle, op })),
  );

  const [gridCols, gridRows] = pageSetup.gridFormat
    .split("x")
    .map(Number);
  const cardsPerPage = gridCols * gridRows;

  const pages: Array<
    Array<{
      bundle: BundleDetailRow;
      op: OperationsDetailRow;
      globalIndex: number;
    }>
  > = [];

  for (let i = 0; i < totalCardsList.length; i += cardsPerPage) {
    pages.push(
      totalCardsList
        .slice(i, i + cardsPerPage)
        .map((item, localIdx) => ({
          ...item,
          globalIndex: i + localIdx + 1,
        })),
    );
  }

  const getPageHeight = (): string => {
    if (pageSetup.size === "Letter") return "9.8in";
    if (pageSetup.size === "A4") return "268mm";
    if (pageSetup.size === "Legal") return "12.8in";
    return "9.8in";
  };

  return (
    <div id="printable-barcode-area" className="hidden print:block">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            #printable-barcode-area {
              display: block !important;
              width: 100% !important;
            }
            @page {
              size: ${pageSetup.size === "4x6 Label" ? "4in 6in" : pageSetup.size.toLowerCase()} ${pageSetup.orientation.toLowerCase()};
              margin: 5mm !important;
            }
            .print-page-container {
              width: 100% !important;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              padding: 2mm;
              overflow: hidden;
            }
            .print-page-container:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .print-grid-dynamic {
              display: grid !important;
              width: 100% !important;
              height: 100% !important;
              gap: 0px !important;
            }
          }
        `,
        }}
      />

      {pages.map((pageCards, pageIdx) => (
        <div
          key={pageIdx}
          className="print-page-container"
          style={{ height: getPageHeight(), maxHeight: getPageHeight() }}
        >
          <div
            className="print-grid-dynamic"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            }}
          >
            {pageCards.map(({ bundle, op, globalIndex }) => (
              <BarcodeCard
                key={`${bundle.id}-${op.id}`}
                pageIndex={globalIndex}
                totalPages={totalCardsList.length}
                styleCode={activeStyle.styleCode}
                anlNo={activeStyle.anlNo}
                bundle={bundle}
                op={op}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
