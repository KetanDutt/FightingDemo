# Deployment Guide

## GitHub Pages (automated)

The canonical deployment: every push to `main` is built and published to GitHub Pages by
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).

```
push to main ──► lint ──► unit + smoke tests ──► vite build ──► publish dist/ ──► gh-pages branch ──► Pages
```

- **Live site:** <https://ketandutt.github.io/FightingDemo/>
- **Workflow runs:** <https://github.com/KetanDutt/FightingDemo/actions/workflows/deploy-pages.yml>
  (also supports manual _Run workflow_ dispatches from any branch)
- The publish step (`tools/publish-gh-pages.mjs --skip-build`) commits `dist/` contents to the
  `gh-pages` branch as the root (via `git write-tree --prefix=dist/`), parents each deploy on
  the previous one, and pushes with `--force-with-lease` so two racing deploys can never
  silently clobber each other.
- `concurrency: gh-pages-deploy` cancels superseded runs, so only the newest `main` build wins.

### One-time setup (per repository)

GitHub Pages must be pointed at the `gh-pages` branch once; changing Pages settings needs
repository **admin** rights, so it is a UI action, not part of the workflow:

1. Open **Settings → Pages** on GitHub.
2. Under _Build and deployment → Source_, choose **Deploy from a branch**.
3. Branch: **`gh-pages`**, folder: **`/(root)`**. Save.

The next deploy (or a manual _Run workflow_) serves the compiled game. Pushing with the
default `GITHUB_TOKEN` cannot modify Pages settings by design — hence the manual flip.

### Manual deploy (local machine)

```bash
npm run deploy              # build + publish to gh-pages
npm run deploy -- --skip-build   # publish an existing dist/ as-is
```

Requirements: write access to the repository (the script pushes to `origin/gh-pages`).

## Quick Deploy

The game is a fully static site — no server, no database, no build secrets.

### Build

```bash
npm install
npm run build
```

This creates a `dist/` folder with everything needed.

### Deploy to Other Static Hosts

Any static hosting service works. The build uses `base: './'`, so sub-paths need no config.

#### Netlify

```bash
# Build command: npm run build
# Publish directory: dist
```

#### Vercel

```bash
vercel --prod
```

#### Cloudflare Pages

```bash
# Build command: npm run build
# Output directory: dist
```

### Local Preview

```bash
npm run preview
```

Serves `dist/` on `http://localhost:4173` (or the next available port).

## Build Output

| Path          | Size (gzip) | Contents                            |
| ------------- | ----------- | ----------------------------------- |
| `index.html`  | ~1 KB       | Shell with meta tags, splash screen |
| `assets/`     | ~1.8 MB     | Sprite atlases (PNG + JSON)         |
| `index-*.js`  | ~37 KB      | Game code                           |
| `phaser-*.js` | ~340 KB     | Phaser engine (cached separately)   |

## Configuration

### Base Path

`vite.config.js` ships with `base: './'`, which makes `dist/` location-independent: it works
from a domain root, a project sub-path (e.g. `username.github.io/FightingDemo/`) or a local
static server. Only switch to an absolute `base: '/FightingDemo/'` if you need
router-style deep links (this game has none).

### Environment

No environment variables needed. All config is in `src/config/`.

## Performance Checklist

- [ ] Enable gzip/brotli compression on the server
- [ ] Set `Cache-Control: max-age=31536000` for asset files
- [ ] Keep `index.html` with `no-cache` so updates propagate
- [ ] Use a CDN for global distribution

## Security Headers

Recommended headers (add via hosting platform config):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Monitoring

The game exposes a debug surface in the console:

```js
window.MonkeyMayhem.game; // Phaser.Game instance
window.MonkeyMayhem.settings; // Current settings
window.MonkeyMayhem.scene; // Active scene
```
