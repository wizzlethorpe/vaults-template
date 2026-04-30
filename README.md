# vaults-template

Self-deployable Cloudflare template for hosting an Obsidian vault as a static wiki, with a read-only API and MCP server for Foundry VTT and AI tooling.

## Architecture

- **Cloudflare Pages** serves the rendered HTML wiki (static, edge-cached)
- **Pages Functions** expose:
  - `GET /api/manifest` — file listing with etags (used for incremental sync)
  - `GET /api/files/<path>` — read a single source file
  - `GET /api/search?q=…` — substring search
  - `GET /api/grep?pattern=…` — regex search
  - `POST /mcp` — Model Context Protocol server (`list_files`, `read_file`, `search_text`, `grep`)
  - `PUT/DELETE /admin/source/<path>` — used by the CLI to push source files
- **R2** stores the source vault files (markdown, images, audio, etc.)
- **CLI** renders markdown → HTML locally, compresses images to webp, syncs source to R2, and deploys the rendered wiki to Pages

All `/api/*`, `/mcp`, and `/admin/*` requests require a Bearer token (the `API_KEY` secret).

## Deploy

1. Click **Deploy to Cloudflare** (or fork this repo and connect it to Pages manually).
2. Set the API key:
   ```
   wrangler pages secret put API_KEY --project-name=<your-project>
   ```
3. From your local Obsidian vault, install the CLI:
   ```
   pnpm add -g @vault/cli
   ```
4. Create `.vaultrc.json` in your vault root:
   ```json
   {
     "url": "https://<your-project>.pages.dev",
     "apiKey": "<the API key you set above>",
     "projectName": "<your-project>"
   }
   ```
5. Push:
   ```
   vaults push
   ```

## Layout

```
template/
├── pages/      Cloudflare Pages project (Functions + static)
└── cli/        Node CLI for local render + push
```

## Custom CSS (Obsidian snippets)

The renderer is compatible with Obsidian's CSS snippet system. Drop `.css` files
into `<vault>/.obsidian/snippets/` and the build picks them up.

If `<vault>/.obsidian/appearance.json` is present (Obsidian writes it), only
snippets in its `enabledCssSnippets` array are loaded — matching whatever you
have toggled on in Obsidian's Settings → Appearance pane. If the file is
missing, every `.css` file in the snippets folder is loaded.

To make community snippets work out of the box, the rendered DOM mirrors
Obsidian's:

- The article wrapper is `<article class="markdown-preview-view markdown-rendered">`
- Wikilinks carry `class="internal internal-link"` (resolved) or `class="internal internal-link is-unresolved"` (broken)
- Callouts emit both a `callout-<type>` class and a `data-callout="<type>"` attribute

Snippets concatenate into `/user.css` and load after the default theme, so they
override cleanly.

## Sync model

The CLI syncs incrementally via the manifest:

1. Scans the local vault, computes an MD5 of each file (matches R2's etag for single-part uploads).
2. Fetches `/api/manifest` from the deployment.
3. Uploads files where the local MD5 differs from the remote etag.
4. Deletes any remote file no longer present locally.
5. Renders the static wiki to a local cache directory and runs `wrangler pages deploy`.

The same manifest endpoint backs Foundry sync and any other client. No server-side change journal is needed — every consumer just compares etags.
