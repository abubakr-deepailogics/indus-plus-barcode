"use client";

import React from "react";
import type { QrCodeStyleData, BundleDetailRow, OperationsDetailRow, PageSetupConfig } from "../types";
import { QrCodeCard } from "./QrCodeCard";
import { buildCouponCards } from "../services/coupon-pairing.service";

interface PrintableQrCodesAreaProps {
  activeStyle: QrCodeStyleData;
  pageSetup: PageSetupConfig;
}

export function PrintableQrCodesArea({
  activeStyle,
  pageSetup,
}: PrintableQrCodesAreaProps) {
  const selectedBundles = activeStyle.bundles.filter((b) => b.sel);
  const hasContent = selectedBundles.length > 0 && activeStyle.operations.length > 0;

  if (!hasContent) {
    return (
      <div id="printable-qr-code-area" className="hidden print:block">
        <div className="p-8 text-center text-gray-500 font-bold border border-gray-300 rounded">
          No bundles selected or no operations found to print QR codes.
        </div>
      </div>
    );
  }

  const pairedCardsList = buildCouponCards(selectedBundles, activeStyle.operations);

  const [gridCols, gridRows] = pageSetup.gridFormat
    .split("x")
    .map(Number);
  const cardsPerPage = gridCols * gridRows;

  // Pad each operation's card group up to a multiple of gridCols so a new
  // operation always starts on a fresh grid row instead of sharing a row
  // with the tail end of the previous operation's cards.
  type Slot = { bundle: BundleDetailRow; op: OperationsDetailRow } | null;
  const totalCardsList: Slot[] = [];
  for (const op of activeStyle.operations) {
    const opCards = pairedCardsList.filter((c) => c.op.id === op.id);
    if (opCards.length === 0) continue;
    totalCardsList.push(...opCards);
    const remainder = opCards.length % gridCols;
    if (remainder !== 0) {
      totalCardsList.push(...Array(gridCols - remainder).fill(null));
    }
  }

  const pages: Array<
    Array<{
      bundle: BundleDetailRow;
      op: OperationsDetailRow;
      globalIndex: number;
    } | { blank: true; key: number }>
  > = [];

  let cardCounter = 0;
  for (let i = 0; i < totalCardsList.length; i += cardsPerPage) {
    pages.push(
      totalCardsList.slice(i, i + cardsPerPage).map((item, localIdx) => {
        if (item === null) return { blank: true, key: i + localIdx };
        cardCounter += 1;
        return { ...item, globalIndex: cardCounter };
      }),
    );
  }
  const totalRealCards = pairedCardsList.length;

  const getPageHeight = (): string => {
    if (pageSetup.size === "Letter") return "9.8in";
    if (pageSetup.size === "A4") return "268mm";
    if (pageSetup.size === "Legal") return "12.8in";
    return "9.8in";
  };

  return (
    <div id="printable-qr-code-area" className="hidden print:block">
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
            #printable-qr-code-area {
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
            {pageCards.map((card) =>
              "blank" in card ? (
                <div key={`blank-${card.key}`} />
              ) : (
                <QrCodeCard
                  key={`${card.bundle.id}-${card.op.id}`}
                  pageIndex={card.globalIndex}
                  totalPages={totalRealCards}
                  styleCode={activeStyle.styleCode}
                  anlNo={activeStyle.anlNo}
                  bundle={card.bundle}
                  op={card.op}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
