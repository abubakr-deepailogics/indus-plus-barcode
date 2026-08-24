import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";
import type {
  BundleDetailRow,
  CouponLayout,
  OperationsDetailRow,
} from "../types";
import { buildCouponCards, type CouponCard } from "./coupon-pairing.service";
import { buildCouponCode, trimBundleNo } from "./coupon-code";

// pdfkit's built-in "standard" fonts (Helvetica etc.) read .afm metric
// files from node_modules at runtime via fs.readFileSync — bundlers that
// don't ship non-.js files from node_modules (serverless/standalone
// builds) drop those files, causing ENOENT in production even though
// local dev works. Embedding a real TTF sidesteps that path entirely.
const FONT_PATH = path.join(
  process.cwd(),
  "src/assets/fonts/Roboto-Regular.ttf",
);

const CODE128_PATTERNS = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2], // 1
  [2, 2, 2, 2, 2, 1], // 2
  [1, 2, 1, 2, 2, 3], // 3
  [1, 2, 1, 3, 2, 2], // 4
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3], // 6
  [1, 2, 2, 3, 1, 2], // 7
  [1, 3, 2, 2, 1, 2], // 8
  [2, 2, 1, 2, 1, 3], // 9
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2], // 11
  [1, 1, 2, 2, 3, 2], // 12
  [1, 2, 2, 1, 3, 2], // 13
  [1, 2, 2, 2, 3, 1], // 14
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2], // 16
  [1, 2, 3, 2, 2, 1], // 17
  [2, 2, 3, 2, 1, 1], // 18
  [2, 2, 1, 1, 3, 2], // 19
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2], // 21
  [2, 2, 3, 1, 1, 2], // 22
  [3, 1, 2, 1, 3, 1], // 23
  [3, 1, 1, 2, 2, 2], // 24
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1], // 26
  [3, 1, 2, 2, 1, 2], // 27
  [3, 2, 2, 1, 1, 2], // 28
  [3, 2, 2, 2, 1, 1], // 29
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1], // 31
  [2, 3, 2, 1, 2, 1], // 32
  [1, 1, 1, 3, 2, 3], // 33
  [1, 3, 1, 1, 2, 3], // 34
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3], // 36
  [1, 3, 2, 1, 1, 3], // 37
  [1, 3, 2, 3, 1, 1], // 38
  [2, 1, 1, 3, 1, 3], // 39
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1], // 41
  [1, 1, 2, 1, 3, 3], // 42
  [1, 1, 2, 3, 3, 1], // 43
  [1, 3, 2, 1, 3, 1], // 44
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1], // 46
  [1, 3, 3, 1, 2, 1], // 47
  [3, 1, 3, 1, 2, 1], // 48
  [2, 1, 1, 3, 3, 1], // 49
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3], // 51
  [2, 1, 3, 3, 1, 1], // 52
  [2, 1, 3, 1, 3, 1], // 53
  [3, 1, 1, 1, 2, 3], // 54
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1], // 56
  [3, 1, 2, 1, 1, 3], // 57
  [3, 1, 2, 3, 1, 1], // 58
  [3, 3, 2, 1, 1, 1], // 59
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1], // 61
  [4, 3, 1, 1, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103 (Start A)
  [2, 1, 1, 2, 1, 4], // 104 (Start B)
  [2, 1, 1, 2, 3, 2], // 105 (Start C)
  [2, 3, 3, 1, 1, 1, 2], // 106 (Stop)
];

function formatShortDate(date: Date = new Date()): string {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function drawBarcode(
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
) {
  const symbols: number[] = [104]; // Start B
  let checksum = 104;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 127) continue;
    const symbolVal = code - 32;
    symbols.push(symbolVal);
    checksum += symbolVal * (i + 1);
  }
  checksum = checksum % 103;
  symbols.push(checksum);
  symbols.push(106); // Stop

  const totalModules = 11 * (value.length + 2) + 13;
  const moduleWidth = width / totalModules;

  let currentX = x;
  doc.save();
  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym];
    if (!pattern) continue;
    for (let j = 0; j < pattern.length; j++) {
      const w = pattern[j] * moduleWidth;
      if (j % 2 === 0) {
        doc.rect(currentX, y, w, height).fill("#000000");
      }
      currentX += w;
    }
  }
  doc.restore();
}

interface GeneratePdfParams {
  workOrder: string;
  saleOrderNo: string;
  styleCode: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
  // Precomputed card list, bypassing the bundles x operations cross
  // product — for callers rendering an arbitrary/sparse subset of pairs
  // (e.g. exactly the coupons that matched a filter) rather than "every
  // bundle against every operation". bundles/operations are still used
  // for their row data even when this is set.
  cards?: CouponCard[];
  // Controls how operation boundaries fall on the grid. Cards arrive
  // operation-major (see buildCouponCards), so "next operation" is just
  // "op differs from the previous card's op". Defaults to today's plain
  // dense packing. See CouponLayout for the three modes.
  layout?: CouponLayout;
  // Page margins in cm, per side — matches the box/page dimensions used
  // everywhere else in this feature. Defaults match PageSetupModal's
  // initial config (see useQrCodeGenerationFacade).
  margins?: { top: number; bottom: number; left: number; right: number };
  codeType?: "qr" | "barcode";
}

// Strips a leading non-digit label ("W/O-", "WO", etc.) so the printed
// card shows just the number, e.g. "W/O-003355" -> "003355". Falls back
// to the original string when there's no digit run to find (keeps
// non-numeric codes readable instead of blanking them).
function stripPrefix(value: string): string {
  const match = value.match(/\d[\d/-]*$/);
  return match ? match[0] : value;
}

// Assigns each card a (page, col, row) slot per the chosen layout. Cards
// are already operation-major/cut-major ordered by buildCouponCards —
// this only decides where page/row breaks fall relative to op changes.
function assignSlots(
  cards: CouponCard[],
  layout: CouponLayout,
  cols: number,
  rows: number,
): { page: number; col: number; row: number }[] {
  const perPage = cols * rows;
  const slots: { page: number; col: number; row: number }[] = [];
  let page = 0;
  let cell = 0; // 0-indexed position within the current page
  let prevOp: string | undefined;

  for (const { op } of cards) {
    const opChanged = prevOp !== undefined && op.opNo !== prevOp;
    prevOp = op.opNo;

    if (opChanged) {
      if (layout === "different-pages") {
        page += 1;
        cell = 0;
      } else if (layout === "same-page" && cell % cols !== 0) {
        // Jump to the start of the next row (rolling onto the next page
        // if that row doesn't exist on this one).
        cell += cols - (cell % cols);
      }
    }

    if (cell >= perPage) {
      page += 1;
      cell = 0;
    }

    slots.push({ page, col: cell % cols, row: Math.floor(cell / cols) });
    cell += 1;
  }

  return slots;
}

// Printed on real Legal (215.9x355.6mm / 8.5x14in) — printers select
// "Legal" in the dialog, so the PDF page must actually be Legal, not a
// mismatched size, or the print driver auto-scales the whole page to fit
// the selected paper and every carefully-tuned dimension below (box size,
// margins, offsets) drifts off. Grid: 6 cols x 18 rows = 108 cards/page,
// each box 3.258cm x 1.58cm.
const IN_TO_PT = 72;
const PAGE_SIZE: [number, number] = [8.5 * IN_TO_PT, 14 * IN_TO_PT];
const CM_TO_PT = 28.3465;
const BOX_WIDTH = 3.258 * CM_TO_PT;
const BOX_HEIGHT = 1.58 * CM_TO_PT;
const GRID_COLS = 6;
const GRID_ROWS = 18;
// Margins (cm) for real Legal stock. Callers that don't pass margins
// explicitly (e.g. the coupon-tracing reprint route) still need to land
// on the real printable area, not a theoretical centered guess.
// Shifted 2mm right (+left/-right) and 1mm up (-top/+bottom) from the
// theoretical centering to correct for print-driver drift observed on
// actual sheets — the grid math centers correctly, but the physical
// printout was landing 2mm left / 1mm low of centered.
const DEFAULT_MARGINS = { top: 1.6, bottom: 0.8, left: 0.6, right: 0.65 };

export async function generateCouponPdf({
  workOrder,
  bundles,
  operations,
  cards: precomputedCards,
  layout = "same-line",
  margins = DEFAULT_MARGINS,
  codeType = "qr",
}: GeneratePdfParams): Promise<{ buffer: Buffer; cardCount: number }> {
  // buildCouponCards already sorts by seqNo for the common path; precomputedCards
  // (filtered coupon-tracing reprints) is built card-by-card outside that
  // function, so re-sort here too — the single choke point every render
  // goes through, regardless of how the card list was assembled.
  const cards = (precomputedCards ?? buildCouponCards(bundles, operations))
    .slice()
    .sort((a, b) => (Number(a.op.seqNo) || 0) - (Number(b.op.seqNo) || 0));
  const totalCards = cards.length;
  const slots = assignSlots(cards, layout, GRID_COLS, GRID_ROWS);

  const marginTop = margins.top * CM_TO_PT;
  const marginBottom = margins.bottom * CM_TO_PT;
  const marginLeft = margins.left * CM_TO_PT;
  const marginRight = margins.right * CM_TO_PT;
  const cellWidth = BOX_WIDTH;
  const cellHeight = BOX_HEIGHT;
  // QR spans most of the box height (top edge to the op-name strip) — it's
  // the largest single element on the card and the one thing that must
  // stay scanner-reliable, so it gets priority over the text rows for
  // vertical space rather than being capped to match the field grid. Shaved
  // down slightly (not the full available height) so it doesn't sit flush
  // against the box edges — square, so scannability doesn't degrade.
  const qrSize = cellHeight - 3 - 7 - 2;
  // Fixed-size grid is centered in whatever page area the margins leave,
  // rather than stretched to fill it — the box dimensions are a print
  // spec (label sheet), not a function of page size.
  // Horizontal: centered in the leftover width slack. Vertical: anchored
  // to the top margin instead — Legal's height leaves far more slack than
  // the grid needs, and centering it vertically would push the top gap
  // well past the configured top margin (e.g. 16mm margin rendering as a
  // ~40mm gap). Leftover vertical space goes to the bottom only.
  const usableWidth = PAGE_SIZE[0] - marginLeft - marginRight;
  const gridOriginX =
    marginLeft + Math.max(0, (usableWidth - cellWidth * GRID_COLS) / 2);
  const gridOriginY = marginTop;
  const gridHeight = cellHeight * GRID_ROWS;
  if (gridOriginY + gridHeight > PAGE_SIZE[1] - marginBottom) {
    throw new Error(
      `Coupon grid (${gridHeight.toFixed(1)}pt) plus top margin doesn't fit ` +
        `within the page above the bottom margin — reduce top/bottom margins ` +
        `or box height.`,
    );
  }

  const doc = new PDFDocument({
    size: PAGE_SIZE,
    margin: 0,
    bufferPages: false,
    font: FONT_PATH,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Grid lines drawn once per boundary (not once per cell) — a per-cell
  // rect() strokes every shared edge twice (once from each neighboring
  // cell), and those doubled-up strokes were the "borders stacking" bug:
  // each extra stroke width eats into the cell below/right of it, so the
  // drift compounds row after row down the page.
  function drawGridLines() {
    doc.strokeColor("#94a3b8").lineWidth(0.4);
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = gridOriginX + c * cellWidth;
      doc
        .moveTo(x, gridOriginY)
        .lineTo(x, gridOriginY + cellHeight * GRID_ROWS)
        .stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = gridOriginY + r * cellHeight;
      doc
        .moveTo(gridOriginX, y)
        .lineTo(gridOriginX + cellWidth * GRID_COLS, y)
        .stroke();
    }
  }
  drawGridLines();

  // ponytail: cards are rendered and flushed one at a time (not held as
  // PDFKit objects all at once), so memory stays flat for thousands of
  // cards. If this needs to run against tens of thousands, move to a
  // streaming HTTP response instead of buffering the whole PDF before
  // the DB insert.
  for (let i = 0; i < cards.length; i++) {
    const { bundle, op } = cards[i];
    const { page, col, row } = slots[i];

    if (i > 0 && page !== slots[i - 1].page) {
      doc.addPage();
      drawGridLines();
    }

    const cellX = gridOriginX + col * cellWidth;
    const cellY = gridOriginY + row * cellHeight;
    const cardX = cellX + 1.5;
    const cardY = cellY + 1.5;
    const cardW = cellWidth - 3;

    const rateNum = parseFloat(op.rate || "0");
    const qtyNum = bundle.pcs || 0;
    const rsVal = Math.round(rateNum * qtyNum);
    // Coupon code stays only in the QR payload (scan/rework routes match
    // on it) — not printed, per the smaller box's space budget.
    const couponCode = buildCouponCode(workOrder, bundle.bundleNo, op.opNo);
    const workOrderShort = stripPrefix(workOrder);
    // Bundle number often repeats the work order's digits at the front
    // (see coupon-code.ts) — trim that repetition, not just the label
    // prefix, so B# actually fits its column instead of ellipsizing.
    const bundleShort = trimBundleNo(workOrder, bundle.bundleNo);

    if (codeType === "barcode") {
      // 3x3 Grid fields at the top
      const colW = cardW / 3;
      const rowH = 4.8;
      const shortDate = formatShortDate();

      const fields: {
        label: string;
        value: string;
        col: number;
        row: number;
        labelW: number;
      }[] = [
        { label: "Cut:", value: bundle.cutNo, col: 0, row: 0, labelW: 8 },
        { label: "B#", value: bundleShort, col: 0, row: 1, labelW: 7 },
        { label: "Rate:", value: op.rate || "0", col: 0, row: 2, labelW: 11 },
        { label: "G:", value: shortDate, col: 1, row: 0, labelW: 5 },
        { label: "Order:", value: workOrderShort, col: 1, row: 1, labelW: 13 },
        { label: "Rs:", value: String(rsVal), col: 1, row: 2, labelW: 8 },
        {
          label: "Size:",
          value: bundle.size || "/",
          col: 2,
          row: 0,
          labelW: 11,
        },
        { label: "Qty:", value: String(qtyNum), col: 2, row: 1, labelW: 9 },
        { label: "Inc:", value: op.inc || "", col: 2, row: 2, labelW: 9 },
      ];

      doc.fontSize(4.5);
      for (const field of fields) {
        const cx = cardX + field.col * colW;
        const cy = cardY + field.row * rowH;

        doc.fillColor("#000000").font(FONT_PATH).text(field.label, cx, cy, {
          width: field.labelW,
          height: rowH,
          lineBreak: false,
        });
        doc
          .fillColor("#000000")
          .font(FONT_PATH)
          .text(field.value, cx + field.labelW + 0.5, cy, {
            width: colW - field.labelW - 0.5,
            height: rowH,
            ellipsis: true,
            lineBreak: false,
          });
      }

      // Barcode in the center
      const barcodeY = cardY + 16;
      const opNameH = 6;
      const opNameY = cardY + cellHeight - 3 - opNameH + 0.5;
      const barcodeH = opNameY - barcodeY - 1.5;

      const barcodeX = cardX + 2;
      const barcodeW = cardW - 4;

      drawBarcode(doc, barcodeX, barcodeY, barcodeW, barcodeH, couponCode);

      // Operation name at the bottom
      doc
        .fillColor("#000000")
        .fontSize(4.8)
        .font(FONT_PATH)
        .text(op.operationName, cardX, opNameY, {
          width: cardW,
          height: opNameH,
          ellipsis: true,
          lineBreak: false,
        });
    } else {
      const qrDisplayValue = [
        `Coupon: ${couponCode}`,
        `Order: ${workOrder}`,
        `Cut: ${bundle.cutNo}`,
        `Bundle: ${bundle.bundleNo}`,
        `Size: ${bundle.size || "/"}`,
        `Inseam: ${bundle.inseam || "-"}`,
        `Op No: ${op.opNo}`,
        `Op Name: ${op.operationName}`,
        `Qty: ${qtyNum}`,
        `Rate: ${op.rate}`,
        `Rs: ${rsVal}`,
      ].join("\n");

      const qrPng = await QRCode.toBuffer(qrDisplayValue, {
        errorCorrectionLevel: "M",
        margin: 0,
        width: 150,
      });

      // QR spans the full left-to-op-name height, flush right, as large as
      // the box allows. WO/Section (own lines, so long section names don't
      // truncate) and the Cut/B#/Sz/Inm/Qty/Rt/Rs/Inc grid share the
      // narrower column left of it — that column is the whitespace budget,
      // not the QR, so the QR is sized off the box, not the text column.
      const opNameH = 7;
      const headerLineH = 6;
      const headerH = headerLineH * 2;
      const topH = cellHeight - 3 - opNameH;

      // Shifted left of the box's right edge so the QR has its own margin
      // instead of sitting flush against the border.
      const qrX = cardX + cardW - qrSize - 1.5;
      doc.image(qrPng, qrX, cardY, { width: qrSize, height: qrSize });

      const textW = qrX - cardX - 3;
      doc.fontSize(4.5);
      doc.fillColor("#64748b").text("WO", cardX, cardY, {
        width: 9,
        height: headerLineH,
        lineBreak: false,
      });
      doc.fillColor("#1e293b").text(workOrderShort, cardX + 9, cardY, {
        width: textW - 9,
        height: headerLineH,
        ellipsis: true,
        lineBreak: false,
      });
      doc.fillColor("#64748b").text("Sec", cardX, cardY + headerLineH, {
        width: 9,
        height: headerLineH,
        lineBreak: false,
      });
      doc
        .fillColor("#1e293b")
        .text(op.section || "-", cardX + 9, cardY + headerLineH, {
          width: textW - 9,
          height: headerLineH,
          ellipsis: true,
          lineBreak: false,
        });

      const gridY = cardY + headerH;

      // Field grid: 2 columns x 4 rows in the space left of the QR — each
      // cell a small label+value pair.
      const fieldsW = textW;
      const fieldColW = fieldsW / 2;
      const fieldRowH = (topH - headerH) / 4;
      const fields: [string, string][] = [
        ["Cut", bundle.cutNo],
        ["B#", bundleShort],
        ["Sz", bundle.size || "/"],
        ["Inm", bundle.inseam || "-"],
        ["Qty", String(qtyNum)],
        ["Rt", op.rate || "0"],
        ["Rs", String(rsVal)],
        ["Inc", op.inc || "0"],
      ];
      doc.fontSize(4.5);
      for (let f = 0; f < fields.length; f++) {
        const [label, value] = fields[f];
        const col = Math.floor(f / 4);
        const row = f % 4;
        const cx = cardX + col * fieldColW;
        const cy = gridY + row * fieldRowH;
        const labelW = 9;
        doc.fillColor("#64748b").text(label, cx, cy, {
          width: labelW,
          height: fieldRowH,
          lineBreak: false,
        });
        doc.fillColor("#1e293b").text(value, cx + labelW, cy, {
          width: fieldColW - labelW,
          height: fieldRowH,
          ellipsis: true,
          lineBreak: false,
        });
      }

      // Operation name — full card width (under the QR too), pinned to the
      // bottom, separated by a hairline so it reads as its own row.
      const opNameY = cardY + topH + 1;
      doc
        .moveTo(cardX, opNameY - 0.5)
        .lineTo(cardX + cardW, opNameY - 0.5)
        .strokeColor("#e2e8f0")
        .lineWidth(0.4)
        .stroke();
      doc
        .fillColor("#000000")
        .fontSize(4.8)
        .text(op.operationName, cardX, opNameY, {
          width: cardW,
          height: opNameH - 1,
          ellipsis: true,
        });
    }
  }

  doc.end();
  const buffer = await done;
  return { buffer, cardCount: totalCards };
}
