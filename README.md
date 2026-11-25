# Teleprompter

A browser-based teleprompter. It's a static site with no build step and no dependencies, made for **Cloudflare Pages**.

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
  _headers         ← Cloudflare Pages security & cache headers
  404.html
  favicon.svg
  manifest.webmanifest
wrangler.toml      ← pages_build_output_dir = "public"
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

## Deploy to Cloudflare Pages

### Option A: Git integration (recommended)

1. Push this repo to GitHub or GitLab.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
4. Click **Save and Deploy**. Every push to `main` redeploys the site, and other branches get preview URLs.

### Option B: Direct upload with Wrangler

```powershell
npx wrangler login
```

```powershell
npx wrangler pages deploy public --project-name tel-prompt
```

To use a custom domain, open the Pages project and go to **Custom domains → Set up a domain**.
