import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";
import type { BundleDetailRow, OperationsDetailRow } from "../types";
import { buildCouponCards } from "./coupon-pairing.service";
import { buildCouponCode } from "./coupon-code";

// pdfkit's built-in "standard" fonts (Helvetica etc.) read .afm metric
// files from node_modules at runtime via fs.readFileSync — bundlers that
// don't ship non-.js files from node_modules (serverless/standalone
// builds) drop those files, causing ENOENT in production even though
// local dev works. Embedding a real TTF sidesteps that path entirely.
const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");

interface GeneratePdfParams {
  workOrder: string;
  saleOrderNo: string;
  styleCode: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
}

// US Letter, points (72pt/in). Grid: 4 cols x 10 rows = 40 cards/page —
// matches the density of a typical printed coupon sheet (small card,
// registration marks at corners for cutting).
const PAGE_SIZE: [number, number] = [612, 792];
const PAGE_MARGIN = 18;
const GRID_COLS = 4;
const GRID_ROWS = 10;
const CARDS_PER_PAGE = GRID_COLS * GRID_ROWS;

export async function generateCouponPdf({
  workOrder,
  saleOrderNo,
  styleCode,
  bundles,
  operations,
}: GeneratePdfParams): Promise<{ buffer: Buffer; cardCount: number }> {
  const cards = buildCouponCards(bundles, operations);
  const totalCards = cards.length;

  const usableWidth = PAGE_SIZE[0] - PAGE_MARGIN * 2;
  const usableHeight = PAGE_SIZE[1] - PAGE_MARGIN * 2;
  const cellWidth = usableWidth / GRID_COLS;
  const cellHeight = usableHeight / GRID_ROWS;
  const qrSize = Math.min(cellHeight - 30, cellWidth * 0.36);

  const doc = new PDFDocument({ size: PAGE_SIZE, margin: 0, bufferPages: false, font: FONT_PATH });
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
    const pageIndex = i + 1;
    const posOnPage = i % CARDS_PER_PAGE;

    if (i > 0 && posOnPage === 0) doc.addPage();

    const col = posOnPage % GRID_COLS;
    const row = Math.floor(posOnPage / GRID_COLS);
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
    doc.dash(2, { space: 2 })
      .rect(cellX, cellY, cellWidth, cellHeight)
      .strokeColor("#bbbbbb")
      .stroke()
      .undash();
    const cardX = cellX + 2;
    const cardY = cellY + 2;
    const cardW = cellWidth - 4;
    const cardH = cellHeight - 4;
    doc.rect(cardX, cardY, cardW, cardH).strokeColor("#94a3b8").lineWidth(0.6).stroke();

    // Registration marks at cell corners.
    doc.strokeColor("#cccccc");
    for (const [mx, my] of [
      [cellX, cellY], [cellX + cellWidth, cellY],
      [cellX, cellY + cellHeight], [cellX + cellWidth, cellY + cellHeight],
    ]) {
      doc.moveTo(mx - 3, my).lineTo(mx + 3, my).stroke();
      doc.moveTo(mx, my - 3).lineTo(mx, my + 3).stroke();
    }

    const textWidth = cardW - qrSize - 12;
    const textX = cardX + 5;
    let y = cardY + 4;

    // Header band: style/order + card counter on the same row (counter is
    // small and right-aligned here, not crammed into the footer next to
    // the QR where it used to overlap the qty text).
    const headerH = saleOrderNo ? 20 : 12;
    doc.rect(cardX, cardY, cardW, headerH).fillColor("#eef2ff").fill();
    const counterText = `${pageIndex}/${totalCards}`;
    const counterWidth = 28;
    doc.fillColor("#1e293b").fontSize(6.5)
      .text(`${styleCode || workOrder}`, textX, y, { width: textWidth - counterWidth, height: 12, ellipsis: true });
    doc.fillColor("#64748b").fontSize(5)
      .text(counterText, textX + textWidth - counterWidth, y + 1, { width: counterWidth, align: "right" });
    if (saleOrderNo) {
      y += 8;
      doc.fillColor("#475569").fontSize(5.5)
        .text(`SO: ${saleOrderNo}`, textX, y, { width: textWidth, ellipsis: true });
    }
    y = cardY + headerH + 3;

    // Cut/bundle/size/inseam — one grouped 2x2 block, same identity family.
    const colW = textWidth / 2;
    doc.fillColor("#334155").fontSize(6);
    doc.text(`Cut: ${bundle.cutNo}`, textX, y, { width: colW });
    doc.text(`B#: ${bundle.bundleNo}`, textX + colW, y, { width: colW });
    y += 9;
    doc.text(`Size: ${bundle.size || "/"}`, textX, y, { width: colW });
    doc.text(`Inseam: ${bundle.inseam || "-"}`, textX + colW, y, { width: colW });
    y += 11;

    // Qty/rate/amount footer band — the money group, visually anchored to
    // the card bottom regardless of how tall the operation text ran.
    const footerY = cardY + cardH - 12;

    // Operation band — its own row, separated with a hairline. Height is
    // clipped to whatever room is actually left above the footer, so a
    // taller header (e.g. sale order line) never pushes this into the
    // qty/amount row below.
    const opTextH = Math.max(footerY - y - 4, 8);
    doc.moveTo(textX, y - 2).lineTo(textX + textWidth, y - 2).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.fillColor("#000000").fontSize(6)
      .text(`Op ${op.opNo}: ${op.operationName}`, textX, y, { width: textWidth, height: opTextH, ellipsis: true });
    doc.moveTo(textX, footerY - 2).lineTo(textX + textWidth, footerY - 2).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.fillColor("#334155").fontSize(5.5)
      .text(`Qty ${qtyNum} x ${op.rate || "?"}`, textX, footerY, { width: textWidth * 0.6 });
    doc.fillColor("#1e293b").fontSize(6.5)
      .text(`Rs ${rsVal}`, textX + textWidth * 0.6, footerY - 1, { width: textWidth * 0.4, align: "right" });

    doc.image(qrPng, cardX + cardW - qrSize - 4, cardY + (cardH - qrSize) / 2, {
      width: qrSize,
      height: qrSize,
    });
  }

  doc.end();
  const buffer = await done;
  return { buffer, cardCount: totalCards };
}
