"use client";

import type { BarcodeResult } from "@/lib/types";
import { STATUS_STYLE, LAYER_STAGE } from "@/lib/ui";

export default function ResultDetail({ result }: { result: BarcodeResult }) {
  const a = result.analysis;
  return (
    <div className="unfold space-y-5 border-t border-[var(--stroke-soft)] bg-white/25 px-5 py-5">
      {/* Tang 0 — structural facts */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Stage n="0" />
          <span className="label-caps">Structure</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Fact label="Format" value={a.format} />
          <Fact
            label="Check digit"
            value={a.checkDigitOk ? "Valid" : "Invalid"}
            tone={a.checkDigitOk ? "ok" : "bad"}
          />
          <Fact label="GS1 prefix" value={a.gs1Prefix ?? "—"} mono />
          <Fact label="Origin" value={a.prefixOrganization ?? "—"} />
        </div>
        {a.errors.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm text-[var(--danger)]">
            {a.errors.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Layers 1-4 */}
      <div className="space-y-2.5">
        {result.layers.map((layer) => {
          const s = STATUS_STYLE[layer.status];
          return (
            <div
              key={layer.layerId}
              className="rounded-2xl border border-[var(--stroke-soft)] bg-white/45 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Stage n={String(LAYER_STAGE[layer.layerId] ?? "•")} />
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {layer.layerName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${s.badge}`}
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-[0.7rem] text-[var(--ink-faint)]">
                    +{layer.score} · {layer.elapsedMs}ms
                  </span>
                </div>
              </div>

              {layer.note && (
                <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{layer.note}</p>
              )}

              {layer.evidence.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-[var(--stroke-soft)] pt-2 text-sm">
                  {layer.evidence.map((ev, i) => (
                    <li key={i} className="text-[var(--ink-soft)]">
                      <span className="text-[var(--ink-faint)]">{ev.label}: </span>
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] underline-offset-2 hover:underline"
                        >
                          {ev.detail || ev.url}
                        </a>
                      ) : (
                        <span className="text-[var(--ink)]">{ev.detail}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      <div className="rounded-2xl border border-[var(--stroke-soft)] border-l-[3px] border-l-[var(--accent)] bg-white/55 px-4 py-3">
        <span className="label-caps">Recommendation</span>
        <p className="mt-1 text-sm text-[var(--ink)]">{result.recommendation}</p>
      </div>
    </div>
  );
}

function Stage({ n }: { n: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/40 bg-white/70 font-mono text-[0.65rem] font-semibold text-[var(--accent)]">
      {n}
    </span>
  );
}

function Fact({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "bad";
}) {
  const color =
    tone === "ok"
      ? "text-[var(--safe)]"
      : tone === "bad"
        ? "text-[var(--danger)]"
        : "text-[var(--ink)]";
  return (
    <div>
      <div className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </div>
      <div className={`mt-0.5 font-medium ${mono ? "font-mono" : ""} ${color}`}>
        {value}
      </div>
    </div>
  );
}
