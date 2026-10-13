# Card Picker

A phone-friendly web app that tells you which credit card to use for a purchase. It fixes two problems with Credit Karma's version:

1. **Rotating categories.** Discover it and Chase Freedom Flex quarterly categories are built in. The app tracks whether you activated each quarter and how much of the $1,500 cap you've used.
2. **Points aren't all worth the same.** Each rewards currency has a cents-per-point value *you* set. GM Rewards points start at 0.25¢, so a GM card's "3x" counts as 0.75% and doesn't beat a 2% cash card. Change any value in Settings.

Other features:

- **📍 What card here?** Uses your phone's GPS and OpenStreetMap to find the store you're in, then ranks your cards for it. If it picks the wrong store, tap the right one in the list of nearby places.
- **At a glance** tiles show the best card for each category.
- Card **benefits** appear where they matter. For example, renting a car shows which card has primary rental insurance, and ties go to the card with the relevant perk.
- Spending caps per month/quarter/year, "pick your category" cards, and store payment rules (Costco only takes Visa in store).
- **Automatic updates.** Card terms and rotating categories update by themselves (see below).
- Works offline except the store lookup. All your data stays on your phone. Use Export/Import in Settings for backups.

## Set it up (one time, ~5 minutes)

### 1. Turn on the website (on a computer or phone browser)

1. Go to **https://github.com/Manmeyco/credit-card-picker/settings/pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow** → **Run workflow**. Wait ~1 minute for the green check.
4. Your app is live at **https://manmeyco.github.io/credit-card-picker/**.

### 2. Install it on your Android phone

1. Open **https://manmeyco.github.io/credit-card-picker/** in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. *(Optional one-tap button)* Long-press the new Card Picker icon. Drag the **"What card here?"** shortcut onto your home screen. Tapping it opens the app and looks up your location straight away.

### 3. Add your cards

1. The app opens on the **Wallet** tab. Tap **＋ Add a card** for each card you have.
   - For GM, pick **GM Rewards Mastercard (2025+)** if you have the newer Barclays card (3x everywhere, up to 10x at GM). Pick **My GM Rewards Card (older version)** for the earlier 4x card.
2. For Discover / Freedom Flex, tick **Activated** once you've activated the quarter's 5% categories with the bank.
3. For "pick your category" cards (Citi Custom Cash, BofA Customized Cash, U.S. Bank Cash+), choose your category in the wallet.
4. Tap **Edit** on any card to correct a number, if your terms differ.

### 4. Set what your points are worth

**Settings → What your points are worth.** Some guidance:

- **Cash back** is always 1¢.
- **GM Rewards:** if you'd only ever use the points on GM service, keep the value low (0.25¢ or less). If you're planning to buy a GM car soon, raise it toward 1¢.
- **Chase / Amex / Citi / Capital One points:** 1¢ if you redeem for cash or statement credit. Use 1.25–2¢ if you transfer them to airlines or hotels.

### 5. Optional settings

- **Look up my location when the app opens** makes the app work like an automatic "card for this store" screen.
- Allow location when Chrome asks. If you denied it: Android **Settings → Apps → Chrome → Permissions → Location**.

### Everyday use

Open the app (or tap the "What card here?" shortcut). The top card with the green highlight is the one to use. Tap **log $** after a purchase if the card has a spending cap, so the app knows how much bonus room is left.

About widgets: a web app can't add a real Android home-screen widget. The launcher shortcut is the closest thing. A native widget would need a separate Android app build.

## Automatic updates

- Card terms live in [`data/cards.json`](data/cards.json). The app checks it every time it opens (and again if it has been in the background for 6+ hours). Use **Settings → Check now** to check by hand.
- **A scheduled Claude routine** researches changes. It runs on the 16th of every month and on the 1st of each quarter, following [`UPDATING.md`](UPDATING.md). It covers new rotating categories, changed earn rates and caps, and benefits added or removed. It must pass the data checks (`npm test`) before publishing.
- When a card in your wallet changes, the app shows a notice with what changed and an **Undo** button.
- Cards you have **edited yourself** are never overwritten. You get "Use the update / Keep mine" instead.
- New rotating quarters always arrive, except for any quarter you edited by hand.

## Development

No build step. Plain HTML/CSS/ES modules.

```sh
npm start    # serves on http://localhost:8080
npm test     # ranking, update-sync, and card-data validation tests (Node 20+)
```

| File | What it does |
|---|---|
| `data/cards.json` | Card presets, benefits, rotating quarters, point currencies, changelog |
| `js/catalog.js` | Loads `cards.json` (cached for offline) |
| `js/sync.js` | Applies catalog updates to your wallet: auto-update, undo, keep-mine |
| `js/engine.js` | Ranking: earn rate × point value, caps, rotating quarters, activation, network acceptance, benefit tie-breaks |
| `js/data.js` | Categories, merchant directory, OpenStreetMap tag mapping |
| `js/location.js` | GPS + Overpass API lookup of nearby stores |
| `js/store.js` | localStorage persistence |
| `js/app.js` | UI |

Store data © OpenStreetMap contributors.
