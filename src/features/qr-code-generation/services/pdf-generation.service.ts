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

// Printed on real A4 (210x297mm) — printers select "A4" in the dialog, so
// the PDF page must actually be A4, not a taller label-stock size, or the
// print driver auto-scales the whole page down to fit and every box comes
// out a few % undersized. Grid: 6 cols x 18 rows = 108 cards/page, each
// box 3.25cm x 1.527cm.
//
// Box height is shaved down from the original 3.25x1.55cm spec on
// purpose: with margins (top 1.6, bottom 0.6cm), the printable height is
// 275mm — 18 rows of 1.55cm need 279mm, 4mm *too tall*, which clipped the
// 18th row off the printable page. 1.527cm/row (18 rows = 274.9mm) is the
// largest box that actually fits, leaving ~0.1mm/row of slack. That's
// razor-thin: a ~1mm error in any one measurement (margin or box) can
// overflow again, but there's no more height to give — A4 minus a
// workable top margin (for the sheet edge most printers can't feed to)
// is already this tight at 18 rows.
const MM_TO_PT = 72 / 25.4;
const PAGE_SIZE: [number, number] = [210 * MM_TO_PT, 297 * MM_TO_PT];
const CM_TO_PT = 28.3465;
const BOX_WIDTH = 3.25 * CM_TO_PT;
const BOX_HEIGHT = 1.55 * CM_TO_PT;
const GRID_COLS = 6;
const GRID_ROWS = 18;
// Margins (cm) for real A4 stock. Callers that don't pass margins
// explicitly (e.g. the coupon-tracing reprint route) still need to land
// on the real printable area, not a theoretical centered guess.
const DEFAULT_MARGINS = { top: 1.6, bottom: 0.6, left: 0.7, right: 0.65 };

export async function generateCouponPdf({
  workOrder,
  bundles,
  operations,
  cards: precomputedCards,
  layout = "same-line",
  margins = DEFAULT_MARGINS,
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
  const usableWidth = PAGE_SIZE[0] - marginLeft - marginRight;
  const usableHeight = PAGE_SIZE[1] - marginTop - marginBottom;
  const gridOriginX =
    marginLeft + Math.max(0, (usableWidth - cellWidth * GRID_COLS) / 2);
  const gridOriginY =
    marginTop + Math.max(0, (usableHeight - cellHeight * GRID_ROWS) / 2);

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

    // Cell border is part of the shared grid (drawGridLines, drawn once
    // per page) — not redrawn per cell.
    const cardX = cellX + 1.5;
    const cardY = cellY + 1.5;
    const cardW = cellWidth - 3;

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

  doc.end();
  const buffer = await done;
  return { buffer, cardCount: totalCards };
}
