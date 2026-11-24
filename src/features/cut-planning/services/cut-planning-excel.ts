import ExcelJS from "exceljs";
import type { CutPlanningInseamGroup, SizeQuantities } from "../types";
import { shadeGroupKey } from "./shade-groups";

// Excel export of the "SIZE DETAIL & CHECK LIST" print: same blocks, columns,
// colours and calculations as the print. Every calculated cell is a live
// formula (so edits recalculate) that also stores its computed value (so it
// shows correctly where Excel doesn't calculate, e.g. Protected View).
// All inseams sit side by side on one sheet (the print splits wide orders
// across pages; Excel scrolls instead and fits to one page width on print).

export type CutPlanningExcelRow = {
  markerWidthCm: number | null;
  shrinkage: string;
  markerPlies: number;
  plyType: string;
  cutNo: string;
  shade: string;
  markerLengthM: number | null;
  /** Ratio per size, one entry per `groups` item (same order). */
  sizeQuantities: Array<SizeQuantities | undefined>;
};

export type CutPlanningExcelInput = {
  header: {
    date: string;
    workOrder: string;
    styleNo: string;
    styleName: string;
    customer: string;
    average: number | null;
    fabric: string;
    pocketing: string;
    pocketingBomAverage: string;
    fusing: string;
    fusingAverage: string;
    wash: string;
  };
  groups: CutPlanningInseamGroup[];
  rows: CutPlanningExcelRow[];
  /** GROUP table lines as printed (summarizeShadeGroups keys; "-" = no shade). */
  shadeGroups: string[];
};

// Print colours (CutPlanningPage print CSS).
const COLOR = {
  title: "FFFFE699",
  label: "FF9BC2E6",
  order: "FF92D050",
  groupBody: "FFDDEBF7",
  groupHead: "FFBDD7EE",
  head: "FFDCE6F1",
  yellow: "FFFFFF00",
  balance: "FFC6EFCE",
  balanceText: "FF006100",
  fusing: "FFFDE9D9",
  total: "FFF2F2F2",
  red: "FFFF0000",
  blue: "FF0000FF",
  bar: "FF4F81BD",
  white: "FFFFFFFF",
  black: "FF000000",
} as const;

type CellStyle = {
  fill?: string;
  color?: string;
  bold?: boolean;
  size?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
  rotate?: number;
  wrap?: boolean;
  border?: boolean;
};

const FONT = "Arial";
const BASE_SIZE = 9;
const thin = { style: "thin" as const, color: { argb: COLOR.black } };
const medium = { style: "medium" as const, color: { argb: COLOR.black } };
/** Number shown as "-" when zero, like the print's blank/"-" cells. */
const INT_OR_DASH = '#,##0;-#,##0;"-"';
const INT_OR_BLANK = '#,##0;-#,##0;""';
const TWO_DP = '0.00;-0.00;"-"';

/** SUMIF criteria for an exact match (escapes wildcards; "" matches blanks). */
const exactCriteria = (value: string) => `"=${value.replace(/[~*?]/g, "~$&").replace(/"/g, '""')}"`;

export function buildCutPlanningWorkbook(input: CutPlanningExcelInput): ExcelJS.Workbook {
  const { header, groups, rows, shadeGroups } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("Cut Planning", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.24, right: 0.24, top: 0.2, bottom: 0.2, header: 0, footer: 0 },
    },
    views: [{ showGridLines: false }],
  });

  // ---- Column map (mirrors the print sheet's colgroup) --------------------
  const sizeColumns = groups.flatMap((group, groupIndex) =>
    group.sizeColumns.map((size) => ({ group, groupIndex, size })),
  );
  // Header blocks above the sizes need at least 3 columns.
  const sizeArea = Math.max(sizeColumns.length, 3);
  const C = {
    width: 1, sr: 2, pcs: 3, shrink: 4, plys: 5, plyType: 6, cut: 7, bundle: 8,
    firstSize: 9,
    lastSize: 8 + sizeArea,
    fabric: 9 + sizeArea,
    shade: 10 + sizeArea,
    mavg: 11 + sizeArea,
    mkLength: 12 + sizeArea,
  };
  const lastColumn = C.mkLength;
  const widths: Record<number, number> = {
    [C.width]: 9, [C.sr]: 4, [C.pcs]: 8, [C.shrink]: 9, [C.plys]: 6, [C.plyType]: 9,
    [C.cut]: 7, [C.bundle]: 8, [C.fabric]: 8, [C.shade]: 7, [C.mavg]: 7, [C.mkLength]: 9,
  };
  for (let column = 1; column <= lastColumn; column += 1) {
    sheet.getColumn(column).width = widths[column] ?? 5;
  }
  const letter = (column: number) => sheet.getColumn(column).letter;
  const ref = (row: number, column: number, absolute = false) =>
    absolute ? `$${letter(column)}$${row}` : `${letter(column)}${row}`;

  // ---- Cell helpers -------------------------------------------------------
  const style = (cell: ExcelJS.Cell, s: CellStyle) => {
    cell.font = { name: FONT, size: s.size ?? BASE_SIZE, bold: s.bold ?? false, color: { argb: s.color ?? COLOR.black } };
    cell.alignment = {
      horizontal: s.align ?? "center",
      vertical: "middle",
      wrapText: s.wrap ?? true,
      ...(s.rotate ? { textRotation: s.rotate } : {}),
    };
    if (s.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.fill } };
    if (s.numFmt) cell.numFmt = s.numFmt;
    if (s.border !== false) cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  };
  /** Writes `value` into a (possibly merged) block and styles every cell in it. */
  const put = (
    r1: number, c1: number, r2: number, c2: number,
    value: ExcelJS.CellValue, s: CellStyle = {},
  ) => {
    if (r1 !== r2 || c1 !== c2) sheet.mergeCells(r1, c1, r2, c2);
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) style(sheet.getCell(r, c), s);
    }
    sheet.getCell(r1, c1).value = value;
    return sheet.getCell(r1, c1);
  };
  // Every formula carries its value: Excel shows stored results as-is in
  // Protected View and in manual-calculation mode, where it never recalculates.
  const formula = (expression: string, result: number | string): ExcelJS.CellFormulaValue =>
    ({ formula: expression, result, date1904: false });
  const values = computeSheetValues(input, sizeColumns);

  // ---- Sheet (bottom part) rows: computed first so the header can point at them
  const groupRowCount = 2 + Math.max(1, shadeGroups.length);
  const headerRows = Math.max(6, groupRowCount); // 2 label rows + 3-row TOTAL PCS block + value row
  const H = { start: 3, end: 2 + headerRows };
  const T = { balance: H.end + 2, inseam: H.end + 3, size: H.end + 4, qty: H.end + 5 };
  const dataStart = T.qty + 1;
  const dataEnd = dataStart + rows.length - 1;
  const totalRow = dataStart + rows.length;
  const liningRow = totalRow + 1;
  const hasRows = rows.length > 0;
  const range = (column: number, absolute = false) =>
    `${ref(dataStart, column, absolute)}:${ref(dataEnd, column, absolute)}`;
  const totalPcsRef = ref(totalRow, C.pcs);
  const totalFabricRef = ref(totalRow, C.fabric);
  const qtyTotalRef = ref(T.qty, C.cut);
  const closingAvg = `IF(${totalPcsRef}>0,${totalFabricRef}/${totalPcsRef},"")`;

  // ---- Title band (print .cp-header-title) --------------------------------
  put(1, 1, 1, lastColumn, "SIZE DETAIL & CHECK LIST", { fill: COLOR.title, bold: true, size: 16 });
  put(2, 1, 2, lastColumn, `Date: ${header.date}`, { fill: COLOR.title, bold: true, align: "left" });
  sheet.getRow(1).height = 26;

  // ---- Header GROUP table (A:D) — FABRIC/PCS are SUMIFs over the rows -----
  put(H.start, C.width, H.start, C.width, "GROUP", { fill: COLOR.groupHead, bold: true });
  put(H.start, C.sr, H.start, C.pcs, "FABRIC", { fill: COLOR.groupHead, bold: true });
  put(H.start, C.shrink, H.start, C.shrink, "PCS", { fill: COLOR.groupHead, bold: true });
  const groupLines = shadeGroups.length > 0 ? shadeGroups : ["-"];
  groupLines.forEach((shadeGroup, index) => {
    const row = H.start + 1 + index;
    const criteria = exactCriteria(shadeGroup === "-" ? "" : shadeGroup);
    const groupValues = values.shadeGroups.get(shadeGroup) ?? { fabric: 0, pcs: 0 };
    const sumIf = (column: number, result: number) =>
      hasRows && shadeGroups.length > 0
        ? formula(`SUMIF(${range(C.shade, true)},${criteria},${range(column, true)})`, result)
        : 0;
    put(row, C.width, row, C.width, shadeGroup, { fill: COLOR.groupBody, bold: true });
    put(row, C.sr, row, C.pcs, sumIf(C.fabric, groupValues.fabric), { fill: COLOR.groupBody, bold: true, numFmt: INT_OR_DASH });
    put(row, C.shrink, row, C.shrink, sumIf(C.pcs, groupValues.pcs), { fill: COLOR.white, bold: true, color: COLOR.red, numFmt: INT_OR_DASH });
  });
  const groupTotalRow = H.start + 1 + groupLines.length;
  const groupFirst = H.start + 1;
  const groupLast = groupTotalRow - 1;
  put(groupTotalRow, C.width, groupTotalRow, C.width, "Total", { fill: COLOR.groupHead, bold: true });
  put(groupTotalRow, C.sr, groupTotalRow, C.pcs, formula(`SUM(${ref(groupFirst, C.sr)}:${ref(groupLast, C.sr)})`, values.totalFabric), { fill: COLOR.groupHead, bold: true, numFmt: INT_OR_DASH });
  put(groupTotalRow, C.shrink, groupTotalRow, C.shrink, formula(`SUM(${ref(groupFirst, C.shrink)}:${ref(groupLast, C.shrink)})`, values.totalPcs), { fill: COLOR.white, bold: true, color: COLOR.red, numFmt: INT_OR_DASH });
  if (groupTotalRow < H.end) put(groupTotalRow + 1, C.width, H.end, C.shrink, "", { fill: COLOR.groupBody });

  // ---- Header right block (E:end) -----------------------------------------
  // Rows: labels 1, values 1 (merged down), labels 2, values 2 (3 rows).
  const labels1 = H.start;
  const values1 = { from: H.start + 1, to: H.end - 4 };
  const labels2 = H.end - 3;
  const values2 = { from: H.end - 2, to: H.end };
  const styleSpan = Math.max(1, Math.round(sizeArea * 0.3));
  const fusingSpan = Math.max(1, Math.round(sizeArea * 0.2));
  const S = {
    styleFrom: C.firstSize,
    styleTo: C.firstSize + styleSpan - 1,
    pocketFrom: C.firstSize + styleSpan,
    pocketTo: C.lastSize - fusingSpan,
    fusingFrom: C.lastSize - fusingSpan + 1,
    fusingTo: C.lastSize,
  };
  const label = { fill: COLOR.label, bold: true, size: 11 };
  put(labels1, C.plys, labels1, C.bundle, "ORDER #", label);
  put(labels1, S.styleFrom, labels1, S.styleTo, "STYLE", label);
  put(labels1, S.pocketFrom, labels1, S.fusingTo, "CUSTOMER", label);
  put(labels1, C.fabric, labels1, C.mkLength, "PO", label);
  // All-digit order numbers are stored as numbers with their leading zeros as
  // a format, so Excel doesn't flag "number stored as text".
  const orderIsNumber = /^\d{1,15}$/.test(header.workOrder);
  put(values1.from, C.plys, values1.to, C.bundle, orderIsNumber ? Number(header.workOrder) : header.workOrder, {
    fill: COLOR.order, bold: true, size: 18, numFmt: orderIsNumber ? "0".repeat(header.workOrder.length) : undefined,
  });
  const styleText: ExcelJS.CellValue = header.styleName && header.styleName !== header.styleNo
    ? { richText: [
      { text: header.styleNo, font: { name: FONT, size: 12, bold: true } },
      { text: `\n${header.styleName}`, font: { name: FONT, size: 8 } },
    ] }
    : header.styleNo;
  put(values1.from, S.styleFrom, values1.to, S.styleTo, styleText, { bold: true, size: 12 });
  put(values1.from, S.pocketFrom, values1.to, S.fusingTo, header.customer.toUpperCase(), { bold: true, size: 14 });
  put(values1.from, C.fabric, values1.to, C.mkLength, "", {});

  put(labels2, C.plys, labels2, C.plyType, "TOTAL PCS", { bold: true, size: 8 });
  put(labels2, C.cut, labels2, C.bundle, "AVERAGE", { bold: true, size: 8 });
  put(labels2, S.styleFrom, labels2, S.styleTo, "FABRIC", label);
  put(labels2, S.pocketFrom, labels2, S.pocketTo, "POCKETING/PIPING", label);
  put(labels2, S.fusingFrom, labels2, S.fusingTo, "FUSING", label);
  put(labels2, C.fabric, labels2, C.mkLength, "WASH", label);
  // Excel G10 (QTY total), G37 (QTY - planned), G38 (fabric used, blue).
  put(values2.from, C.plys, values2.from, C.plyType, formula(qtyTotalRef, values.qtyTotal), { bold: true, size: 14, color: COLOR.red, numFmt: INT_OR_DASH });
  put(values2.from + 1, C.plys, values2.from + 1, C.plyType, formula(
    `"PCS (+,-) "&TEXT(${qtyTotalRef}-${totalPcsRef},"0")`,
    `PCS (+,-) ${Math.round(values.qtyTotal - values.totalPcs)}`,
  ), { bold: true, size: 7 });
  put(values2.to, C.plys, values2.to, C.plyType, formula(totalFabricRef, values.totalFabric), { bold: true, size: 8, color: COLOR.blue, numFmt: INT_OR_DASH });
  put(values2.from, C.cut, values2.to, C.bundle, header.average ?? "-", { bold: true, size: 20, numFmt: TWO_DP });
  put(values2.from, S.styleFrom, values2.to, S.styleTo, header.fabric || "-", { bold: true });
  put(values2.from, S.pocketFrom, values2.to, S.pocketTo, header.pocketing || "-", { bold: true });
  put(values2.from, S.fusingFrom, values2.to, S.fusingTo, header.fusing || "-", { bold: true, size: 7 });
  put(values2.from, C.fabric, values2.to, C.mkLength, header.wash.toUpperCase() || "-", { bold: true, size: 11 });

  // ---- Sheet header rows (print thead) ------------------------------------
  const head = { fill: COLOR.head, bold: true };
  const redHead = { ...head, color: COLOR.red };
  const inseamStart = new Set(
    sizeColumns.flatMap((entry, index) => (entry.size === entry.group.sizeColumns[0] ? [C.firstSize + index] : [])),
  );
  sheet.getCell(T.balance, C.width).value = "";
  put(T.balance, C.sr, T.balance, C.sr, "SR", { ...redHead, size: 7 });
  put(T.balance, C.pcs, T.balance, C.pcs, "TOTAL PCS", { ...head, size: 7 });
  put(T.balance, C.shrink, T.balance, C.shrink, "SHRINKAGE", { ...redHead, size: 7 });
  put(T.balance, C.plys, T.balance, C.plyType, "PLYS", redHead);
  put(T.balance, C.cut, T.balance, C.cut, "CUT #", redHead);
  put(T.balance, C.bundle, T.balance, C.bundle, "BUNDLE", { ...redHead, size: 7 });
  put(
    T.balance, C.fabric, T.balance, C.mkLength,
    `FUSING AVG.${header.fusingAverage ? ` ${header.fusingAverage}` : ""}`,
    { fill: COLOR.fusing, color: COLOR.red, size: 10 },
  );

  put(T.inseam, C.width, T.qty, C.width, "FABRIC WIDTH", { fill: COLOR.head, color: COLOR.red, bold: true, size: 8, rotate: 90 });
  put(T.inseam, C.sr, T.inseam, C.plyType, "CLOSING AVG", { fill: COLOR.head, color: COLOR.red, size: 11 });
  put(T.inseam, C.cut, T.inseam, C.bundle, "inseam", { fill: COLOR.head, size: 11 });
  put(T.size, C.sr, T.qty, C.plyType, formula(closingAvg, values.closingAvg), { fill: COLOR.yellow, color: COLOR.red, bold: true, size: 22, numFmt: TWO_DP });
  put(T.size, C.cut, T.size, C.cut, formula(totalPcsRef, values.totalPcs), { bold: true, numFmt: INT_OR_DASH });
  put(T.size, C.bundle, T.size, C.bundle, "SIZE", { bold: true, size: 7 });
  put(T.qty, C.cut, T.qty, C.cut, formula(
    sizeColumns.length ? `SUM(${ref(T.qty, C.firstSize)}:${ref(T.qty, C.firstSize + sizeColumns.length - 1)})` : "0",
    values.qtyTotal,
  ), { fill: COLOR.head, bold: true, numFmt: INT_OR_DASH });
  put(T.qty, C.bundle, T.qty, C.bundle, "QTY", { fill: COLOR.head, bold: true, size: 7 });

  let column = C.firstSize;
  groups.forEach((group) => {
    if (group.sizeColumns.length === 0) return;
    put(T.inseam, column, T.inseam, column + group.sizeColumns.length - 1, group.inseam ?? "-", {
      fill: COLOR.yellow, color: COLOR.red, size: 14,
    });
    column += group.sizeColumns.length;
  });
  sizeColumns.forEach(({ group, size }, index) => {
    const col = C.firstSize + index;
    const qty = group.willCutQuantities[size] || 0;
    put(T.size, col, T.size, col, sizeCellValue(size), { bold: true });
    put(T.qty, col, T.qty, col, qty || null, { fill: COLOR.head, bold: true, numFmt: INT_OR_BLANK });
    // Print's green row (Excel row 39): QTY - planned (ratio x plys).
    const planned = hasRows ? `SUMPRODUCT(${range(col)},${range(C.plys)})` : "0";
    put(T.balance, col, T.balance, col, formula(`${ref(T.qty, col)}-${planned}`, qty - values.plannedBySize[index]), {
      fill: COLOR.balance, color: COLOR.balanceText, numFmt: "0",
    });
  });
  for (let col = C.firstSize + sizeColumns.length; col <= C.lastSize; col += 1) {
    [T.balance, T.inseam, T.size, T.qty].forEach((row) => put(row, col, row, col, "", {}));
  }
  put(T.inseam, C.fabric, T.inseam, C.mkLength, "", { fill: COLOR.fusing });
  put(T.size, C.fabric, T.size, C.mkLength, "", {});
  put(T.qty, C.fabric, T.qty, C.fabric, "FABRIC", redHead);
  put(T.qty, C.shade, T.qty, C.shade, "SHADE", redHead);
  put(T.qty, C.mavg, T.qty, C.mavg, "M.AVG", { ...redHead, fill: COLOR.yellow });
  put(T.qty, C.mkLength, T.qty, C.mkLength, "MK LENGTH", head);

  // ---- Marker rows (print tbody) ------------------------------------------
  rows.forEach((row, index) => {
    const r = dataStart + index;
    const sizeRange = sizeColumns.length
      ? `${ref(r, C.firstSize)}:${ref(r, C.firstSize + sizeColumns.length - 1)}`
      : null;
    const ratio = sizeRange ? `SUM(${sizeRange})` : "0";
    const computed = values.rows[index];
    put(r, C.width, r, C.width, row.markerWidthCm == null ? "" : `${row.markerWidthCm} CM`, { bold: true, size: 8 });
    put(r, C.sr, r, C.sr, index + 1, { size: 7 });
    put(r, C.pcs, r, C.pcs, formula(`${ratio}*${ref(r, C.plys)}`, computed.pcs), { bold: true, align: "right", numFmt: INT_OR_BLANK });
    put(r, C.shrink, r, C.shrink, row.shrinkage, { bold: true });
    put(r, C.plys, r, C.plys, row.markerPlies || null, { numFmt: INT_OR_BLANK });
    put(r, C.plyType, r, C.plyType, row.plyType, { bold: true, size: 7 });
    put(r, C.cut, r, C.cut, sizeCellValue(row.cutNo.trim()), {});
    put(r, C.bundle, r, C.bundle, formula(`IF(${ratio}>0,"1 - "&${ratio},"")`, computed.ratio > 0 ? `1 - ${computed.ratio}` : ""), {});
    sizeColumns.forEach(({ groupIndex, size }, sizeIndex) => {
      const col = C.firstSize + sizeIndex;
      put(r, col, r, col, row.sizeQuantities[groupIndex]?.[size] || null, { bold: true, numFmt: INT_OR_BLANK });
    });
    for (let col = C.firstSize + sizeColumns.length; col <= C.lastSize; col += 1) put(r, col, r, col, null, {});
    const mk = ref(r, C.mkLength);
    put(r, C.fabric, r, C.fabric, formula(`IF(${mk}="","",${mk}*${ref(r, C.plys)})`, computed.fabric ?? ""), {
      fill: COLOR.yellow, color: COLOR.red, numFmt: INT_OR_DASH,
    });
    // A blank shade stays an empty cell so the "-" group's SUMIF matches it.
    put(r, C.shade, r, C.shade, row.shade.trim().replace(/\s+/g, " ") || null, { bold: true });
    put(r, C.mavg, r, C.mavg, formula(`IF(AND(N(${ref(r, C.fabric)})>0,${ref(r, C.pcs)}>0),${ref(r, C.fabric)}/${ref(r, C.pcs)},"")`, computed.markerAvg ?? ""), {
      fill: COLOR.yellow, bold: true, numFmt: TWO_DP,
    });
    put(r, C.mkLength, r, C.mkLength, row.markerLengthM, { bold: true, numFmt: TWO_DP });
  });
  if (hasRows) {
    // The print's blue bar behind TOTAL PCS.
    sheet.addConditionalFormatting({
      ref: range(C.pcs),
      rules: [{
        type: "dataBar",
        priority: 1,
        gradient: true,
        cfvo: [{ type: "num", value: 0 }, { type: "max" }],
        color: { argb: COLOR.bar },
      } as ExcelJS.DataBarRuleType],
    });
  }

  // ---- TOTAL row and lining line (Excel rows 117-118) ---------------------
  const sum = (col: number, result: number) => formula(hasRows ? `SUM(${range(col)})` : "0", result);
  const totalStyle = { fill: COLOR.total, bold: true };
  put(totalRow, C.width, totalRow, C.sr, "TOTAL", totalStyle);
  put(totalRow, C.pcs, totalRow, C.pcs, sum(C.pcs, values.totalPcs), { ...totalStyle, numFmt: INT_OR_BLANK });
  put(totalRow, C.shrink, totalRow, C.shrink, "", totalStyle);
  put(totalRow, C.plys, totalRow, C.plys, sum(C.plys, values.totalPlies), { ...totalStyle, numFmt: INT_OR_BLANK });
  put(totalRow, C.plyType, totalRow, C.bundle, "", totalStyle);
  for (let col = C.firstSize; col <= C.lastSize; col += 1) put(totalRow, col, totalRow, col, "", totalStyle);
  put(totalRow, C.fabric, totalRow, C.fabric, sum(C.fabric, values.totalFabric), { fill: COLOR.yellow, color: COLOR.red, bold: true, numFmt: INT_OR_DASH });
  put(totalRow, C.shade, totalRow, C.shade, "", totalStyle);
  put(totalRow, C.mavg, totalRow, C.mavg, formula(closingAvg, values.closingAvg), { fill: COLOR.yellow, bold: true, numFmt: TWO_DP });
  put(totalRow, C.mkLength, totalRow, C.mkLength, "", totalStyle);

  const lining = { fill: COLOR.total, bold: true, size: 8 };
  put(liningRow, C.width, liningRow, C.width, "LINING WIDTH", lining);
  put(liningRow, C.sr, liningRow, C.shrink, "PC PLAN", lining);
  put(liningRow, C.plys, liningRow, C.plyType, "BOM AVG", lining);
  put(liningRow, C.cut, liningRow, C.bundle, header.pocketingBomAverage || "-", { fill: COLOR.total, bold: true });
  put(liningRow, C.firstSize, liningRow, C.lastSize, header.pocketing || "-", { fill: COLOR.total, bold: true, align: "left" });
  put(liningRow, C.fabric, liningRow, C.shade, "PC C.AVG", lining);
  put(liningRow, C.mavg, liningRow, C.mkLength, "", { fill: COLOR.total });

  // Thick line where each inseam starts (print .print-inseam-start).
  for (let r = T.balance; r <= totalRow; r += 1) {
    inseamStart.forEach((col) => {
      const cell = sheet.getCell(r, col);
      cell.border = { ...cell.border, left: medium };
    });
  }

  // Row heights: tall value rows in the header (big ORDER # / AVERAGE, the
  // two-line STYLE), readable sheet rows below.
  const valueRows1 = values1.to - values1.from + 1;
  for (let r = values1.from; r <= values1.to; r += 1) sheet.getRow(r).height = Math.max(16, 36 / valueRows1);
  for (let r = values2.from; r <= values2.to; r += 1) sheet.getRow(r).height = 15;
  sheet.getRow(T.inseam).height = 20;
  for (let r = dataStart; r <= liningRow; r += 1) sheet.getRow(r).height = 16;

  sheet.pageSetup.printArea = `A1:${ref(liningRow, lastColumn)}`;
  return workbook;
}

/** Whole-number text ("5", "28") as a number so Excel doesn't flag it; "5A" stays text. */
function sizeCellValue(value: string): string | number {
  return /^\d{1,9}$/.test(value) ? Number(value) : value;
}

/**
 * The value of every formula the sheet writes, computed the same way Excel
 * will: stored as each formula's cached result (see `formula` above).
 */
export function computeSheetValues(
  input: CutPlanningExcelInput,
  sizeColumns: Array<{ groupIndex: number; size: string }>,
) {
  const rows = input.rows.map((row) => {
    const ratio = sizeColumns.reduce(
      (sum, { groupIndex, size }) => sum + (row.sizeQuantities[groupIndex]?.[size] || 0),
      0,
    );
    const pcs = ratio * row.markerPlies;
    const fabric = row.markerLengthM == null ? null : row.markerLengthM * row.markerPlies;
    return {
      ratio,
      pcs,
      fabric,
      markerAvg: fabric != null && fabric > 0 && pcs > 0 ? fabric / pcs : null,
      shadeGroup: shadeGroupKey(row.shade) || "-",
    };
  });
  const totalPcs = rows.reduce((sum, row) => sum + row.pcs, 0);
  const totalFabric = rows.reduce((sum, row) => sum + (row.fabric ?? 0), 0);
  const shadeGroups = new Map<string, { fabric: number; pcs: number }>();
  for (const row of rows) {
    const group = shadeGroups.get(row.shadeGroup) ?? { fabric: 0, pcs: 0 };
    group.fabric += row.fabric ?? 0;
    group.pcs += row.pcs;
    shadeGroups.set(row.shadeGroup, group);
  }
  return {
    rows,
    totalPcs,
    totalFabric,
    totalPlies: input.rows.reduce((sum, row) => sum + row.markerPlies, 0),
    closingAvg: totalPcs > 0 ? totalFabric / totalPcs : ("" as const),
    qtyTotal: sizeColumns.reduce(
      (sum, { groupIndex, size }) => sum + (input.groups[groupIndex]?.willCutQuantities[size] || 0),
      0,
    ),
    plannedBySize: sizeColumns.map(({ groupIndex, size }) =>
      input.rows.reduce((sum, row) => sum + (row.sizeQuantities[groupIndex]?.[size] || 0) * row.markerPlies, 0),
    ),
    shadeGroups,
  };
}
