"use client";

import { useRef, useState } from "react";
import { parseBarcodesFromFile } from "@/lib/excel";

interface Props {
  onCheck: (barcodes: string[]) => void;
  loading: boolean;
}

export default function InputPanel({ onCheck, loading }: Props) {
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parse(): string[] {
    return Array.from(
      new Set(
        text
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const barcodes = await parseBarcodesFromFile(file);
      setFileNote(`${file.name} — ${barcodes.length} barcode(s) found`);
      if (barcodes.length) {
        setText((prev) => (prev ? prev + "\n" : "") + barcodes.join("\n"));
      }
    } catch {
      setFileNote(`${file.name} — could not read file`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const count = parse().length;

  return (
    <section className="card rounded-3xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-caps">Barcodes to inspect</span>
        {count > 0 && (
          <span className="font-mono text-xs text-[var(--ink-faint)]">
            {count} queued
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="885909950805&#10;4006381333931&#10;…one per line, or separated by space / comma"
        rows={5}
        spellCheck={false}
        className="w-full resize-y rounded-2xl border border-[var(--stroke)] bg-white/40 p-4 font-mono text-sm text-[var(--ink)] shadow-[inset_0_1px_2px_rgba(24,35,59,0.06)] outline-none backdrop-blur-sm transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:bg-white/55 focus:ring-4 focus:ring-[var(--accent)]/15"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onCheck(parse())}
          disabled={loading || count === 0}
          className="glass-accent group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="font-mono text-white/90">▸</span>
          {loading ? "Inspecting…" : "Run inspection"}
        </button>

        <label className="glass-pill inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)] active:scale-[0.98]">
          Import Excel / CSV
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>

        {text && (
          <button
            onClick={() => {
              setText("");
              setFileNote(null);
            }}
            className="text-sm text-[var(--ink-faint)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
          >
            Clear
          </button>
        )}

        {fileNote && (
          <span className="font-mono text-xs text-[var(--ink-faint)]">{fileNote}</span>
        )}
      </div>
    </section>
  );
}
