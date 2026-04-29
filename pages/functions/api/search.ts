import type { Env } from "../types.js";
import { errorResponse, jsonResponse } from "../types.js";
import { scanText } from "../lib/text-scan.js";

// GET /api/search?q=<query>&prefix=<prefix>&limit=<n>
// Plain substring search across every markdown file in the vault.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) return errorResponse("Missing q parameter", 400);

  const prefix = url.searchParams.get("prefix") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const results = await scanText(env.VAULT, {
    prefix,
    limit,
    match: (line) => line.toLowerCase().includes(q.toLowerCase()),
  });

  return jsonResponse({ query: q, results });
};
