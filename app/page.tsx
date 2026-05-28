"use client";

import { useState } from "react";
import InputPanel from "@/components/InputPanel";
import ResultsTable from "@/components/ResultsTable";
import Loading from "@/components/Loading";
import { exportResultsToExcel } from "@/lib/excel";
import type { BarcodeResult } from "@/lib/types";

const STAGES = [
  { n: "0", name: "Validation", desc: "Check digit · format · origin" },
  { n: "1", name: "GS1 ownership", desc: "Who registered the GTIN" },
  { n: "2", name: "Marketplace", desc: "Existing listings & brand" },
  { n: "3", name: "Google", desc: "Shopping / Manufacturer Center" },
  { n: "4", name: "Web footprint", desc: "Any reference online" },
];

export default function Home() {
  const [results, setResults] = useState<BarcodeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(barcodes: string[]) {
    setLoading(true);
    setPending(barcodes.length);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setResults(data.results as BarcodeResult[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header band */}
      <header className="sticky top-0 z-20 border-b border-[var(--stroke-soft)] bg-white/45 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-5">
          <Mark />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight text-[var(--ink)]">
              Barcode Risk Checker
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Inspection report for reused GTIN / EAN / UPC barcodes
            </p>
          </div>
          <span className="glass-pill ml-auto hidden rounded-full px-3 py-1 text-[0.7rem] font-semibold tracking-wide text-[var(--ink-soft)] sm:inline">
            5-layer pipeline
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Pipeline legend */}
        <ol className="mb-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((s, i) => (
            <li
              key={s.n}
              className="rise card flex flex-col gap-1 rounded-2xl px-3.5 py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.7rem] font-semibold text-[var(--accent)]">
                  {s.n}
                </span>
                <span className="text-sm font-semibold text-[var(--ink)]">{s.name}</span>
              </div>
              <span className="text-[0.72rem] leading-tight text-[var(--ink-faint)]">
                {s.desc}
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-6">
          <InputPanel onCheck={handleCheck} loading={loading} />

          {error && (
            <div className="rounded-2xl border border-red-600/30 bg-red-50/80 px-4 py-3 text-sm text-red-800 backdrop-blur">
              {error}
            </div>
          )}

          {loading && <Loading count={pending} />}

          {!loading && results && results.length > 0 && (
            <ResultsTable
              results={results}
              onExport={() => exportResultsToExcel(results)}
            />
          )}

          {!loading && !results && !error && <EmptyState />}
        </div>

        <footer className="mt-12 border-t border-[var(--line)] pt-5 text-xs leading-relaxed text-[var(--ink-faint)]">
          Layers without configured API credentials report{" "}
          <span className="font-mono">Unverified</span> and add only a small
          uncertainty penalty — the verdict never reports a false{" "}
          <span className="font-mono">Safe</span>. Configure GS1 / Amazon SP-API /
          Google Content API keys for a conclusive result.
        </footer>
      </main>
    </div>
  );
}

function Mark() {
  // Minimalist barcode glyph as the product mark.
  const bars = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2];
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink)] shadow-[0_8px_20px_-6px_rgba(24,35,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]">
      <div className="flex h-6 items-end gap-[2px]">
        {bars.map((w, i) => (
          <span
            key={i}
            className="block bg-[var(--paper)]"
            style={{ width: w, height: i % 3 === 0 ? "100%" : "78%" }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center rounded-3xl px-6 py-16 text-center">
      <div className="font-mono text-3xl tracking-widest text-[var(--ink-faint)]/60">
        ▮▯▮▮▯▮▯▯▮
      </div>
      <p className="mt-4 max-w-sm text-sm text-[var(--ink-soft)]">
        Enter barcodes above or import a spreadsheet. Each code is inspected
        across the five layers and stamped with a verdict.
      </p>
    </div>
  );
}
