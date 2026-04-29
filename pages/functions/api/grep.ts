import type { Env } from "../types.js";
import { errorResponse, jsonResponse } from "../types.js";
import { scanText } from "../lib/text-scan.js";

// GET /api/grep?pattern=<regex>&flags=<flags>&prefix=<prefix>&limit=<n>
// Regex search across the vault. Pattern is JavaScript regex syntax.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const pattern = url.searchParams.get("pattern")?.trim();
  if (!pattern) return errorResponse("Missing pattern parameter", 400);

  const flags = url.searchParams.get("flags") ?? "";
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (err) {
    return errorResponse(`Invalid regex: ${err instanceof Error ? err.message : "unknown"}`, 400);
  }

  const prefix = url.searchParams.get("prefix") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const results = await scanText(env.VAULT, {
    prefix,
    limit,
    match: (line) => regex.test(line),
  });

  return jsonResponse({ pattern, flags, results });
};
