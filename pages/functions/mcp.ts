import type { Env } from "./types.js";
import { jsonResponse } from "./types.js";
import { scanText } from "./lib/text-scan.js";

// Minimal MCP server (JSON-RPC 2.0 over HTTP).
// Spec: https://modelcontextprotocol.io/specification
//
// Implements the subset needed for read-only vault access:
//   initialize, tools/list, tools/call
//
// Exposes four tools:
//   list_files   — list every file in the vault (prefix-filterable)
//   read_file    — fetch a single file's text content
//   search_text  — substring search across markdown
//   grep         — regex search across markdown

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "vaults-template", version: "0.1.0" };

const TOOLS = [
  {
    name: "list_files",
    description: "List files in the vault. Optionally filter by path prefix.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "Path prefix filter, e.g. 'NPCs/'" },
      },
    },
  },
  {
    name: "read_file",
    description: "Read the full text content of a single vault file by path.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "search_text",
    description: "Plain substring search across vault text files. Case-insensitive.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        prefix: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["query"],
    },
  },
  {
    name: "grep",
    description: "Regex search across vault text files. JavaScript regex syntax.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        flags: { type: "string", default: "" },
        prefix: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["pattern"],
    },
  },
] as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return rpcError(req.id ?? null, -32600, "Invalid Request");
  }

  try {
    switch (req.method) {
      case "initialize":
        return rpcResult(req.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      case "tools/list":
        return rpcResult(req.id, { tools: TOOLS });
      case "tools/call":
        return await handleToolCall(req, env);
      default:
        return rpcError(req.id, -32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return rpcError(req.id, -32603, message);
  }
};

async function handleToolCall(req: JsonRpcRequest, env: Env): Promise<Response> {
  const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
  const name = params.name;
  const args = params.arguments ?? {};

  switch (name) {
    case "list_files": {
      const prefix = String(args.prefix ?? "");
      const files: { path: string; size: number }[] = [];
      let cursor: string | undefined;
      do {
        const page = await env.VAULT.list({ prefix, cursor, limit: 1000 });
        for (const obj of page.objects) files.push({ path: obj.key, size: obj.size });
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return toolResult(req.id, files.map((f) => `${f.path} (${f.size} bytes)`).join("\n"));
    }

    case "read_file": {
      const path = String(args.path ?? "");
      if (!path) return rpcError(req.id, -32602, "path is required");
      const obj = await env.VAULT.get(path);
      if (!obj) return rpcError(req.id, -32602, `File not found: ${path}`);
      return toolResult(req.id, await obj.text());
    }

    case "search_text": {
      const query = String(args.query ?? "");
      if (!query) return rpcError(req.id, -32602, "query is required");
      const results = await scanText(env.VAULT, {
        prefix: String(args.prefix ?? ""),
        limit: Math.min(Number(args.limit ?? 50), 200),
        match: (line) => line.toLowerCase().includes(query.toLowerCase()),
      });
      return toolResult(req.id, formatMatches(results));
    }

    case "grep": {
      const pattern = String(args.pattern ?? "");
      if (!pattern) return rpcError(req.id, -32602, "pattern is required");
      let regex: RegExp;
      try { regex = new RegExp(pattern, String(args.flags ?? "")); }
      catch (err) { return rpcError(req.id, -32602, `Invalid regex: ${err instanceof Error ? err.message : "unknown"}`); }
      const results = await scanText(env.VAULT, {
        prefix: String(args.prefix ?? ""),
        limit: Math.min(Number(args.limit ?? 50), 200),
        match: (line) => regex.test(line),
      });
      return toolResult(req.id, formatMatches(results));
    }

    default:
      return rpcError(req.id, -32602, `Unknown tool: ${name}`);
  }
}

function formatMatches(results: { path: string; line: number; text: string }[]): string {
  if (results.length === 0) return "No matches.";
  return results.map((r) => `${r.path}:${r.line}: ${r.text}`).join("\n");
}

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number | null;
  method: string;
  params?: unknown;
}

function rpcResult(id: string | number | null, result: unknown): Response {
  return jsonResponse({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolResult(id: string | number | null, text: string): Response {
  return rpcResult(id, { content: [{ type: "text", text }] });
}
