# LGL Vibecoding — Session Notes

Gallery of vibecoded projects from Marc's old Little Giant Ladders marketing alumni crew. Built at the alumni lunch on 2026-05-15.

## URLs

- **Live:** https://lgl-vibecoding.onrender.com
- **Repo:** https://github.com/marcmacwebb/lgl-vibecoding (private)
- **Local:** `~/Desktop/Claude/LGL Vibecoding/`

## Access

- **Password:** `buttstuff69` (SHA-256 hash stored in app.js, compared client-side)
- One-time per browser — localStorage flag persists the unlock
- `<meta name="robots" content="noindex,nofollow">` on the page

## Why the gate exists

`images/mascot-1.png` (LGL ladder girl) and `images/mascot-2.png` (LLPA aquarium claw) are risqué pin-up art the crew uses as inside-joke mascots. The site is public-URL accessible, and Marc's own professional projects (CMO Command Center, YES Design System) link from it — so the gate keeps casual visitors and search engines out. **Do not remove the gate without flagging it to Marc.**

## Stack

- Static HTML/CSS/JS, no build step
- Deployed to Render as a static site via `render.yaml` Blueprint
- Auto-deploys on push to `main`
- Montserrat font + YDS-style color tokens (navy, blue, ice) borrowed from CMO Command Center's `yes-tokens.css`

## Files

```
LGL Vibecoding/
├── index.html         — gate + shell
├── app.js             — gate logic + DATA.sites + render functions
├── styles.css         — YDS-tokenized, light/dark, mobile
├── render.yaml        — Render static-site blueprint
├── images/
│   ├── mascot-1.png   — LGL ladder girl (≈1.4MB)
│   └── mascot-2.png   — LLPA aquarium claw (≈2.3MB)
├── sites.json         — abandoned (see note below)
├── README.md
└── SESSION_NOTES.md   — this file
```

## ⚠ Data lives in app.js, NOT sites.json

The first build used `fetch('sites.json')` to load the cards. On Render the deploy rendered the page blank — JSON was valid and headers were fine, but main() never populated the DOM. **The fix was inlining DATA into app.js** as `const DATA = {...}`. `sites.json` is still in the repo but is unused — do not switch back to fetch.

To add a new site: edit the `DATA.sites` array at the top of `app.js`, commit, push. Render auto-redeploys in ~30s.

## Site schema

```js
{
  id: 'short-slug',
  title: 'Display name',
  url: 'https://...',
  tag: 'Game | Dashboard | Tool | Interactive | Reference | Personal',
  by: 'Builder first name',
  audience: 'Who it is for',
  description: 'One-sentence pitch.',
  credentials: { username: '...', password: '...' }  // optional, only if gated
}
```

The tag drives the filter chips at the top of the gallery. `by` and `audience` render in the card footer as "By [name] · [audience]".

## Current cards (10)

| Builder | Title | Tag |
|---|---|---|
| James | Shark Tunnel Pinball | Game |
| James | Build-A-Beast | Interactive |
| James | Color Aquarium | Interactive |
| James | NPS Display | Dashboard |
| James | Marketing Calendar | Tool |
| Aaron | Gabb Pinball | Game |
| Marc | YES Yeti Pinball | Game |
| Marc | CMO Command Center | Dashboard (gated: YES / christina) |
| Marc | YES Design System | Reference |
| Marc | CSP Study | Personal |

## People

- **Marc** — Director of Marketing at YES Staffing (project owner)
- **James** — former LGL marketing crew; now likely with LLPA based on the aquarium projects
- **Aaron Matson** — at Gabb Wireless (https://github.com/aaronmatson1)
- More crew members may add projects later

## Common operations

**Add a new site Marc mentions:**
1. Get URL, builder, what it does
2. Edit `app.js` → add object to `DATA.sites` array
3. `git add app.js && git commit -m "Add <site>" && git push`
4. Confirm Render redeploys (~30s) by curling app.js for the new entry

**Add a new mascot:**
1. Save to `images/mascot-N.png`
2. Edit `index.html` to add another `<img class="mascot">` inside `.mascots`
3. Update `.mascots` grid in `styles.css` if more than 2 columns needed

**Change the password:**
1. Compute new hash: `printf "newpassword" | shasum -a 256 | awk '{print $1}'`
2. Replace `GATE_HASH` constant in `app.js`
3. Clear localStorage on test browsers to re-trigger gate

**Local preview:**
```bash
cd "~/Desktop/Claude/LGL Vibecoding"
python3 -m http.server 4173
# open http://localhost:4173
```

## Render config

- Service name: `lgl-vibecoding`
- Type: static
- `staticPublishPath: .`
- `pullRequestPreviewsEnabled: false`
- Security headers in `render.yaml`: X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff
- 60s cache on `*.json` (legacy, no longer used)

## Open / future

- More crew members may submit projects — same workflow: add to DATA.sites
- Mascot row currently 2 columns; if more mascots arrive, adjust grid
- Could add a "Submit your site" form if the crew wants self-serve, but not needed yet
- Could make repo public if Marc wants outside contributions, but currently private is fine
