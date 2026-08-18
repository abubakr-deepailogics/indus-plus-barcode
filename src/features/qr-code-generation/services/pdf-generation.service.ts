import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";
import type { BundleDetailRow, CouponLayout, OperationsDetailRow } from "../types";
import { buildCouponCards, type CouponCard } from "./coupon-pairing.service";
import { buildCouponCode } from "./coupon-code";

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

// US Letter, points (72pt/in). Grid: 4 cols x 10 rows = 40 cards/page —
// matches the density of a typical printed coupon sheet (small card,
// registration marks at corners for cutting).
const PAGE_SIZE: [number, number] = [612, 792];
const PAGE_MARGIN = 18;
const GRID_COLS = 4;
const GRID_ROWS = 10;

export async function generateCouponPdf({
  workOrder,
  saleOrderNo,
  styleCode,
  bundles,
  operations,
  cards: precomputedCards,
  layout = "same-line",
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

  const usableWidth = PAGE_SIZE[0] - PAGE_MARGIN * 2;
  const usableHeight = PAGE_SIZE[1] - PAGE_MARGIN * 2;
  const cellWidth = usableWidth / GRID_COLS;
  const cellHeight = usableHeight / GRID_ROWS;
  const qrSize = Math.min(cellHeight - 30, cellWidth * 0.36);

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

  // ponytail: cards are rendered and flushed one at a time (not held as
  // PDFKit objects all at once), so memory stays flat for thousands of
  // cards. If this needs to run against tens of thousands, move to a
  // streaming HTTP response instead of buffering the whole PDF before
  // the DB insert.
  for (let i = 0; i < cards.length; i++) {
    const { bundle, op } = cards[i];
    const { page, col, row } = slots[i];

    if (i > 0 && page !== slots[i - 1].page) doc.addPage();

    const cellX = PAGE_MARGIN + col * cellWidth;
    const cellY = PAGE_MARGIN + row * cellHeight;
    const padX = cellX + 6;
    const padY = cellY + 6;

    const rateNum = parseFloat(op.rate || "0");
    const qtyNum = bundle.pcs || 0;
    const rsVal = Math.round(rateNum * qtyNum);
    const couponCode = buildCouponCode(workOrder, bundle.bundleNo, op.opNo);

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

    // Solid outer card border (dashed cut-line just outside it) so each
    // coupon reads as one boxed unit instead of loose text on a grid line.
    doc
      .dash(2, { space: 2 })
      .rect(cellX, cellY, cellWidth, cellHeight)
      .strokeColor("#bbbbbb")
      .stroke()
      .undash();
    const cardX = cellX + 2;
    const cardY = cellY + 2;
    const cardW = cellWidth - 4;
    const cardH = cellHeight - 4;
    doc
      .rect(cardX, cardY, cardW, cardH)
      .strokeColor("#94a3b8")
      .lineWidth(0.6)
      .stroke();

    // Registration marks at cell corners.
    doc.strokeColor("#cccccc");
    for (const [mx, my] of [
      [cellX, cellY],
      [cellX + cellWidth, cellY],
      [cellX, cellY + cellHeight],
      [cellX + cellWidth, cellY + cellHeight],
    ]) {
      doc
        .moveTo(mx - 3, my)
        .lineTo(mx + 3, my)
        .stroke();
      doc
        .moveTo(mx, my - 3)
        .lineTo(mx, my + 3)
        .stroke();
    }

    const textWidth = cardW - qrSize;
    const textX = cardX + 5;
    let y = cardY + 4;

    // Header band: coupon code gets its own full-width row at the very
    // top of the card — the card is only ~140pt wide, so splitting that
    // between the code and the QR column (previous layout) truncated
    // both. A full-width row is the only way to show the whole code
    // without shrinking it past readable. Style/order (+ SO) stack below.
    const headerH = saleOrderNo ? 28 : 20;
    doc.rect(cardX, cardY, cardW, headerH).fillColor("#eef2ff").fill();
    doc
      .fillColor("#1e293b")
      .fontSize(6.5)
      .text(couponCode, textX, y, {
        width: cardW - 10,
        height: 9,
        ellipsis: true,
      });
    y += 9;
    doc
      .fillColor("#334155")
      .fontSize(5.5)
      .text(`${styleCode || workOrder}`, textX, y, {
        width: textWidth,
        height: 8,
        ellipsis: true,
      });
    if (saleOrderNo) {
      y += 8;
      doc
        .fillColor("#475569")
        .fontSize(5.5)
        .text(`SO: ${saleOrderNo}`, textX, y, {
          width: textWidth,
          ellipsis: true,
        });
    }
    y = cardY + headerH + 3;

    // Cut/bundle/size/inseam — one grouped 2x2 block, same identity family.
    const colW = textWidth / 2;
    doc.fillColor("#334155").fontSize(6);
    doc.text(`Cut: ${bundle.cutNo}`, textX, y, { width: colW });
    doc.text(`B#: ${bundle.bundleNo}`, textX + colW, y, { width: colW });
    y += 9;
    doc.text(`Size: ${bundle.size || "/"}`, textX, y, { width: colW });
    doc.text(`Inseam: ${bundle.inseam || "-"}`, textX + colW, y, {
      width: colW,
    });
    y += 11;

    // Qty/rate/amount footer band — the money group, visually anchored to
    // the card bottom regardless of how tall the operation text ran.
    const footerY = cardY + cardH - 12;

    // Operation band — its own row, separated with a hairline. Height is
    // clipped to whatever room is actually left above the footer, so a
    // taller header (e.g. sale order line) never pushes this into the
    // qty/amount row below.
    const opTextH = Math.max(footerY - y - 4, 8);
    doc
      .moveTo(textX, y - 2)
      .lineTo(textX + textWidth, y - 2)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();
    doc.fillColor("#000000").fontSize(5).text(`${op.operationName}`, textX, y, {
      width: textWidth,
      height: opTextH,
      ellipsis: true,
    });
    doc
      .moveTo(textX, footerY - 2)
      .lineTo(textX + textWidth, footerY - 2)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();
    doc
      .fillColor("#334155")
      .fontSize(5.5)
      .text(`Qty ${qtyNum} x ${op.rate || "?"}`, textX, footerY, {
        width: textWidth * 0.6,
      });
    doc
      .fillColor("#1e293b")
      .fontSize(6.5)
      .text(`Rs ${rsVal}`, textX + textWidth * 0.6, footerY - 1, {
        width: textWidth * 0.4,
        align: "right",
      });

    doc.image(qrPng, cardX + cardW - qrSize - 4, cardY + (cardH - qrSize) / 2, {
      width: qrSize,
      height: qrSize,
    });
  }

  doc.end();
  const buffer = await done;
  return { buffer, cardCount: totalCards };
}
