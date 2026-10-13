# Card Picker

A phone-friendly web app that tells you which credit card to use for a purchase. It fixes two problems with Credit Karma's version:

1. **Rotating categories.** Discover it and Chase Freedom Flex 5% quarters are built in (Q4 2026: Discover = restaurants, entertainment, utilities; Freedom Flex = dining at 7x, groceries, Red Cross). It tracks whether you activated them and how much of the $1,500 cap you've used.
2. **Points aren't all worth the same.** Each rewards currency has a cents-per-point value *you* set. GM Rewards points start at 0.25¢, so the GM card's "4x" counts as 1% and doesn't beat a 2% cash card. Raise or lower any value in Settings.

Other features:

- **📍 What card here?** Uses your phone's GPS and OpenStreetMap to find the store you're in, then ranks your cards for it. If it picks the wrong store, tap the right one in the list of nearby places.
- **At a glance** tiles show the best card for each category (dining, groceries, gas, Amazon, Target, Costco, …).
- Search by store name or category. Enter an amount to account for a cap you're about to go over.
- Caps per month/quarter/year (Custom Cash $500/month, Amex BCP $6k/year, BofA combined caps, …). Tap **log $** after a purchase to count it toward the cap.
- "Pick your category" cards (Citi Custom Cash, BofA Customized Cash, U.S. Bank Cash+). Choose the category in the Wallet tab.
- Store payment rules: Costco only takes Visa in store, so other cards are flagged there.
- 20 preset cards plus fully custom cards. Every number is editable.
- Works offline (except the store lookup). All data stays on your phone. Export/Import in Settings for backups.

> Card terms change. The presets are a starting point — check each card in **Wallet → Edit** against your issuer's current terms.

## Put it on your Android phone

The app has to be served over HTTPS for location to work. GitHub Pages is the easiest way:

1. Merge this branch into `main`.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (GitHub Pages on a *private* repo needs a paid GitHub plan. Otherwise, make the repo public. It holds only app code; your card data never leaves your phone.)
3. The workflow deploys to `https://<your-username>.github.io/credit-card-picker/`.
4. Open that URL in **Chrome on Android** → ⋮ menu → **Add to Home screen / Install app**.
5. Long-press the app icon for a **"What card here?"** shortcut. You can drag that shortcut onto your home screen as its own one-tap button.
   To check your location every time the app opens, turn on **Settings → Look up my location when the app opens**.

About widgets: a web app can't add a real Android home-screen widget. The launcher shortcut is the closest thing. A native widget would need a separate Android app build.

## Updating rotating categories

When a new quarter is announced, update the `quarters` entries in `js/data.js` for the Discover and Freedom Flex presets. Cards already in your wallet pick up new quarters automatically. You can also add a quarter yourself in the app: **Wallet → Edit → ＋ Quarter**.

## Development

No build step. Plain HTML/CSS/ES modules.

```sh
npm start    # serves on http://localhost:8080
npm test     # ranking-logic tests (Node 20+)
```

| File | What it does |
|---|---|
| `js/data.js` | Categories, point currencies, card presets, merchant directory, OpenStreetMap tag mapping |
| `js/engine.js` | Ranking: earn rate × point value, caps, rotating quarters, activation, network acceptance |
| `js/location.js` | GPS + Overpass API lookup of nearby stores |
| `js/store.js` | localStorage persistence |
| `js/app.js` | UI |

Store data © OpenStreetMap contributors.
