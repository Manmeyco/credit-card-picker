// Static reference data: spending categories, a merchant directory, and
// OpenStreetMap tag -> category mapping.

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

// Category aliases usable in data/cards.json.
export const CATEGORY_ALIASES = {
  '@travel': ['airfare', 'hotels', 'car_rental', 'transit', 'rideshare', 'travel_other'],
};

// Card presets and point currencies live in data/cards.json so they can be
// updated without touching the app code. See js/catalog.js and UPDATING.md.

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
