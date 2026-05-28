// Client-side Excel/CSV helpers built on SheetJS.

import * as XLSX from "xlsx";
import type { BarcodeResult } from "./types";

// Extract barcode-like tokens from the first sheet of an uploaded workbook.
// We scan every cell and keep values that look like a barcode (8-14 digits,
// allowing separators that we strip), so users can paste messy spreadsheets.
export async function parseBarcodesFromFile(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const found: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    for (const row of rows) {
      for (const cell of row) {
        const text = String(cell ?? "").trim();
        if (!text) continue;
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 14) {
          found.push(text);
        }
      }
    }
  }
  // Dedupe while preserving order.
  return Array.from(new Set(found));
}

// Build a flat, reviewer-friendly worksheet from results and trigger a download.
export function exportResultsToExcel(results: BarcodeResult[]): void {
  const rows = results.map((r) => {
    const layerCol: Record<string, string> = {};
    for (const l of r.layers) {
      layerCol[l.layerName] = `${l.status} (${l.score})`;
    }
    return {
      Barcode: r.input,
      Format: r.analysis.format,
      "Check digit": r.analysis.checkDigitOk ? "OK" : "FAIL",
      Country: r.analysis.prefixOrganization ?? "",
      Verdict: r.verdict,
      "Risk score": r.totalScore,
      ...layerCol,
      Recommendation: r.recommendation,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Barcode risk");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `barcode-risk-${stamp}.xlsx`);
}
