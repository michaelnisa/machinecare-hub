import { describe, it, expect } from "vitest";
import {
  colLetterToIndex,
  indexToColLetter,
  unescapeXml,
  parseCsvText,
  parseHtmlTable,
  createXlsxTemplate,
  parseXlsxBuffer,
} from "./spreadsheetParser";

describe("spreadsheetParser", () => {
  it("converts column letters to 0-based indices correctly", () => {
    expect(colLetterToIndex("A")).toBe(0);
    expect(colLetterToIndex("B")).toBe(1);
    expect(colLetterToIndex("Z")).toBe(25);
    expect(colLetterToIndex("AA")).toBe(26);
    expect(colLetterToIndex("AB")).toBe(27);
  });

  it("converts indices back to column letters", () => {
    expect(indexToColLetter(0)).toBe("A");
    expect(indexToColLetter(1)).toBe("B");
    expect(indexToColLetter(25)).toBe("Z");
    expect(indexToColLetter(26)).toBe("AA");
  });

  it("unescapes XML entities cleanly", () => {
    expect(unescapeXml("Heavy &amp; Duty &lt;Filter&gt; &quot;Gold&quot;")).toBe(
      'Heavy & Duty <Filter> "Gold"'
    );
  });

  it("parses CSV and TSV content", () => {
    const csv = `Part Number,Description,Quantity\nFLT-100,"Air Filter, Heavy Duty",15\nOIL-200,Hydraulic Oil,5`;
    const result = parseCsvText(csv);
    expect(result.headers).toEqual(["Part Number", "Description", "Quantity"]);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]["Description"]).toBe("Air Filter, Heavy Duty");
    expect(result.rows[0]["Quantity"]).toBe("15");
  });

  it("parses HTML tables from legacy .xls exports", () => {
    const html = `
      <table>
        <tr><th>Asset ID</th><th>Name</th><th>Hours</th></tr>
        <tr><td>AST-01</td><td>Excavator 01</td><td>1250</td></tr>
      </table>
    `;
    const result = parseHtmlTable(html);
    expect(result.headers).toEqual(["Asset ID", "Name", "Hours"]);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]["Name"]).toBe("Excavator 01");
  });

  it("generates and parses XLSX binary buffer without data loss", () => {
    const headers = ["Item Code", "Item Name", "Order Status", "Quantity"];
    const fieldKeys = ["code", "name", "order_status", "qty"];
    const sampleRows = [
      { code: "OIL-01", name: "Hydraulic Oil 68", order_status: "received", qty: "20" },
      { code: "BELT-02", name: "Fan Belt V-12", order_status: "received", qty: "4" },
    ];

    const xlsxBytes = createXlsxTemplate(headers, sampleRows, fieldKeys);
    expect(xlsxBytes.length).toBeGreaterThan(500);

    const parsed = parseXlsxBuffer(xlsxBytes);
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]["Item Code"]).toBe("OIL-01");
    expect(parsed.rows[0]["Item Name"]).toBe("Hydraulic Oil 68");
    expect(parsed.rows[0]["Order Status"]).toBe("received");
    expect(parsed.rows[0]["Quantity"]).toBe("20");
    expect(parsed.rows[1]["Item Code"]).toBe("BELT-02");
  });
});
