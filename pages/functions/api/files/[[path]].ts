import type { Env } from "../../types.js";
import { errorResponse } from "../../types.js";

// GET /api/files/<path> — stream the raw file content from R2.
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const path = paramPath(params.path);
  if (!path) return errorResponse("Missing path", 400);

  const obj = await env.VAULT.get(path);
  if (!obj) return errorResponse("Not found", 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.etag);
  headers.set("Content-Length", obj.size.toString());
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  return new Response(obj.body, { headers });
};

function paramPath(p: string | string[] | undefined): string | null {
  if (!p) return null;
  const joined = Array.isArray(p) ? p.join("/") : p;
  try {
    return decodeURIComponent(joined);
  } catch {
    return null;
  }
}
