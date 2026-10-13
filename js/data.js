// Static reference data: spending categories, point currencies, card presets,
// a merchant directory, and OpenStreetMap tag -> category mapping.
//
// Card terms change often. Every preset is copied into your wallet when you add
// it, and every number can be edited in the app, so treat these as a starting
// point and check them against your issuer's terms.

export const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: '🍽️' },
  { id: 'groceries', label: 'Groceries', icon: '🛒', hint: 'Supermarkets. Walmart, Target and Costco usually do not count.' },
  { id: 'gas', label: 'Gas', icon: '⛽' },
  { id: 'drugstore', label: 'Drugstore', icon: '💊' },
  { id: 'amazon', label: 'Amazon', icon: '📦' },
  { id: 'target', label: 'Target', icon: '🎯' },
  { id: 'walmart', label: 'Walmart', icon: '🏬' },
  { id: 'wholesale', label: 'Costco / wholesale', icon: '🧺' },
  { id: 'online', label: 'Online shopping', icon: '🛍️' },
  { id: 'home_improvement', label: 'Home improvement', icon: '🔨' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎟️', hint: 'Movies, concerts, sports, theme parks, zoos, bowling.' },
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'utilities', label: 'Utilities & phone', icon: '💡', hint: 'Electric, water, gas utility, internet, phone.' },
  { id: 'airfare', label: 'Flights', icon: '✈️' },
  { id: 'hotels', label: 'Hotels', icon: '🏨' },
  { id: 'car_rental', label: 'Car rental', icon: '🚙' },
  { id: 'transit', label: 'Transit & parking', icon: '🚇' },
  { id: 'rideshare', label: 'Rideshare', icon: '🚕' },
  { id: 'travel_other', label: 'Other travel', icon: '🧳' },
  { id: 'department', label: 'Department store', icon: '👗' },
  { id: 'gm', label: 'GM dealer / service', icon: '🔧' },
  { id: 'auto_service', label: 'Auto service', icon: '🛠️' },
  { id: 'ev_charging', label: 'EV charging', icon: '🔌' },
  { id: 'fitness', label: 'Fitness', icon: '🏋️' },
  { id: 'charity', label: 'Charity', icon: '❤️' },
  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
  { id: 'other', label: 'Everything else', icon: '💳' },
  // Merchant-specific categories that only a few cards reward. Hidden from tiles.
  { id: 'costco', label: 'Costco (store)', icon: '🧺', hidden: true },
  { id: 'whole_foods', label: 'Whole Foods', icon: '🥦', hidden: true },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const TRAVEL = ['airfare', 'hotels', 'car_rental', 'transit', 'rideshare', 'travel_other'];

// cpp = cents each point/mile/dollar is worth to *you*. This is the fix for
// "all points are valued the same": a GM point that can only go toward GM
// service is not worth what a dollar of cash back is.
export const CURRENCIES = {
  cash: { name: 'Cash back', cpp: 1, locked: true },
  chase_ur: { name: 'Chase Ultimate Rewards', cpp: 1, note: '1¢ as cash. Worth more if you transfer to airlines/hotels or use Points Boost.' },
  amex_mr: { name: 'Amex Membership Rewards', cpp: 1, note: 'Often 0.6–0.8¢ as statement credit; more via transfer partners.' },
  citi_ty: { name: 'Citi ThankYou', cpp: 1, note: '1¢ as cash; more via transfer partners.' },
  cap1_miles: { name: 'Capital One miles', cpp: 1, note: '1¢ toward travel; more via transfer partners.' },
  gm: { name: 'GM Rewards points', cpp: 0.25, note: 'Only usable toward GM vehicles/service. Set this to what they are really worth to you — if you rarely buy GM, keep it low.' },
};

// Rule shape:  { cats: [...], rate, cap?: { amount, period: 'month'|'quarter'|'year', group? }, label?, choiceOptions? }
//   rate is points (or %) per dollar in the card's currency.
//   choiceOptions marks a "you pick the category" rule; cats holds the pick.
// Rotating shape: { cap: {...}, quarters: { 'YYYY-Qn': { cats, rate, rates?: { cat: rate } } }, activationRequired }
export const PRESETS = [
  {
    presetId: 'discover_it',
    name: 'Discover it Cash Back', short: 'Discover', network: 'discover', currency: 'cash', color: '#ff6000',
    base: 1,
    rules: [],
    rotating: {
      activationRequired: true,
      cap: { amount: 1500, period: 'quarter' },
      quarters: {
        '2026-Q4': { cats: ['dining', 'entertainment', 'utilities'], rate: 5 },
      },
    },
  },
  {
    presetId: 'freedom_flex',
    name: 'Chase Freedom Flex', short: 'Freedom Flex', network: 'mastercard', currency: 'chase_ur', color: '#1a5ba6',
    base: 1,
    rules: [
      { cats: ['dining'], rate: 3 },
      { cats: ['drugstore'], rate: 3 },
    ],
    rotating: {
      activationRequired: true,
      cap: { amount: 1500, period: 'quarter' },
      quarters: {
        // Dining stacks with the card's normal 3x for 7x total.
        '2026-Q4': { cats: ['dining', 'groceries', 'charity'], rate: 5, rates: { dining: 7 } },
      },
    },
  },
  {
    presetId: 'freedom_unlimited',
    name: 'Chase Freedom Unlimited', short: 'Freedom Unl.', network: 'visa', currency: 'chase_ur', color: '#2d6fc0',
    base: 1.5,
    rules: [
      { cats: ['dining'], rate: 3 },
      { cats: ['drugstore'], rate: 3 },
    ],
  },
  {
    presetId: 'sapphire_preferred',
    name: 'Chase Sapphire Preferred', short: 'Sapphire Pref.', network: 'visa', currency: 'chase_ur', color: '#0b2f5b',
    base: 1,
    rules: [
      { cats: ['dining'], rate: 3 },
      { cats: ['streaming'], rate: 3 },
      { cats: TRAVEL, rate: 2 },
    ],
  },
  {
    presetId: 'sapphire_reserve',
    name: 'Chase Sapphire Reserve', short: 'Sapphire Res.', network: 'visa', currency: 'chase_ur', color: '#1c2833',
    base: 1,
    rules: [
      { cats: ['airfare', 'hotels'], rate: 4, label: 'Booked direct' },
      { cats: ['dining'], rate: 3 },
    ],
  },
  {
    presetId: 'amex_gold',
    name: 'Amex Gold', short: 'Amex Gold', network: 'amex', currency: 'amex_mr', color: '#b8913a',
    base: 1,
    rules: [
      { cats: ['dining'], rate: 4, cap: { amount: 50000, period: 'year' } },
      { cats: ['groceries'], rate: 4, cap: { amount: 25000, period: 'year' } },
      { cats: ['airfare'], rate: 3, label: 'Booked direct' },
    ],
  },
  {
    presetId: 'amex_bcp',
    name: 'Amex Blue Cash Preferred', short: 'Blue Cash Pref.', network: 'amex', currency: 'cash', color: '#2671b9',
    base: 1,
    rules: [
      { cats: ['groceries'], rate: 6, cap: { amount: 6000, period: 'year' } },
      { cats: ['streaming'], rate: 6 },
      { cats: ['gas'], rate: 3 },
      { cats: ['transit', 'rideshare'], rate: 3 },
    ],
  },
  {
    presetId: 'amex_bce',
    name: 'Amex Blue Cash Everyday', short: 'Blue Cash Every.', network: 'amex', currency: 'cash', color: '#4a90d9',
    base: 1,
    rules: [
      { cats: ['groceries'], rate: 3, cap: { amount: 6000, period: 'year', group: 'groc' } },
      { cats: ['online', 'amazon'], rate: 3, cap: { amount: 6000, period: 'year', group: 'online' } },
      { cats: ['gas'], rate: 3, cap: { amount: 6000, period: 'year', group: 'gas' } },
    ],
  },
  {
    presetId: 'citi_double_cash',
    name: 'Citi Double Cash', short: 'Double Cash', network: 'mastercard', currency: 'cash', color: '#056dae',
    base: 2,
    rules: [],
  },
  {
    presetId: 'citi_custom_cash',
    name: 'Citi Custom Cash', short: 'Custom Cash', network: 'mastercard', currency: 'cash', color: '#00a3e0',
    base: 1,
    rules: [
      {
        cats: ['dining'], rate: 5, cap: { amount: 500, period: 'month' },
        label: 'Your top category each billing cycle',
        choiceOptions: ['dining', 'groceries', 'gas', 'ev_charging', 'drugstore', 'home_improvement', 'fitness', 'streaming', 'transit', 'travel_other', 'entertainment'],
      },
    ],
  },
  {
    presetId: 'savor',
    name: 'Capital One Savor', short: 'Savor', network: 'mastercard', currency: 'cash', color: '#8a1538',
    base: 1,
    rules: [
      { cats: ['dining', 'entertainment', 'streaming', 'groceries'], rate: 3 },
    ],
  },
  {
    presetId: 'quicksilver',
    name: 'Capital One Quicksilver', short: 'Quicksilver', network: 'mastercard', currency: 'cash', color: '#7d8a96',
    base: 1.5,
    rules: [],
  },
  {
    presetId: 'venture_x',
    name: 'Capital One Venture X', short: 'Venture X', network: 'visa', currency: 'cap1_miles', color: '#23303d',
    base: 2,
    rules: [],
  },
  {
    presetId: 'wf_active_cash',
    name: 'Wells Fargo Active Cash', short: 'Active Cash', network: 'visa', currency: 'cash', color: '#d71e28',
    base: 2,
    rules: [],
  },
  {
    presetId: 'wf_autograph',
    name: 'Wells Fargo Autograph', short: 'Autograph', network: 'visa', currency: 'cash', color: '#5a1a1a',
    base: 1,
    rules: [
      { cats: ['dining', 'gas', 'ev_charging', 'streaming', 'utilities', ...TRAVEL], rate: 3 },
    ],
  },
  {
    presetId: 'bofa_customized',
    name: 'BofA Customized Cash', short: 'BofA Custom.', network: 'visa', currency: 'cash', color: '#e31837',
    base: 1,
    rules: [
      {
        cats: ['gas', 'ev_charging'], rate: 3, cap: { amount: 2500, period: 'quarter', group: 'combo' },
        label: 'Your choice category',
        choiceOptions: ['gas', 'online', 'dining', 'travel_other', 'drugstore', 'home_improvement'],
      },
      { cats: ['groceries', 'wholesale'], rate: 2, cap: { amount: 2500, period: 'quarter', group: 'combo' } },
    ],
  },
  {
    presetId: 'usbank_cash_plus',
    name: 'U.S. Bank Cash+', short: 'Cash+', network: 'visa', currency: 'cash', color: '#0c2074',
    base: 1,
    rules: [
      { cats: ['utilities'], rate: 5, cap: { amount: 2000, period: 'quarter', group: 'five' }, label: 'Choice #1', choiceOptions: ['utilities', 'fitness', 'department', 'home_improvement', 'entertainment', 'streaming', 'transit'] },
      { cats: ['streaming'], rate: 5, cap: { amount: 2000, period: 'quarter', group: 'five' }, label: 'Choice #2', choiceOptions: ['utilities', 'fitness', 'department', 'home_improvement', 'entertainment', 'streaming', 'transit'] },
      { cats: ['groceries'], rate: 2, label: 'Everyday choice', choiceOptions: ['groceries', 'gas', 'ev_charging', 'dining'] },
    ],
  },
  {
    presetId: 'costco_citi',
    name: 'Costco Anywhere Visa (Citi)', short: 'Costco Visa', network: 'visa', currency: 'cash', color: '#005daa',
    base: 1,
    rules: [
      { cats: ['gas', 'ev_charging'], rate: 4, cap: { amount: 7000, period: 'year' } },
      { cats: ['dining', ...TRAVEL], rate: 3 },
      { cats: ['costco'], rate: 2 },
    ],
  },
  {
    presetId: 'prime_visa',
    name: 'Amazon Prime Visa', short: 'Prime Visa', network: 'visa', currency: 'cash', color: '#232f3e',
    base: 1,
    rules: [
      { cats: ['amazon', 'whole_foods'], rate: 5 },
      { cats: ['dining', 'gas', 'transit', 'rideshare'], rate: 2 },
    ],
  },
  {
    presetId: 'target_circle',
    name: 'Target Circle Card', short: 'Target Card', network: 'mastercard', currency: 'cash', color: '#cc0000',
    base: 0,
    rules: [{ cats: ['target'], rate: 5, label: '5% off at Target' }],
  },
  {
    presetId: 'my_gm_rewards',
    name: 'My GM Rewards Card', short: 'GM Rewards', network: 'mastercard', currency: 'gm', color: '#3d4f63',
    base: 4,
    rules: [{ cats: ['gm'], rate: 7 }],
  },
];

// Merchant directory. `match` is tested against the store name / brand from
// OpenStreetMap and against what you type into search.
// `networks` limits which card networks the store takes (Costco in-store = Visa).
export const MERCHANTS = [
  { name: 'Amazon', match: /\bamazon\b/i, cats: ['amazon', 'online'] },
  { name: 'Whole Foods', match: /whole\s*foods/i, cats: ['groceries', 'whole_foods'] },
  { name: 'Target', match: /^target\b|\btarget\s+(store|super)/i, cats: ['target'] },
  { name: 'Walmart', match: /wal-?mart/i, cats: ['walmart'] },
  { name: 'Costco Gas', match: /costco\s*gas/i, cats: ['gas', 'costco'], networks: ['visa'] },
  { name: 'Costco', match: /costco/i, cats: ['wholesale', 'costco'], networks: ['visa'] },
  { name: "Sam's Club", match: /sam'?s\s*club/i, cats: ['wholesale'] },
  { name: "BJ's Wholesale", match: /\bbj'?s\b/i, cats: ['wholesale'] },
  { name: 'The Home Depot', match: /home\s*depot/i, cats: ['home_improvement'] },
  { name: "Lowe's", match: /\blowe'?s\b/i, cats: ['home_improvement'] },
  { name: 'Menards', match: /menards/i, cats: ['home_improvement'] },
  { name: 'CVS', match: /\bcvs\b/i, cats: ['drugstore'] },
  { name: 'Walgreens', match: /walgreens/i, cats: ['drugstore'] },
  { name: 'Rite Aid', match: /rite\s*aid/i, cats: ['drugstore'] },
  ...[
    'Kroger', 'Safeway', 'Publix', 'Albertsons', 'H-E-B', 'Wegmans', "Trader Joe's", 'Aldi', 'Food Lion',
    'Stop & Shop', 'Giant', 'Sprouts', 'Harris Teeter', 'Hy-Vee', 'ShopRite', 'Meijer', 'Vons', 'Ralphs',
    'Fred Meyer', 'King Soopers', 'Smith\'s', 'Jewel-Osco', 'Hannaford', 'Winn-Dixie', 'Lidl', 'Market Basket',
    'Giant Eagle', 'Weis', 'Fry\'s', 'Food 4 Less', 'WinCo',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n)}\\b`, 'i'), cats: ['groceries'] })),
  ...[
    'Shell', 'Exxon', 'Mobil', 'Chevron', 'BP', 'Sunoco', 'Speedway', 'Wawa', 'Sheetz', 'QuikTrip', 'Circle K',
    'Marathon', 'Valero', 'Citgo', 'Phillips 66', "Casey's", 'Texaco', 'Arco', '76', 'Kwik Trip', 'Racetrac', 'Love\'s', 'Pilot',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n)}\\b`, 'i'), cats: ['gas'] })),
  ...[
    'Starbucks', "McDonald's", 'Chipotle', "Dunkin'", 'Chick-fil-A', 'Subway', 'Panera', 'Taco Bell', "Wendy's",
    'Burger King', "Domino's", 'Pizza Hut', 'Olive Garden', "Applebee's", 'Panda Express', 'Five Guys', 'Sonic',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n).replace("'", "'?")}`, 'i'), cats: ['dining'] })),
  { name: 'Uber Eats', match: /uber\s*eats/i, cats: ['dining'] },
  { name: 'DoorDash', match: /door\s*dash/i, cats: ['dining'] },
  { name: 'Uber', match: /^uber$/i, cats: ['rideshare'] },
  { name: 'Lyft', match: /^lyft/i, cats: ['rideshare'] },
  { name: 'AMC Theatres', match: /^amc\b/i, cats: ['entertainment'] },
  { name: 'Regal', match: /^regal\b/i, cats: ['entertainment'] },
  { name: 'Cinemark', match: /cinemark/i, cats: ['entertainment'] },
  { name: 'Chevrolet dealer', match: /chevrolet|chevy/i, cats: ['gm', 'auto_service'] },
  { name: 'GMC dealer', match: /\bgmc\b/i, cats: ['gm', 'auto_service'] },
  { name: 'Buick dealer', match: /buick/i, cats: ['gm', 'auto_service'] },
  { name: 'Cadillac dealer', match: /cadillac/i, cats: ['gm', 'auto_service'] },
  { name: "Macy's", match: /^macy'?s/i, cats: ['department'] },
  { name: "Kohl's", match: /^kohl'?s/i, cats: ['department'] },
  { name: 'Nordstrom', match: /nordstrom/i, cats: ['department'] },
  { name: 'JCPenney', match: /jc\s*penney/i, cats: ['department'] },
  { name: 'Netflix', match: /netflix/i, cats: ['streaming'] },
  { name: 'Spotify', match: /spotify/i, cats: ['streaming'] },
  { name: 'Hulu', match: /hulu/i, cats: ['streaming'] },
  { name: 'Disney+', match: /disney\s*\+|disney plus/i, cats: ['streaming'] },
  { name: 'YouTube TV / Premium', match: /youtube/i, cats: ['streaming'] },
  { name: 'PayPal', match: /paypal/i, cats: ['paypal'] },
  { name: 'Comcast / Xfinity', match: /comcast|xfinity/i, cats: ['utilities'] },
  { name: 'Verizon', match: /verizon/i, cats: ['utilities'] },
  { name: 'AT&T', match: /at\s*&\s*t|\batt\b/i, cats: ['utilities'] },
  { name: 'T-Mobile', match: /t-?mobile/i, cats: ['utilities'] },
  { name: 'Delta', match: /^delta\b/i, cats: ['airfare'] },
  { name: 'United Airlines', match: /united\s*airlines/i, cats: ['airfare'] },
  { name: 'American Airlines', match: /american\s*airlines/i, cats: ['airfare'] },
  { name: 'Southwest', match: /southwest/i, cats: ['airfare'] },
  { name: 'Marriott', match: /marriott/i, cats: ['hotels'] },
  { name: 'Hilton', match: /hilton/i, cats: ['hotels'] },
  { name: 'Hyatt', match: /hyatt/i, cats: ['hotels'] },
  { name: 'Planet Fitness', match: /planet\s*fitness/i, cats: ['fitness'] },
  { name: 'Red Cross', match: /red\s*cross/i, cats: ['charity'] },
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// OpenStreetMap tag -> categories, used when the store isn't in MERCHANTS.
export const OSM_TAG_CATEGORIES = [
  ['amenity', /^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|biergarten)$/, ['dining']],
  ['amenity', /^fuel$/, ['gas']],
  ['amenity', /^charging_station$/, ['ev_charging']],
  ['amenity', /^pharmacy$/, ['drugstore']],
  ['amenity', /^(cinema|theatre|arts_centre|nightclub)$/, ['entertainment']],
  ['amenity', /^car_rental$/, ['car_rental']],
  ['amenity', /^(parking|bus_station|ferry_terminal)$/, ['transit']],
  ['amenity', /^taxi$/, ['rideshare']],
  ['shop', /^(supermarket|grocery|greengrocer|butcher|deli|seafood|health_food|frozen_food)$/, ['groceries']],
  ['shop', /^(bakery|pastry|coffee)$/, ['dining']],
  ['shop', /^chemist$/, ['drugstore']],
  ['shop', /^department_store$/, ['department']],
  ['shop', /^(doityourself|hardware|trade|garden_centre)$/, ['home_improvement']],
  ['shop', /^wholesale$/, ['wholesale']],
  ['shop', /^(car_repair|tyres|car_parts)$/, ['auto_service']],
  ['shop', /^car$/, ['auto_service']],
  ['shop', /^(mobile_phone|telecommunication)$/, ['utilities']],
  ['leisure', /^(fitness_centre|sports_centre)$/, ['fitness']],
  ['leisure', /^(bowling_alley|amusement_arcade|water_park|stadium|miniature_golf|escape_game)$/, ['entertainment']],
  ['tourism', /^(zoo|aquarium|theme_park|museum)$/, ['entertainment']],
  ['tourism', /^(hotel|motel|hostel|guest_house)$/, ['hotels']],
  ['aeroway', /^(aerodrome|terminal)$/, ['airfare']],
  ['railway', /^station$/, ['transit']],
  ['public_transport', /^station$/, ['transit']],
];
