export interface Env {
  VAULT: R2Bucket;
  API_KEY: string;
  MAX_FILE_BYTES: string;
}

export interface ManifestEntry {
  path: string;
  etag: string;
  size: number;
  mtime: number;
  content_type: string;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
