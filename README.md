# Teleprompter

A browser-based teleprompter. It's a static site with no build step and no dependencies, made for **Cloudflare** (Workers static assets).

## Features

- Paste or type a script, or open a `.txt`/`.md` file. Your script and settings are saved in the browser.
- Smooth scrolling. Speed adjusts live, and it scales with font size so your reading pace stays the same when you resize the text.
- Settings for font size, line spacing, side margins, font and alignment, plus 3 colour themes.
- A reading-line guide you can move, and optional dimming of the text above and below it.
- Mirror horizontally (for beam-splitter glass) and flip vertically.
- Countdown before start, a progress bar and an estimate of time remaining.
- Fullscreen mode. The screen stays awake while prompting (Screen Wake Lock API).
- Mouse-wheel or touch-drag to scroll by hand. Tap the text to play or pause.
- Lines in `[brackets]` show as highlighted cues, for example `[PAUSE]`.

### Keyboard shortcuts (while prompting)

| Key | Action |
| --- | --- |
| Space / K | Play / pause |
| ↑ / ↓ | Faster / slower |
| ← / → (PgUp / PgDn) | Jump back / forward |
| + / − | Bigger / smaller text |
| M | Toggle mirror |
| F | Toggle fullscreen |
| Home / End | Start / end |
| Esc | Back to editor |

In the editor, `Ctrl/Cmd + Enter` starts prompting.

## Project layout

```
public/            ← deployed as-is
  index.html
  styles.css
  app.js
  _headers         ← security & cache headers
  404.html
  favicon.svg
  manifest.webmanifest
wrangler.toml      ← Workers static assets config (directory = public)
```

## Run locally

Any static server works:

```powershell
npx serve public
```

You can also preview with Cloudflare's runtime, which applies `_headers`:

```powershell
npx wrangler pages dev public
```

## Deploy to Cloudflare

`wrangler.toml` configures the site as a Cloudflare Worker that serves the static files in `public/`. There's no Worker script. `_headers` and `404.html` still apply.

### Option A: Git integration (recommended)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Leave the build command empty. The deploy command is `npx wrangler deploy`, which is the default.
3. Deploy. Every push to `main` redeploys the site.

### Option B: Deploy from your machine

```powershell
npx wrangler login
```

```powershell
npx wrangler deploy
```

To use a custom domain, open the Worker and go to **Settings → Domains & Routes → Add → Custom domain**.
