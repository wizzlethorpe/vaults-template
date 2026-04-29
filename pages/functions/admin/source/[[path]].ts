import type { Env } from "../../types.js";
import { errorResponse, jsonResponse } from "../../types.js";

// PUT /admin/source/<path> — upload a single source file.
// Body is the raw file content. Content-Type is preserved into R2 httpMetadata.
export const onRequestPut: PagesFunction<Env> = async ({ request, params, env }) => {
  const path = paramPath(params.path);
  if (!path) return errorResponse("Missing path", 400);

  const max = Number(env.MAX_FILE_BYTES);
  const len = Number(request.headers.get("Content-Length") ?? 0);
  if (len > max) return errorResponse(`File exceeds limit of ${max} bytes`, 413);

  const body = await request.arrayBuffer();
  if (body.byteLength > max) return errorResponse(`File exceeds limit of ${max} bytes`, 413);

  const contentType = request.headers.get("Content-Type") ?? "application/octet-stream";
  const obj = await env.VAULT.put(path, body, {
    httpMetadata: { contentType },
  });
  if (!obj) return errorResponse("R2 write failed", 500);

  return jsonResponse({ path, etag: obj.etag, size: obj.size });
};

// DELETE /admin/source/<path> — remove a single source file.
export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const path = paramPath(params.path);
  if (!path) return errorResponse("Missing path", 400);
  await env.VAULT.delete(path);
  return new Response(null, { status: 204 });
};

function paramPath(p: string | string[] | undefined): string | null {
  if (!p) return null;
  const joined = Array.isArray(p) ? p.join("/") : p;
  try {
    const decoded = decodeURIComponent(joined);
    if (decoded.split("/").some((s) => s === "" || s === "." || s === "..")) return null;
    return decoded;
  } catch {
    return null;
  }
}
