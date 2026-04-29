import type { Env, ManifestEntry } from "../types.js";
import { jsonResponse } from "../types.js";

// GET /api/manifest — list every file in the vault with its etag.
// Clients diff against their local cache and pull only files where the etag changed.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const entries: ManifestEntry[] = [];
  let cursor: string | undefined;

  do {
    const page = await env.VAULT.list({ cursor, limit: 1000 });
    for (const obj of page.objects) {
      entries.push({
        path: obj.key,
        etag: obj.etag,
        size: obj.size,
        mtime: Math.floor(obj.uploaded.getTime() / 1000),
        content_type: obj.httpMetadata?.contentType ?? "application/octet-stream",
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return jsonResponse({ files: entries });
};
