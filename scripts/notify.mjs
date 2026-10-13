// Emails people about card-data changes. Run by .github/workflows/notify.yml
// whenever data/cards.json changes on the live branch.
//
//   node scripts/notify.mjs <old cards.json> <new cards.json>
//
// Needs (as GitHub Actions secrets):
//   FIREBASE_SERVICE_ACCOUNT  JSON key for a Firebase service account (reads the users collection)
//   GMAIL_USER, GMAIL_APP_PASSWORD  the Gmail account + app password used to send
// Without them it prints what it would send and exits (dry run).
import { readFileSync, existsSync } from 'node:fs';
import { diffCatalogs, buildEmail } from './card-diff.mjs';
import { categoryLabel } from '../js/data.js';

const [oldPath, newPath] = process.argv.slice(2);
const oldRaw = oldPath && existsSync(oldPath) ? JSON.parse(readFileSync(oldPath, 'utf8')) : { cards: [] };
const newRaw = JSON.parse(readFileSync(newPath, 'utf8'));
const appUrl = process.env.APP_URL || 'https://manmeyco.github.io/credit-card-picker/';

const events = diffCatalogs(oldRaw, newRaw, categoryLabel);
console.log(`${events.length} change(s) found`);
for (const e of events) console.log(`- [${e.kind}] ${e.name}: ${e.text}`);
if (!events.length) process.exit(0);

const { FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.log('Email secrets are not set — dry run only. See SETUP-ACCOUNTS.md.');
  const sample = buildEmail(events, { presetIds: [], prefs: { emailAll: true } }, appUrl);
  console.log(`\n--- Sample "all card news" email ---\nSubject: ${sample.subject}\n\n${sample.text}`);
  process.exit(0);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const nodemailer = (await import('nodemailer')).default;

initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const [mineSnap, allSnap] = await Promise.all([
  db.collection('users').where('prefs.emailMine', '==', true).get(),
  db.collection('users').where('prefs.emailAll', '==', true).get(),
]);
const people = new Map();
for (const doc of [...mineSnap.docs, ...allSnap.docs]) people.set(doc.id, doc.data());

const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
let sent = 0;
let failed = 0;
for (const person of people.values()) {
  if (!person.email) continue;
  const mail = buildEmail(events, person, appUrl);
  if (!mail) continue;
  try {
    await transport.sendMail({ from: `Pick-A-Card <${GMAIL_USER}>`, to: person.email, ...mail });
    sent += 1;
  } catch (e) {
    failed += 1;
    console.error(`Failed to email one subscriber: ${e.message}`);
  }
}
console.log(`Sent ${sent} email(s), ${failed} failed, ${people.size} subscriber(s).`);
if (failed && !sent) process.exit(1);
