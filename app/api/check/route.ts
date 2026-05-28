import { NextRequest, NextResponse } from "next/server";
import { checkBatch } from "@/lib/providers";
import { DEFAULT_CONTEXT } from "@/lib/config";
import type { CheckContext } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BARCODES = 200; // guard against accidental huge uploads

interface CheckRequestBody {
  barcodes?: unknown;
  ownBrandNames?: unknown;
  ownCompanyName?: unknown;
}

export async function POST(req: NextRequest) {
  let body: CheckRequestBody;
  try {
    body = (await req.json()) as CheckRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Normalize input: accept array of strings, dedupe, trim, drop empties.
  const raw = Array.isArray(body.barcodes) ? body.barcodes : [];
  const barcodes = Array.from(
    new Set(
      raw
        .map((b) => String(b ?? "").trim())
        .filter((b) => b.length > 0)
    )
  );

  if (barcodes.length === 0) {
    return NextResponse.json({ error: "No barcodes provided." }, { status: 400 });
  }
  if (barcodes.length > MAX_BARCODES) {
    return NextResponse.json(
      { error: `Too many barcodes (${barcodes.length}). Max ${MAX_BARCODES} per request.` },
      { status: 400 }
    );
  }

  const ctx: CheckContext = {
    ownCompanyName:
      typeof body.ownCompanyName === "string"
        ? body.ownCompanyName
        : DEFAULT_CONTEXT.ownCompanyName,
    ownBrandNames: Array.isArray(body.ownBrandNames)
      ? (body.ownBrandNames as unknown[]).map((s) => String(s).toLowerCase().trim()).filter(Boolean)
      : DEFAULT_CONTEXT.ownBrandNames,
  };

  const results = await checkBatch(barcodes, ctx);
  return NextResponse.json({ results, checkedAt: new Date().toISOString() });
}
