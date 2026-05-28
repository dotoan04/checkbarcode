"use client";

export default function Loading({ count }: { count: number }) {
  return (
    <div className="card overflow-hidden rounded-3xl">
      <div className="relative h-28 overflow-hidden border-b border-[var(--stroke-soft)] bg-white/20">
        {/* Faux barcode being scanned */}
        <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-8 opacity-70">
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="block bg-[var(--ink)]"
              style={{
                width: ((i * 37) % 5) + 1,
                height: `${40 + ((i * 53) % 40)}%`,
              }}
            />
          ))}
        </div>
        {/* Moving scan line */}
        <div className="scan-line absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)] shadow-[0_0_12px_2px_rgba(31,111,99,0.5)]" />
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
        <p className="text-sm text-[var(--ink-soft)]">
          Inspecting{" "}
          <span className="font-mono font-semibold text-[var(--ink)]">{count}</span>{" "}
          barcode{count === 1 ? "" : "s"} across all layers…
        </p>
      </div>
    </div>
  );
}
