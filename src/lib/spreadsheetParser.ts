import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Converts Excel column letters (e.g. 'A', 'B', 'Z', 'AA', 'AB') to 0-indexed column numbers.
 */
export function colLetterToIndex(col: string): number {
  let idx = 0;
  const upper = col.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Converts 0-indexed column number to Excel column letters (e.g. 0 -> 'A', 27 -> 'AB').
 */
export function indexToColLetter(idx: number): string {
  let col = "";
  let temp = idx;
  while (temp >= 0) {
    col = String.fromCharCode((temp % 26) + 65) + col;
    temp = Math.floor(temp / 26) - 1;
  }
  return col;
}

/**
 * Unescapes standard XML entities.
 */
export function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Escapes standard XML entities.
 */
export function escapeXml(str: any): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parses XLSX (OpenXML zip) binary buffer in browser or Node.js.
 */
export function parseXlsxBuffer(buffer: Uint8Array): ParsedSpreadsheet {
  const unzipped = unzipSync(buffer);

  // 1. Shared Strings Table
  const sharedStringsXml = unzipped["xl/sharedStrings.xml"]
    ? strFromU8(unzipped["xl/sharedStrings.xml"])
    : "";

  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const siMatches = sharedStringsXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/gi) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/gi) || [];
      const rawText = tMatches
        .map((t) => t.replace(/<t\b[^>]*>/i, "").replace(/<\/t>/i, ""))
        .join("");
      sharedStrings.push(unescapeXml(rawText));
    }
  }

  // 2. Identify the first sheet
  const sheetKey =
    Object.keys(unzipped).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)) ||
    "xl/worksheets/sheet1.xml";
  const sheetXml = unzipped[sheetKey] ? strFromU8(unzipped[sheetKey]) : "";

  if (!sheetXml) {
    throw new Error("Could not find worksheet data inside Excel file.");
  }

  // 3. Parse cell data from sheet
  const rawGrid: string[][] = [];
  const rowMatches = sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) || [];

  for (const rowTag of rowMatches) {
    const rowValues: string[] = [];
    const cellMatches = rowTag.match(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/gi) || [];

    for (const c of cellMatches) {
      const rMatch = c.match(/\br="([A-Z]+)(\d+)"/i);
      const tMatch = c.match(/\bt="([^"]+)"/i);
      const colLetter = rMatch ? rMatch[1] : "";
      const colIdx = colLetter ? colLetterToIndex(colLetter) : rowValues.length;
      const cellType = tMatch ? tMatch[1] : "";

      let val = "";
      if (cellType === "s") {
        const vMatch = c.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        if (vMatch) {
          const sIdx = parseInt(vMatch[1], 10);
          val = sharedStrings[sIdx] ?? "";
        }
      } else if (cellType === "inlineStr") {
        const isMatch = c.match(/<is\b[^>]*>[\s\S]*?<\/is>/i);
        if (isMatch) {
          const tMatches = isMatch[0].match(/<t\b[^>]*>([\s\S]*?)<\/t>/gi) || [];
          val = tMatches.map((t) => t.replace(/<t\b[^>]*>/i, "").replace(/<\/t>/i, "")).join("");
        }
      } else {
        const vMatch = c.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        if (vMatch) {
          val = vMatch[1];
        }
      }

      while (rowValues.length < colIdx) {
        rowValues.push("");
      }
      rowValues[colIdx] = unescapeXml(val.trim());
    }

    if (rowValues.some((v) => v !== undefined && v !== "")) {
      rawGrid.push(rowValues);
    }
  }

  if (rawGrid.length === 0) {
    throw new Error("Spreadsheet contains no data rows.");
  }

  return matrixToSpreadsheet(rawGrid);
}

/**
 * Parses CSV or TSV string text.
 */
export function parseCsvText(text: string): ParsedSpreadsheet {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) {
    throw new Error("File is empty.");
  }

  // Detect delimiter (comma vs tab vs semicolon)
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t") && !firstLine.includes(",")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result.map((s) => s.replace(/^["']|["']$/g, "").trim());
  };

  const rawGrid = lines.map(parseLine).filter((row) => row.some((v) => v.length > 0));
  return matrixToSpreadsheet(rawGrid);
}

/**
 * Parses HTML-based spreadsheet export (common in legacy SAP/Oracle .xls exports).
 */
export function parseHtmlTable(html: string): ParsedSpreadsheet {
  const rowMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const rawGrid: string[][] = [];

  for (const tr of rowMatches) {
    const cellMatches = tr.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    const row = cellMatches.map((cell) => {
      const text = cell.replace(/<[^>]+>/g, "").trim();
      return unescapeXml(text);
    });
    if (row.length > 0 && row.some((c) => c !== "")) {
      rawGrid.push(row);
    }
  }

  if (rawGrid.length === 0) {
    throw new Error("Could not parse table rows from file.");
  }

  return matrixToSpreadsheet(rawGrid);
}

/**
 * Converts a 2D string matrix into headers and row objects.
 */
function matrixToSpreadsheet(rawGrid: string[][]): ParsedSpreadsheet {
  if (rawGrid.length === 0) {
    throw new Error("No data found.");
  }

  const rawHeaders = rawGrid[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < rawGrid.length; r++) {
    const rowVals = rawGrid[r];
    if (rowVals.every((v) => !v || v.trim() === "")) continue;

    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((header, colIdx) => {
      rowObj[header] = (rowVals[colIdx] ?? "").trim();
    });
    rows.push(rowObj);
  }

  return { headers: rawHeaders, rows };
}

/**
 * Master parser: detects file format automatically (XLSX, HTML/XML XLS, CSV, TSV)
 * and returns headers and rows.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const name = file.name.toLowerCase();

  // Read first 4 bytes to detect zip container (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
  const slice = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(slice);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (isZip || name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const arrayBuffer = await file.arrayBuffer();
    return parseXlsxBuffer(new Uint8Array(arrayBuffer));
  }

  // Read as text
  const text = await file.text();
  const trimmed = text.trim();

  // Check if HTML table exported with .xls extension
  if (trimmed.startsWith("<html") || trimmed.startsWith("<table") || /<tr\b/i.test(trimmed)) {
    return parseHtmlTable(text);
  }

  // Check if XML Spreadsheet 2003
  if (trimmed.startsWith("<?xml") && trimmed.includes("<Workbook")) {
    return parseHtmlTable(text);
  }

  // Standard CSV / TSV fallback
  return parseCsvText(text);
}

/**
 * Creates a clean Microsoft Excel (.xlsx) file in browser memory without external server dependencies.
 */
export function createXlsxTemplate(
  headers: string[],
  sampleRows: Record<string, string>[],
  fieldKeys: string[]
): Uint8Array {
  let sheetDataXml = "";

  // 1. Header row
  sheetDataXml += '<row r="1">';
  headers.forEach((h, colIdx) => {
    const cellRef = indexToColLetter(colIdx) + "1";
    sheetDataXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetDataXml += "</row>";

  // 2. Data rows
  sampleRows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    sheetDataXml += `<row r="${rowNum}">`;
    fieldKeys.forEach((key, colIdx) => {
      const cellRef = indexToColLetter(colIdx) + rowNum;
      const val = row[key] ?? "";
      sheetDataXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
    });
    sheetDataXml += "</row>";
  });

  const files = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetDataXml}</sheetData></worksheet>`
    ),
  };

  return zipSync(files);
}

/**
 * Creates standard UTF-8 CSV text.
 */
export function createCsvTemplate(
  headers: string[],
  sampleRows: Record<string, string>[],
  fieldKeys: string[]
): string {
  const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
  const dataLines = sampleRows.map((row) =>
    fieldKeys
      .map((key) => {
        const val = row[key] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}
