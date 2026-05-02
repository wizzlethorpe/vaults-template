# vaults-cli

Self-deployable Cloudflare template for hosting an Obsidian vault as a static wiki, with an MCP server for AI tooling and a static manifest for Foundry/etc. sync.

## Architecture

```
~/Documents/MyVault/        ← your Obsidian vault
        │
        │  vaults push
        ▼
your Cloudflare Pages project (one wrangler deploy per push)
├── attachments/             webp-compressed images (shared)
├── styles.css, user.css     theme + Obsidian snippets
├── login.html               (multi-role only)
├── functions/
│   ├── _middleware.js       role gate (multi-role only)
│   └── mcp.js               JSON-RPC MCP server
├── _variants/<role>/        OR collapsed to root if single-role
│   ├── *.html               rendered wiki
│   ├── *.md                 raw markdown source (for Foundry / MCP)
│   ├── *.preview.json       hover-preview blobs
│   ├── _search-index.json   client-side search index
│   └── _manifest.json       all files + MD5 hashes (for incremental sync)
```

**No R2, no D1, no KV.** The deploy is one `wrangler pages deploy` away. Clients diff against `_manifest.json` to pull only changed files.

## Deploy

1. Create a Pages project in Cloudflare (one-time, via dashboard or `wrangler pages project create my-vault --production-branch=main`).
2. From your local Obsidian vault, install the CLI:
   ```
   cd /path/to/vaults-cli/cli
   npm link
   ```
3. Create `.vaultrc.json` in your vault root:
   ```json
   {
     "projectName": "my-vault"
   }
   ```
4. Push:
   ```
   vaults push
   ```

That's it for single-role builds. For multi-role builds with role-gated content (`> [!dm]`, `role: dm` frontmatter), see the **Roles & auth** section below.

### Tip: skip the path argument

Every command takes the vault path as a positional argument (default = cwd). Set `VAULT_PATH` in your shell to make it default to your vault wherever you run the CLI:

```bash
export VAULT_PATH=~/Documents/MyVault
vaults role list           # operates on MyVault
vaults push                # pushes MyVault
```

## What you get

The deployment serves:

- **The wiki**: every `.md` page is rendered as a static `.html` file, served by Pages from the edge.
- **`/_manifest.json`**: all files + MD5 hashes. Foundry, AI tools, anything that wants to incrementally sync content reads this.
- **`/<page>.md`**: raw markdown source for every page. MCP and Foundry pull these.
- **`/_search-index.json`**: title + path + stripped body text per page. Powers client-side search.
- **`/mcp`**: JSON-RPC MCP server (`list_files`, `read_file`, `search_text`, `grep`). Connect AI assistants here.

## Roles & auth (optional)

For role-gated content (DM-only pages, patron-only sections), declare roles in `settings.md`:

```yaml
roles: [public, patron, dm]
```

Tag pages and callouts:

```yaml
---
role: dm
---
```

```
> [!dm]
> Hidden from non-DMs.
```

Set passwords with `vaults password <role>` (PBKDF2-SHA256, 600k iterations). The build emits one variant per role plus a tiny auth Function that gates URLs via signed cookies. First push generates a SESSION_SECRET and uploads it as a wrangler secret; subsequent pushes reuse it.

## Custom CSS (Obsidian snippets)

The renderer is compatible with Obsidian's CSS snippet system. Drop `.css` files into `<vault>/.obsidian/snippets/`. If `<vault>/.obsidian/appearance.json` exists, only snippets in its `enabledCssSnippets` array are loaded; otherwise everything in the snippets folder.

Snippets concatenate into `/user.css` and load after the default theme.

## Layout

```
template/
└── cli/        Node CLI; render, preview, build, push, init, password
```

The Pages Functions and the deployed site are entirely build artefacts; nothing ships from the template repo's directory tree.

## Sync model

The CLI walks your vault, hashes each file (MD5), renders to a local cache, and runs `wrangler pages deploy`. Cloudflare Pages itself uses content hashing internally; only changed files transfer.

Foundry / external clients use the same approach: fetch `/_manifest.json`, diff against local hashes, fetch only changed paths. The manifest is statically served, no API call needed beyond a single GET.
