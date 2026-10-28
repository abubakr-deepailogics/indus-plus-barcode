// Generic client-side "export to Excel" helper — Excel opens .csv natively,
// so this avoids pulling in a spreadsheet-writing dependency (the one
// available on npm, `xlsx`, carries unpatched high-severity CVEs) for what
// is otherwise a plain flat-table export.
function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const BOM = String.fromCharCode(0xfeff);

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines = [headers, ...rows].map((row) =>
    row.map(csvEscape).join(","),
  );
  // Leading BOM so Excel detects UTF-8 and renders non-ASCII characters
  // (é, —, etc.) correctly instead of mangling them.
  const csvContent = BOM + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  // Callers build filenames from real-world values (work order numbers like
  // "W/O-001939") that aren't filesystem-safe as-is — strip anything but
  // alphanumerics/dot/dash/underscore so the browser never interprets a "/"
  // as a path separator.
  const safeName = filename.replace(/[^A-Za-z0-9._-]+/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName.endsWith(".csv") ? safeName : `${safeName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

type ExcelCell = string | number | null | undefined;

function xmlEscape(value: ExcelCell): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const entries: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  let offset = 0;
  const write = (target: Uint8Array, index: number, value: number, bytes: number) => {
    for (let position = 0; position < bytes; position += 1) target[index + position] = (value >>> (position * 8)) & 0xff;
  };

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const header = new Uint8Array(30 + name.length);
    write(header, 0, 0x04034b50, 4);
    write(header, 4, 20, 2);
    write(header, 14, crc, 4);
    write(header, 18, file.data.length, 4);
    write(header, 22, file.data.length, 4);
    write(header, 26, name.length, 2);
    header.set(name, 30);
    parts.push(header, file.data);
    entries.push({ name, crc, size: file.data.length, offset });
    offset += header.length + file.data.length;
  }

  const centralOffset = offset;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.name.length);
    write(header, 0, 0x02014b50, 4);
    write(header, 4, 20, 2);
    write(header, 6, 20, 2);
    write(header, 16, entry.crc, 4);
    write(header, 20, entry.size, 4);
    write(header, 24, entry.size, 4);
    write(header, 28, entry.name.length, 2);
    write(header, 42, entry.offset, 4);
    header.set(entry.name, 46);
    parts.push(header);
    offset += header.length;
  }

  const end = new Uint8Array(22);
  write(end, 0, 0x06054b50, 4);
  write(end, 8, entries.length, 2);
  write(end, 10, entries.length, 2);
  write(end, 12, offset - centralOffset, 4);
  write(end, 16, centralOffset, 4);
  parts.push(end);

  const result = new Uint8Array(offset + end.length);
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}

/** Creates a genuine .xlsx workbook without adding a spreadsheet dependency. */
export function downloadXlsx(
  filename: string,
  headers: string[],
  rows: ExcelCell[][],
  sheetName = "Report",
): void {
  const rowXml = [headers, ...rows]
    .map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value) => typeof value === "number" ? `<c t="n"><v>${value}</v></c>` : `<c t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join("")}</row>`)
    .join("");
  const encoder = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`) },
  ];
  const workbook = zipStore(files);
  const blob = new Blob([workbook.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const safeName = filename.replace(/[^A-Za-z0-9._-]+/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName.endsWith(".xlsx") ? safeName : `${safeName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
