import PDFDocument from "pdfkit";
import path from "node:path";

// pdfkit's built-in "standard" fonts (Helvetica etc.) read .afm metric files
// from node_modules at runtime — missing from serverless/standalone builds
// that don't ship non-.js node_modules files, causing ENOENT in production
// even though local dev works (see pdf-generation.service.ts). Embedding a
// real TTF sidesteps that entirely. Only a regular weight is embedded, so
// "bold" text below is faux-bolded by re-stroking the glyphs a hair over.
const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");
const BLACK = "#000000";

function boldText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: PDFKit.Mixins.TextOptions,
) {
  doc.text(text, x, y, options);
  doc.text(text, x + 0.3, y, options);
}

function cellText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { bold?: boolean; align?: "left" | "center" | "right" },
) {
  const cellOptions: PDFKit.Mixins.TextOptions = {
    width: width - 6,
    align: options?.align ?? "left",
    lineBreak: false,
    ellipsis: true,
  };
  if (options?.bold) {
    boldText(doc, text, x + 3, y + 3, cellOptions);
  } else {
    doc.text(text, x + 3, y + 3, cellOptions);
  }
}

export interface CorReportMeta {
  workOrder: string;
  saleOrderNo: string;
  customerName: string;
  styleCode: string;
  styleName: string;
  fabricCode: string;
  wash: string;
  willCutQty: number;
}

export interface CorReportBundleRow {
  cutNo: string;
  bundleNo: string;
  size: string;
  inseam: string;
  color: string;
  shade: string;
  shrinkage: string;
  markerPlies: number | null;
  bundleQty: number;
  // Piece numbers this bundle covers. Numbering runs on across bundles of the
  // same cut + inseam + size + shade (see assignSerialRanges).
  serialFrom: number;
  serialTo: number;
}

export function serialRangeLabel(row: Pick<CorReportBundleRow, "serialFrom" | "serialTo" | "bundleQty">): string {
  return row.bundleQty > 0 ? `${row.serialFrom} TO ${row.serialTo}` : "—";
}

// Rows must already be in bundle sequence order.
export function assignSerialRanges<T extends Omit<CorReportBundleRow, "serialFrom" | "serialTo">>(
  rows: T[],
): Array<T & { serialFrom: number; serialTo: number }> {
  const issued = new Map<string, number>();
  return rows.map((row) => {
    const key = [row.cutNo, row.inseam, row.size, row.shade].map((v) => v.trim().toLowerCase()).join("|");
    const qty = Math.max(0, row.bundleQty);
    const from = (issued.get(key) ?? 0) + 1;
    issued.set(key, from - 1 + qty);
    return { ...row, serialFrom: from, serialTo: from - 1 + qty };
  });
}

function sortedCuts(rows: CorReportBundleRow[]): string[] {
  return [...new Set(rows.map((row) => row.cutNo))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

// Plain-form layout matching the client's own "Cut Order Report" (IPL-CQR-
// 04-34): a bordered header block (W/O, Style, P/O / Buyer, Fabric / Will
// Cut Qty, Wash), then every Cut as its own 3-column group — Label | Value |
// Marker — repeating Cut#/Shrk/Shade/Inseam rows, followed by a bordered
// B#/SIZE/UNIQUE N#/PCS/FAULT bundle table. Groups sit side by side across
// the page, same as the original's column layout, wrapping as needed.
const GROUP_WIDTH = 210;
const GROUP_GAP = 10;
const GROUP_ROW_HEIGHT = 13;
const DETAIL_ROW_HEIGHT = 12;
const LABEL_WIDTH = 46;
const MARKER_WIDTH = 40;
const VALUE_WIDTH = GROUP_WIDTH - LABEL_WIDTH - MARKER_WIDTH;

const DETAIL_COLS = [
  { label: "B#", width: 22 },
  { label: "SIZE", width: 44 },
  { label: "UNIQUE N#", width: 56 },
  { label: "PCS", width: 28 },
  { label: "FAULT", width: GROUP_WIDTH - 22 - 44 - 56 - 28 },
];

function drawCutGroup(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  cutNo: string,
  cutRows: CorReportBundleRow[],
) {
  const first = cutRows[0];
  doc.lineWidth(0.6).strokeColor(BLACK);
  doc.fontSize(7);

  const groupRows: Array<[string, string, string]> = [
    ["Cut #", cutNo, "MARKER"],
    ["Shrk", first.shrinkage || "—", String(first.markerPlies ?? "—")],
    ["Shade", first.shade || "—", ""],
    ["Inseam", first.inseam || "—", ""],
  ];
  groupRows.forEach(([label, value, marker], index) => {
    const rowY = y + index * GROUP_ROW_HEIGHT;
    doc.rect(x, rowY, LABEL_WIDTH, GROUP_ROW_HEIGHT).stroke();
    doc.rect(x + LABEL_WIDTH, rowY, VALUE_WIDTH, GROUP_ROW_HEIGHT).stroke();
    doc.rect(x + LABEL_WIDTH + VALUE_WIDTH, rowY, MARKER_WIDTH, GROUP_ROW_HEIGHT).stroke();
    cellText(doc, label, x, rowY, LABEL_WIDTH, { bold: true });
    cellText(doc, value, x + LABEL_WIDTH, rowY, VALUE_WIDTH, { align: "center" });
    cellText(doc, marker, x + LABEL_WIDTH + VALUE_WIDTH, rowY, MARKER_WIDTH, {
      bold: index === 0,
      align: "center",
    });
  });

  const detailTop = y + groupRows.length * GROUP_ROW_HEIGHT;
  let colX = x;
  DETAIL_COLS.forEach((col) => {
    doc.rect(colX, detailTop, col.width, DETAIL_ROW_HEIGHT).stroke();
    cellText(doc, col.label, colX, detailTop, col.width, { bold: true, align: "center" });
    colX += col.width;
  });

  cutRows.forEach((row, index) => {
    const rowY = detailTop + DETAIL_ROW_HEIGHT * (index + 1);
    const values = [String(index + 1), row.size || "—", serialRangeLabel(row), String(row.bundleQty), ""];
    let cx = x;
    DETAIL_COLS.forEach((col, colIndex) => {
      doc.rect(cx, rowY, col.width, DETAIL_ROW_HEIGHT).stroke();
      cellText(doc, values[colIndex], cx, rowY, col.width, { align: "center" });
      cx += col.width;
    });
  });
}

export async function generateCorSheetPdf(
  meta: CorReportMeta,
  rows: CorReportBundleRow[],
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24, font: FONT_PATH });
  doc.lineWidth(0.6).strokeColor(BLACK).fillColor(BLACK);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const contentWidth = right - left;

  function drawPageHeader() {
    doc.fontSize(14);
    boldText(doc, "CUT ORDER REPORT", left, doc.y, {
      align: "center",
      width: contentWidth,
      lineBreak: false,
    });
    doc.moveDown(0.8);

    // Three header rows, each split Label|Value|Label|Value, bordered —
    // same grid as the client's own form (W/O·Style·P/O / Buyer·Fabric /
    // Will Cut Qty·Wash).
    doc.fontSize(8);
    const rowHeight = 16;
    const headerTop = doc.y;
    const col1 = contentWidth * 0.1;
    const col2 = contentWidth * 0.3;
    const col3 = contentWidth * 0.1;
    const col4 = contentWidth - col1 - col2 - col3;
    const headerRows: Array<[string, string, string, string]> = [
      ["W/O", meta.workOrder, "STYLE", [meta.styleCode, meta.styleName].filter(Boolean).join(" · ") || "—"],
      ["BUYER", meta.customerName || "—", "FABRIC", meta.fabricCode || "—"],
      ["WILL CUT QTY", meta.willCutQty ? String(meta.willCutQty) : "—", "WASH", meta.wash || "—"],
    ];
    // P/O rides along the first row, to the right of Style (matches the
    // original's A4:C4/D4:H4/I4:L4/M4:O4/P4:Q4/R4:S4 split).
    const poLabelWidth = 30;
    const poValueWidth = 50;

    headerRows.forEach(([label1, value1, label2, value2], index) => {
      const rowY = headerTop + index * rowHeight;
      const isFirstRow = index === 0;
      const valueWidth2 = isFirstRow ? col4 - poLabelWidth - poValueWidth : col4;

      doc.rect(left, rowY, col1, rowHeight).stroke();
      doc.rect(left + col1, rowY, col2, rowHeight).stroke();
      doc.rect(left + col1 + col2, rowY, col3, rowHeight).stroke();
      doc.rect(left + col1 + col2 + col3, rowY, valueWidth2, rowHeight).stroke();
      cellText(doc, label1, left, rowY, col1, { bold: true });
      cellText(doc, value1, left + col1, rowY, col2);
      cellText(doc, label2, left + col1 + col2, rowY, col3, { bold: true });
      cellText(doc, value2, left + col1 + col2 + col3, rowY, valueWidth2);

      if (isFirstRow) {
        const poX = left + col1 + col2 + col3 + valueWidth2;
        doc.rect(poX, rowY, poLabelWidth, rowHeight).stroke();
        doc.rect(poX + poLabelWidth, rowY, poValueWidth, rowHeight).stroke();
        cellText(doc, "P/O", poX, rowY, poLabelWidth, { bold: true });
        cellText(doc, meta.saleOrderNo || "—", poX + poLabelWidth, rowY, poValueWidth);
      }
    });
    doc.y = headerTop + headerRows.length * rowHeight + 10;
  }

  drawPageHeader();

  const groupsPerRow = Math.max(1, Math.floor((contentWidth + GROUP_GAP) / (GROUP_WIDTH + GROUP_GAP)));
  const cutNos = sortedCuts(rows);
  const rowsByCut = new Map(cutNos.map((cutNo) => [cutNo, rows.filter((row) => row.cutNo === cutNo)]));

  for (let i = 0; i < cutNos.length; i += groupsPerRow) {
    const rowCuts = cutNos.slice(i, i + groupsPerRow);
    const maxBundles = Math.max(...rowCuts.map((cutNo) => rowsByCut.get(cutNo)!.length));
    const blockHeight = 4 * GROUP_ROW_HEIGHT + (maxBundles + 1) * DETAIL_ROW_HEIGHT + GROUP_GAP;

    if (doc.y + blockHeight > bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawPageHeader();
    }

    const blockTop = doc.y;
    rowCuts.forEach((cutNo, groupIndex) => {
      const x = left + groupIndex * (GROUP_WIDTH + GROUP_GAP);
      drawCutGroup(doc, x, blockTop, cutNo, rowsByCut.get(cutNo)!);
    });
    doc.y = blockTop + blockHeight;
  }

  doc.end();
  return done;
}

// Bundling ticket layout copied from the client's "BUNDLING TICKETS.xlsx":
// each bundle gets one line of identical stickers (one per garment panel).
// Each sticker is a 2-column Label | Value grid with W/O, CUT, B, SIZE, IL,
// Sr, Q, Shd, Shk, and SIZE / Sr printed as black bands.
// ponytail: fixed 7 stickers per bundle, matching the template's print area (G:Z).
// Make it a per-style setting if panel counts differ between styles.
const STICKERS_PER_BUNDLE = 7;
const STICKER_GAP = 6;
const STICKER_LABEL_WIDTH = 30;
const STICKER_ROW_HEIGHT = 10;
const STICKER_BAND_HEIGHT = 14;
const BUNDLE_GAP = 8;

type StickerField = { label: string; value: string; band?: boolean; lead?: boolean };

function stickerFields(meta: CorReportMeta, row: CorReportBundleRow): StickerField[] {
  return [
    { label: "W/O", value: meta.workOrder, lead: true },
    { label: "CUT", value: row.cutNo },
    // Bundle IDs are "<work order>-<seq>"; W/O already has its own row.
    { label: "B", value: row.bundleNo.split("-").pop() ?? row.bundleNo },
    { label: "SIZE", value: row.inseam ? `${row.size}/${row.inseam}"` : row.size, band: true },
    { label: "IL", value: row.color },
    { label: "Sr", value: serialRangeLabel(row), band: true },
    { label: "Q", value: String(row.bundleQty) },
    { label: "Shd", value: row.shade },
    { label: "Shk", value: row.shrinkage },
  ];
}

const fieldHeight = (field: StickerField) =>
  field.band || field.lead ? STICKER_BAND_HEIGHT : STICKER_ROW_HEIGHT;

function drawSticker(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  fields: StickerField[],
) {
  const valueWidth = width - STICKER_LABEL_WIDTH;
  let rowY = y;
  fields.forEach((field) => {
    const height = fieldHeight(field);
    const fontSize = field.band || field.lead ? 9 : 7;
    if (field.band) doc.rect(x, rowY, width, height).fill(BLACK);
    doc.lineWidth(0.4).strokeColor(BLACK);
    doc.rect(x, rowY, STICKER_LABEL_WIDTH, height).stroke();
    doc.rect(x + STICKER_LABEL_WIDTH, rowY, valueWidth, height).stroke();

    doc.fillColor(field.band ? "#ffffff" : BLACK).fontSize(fontSize);
    const textY = rowY + (height - fontSize * 1.15) / 2;
    const options: PDFKit.Mixins.TextOptions = { lineBreak: false, ellipsis: true };
    boldText(doc, field.label, x + 2, textY, { ...options, width: STICKER_LABEL_WIDTH - 4, align: "center" });
    boldText(doc, field.value || "—", x + STICKER_LABEL_WIDTH + 3, textY, { ...options, width: valueWidth - 6 });
    doc.fillColor(BLACK);
    rowY += height;
  });
}

export async function generateBundlingTicketsPdf(
  meta: CorReportMeta,
  rows: CorReportBundleRow[],
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24, font: FONT_PATH });
  doc.lineWidth(0.4).strokeColor(BLACK).fillColor(BLACK);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const { left, top } = doc.page.margins;
  const pageWidth = doc.page.width - left - doc.page.margins.right;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const stickerWidth = (pageWidth - STICKER_GAP * (STICKERS_PER_BUNDLE - 1)) / STICKERS_PER_BUNDLE;

  let y = top;
  rows.forEach((row) => {
    const fields = stickerFields(meta, row);
    const stickerHeight = fields.reduce((sum, field) => sum + fieldHeight(field), 0);
    if (y + stickerHeight > pageBottom) {
      doc.addPage();
      y = top;
    }
    for (let i = 0; i < STICKERS_PER_BUNDLE; i += 1) {
      drawSticker(doc, left + i * (stickerWidth + STICKER_GAP), y, stickerWidth, fields);
    }
    y += stickerHeight + BUNDLE_GAP;
  });

  doc.end();
  return done;
}
