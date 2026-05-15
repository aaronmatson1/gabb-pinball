# LGL Vibecoding

A gallery for things the old Little Giant Ladders marketing crew is building on the side.

## Add a new site

Edit `sites.json` and add an object to the `sites` array:

```json
{
  "id": "short-slug",
  "title": "Display name",
  "url": "https://...",
  "tag": "Game | Dashboard | Tool | Interactive | Reference | Personal",
  "by": "Builder's first name",
  "audience": "Who it's for",
  "description": "One-sentence pitch.",
  "credentials": { "username": "...", "password": "..." }
}
```

`credentials` is optional — only include when the site is gated.

## Run locally

```bash
cd "~/Desktop/Claude/LGL Vibecoding"
python3 -m http.server 4173
# open http://localhost:4173
```

## Deploy

Static site on Render via `render.yaml`. Push to GitHub, point Render at the repo, and it picks up the blueprint automatically.
