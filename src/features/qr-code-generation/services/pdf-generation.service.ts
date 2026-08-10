import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";
import type { BundleDetailRow, OperationsDetailRow } from "../types";
import { buildCouponCards } from "./coupon-pairing.service";

// pdfkit's built-in "standard" fonts (Helvetica etc.) read .afm metric
// files from node_modules at runtime via fs.readFileSync — bundlers that
// don't ship non-.js files from node_modules (serverless/standalone
// builds) drop those files, causing ENOENT in production even though
// local dev works. Embedding a real TTF sidesteps that path entirely.
const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");

interface GeneratePdfParams {
  anlNo: string;
  styleCode: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
}

// One page per card, laid out simply (label-per-page) — this is the
// server-side render used to produce a storable PDF, independent of the
// on-screen grid print layout in PrintableQrCodesArea.
const PAGE_SIZE: [number, number] = [288, 216]; // 4in x 3in in points (72pt/in)

export async function generateCouponPdf({
  anlNo,
  styleCode,
  bundles,
  operations,
}: GeneratePdfParams): Promise<{ buffer: Buffer; cardCount: number }> {
  const cards = buildCouponCards(bundles, operations);
  const totalCards = cards.length;

  const doc = new PDFDocument({ size: PAGE_SIZE, margin: 12, bufferPages: false, font: FONT_PATH });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ponytail: cards are rendered and flushed one at a time rather than all
  // held as PDFKit objects at once, so memory stays flat for thousands of
  // cards. If this needs to run against tens of thousands, move to a
  // streaming HTTP response instead of buffering the whole PDF in memory
  // before the DB insert.
  for (let i = 0; i < cards.length; i++) {
    const { bundle, op } = cards[i];
    const pageIndex = i + 1;

    if (i > 0) doc.addPage();

    const rateNum = parseFloat(op.rate || "0");
    const qtyNum = bundle.pcs || 0;
    const rsVal = Math.round(rateNum * qtyNum);

    const qrDisplayValue = [
      `Order: ${anlNo}`,
      `Cut: ${bundle.transId}`,
      `Bundle: ${bundle.bundleNo}`,
      `Size: ${bundle.size || "/"}`,
      `Op No: ${op.opNo}`,
      `Op Name: ${op.operationName}`,
      `Coupon: ${pageIndex}/${totalCards}`,
      `Qty: ${qtyNum}`,
      `Rate: ${op.rate}`,
      `Inc: ${bundle.inseam || "-"}`,
      `Rs: ${rsVal}`,
    ].join("\n");

    const qrPng = await QRCode.toBuffer(qrDisplayValue, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 150,
    });

    doc.fontSize(9).text(`${styleCode}  |  Order: ${anlNo}`, { continued: false });
    doc.fontSize(8).text(`Cut: ${bundle.transId}   Bundle: ${bundle.bundleNo}   Size: ${bundle.size || "/"}`);
    doc.text(`Op ${op.opNo}: ${op.operationName}`);
    doc.text(`Qty: ${qtyNum}   Rate: ${op.rate}   Rs: ${rsVal}`);
    doc.text(`Coupon ${pageIndex}/${totalCards}`);
    doc.image(qrPng, doc.page.width - 162, 12, { width: 150, height: 150 });
  }

  doc.end();
  const buffer = await done;
  return { buffer, cardCount: totalCards };
}
