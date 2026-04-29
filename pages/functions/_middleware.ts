import type { Env } from "./types.js";
import { errorResponse } from "./types.js";

// Gates every /api/*, /mcp/*, and /admin/* request behind a shared API key
// (set via `wrangler pages secret put API_KEY`). All other paths fall through
// to the static asset handler (the rendered wiki).
export const onRequest: PagesFunction<Env> = async ({ request, next, env }) => {
  const url = new URL(request.url);
  const protectedPath =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/mcp") ||
    url.pathname.startsWith("/admin/");

  if (!protectedPath) return next();

  if (!env.API_KEY) {
    return errorResponse("API_KEY is not configured on this deployment", 500);
  }

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.API_KEY}`) {
    return errorResponse("Unauthorized", 401);
  }

  return next();
};
