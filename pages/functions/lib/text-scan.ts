// Shared text-scanning logic used by /api/search and /api/grep.
// Streams every text-like file in R2, returning per-line matches.

const TEXT_EXT_RE = /\.(md|markdown|txt|json|yaml|yml)$/i;
const MAX_LINE_PREVIEW = 240;

export interface ScanMatch {
  path: string;
  line: number;
  text: string;
}

export interface ScanOptions {
  prefix: string;
  limit: number;
  match: (line: string) => boolean;
}

export async function scanText(bucket: R2Bucket, opts: ScanOptions): Promise<ScanMatch[]> {
  const results: ScanMatch[] = [];
  let cursor: string | undefined;

  outer: do {
    const page = await bucket.list({ prefix: opts.prefix, cursor, limit: 1000 });
    for (const obj of page.objects) {
      if (!TEXT_EXT_RE.test(obj.key)) continue;
      const file = await bucket.get(obj.key);
      if (!file) continue;
      const text = await file.text();
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (opts.match(line)) {
          results.push({ path: obj.key, line: i + 1, text: truncate(line) });
          if (results.length >= opts.limit) break outer;
        }
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return results;
}

function truncate(line: string): string {
  const trimmed = line.trim();
  return trimmed.length > MAX_LINE_PREVIEW ? trimmed.slice(0, MAX_LINE_PREVIEW) + "…" : trimmed;
}
