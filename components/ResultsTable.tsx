"use client";

import { useState } from "react";
import type { BarcodeResult, Verdict } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/ui";
import ResultDetail from "./ResultDetail";

interface Props {
  results: BarcodeResult[];
  onExport: () => void;
}

const ORDER: Verdict[] = ["DANGER", "WARNING", "SAFE", "INVALID"];
const SCORE_CAP = 80; // visual ceiling for the score meter

export default function ResultsTable({ results, onExport }: Props) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="card overflow-hidden rounded-3xl">
      {/* Summary header */}
      <div className="border-b border-[var(--stroke-soft)] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="label-caps">Inspection results</span>
            <p className="mt-1 font-display text-xl text-[var(--ink)]">
              {results.length} barcode{results.length === 1 ? "" : "s"} assessed
            </p>
          </div>
          <button
            onClick={onExport}
            className="glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)] active:scale-[0.98]"
          >
            <span className="font-mono text-[var(--accent)]">↓</span> Export Excel
          </button>
        </div>

        {/* Distribution bar */}
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
          {ORDER.map((v) =>
            counts[v] ? (
              <div
                key={v}
                title={`${counts[v]} ${VERDICT_STYLE[v].label}`}
                style={{
                  width: `${(counts[v] / results.length) * 100}%`,
                  background: VERDICT_STYLE[v].color,
                }}
              />
            ) : null
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {ORDER.map((v) =>
            counts[v] ? (
              <span key={v} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: VERDICT_STYLE[v].color }}
                />
                <span className="font-semibold text-[var(--ink)]">{counts[v]}</span>
                <span className="text-[var(--ink-faint)]">{VERDICT_STYLE[v].label}</span>
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--line)]">
        {results.map((r, i) => {
          const style = VERDICT_STYLE[r.verdict];
          const isOpen = open.has(i);
          const pct = Math.min(100, (r.totalScore / SCORE_CAP) * 100);
          return (
            <div key={`${r.input}-${i}`} className="rise" style={{ animationDelay: `${i * 35}ms` }}>
              <button
                onClick={() => toggle(i)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-[var(--paper)] sm:grid-cols-[150px_110px_minmax(0,1fr)_auto]"
              >
                {/* Barcode */}
                <span className="font-mono text-sm font-medium text-[var(--ink)]">
                  {r.input}
                </span>

                {/* Verdict stamp */}
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${style.badge}`}
                >
                  <span aria-hidden>{style.glyph}</span>
                  {style.label}
                </span>

                {/* Recommendation (hidden on small) */}
                <span className="col-span-2 hidden truncate text-sm text-[var(--ink-soft)] sm:col-span-1 sm:block">
                  {r.recommendation}
                </span>

                {/* Score meter */}
                <div className="flex items-center gap-2 justify-self-end">
                  {r.verdict !== "INVALID" && (
                    <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--line)] sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: style.color }}
                      />
                    </div>
                  )}
                  <span className="w-8 text-right font-mono text-xs text-[var(--ink-faint)]">
                    {r.verdict === "INVALID" ? "—" : r.totalScore}
                  </span>
                  <span className="text-[var(--ink-faint)]">{isOpen ? "▴" : "▾"}</span>
                </div>
              </button>
              {isOpen && <ResultDetail result={r} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
