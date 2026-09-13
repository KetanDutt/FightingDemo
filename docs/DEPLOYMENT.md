# Deployment Guide

## Quick Deploy

The game is a fully static site — no server, no database, no build secrets.

### Build

```bash
npm install
npm run build
```

This creates a `dist/` folder with everything needed.

### Deploy to Static Host

Any static hosting service works:

#### Netlify

```bash
# Build command: npm run build
# Publish directory: dist
```

#### Vercel

```bash
vercel --prod
```

#### GitHub Pages

```bash
# In repository Settings → Pages:
# Source: Deploy from a branch
# Branch: main, folder: /dist
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

| Path | Size (gzip) | Contents |
|------|-------------|----------|
| `index.html` | ~1 KB | Shell with meta tags, splash screen |
| `assets/` | ~1.8 MB | Sprite atlases (PNG + JSON) |
| `index-*.js` | ~37 KB | Game code |
| `phaser-*.js` | ~340 KB | Phaser engine (cached separately) |

## Configuration

### Base Path

If deploying to a subdirectory (e.g. `username.github.io/FightingDemo/`):

1. Edit `vite.config.js`:
   ```js
   base: '/FightingDemo/',
   ```

2. Rebuild: `npm run build`

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
window.MonkeyMayhem.game   // Phaser.Game instance
window.MonkeyMayhem.settings // Current settings
window.MonkeyMayhem.scene  // Active scene
```
