# vaults-cli

The deployable Cloudflare Pages template plus the `vaults` CLI that
renders an Obsidian vault to HTML and pushes it to your own Cloudflare
account. Published on npm as
[`@wizzlethorpe/vaults`](https://www.npmjs.com/package/@wizzlethorpe/vaults).

End-user docs live in [`cli/README.md`](cli/README.md). This document
is for contributors.

## Layout

```
vaults-cli/
├── cli/                    Node CLI + renderer (TypeScript, ESM, strict)
│   ├── src/                Source
│   ├── test/               Bases plugin test suite (node:test + tsx)
│   ├── dist/               Build output (published; gitignored)
│   └── package.json        @wizzlethorpe/vaults
├── pnpm-workspace.yaml     Single-package workspace
└── tsconfig.base.json      Shared compiler options
```

## Architecture in one screen

```
~/Documents/MyVault/        ← user's Obsidian vault (source of truth)
        │
        │  vaults push       (this CLI)
        ▼
user's Cloudflare account (one Pages project per user)
└── Pages assets:
    ├── _variants/<role>/   rendered HTML + body fragments per access tier
    │   ├── *.html              full layout (browsed on the wiki)
    │   ├── *.body.html         article only (consumed by Foundry sync)
    │   ├── *.preview.json      hover-preview JSON
    │   ├── _manifest.json      per-file md5s for incremental sync
    │   └── _search-index.json
    ├── styles.css, user.css   shared at root (no role gate)
    ├── login.html             multi-role builds only
    └── functions/
        └── _middleware.js     role gate via signed cookie + variant rewrite,
                               plus /connect (token issuance), /_batch (text),
                               /_batch-images (binary), /login, /logout.
```

Single-role builds collapse `_variants/public/...` to the deploy root, no
auth Function.

## Working in this repo

```bash
pnpm install          # install everything
pnpm typecheck        # tsc --noEmit on cli/
pnpm --filter @wizzlethorpe/vaults test            # bases test suite
pnpm --filter @wizzlethorpe/vaults run typecheck:test
pnpm -r run build     # compile cli/dist
```

CI (`.github/workflows/ci.yml`) runs typecheck + tests on every push and
pull request.

## Tech decisions worth knowing

- **Cloudflare-only target.** Pages + Pages Functions. No R2, KV, D1,
  Queues. The deploy is one `wrangler pages deploy` away.
- **The CLI does the rendering.** The Function is a gate / read API
  only — it never renders.
- **Web Crypto everywhere.** PBKDF2-SHA256 (100k iterations) for
  password hashing, HMAC for cookie/bearer signing. Same code runs in
  Node and the Workers runtime.
- **Settings schema is the single source of truth.** See `SCHEMA` in
  `cli/src/settings.ts`. To add a setting, add an entry there.
- **Render plugins live in `cli/src/render/`.** New rendering features
  almost always become a new plugin or a new `RenderContext` field.

## License

MIT. See `LICENSE`.
