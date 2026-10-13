# Updating card data

The app reads card terms from `data/cards.json` every time it opens. A scheduled Claude routine
follows this file to keep that data current. A person can follow it too.

## When the routine runs

- On the 16th of every month, when rotating categories for the next quarter are usually out.
- On the 1st of January, April, July and October, to confirm the new quarter.

## What to check

1. **Rotating categories.** These are for every card with a `rotating` block (Discover it, Chase
   Freedom Flex). Add the **current and next quarter** as soon as they are announced. Fix any
   quarter that is wrong.
2. **Every card in `data/cards.json`, one at a time.** Run at least one search per card (e.g. "<card name> changes <current year>"). A single broad search for all cards is not enough. If a search hints at a change, follow it up and confirm it, or list it as unconfirmed. Look for changes from the last ~3 months:
   - Earn rates, bonus categories, spending caps, cap periods.
   - Benefits added or removed: purchase/travel/rental-car/cell-phone protection, statement
     credits, TSA PreCheck / Global Entry credits, lounge access, reimbursements.
   - Renames, a new issuer or network, or the card being discontinued or replaced.
   - Point values only matter for **new** currencies. Never change `cpp` on an existing currency;
     the app keeps each person's own values anyway.

### Sources

Prefer the issuer's own pages and press releases. Otherwise use **two** independent reputable
sources (NerdWallet, Doctor of Credit, The Points Guy, Frequent Miler, Bankrate, CNBC Select,
Thrifty Traveler, InsideFlyer). Do not change data on a single unofficial source or a rumor. List
anything uncertain in the run summary instead.

## How to edit `data/cards.json`

- Card shape: `presetId`, `name`, `short`, `network` (visa|mastercard|amex|discover), `currency`
  (a key of `currencies`), `color`, `base`, `rules`, optional `rotating`, `benefits`, `version`,
  `changelog`.
- Rule: `{ "cats": [...], "rate": n, "cap"?: { "amount", "period": month|quarter|year, "group"? }, "label"?, "choiceOptions"? }`.
  `rate` is points (or %) per dollar. Rules that share a cap use the same `cap.group`.
- Valid categories are the ids in `CATEGORIES` in `js/data.js`. `"@travel"` is shorthand for all
  travel categories. Map issuer wording to the closest category. If no category fits, say so in
  the summary rather than inventing one.
- Rotating quarter: `"YYYY-Qn": { "cats": [...], "rate": 5, "rates"?: { "dining": 7 } }`.
  `rates` overrides the rate for specific categories, as with Freedom Flex dining, which stacks
  to 7x. Adding or fixing a quarter needs **no** version bump; it reaches every phone
  automatically.
- Benefit: `{ "text": "...", "cats"?: [...] }`. Give `cats` when the benefit matters for a
  purchase type, such as rental car insurance → `car_rental`, cell phone protection →
  `utilities`, or trip delay → `airfare`. The app shows it as a tip and uses it to break ties.
- **When a card's terms or benefits change:**
  1. Edit the card.
  2. Set its `version` to today's date (`YYYY-MM-DD`). If it is already today's date, append
     `.2`, `.3`, …
  3. Add a `changelog` entry `{ "date": <same as version>, "text": "..." }`. Write one or two
     plain-English sentences for the cardholder, e.g. "Now 3x on gas. Lost the $10/month
     dining credit." People see this text in the app, with an Undo button.
  4. Set the top-level `updated` to today's date.
- If a card is discontinued, keep it, because people may still hold it, and add a changelog
  entry saying so. If it is replaced by a new product, add the new card as a separate preset.
- Do not edit app code (`js/`, `css/`, `index.html`) during a data update.

## Before publishing

```sh
npm test   # must pass: validates every card, category, cap and changelog entry
```

Commit only `data/cards.json`, with a message like `Card data update 2026-11-16: Discover Q1 2027
categories; Amex Gold dining credit change`. Push to the repository's **default branch**. GitHub
Pages redeploys, and phones pick up the change the next time the app opens. If nothing changed,
do not commit.
