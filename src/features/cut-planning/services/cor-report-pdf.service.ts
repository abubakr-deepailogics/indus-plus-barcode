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
    const values = [String(index + 1), row.size || "—", `1 TO ${row.bundleQty}`, String(row.bundleQty), ""];
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

const TICKET_COLUMNS = 4;
const TICKET_GAP = 10;
const TICKET_HEIGHT = 118;
const TICKET_HEADER_HEIGHT = 16;
const TICKET_FOOTER_HEIGHT = 18;

function drawCutGuides(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  // Small corner tick marks just outside the card, like a cut/trim guide on
  // a real ticket sheet — purely decorative, signals "cut along here".
  const tick = 5;
  doc.lineWidth(0.5).strokeColor("#94a3b8");
  const corners: Array<[number, number, number, number, number, number]> = [
    [x, y, -tick, 0, 0, -tick],
    [x + w, y, tick, 0, 0, -tick],
    [x, y + h, -tick, 0, 0, tick],
    [x + w, y + h, tick, 0, 0, tick],
  ];
  corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
    doc.moveTo(cx + dx1, cy + dy1).lineTo(cx, cy).lineTo(cx + dx2, cy + dy2).stroke();
  });
  doc.strokeColor(BLACK).lineWidth(0.6);
}

function drawBundlingTicket(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  meta: CorReportMeta,
  row: CorReportBundleRow,
) {
  drawCutGuides(doc, x, y, w, TICKET_HEIGHT);
  doc.lineWidth(0.8).strokeColor(BLACK).rect(x, y, w, TICKET_HEIGHT).stroke();

  // Header band — W/O on the left, "BUNDLE TICKET" eyebrow on the right.
  doc.lineWidth(0.6);
  doc.moveTo(x, y + TICKET_HEADER_HEIGHT).lineTo(x + w, y + TICKET_HEADER_HEIGHT).stroke();
  doc.fontSize(7.5);
  boldText(doc, `W/O ${meta.workOrder}`, x + 8, y + 4.5, { width: w * 0.6, lineBreak: false });
  doc.fontSize(5.5);
  doc.text("BUNDLE TICKET", x + w * 0.4, y + 5.5, {
    width: w * 0.55,
    align: "right",
    lineBreak: false,
    characterSpacing: 0.5,
  });

  // Focal point — the bundle number, large and centered, like a ticket stub.
  const focalTop = y + TICKET_HEADER_HEIGHT + 6;
  doc.fontSize(5.5);
  doc.text("BUNDLE NO", x, focalTop, { width: w, align: "center", lineBreak: false, characterSpacing: 0.5 });
  doc.fontSize(26);
  boldText(doc, row.bundleNo, x, focalTop + 9, { width: w, align: "center", lineBreak: false });

  // Dashed separator — the visual "tear here" between the stub and details.
  const dashY = focalTop + 42;
  doc.dash(2, { space: 2 }).lineWidth(0.6).moveTo(x + 6, dashY).lineTo(x + w - 6, dashY).stroke();
  doc.undash();

  // CUT / SIZE side by side, label over value.
  const fieldTop = dashY + 7;
  const halfWidth = (w - 16) / 2;
  doc.fontSize(5.5);
  doc.text("CUT", x + 8, fieldTop, { width: halfWidth, lineBreak: false });
  doc.text("SIZE", x + 8 + halfWidth, fieldTop, { width: halfWidth, align: "right", lineBreak: false });
  doc.fontSize(10);
  boldText(doc, row.cutNo || "—", x + 8, fieldTop + 7, { width: halfWidth, lineBreak: false });
  boldText(doc, row.size || "—", x + 8 + halfWidth, fieldTop + 7, {
    width: halfWidth,
    align: "right",
    lineBreak: false,
  });

  // IL (colour/wash), full width.
  doc.fontSize(5.5);
  doc.text("COLOUR / IL", x + 8, fieldTop + 20, { width: w - 16, lineBreak: false });
  doc.fontSize(8.5);
  cellText(doc, row.color || "—", x + 5, fieldTop + 25, w - 10);

  // Footer strip — the serial range, set apart with its own border.
  const footerY = y + TICKET_HEIGHT - TICKET_FOOTER_HEIGHT;
  doc.lineWidth(0.6).moveTo(x, footerY).lineTo(x + w, footerY).stroke();
  doc.fontSize(8);
  boldText(doc, `SR   1 — ${row.bundleQty}`, x, footerY + 5, {
    width: w,
    align: "center",
    lineBreak: false,
  });
}

// A proper cut-and-attach ticket per bundle — header band, a large focal
// bundle number, a dashed tear line, CUT/SIZE/Colour fields and a bordered
// serial-range footer — tiled across the page with cut guides between
// cards, so a full sheet of bundles prints ready to trim and attach.
export async function generateBundlingTicketsPdf(
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

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const ticketWidth = (pageWidth - TICKET_GAP * (TICKET_COLUMNS - 1)) / TICKET_COLUMNS;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight + TICKET_GAP) / (TICKET_HEIGHT + TICKET_GAP)));
  const perPage = TICKET_COLUMNS * rowsPerPage;

  rows.forEach((row, index) => {
    const indexOnPage = index % perPage;
    if (index > 0 && indexOnPage === 0) doc.addPage();
    const column = indexOnPage % TICKET_COLUMNS;
    const line = Math.floor(indexOnPage / TICKET_COLUMNS);
    const x = doc.page.margins.left + column * (ticketWidth + TICKET_GAP);
    const y = doc.page.margins.top + line * (TICKET_HEIGHT + TICKET_GAP);
    drawBundlingTicket(doc, x, y, ticketWidth, meta, row);
  });

  doc.end();
  return done;
}
