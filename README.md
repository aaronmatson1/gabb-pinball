# Gabb Pinball

Browser pinball game branded for [Gabb Wireless](https://gabb.com), built with Matter.js rigid-body physics, Vite, and TypeScript. Includes 8-bit synth audio and touch controls.

> Kids will be kids. Get a pinball machine that lets them.

**▶ Play:** https://gabb-pinball.vercel.app

## Controls

- **Z / Left Arrow**: left flipper
- **M / Right Arrow**: right flipper
- **Space**: hold to charge the plunger, release to launch
- **X**: toggle sound
- **Tap left/right** on touch screens

Hit the four product targets (Watch, Phone, Music, Messenger) to complete a mode and earn a 5,000-point bonus.

## Run locally

```bash
cd aaron-pinball
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

Deploys to Vercel from `main`.

## Repo layout

| Path | What it is |
|---|---|
| `aaron-pinball/` | The pinball game (source in `src/`: physics + table in `main.ts`, audio in `audio.ts`, theme in `brand.ts`) |
| `/` (root) | A small static gallery of side projects built by former Little Giant Ladders marketing teammates, deployed on Render via `render.yaml` |

Not an official Gabb product. Built as a portfolio piece.
