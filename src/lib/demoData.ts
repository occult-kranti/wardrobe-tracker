import { SCHEMA_VERSION, DEFAULT_CATEGORIES, DEFAULT_OCCASIONS, type AppState, type ClothingItem, type Outfit, type WearLog, type WishlistItem } from '../types';
import { todayLocal, addDays } from './dates';

/**
 * A sample wardrobe that exercises every feature at once, so the populated
 * states can be seen without spending an evening photographing clothes.
 *
 * Images are inline SVG data-URIs — nothing is fetched, which keeps the
 * offline-first promise intact even in the demo. Two pieces deliberately have
 * no image so the drawn GarmentPlate stand-in is visible.
 */

function swatch(base: string, accent: string, label: string, motif: 'plain' | 'stripe' | 'check' | 'drape' = 'plain'): string {
  const motifs: Record<string, string> = {
    plain: '',
    stripe: `<g stroke="${accent}" stroke-width="6" opacity="0.35">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="0" y1="${i * 60}" x2="300" y2="${i * 60 - 120}"/>`).join('')}</g>`,
    check: `<g stroke="${accent}" stroke-width="3" opacity="0.3">${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="400"/><line x1="0" y1="${i * 70}" x2="300" y2="${i * 70}"/>`).join('')}</g>`,
    drape: `<g fill="none" stroke="${accent}" stroke-width="2" opacity="0.4">${[0, 1, 2, 3].map(i => `<path d="M40 ${120 + i * 60} Q150 ${160 + i * 60} 260 ${120 + i * 60}"/>`).join('')}</g>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="${base}"/>${motifs[motif]}<text x="150" y="376" font-family="Georgia,serif" font-size="19" fill="${accent}" text-anchor="middle" opacity="0.85">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const D = (n: number) => addDays(todayLocal(), n);

interface Seed {
  id: string;
  name: string;
  category: string;
  color: string;
  brand?: string;
  source?: ClothingItem['source'];
  fitsLike?: string;
  cost?: number;
  wearCount: number;
  favorite?: boolean;
  season: ClothingItem['season'];
  occasion: string[];
  laundry?: ClothingItem['laundryStatus'];
  lastWorn?: number;
  addedDaysAgo: number;
  swatch?: [string, string, string, ('plain' | 'stripe' | 'check' | 'drape')?];
  notes?: string;
  retiredDaysAgo?: number;
  retiredReason?: string;
}

const SEEDS: Seed[] = [
  // ---- tops
  { id: 'd-top-oxford', name: 'White Oxford Shirt', category: 'tops', color: '#EDE7DA', brand: 'Uniqlo', source: 'new', fitsLike: 'true to size, boxy through the shoulder', cost: 45, wearCount: 34, favorite: true, season: ['spring', 'summer', 'fall'], occasion: ['work', 'formal'], addedDaysAgo: 420, lastWorn: -2, swatch: ['#E8E2D4', '#8A8175', 'Oxford'] },
  { id: 'd-top-navy', name: 'Navy Merino Crewneck', category: 'tops', color: '#2C3A54', brand: 'Everlane', source: 'new', fitsLike: 'slim, sleeves run long', cost: 88, wearCount: 21, season: ['fall', 'winter'], occasion: ['work', 'casual'], addedDaysAgo: 300, lastWorn: -9, swatch: ['#2C3A54', '#8FA3C4', 'Merino'] },
  { id: 'd-top-breton', name: 'Breton Stripe Tee', category: 'tops', color: '#F0EBE0', brand: 'Saint James', source: 'gifted', fitsLike: 'roomy, hits at hip', cost: 70, wearCount: 18, favorite: true, season: ['spring', 'summer'], occasion: ['casual'], addedDaysAgo: 260, lastWorn: -5, swatch: ['#F0EBE0', '#31415E', 'Breton', 'stripe'] },
  { id: 'd-top-silk', name: 'Silk Camisole', category: 'tops', color: '#C48B9E', brand: 'Vintage', source: 'secondhand', fitsLike: 'bias cut, drapes close', cost: 24, wearCount: 6, season: ['spring', 'summer'], occasion: ['party', 'formal'], addedDaysAgo: 180, lastWorn: -21, swatch: ['#C48B9E', '#7A4A58', 'Silk', 'drape'] },
  { id: 'd-top-linen', name: 'Linen Camp Shirt', category: 'tops', color: '#D9C4A3', source: 'self-made', fitsLike: 'drafted from my own block, easy through the chest', cost: 32, wearCount: 12, season: ['summer'], occasion: ['casual', 'performance'], addedDaysAgo: 150, lastWorn: -14, notes: 'Made from deadstock linen. Materials + notions only.', swatch: ['#D9C4A3', '#8A7350', 'Linen'] },

  // ---- bottoms
  { id: 'd-bot-denim', name: 'Raw Denim Jeans', category: 'bottoms', color: '#31415E', brand: 'Levi’s', source: 'new', fitsLike: 'size down one, stretches with wear', cost: 120, wearCount: 62, favorite: true, season: ['spring', 'fall', 'winter'], occasion: ['casual'], addedDaysAgo: 500, lastWorn: -2, swatch: ['#31415E', '#9FB0C9', 'Denim'] },
  { id: 'd-bot-trouser', name: 'Pleated Wool Trousers', category: 'bottoms', color: '#3A362E', brand: 'COS', source: 'new', fitsLike: 'high waist, break at the ankle', cost: 135, wearCount: 19, season: ['fall', 'winter'], occasion: ['work', 'formal'], addedDaysAgo: 340, lastWorn: -9, swatch: ['#3A362E', '#A8A08C', 'Wool', 'check'] },
  { id: 'd-bot-kilt', name: 'Wrap Kilt Skirt', category: 'bottoms', color: '#5E4232', source: 'self-made', fitsLike: 'wraps generously, pins at the hip', cost: 40, wearCount: 9, favorite: true, season: ['fall'], occasion: ['performance', 'party'], addedDaysAgo: 120, lastWorn: -30, notes: 'Drafted on the table. Third version of this pattern.', swatch: ['#5E4232', '#C9A227', 'Kilt', 'check'] },

  // ---- one-pieces (dresses live here, ungendered)
  { id: 'd-one-column', name: 'Black Column Dress', category: 'dresses', color: '#201D18', brand: 'The Row', source: 'inherited', fitsLike: 'column cut, skims — no waist seam', cost: 0, wearCount: 11, favorite: true, season: ['fall', 'winter'], occasion: ['formal', 'party'], addedDaysAgo: 600, lastWorn: -16, notes: 'My aunt’s. Altered the hem, kept everything else.', swatch: ['#201D18', '#9A9182', 'Column', 'drape'] },
  { id: 'd-one-wrap', name: 'Sage Wrap Midi', category: 'dresses', color: '#5A7A6E', brand: 'Whistles', source: 'secondhand', fitsLike: 'ties adjustable, hits mid-calf', cost: 48, wearCount: 7, season: ['spring', 'summer'], occasion: ['work', 'party'], addedDaysAgo: 200, lastWorn: -25, swatch: ['#5A7A6E', '#D5E0D8', 'Wrap', 'drape'] },
  { id: 'd-one-slip', name: 'Bias Slip Dress', category: 'dresses', color: '#771324', source: 'self-made', fitsLike: 'true bias, grows about an inch by evening', cost: 55, wearCount: 4, season: ['summer'], occasion: ['party', 'performance'], addedDaysAgo: 90, lastWorn: -40, notes: 'Silk crepe. Hung for three days before hemming.', swatch: ['#771324', '#E0A4AE', 'Bias', 'drape'] },
  { id: 'd-one-jumpsuit', name: 'Utility Jumpsuit', category: 'dresses', color: '#4A5240', brand: 'Lemaire', source: 'new', fitsLike: 'oversized, belt it or it swims', cost: 210, wearCount: 8, season: ['spring', 'fall'], occasion: ['casual', 'work'], addedDaysAgo: 170, lastWorn: -11, swatch: ['#4A5240', '#C4C9B8', 'Utility'] },

  // ---- layers
  { id: 'd-lay-vest', name: 'Long Wool Vest', category: 'layers', color: '#6B6560', brand: 'Arket', source: 'new', fitsLike: 'third layer, hits below the knee', cost: 130, wearCount: 15, favorite: true, season: ['fall', 'winter'], occasion: ['work', 'casual'], addedDaysAgo: 280, lastWorn: -6, swatch: ['#6B6560', '#CFC7B8', 'Vest'] },
  { id: 'd-lay-cardi', name: 'Oatmeal Cardigan', category: 'layers', color: '#D4C4A8', brand: 'Uniqlo', source: 'new', fitsLike: 'boxy, layers over everything', cost: 50, wearCount: 27, season: ['spring', 'fall'], occasion: ['casual', 'work'], addedDaysAgo: 310, lastWorn: -4, swatch: ['#D4C4A8', '#8A7B62', 'Cardigan'] },

  // ---- outerwear
  { id: 'd-out-coat', name: 'Charcoal Wool Overcoat', category: 'outerwear', color: '#3A362E', brand: 'Mackintosh', source: 'new', fitsLike: 'roomy enough for a jumper underneath', cost: 420, wearCount: 24, favorite: true, season: ['winter'], occasion: ['work', 'formal'], addedDaysAgo: 700, lastWorn: -9, swatch: ['#3A362E', '#B0A894', 'Overcoat'] },
  { id: 'd-out-chore', name: 'Indigo Chore Jacket', category: 'outerwear', color: '#31415E', brand: 'Vetra', source: 'swapped', fitsLike: 'workwear cut, straight through the body', cost: 0, wearCount: 0, season: ['spring', 'fall'], occasion: ['casual'], laundry: 'needs-repair', addedDaysAgo: 45, notes: 'Elbow needs a patch before it goes back into rotation.', swatch: ['#31415E', '#A9B8CE', 'Chore'] },
  { id: 'd-out-trench', name: 'Stone Trench', category: 'outerwear', color: '#C9BFA8', brand: 'Burberry', source: 'inherited', fitsLike: 'belted, sleeves need shortening', cost: 0, wearCount: 5, season: ['spring', 'fall'], occasion: ['work'], laundry: 'at-tailor', addedDaysAgo: 380, lastWorn: -33, swatch: ['#C9BFA8', '#6E6552', 'Trench'] },

  // ---- shoes
  { id: 'd-shoe-sneaker', name: 'White Leather Sneakers', category: 'shoes', color: '#EFEAE0', brand: 'Common Projects', source: 'new', fitsLike: 'size down a half', cost: 340, wearCount: 88, favorite: true, season: ['spring', 'summer', 'fall'], occasion: ['casual'], addedDaysAgo: 450, lastWorn: -2, swatch: ['#EFEAE0', '#8A8175', 'Sneaker'] },
  { id: 'd-shoe-chelsea', name: 'Brown Chelsea Boots', category: 'shoes', color: '#5E4232', brand: 'Blundstone', source: 'new', fitsLike: 'true to size, needs thick socks', cost: 180, wearCount: 41, season: ['fall', 'winter'], occasion: ['casual', 'work'], addedDaysAgo: 520, lastWorn: -9, swatch: ['#5E4232', '#C4A88E', 'Chelsea'] },
  { id: 'd-shoe-heel', name: 'Black Leather Heels', category: 'shoes', color: '#201D18', brand: 'Church’s', source: 'secondhand', fitsLike: 'narrow, fine for three hours', cost: 95, wearCount: 6, season: ['fall', 'winter', 'spring'], occasion: ['formal', 'party'], addedDaysAgo: 240, lastWorn: -16, swatch: ['#201D18', '#8A8175', 'Heels'] },

  // ---- jewellery
  { id: 'd-jew-signet', name: 'Gold Signet Ring', category: 'jewellery', color: '#C9A227', source: 'inherited', fitsLike: 'left little finger, sits snug', cost: 0, wearCount: 96, favorite: true, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'work', 'formal', 'party', 'performance'], addedDaysAgo: 900, lastWorn: -2, notes: 'My grandmother’s. Never comes off.', swatch: ['#3A362E', '#C9A227', 'Signet'] },
  { id: 'd-jew-pearls', name: 'Freshwater Pearl Strand', category: 'jewellery', color: '#F0EBE0', source: 'inherited', fitsLike: 'princess length, sits at the collarbone', cost: 0, wearCount: 9, favorite: true, season: ['fall', 'winter', 'spring'], occasion: ['formal', 'party'], addedDaysAgo: 640, lastWorn: -16, swatch: ['#F0EBE0', '#A89B8C', 'Pearls'] },
  { id: 'd-jew-hoops', name: 'Brass Hoop Earrings', category: 'jewellery', color: '#C9A227', brand: 'Wolf Circus', source: 'new', fitsLike: 'medium hoop, light enough for all day', cost: 68, wearCount: 23, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'party', 'performance'], addedDaysAgo: 220, lastWorn: -5, swatch: ['#4A4438', '#C9A227', 'Hoops'] },
  { id: 'd-jew-cuff', name: 'Silver Cuff', category: 'jewellery', color: '#A8A39E', source: 'self-made', fitsLike: 'right wrist, forms to the arm', cost: 30, wearCount: 14, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'performance'], addedDaysAgo: 130, lastWorn: -11, notes: 'Hammered it in a workshop class. First metal piece I made.', swatch: ['#3A362E', '#C9C4BC', 'Cuff'] },
  { id: 'd-jew-pendant', name: 'Enamel Pendant', category: 'jewellery', color: '#771324', brand: 'Alighieri', source: 'gifted', cost: 0, wearCount: 3, season: ['fall', 'winter'], occasion: ['party', 'formal'], addedDaysAgo: 60, lastWorn: -25, swatch: ['#2A251C', '#BE1231', 'Pendant'] },
  // No image on purpose — shows the drawn stand-in.
  { id: 'd-jew-studs', name: 'Pearl Studs', category: 'jewellery', color: '#F0EBE0', source: 'gifted', cost: 0, wearCount: 0, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['work', 'formal'], addedDaysAgo: 20 },

  // ---- accessories
  { id: 'd-acc-tote', name: 'Canvas Tote', category: 'accessories', color: '#D9C4A3', source: 'gifted', cost: 0, wearCount: 52, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'work'], addedDaysAgo: 400, lastWorn: -4, swatch: ['#D9C4A3', '#7A6A50', 'Tote'] },
  { id: 'd-acc-scarf', name: 'Silk Square Scarf', category: 'accessories', color: '#BE1231', source: 'secondhand', cost: 35, wearCount: 8, season: ['fall', 'winter', 'spring'], occasion: ['work', 'formal'], addedDaysAgo: 190, lastWorn: -21, swatch: ['#BE1231', '#F0D5C0', 'Scarf', 'drape'] },
  // No image on purpose.
  { id: 'd-acc-belt', name: 'Tan Leather Belt', category: 'accessories', color: '#8B6B4A', brand: 'Anderson’s', source: 'new', cost: 90, wearCount: 17, season: ['spring', 'fall'], occasion: ['work', 'casual'], addedDaysAgo: 260, lastWorn: -11 },

  // ---- retired (history kept)
  { id: 'd-ret-jacket', name: 'Cropped Denim Jacket', category: 'outerwear', color: '#6B8FA3', brand: 'Zara', source: 'new', cost: 60, wearCount: 3, season: ['spring'], occasion: ['casual'], addedDaysAgo: 800, lastWorn: -300, retiredDaysAgo: 60, retiredReason: 'Not me anymore', swatch: ['#6B8FA3', '#DCE6EC', 'Denim Jkt'] },
  { id: 'd-ret-heels', name: 'Red Patent Heels', category: 'shoes', color: '#A03D3D', brand: 'Zara', source: 'new', cost: 75, wearCount: 1, season: ['summer'], occasion: ['party'], addedDaysAgo: 760, lastWorn: -400, retiredDaysAgo: 120, retiredReason: 'Swapped on', swatch: ['#A03D3D', '#F0D0D0', 'Patent'] },
];

function buildItems(): ClothingItem[] {
  return SEEDS.map(s => {
    const item: ClothingItem = {
      id: s.id,
      name: s.name,
      category: s.category,
      color: s.color,
      brand: s.brand,
      source: s.source,
      fitsLike: s.fitsLike,
      season: s.season,
      occasion: s.occasion,
      imageUrl: s.swatch ? swatch(s.swatch[0], s.swatch[1], s.swatch[2], s.swatch[3] ?? 'plain') : '',
      dateAdded: D(-s.addedDaysAgo),
      lastWorn: s.lastWorn !== undefined ? D(s.lastWorn) : undefined,
      wearCount: s.wearCount,
      cost: s.cost,
      favorite: s.favorite ?? false,
      notes: s.notes,
      laundryStatus: s.laundry ?? 'clean',
    };
    if (s.retiredDaysAgo !== undefined) {
      item.retired = { date: D(-s.retiredDaysAgo), reason: s.retiredReason };
    }
    return item;
  });
}

// Outfits deliberately include jewellery — a saved outfit is the whole look,
// down to the ring.
const OUTFITS: Array<Omit<Outfit, 'dateCreated' | 'lastWorn'> & { createdDaysAgo: number; lastWornDaysAgo?: number }> = [
  {
    id: 'd-fit-monday',
    name: 'Monday Uniform',
    itemIds: ['d-top-oxford', 'd-bot-denim', 'd-shoe-sneaker', 'd-jew-signet', 'd-acc-tote'],
    favorite: true,
    wearCount: 14,
    occasion: 'work',
    createdDaysAgo: 300,
    lastWornDaysAgo: 2,
  },
  {
    id: 'd-fit-gallery',
    name: 'Gallery Evening',
    itemIds: ['d-one-column', 'd-jew-pearls', 'd-shoe-heel', 'd-jew-signet'],
    favorite: true,
    wearCount: 6,
    occasion: 'formal',
    createdDaysAgo: 240,
    lastWornDaysAgo: 16,
  },
  {
    id: 'd-fit-coldsnap',
    name: 'Cold Snap Layers',
    itemIds: ['d-top-navy', 'd-bot-trouser', 'd-lay-vest', 'd-out-coat', 'd-shoe-chelsea', 'd-jew-signet'],
    favorite: true,
    wearCount: 9,
    occasion: 'work',
    createdDaysAgo: 190,
    lastWornDaysAgo: 9,
  },
  {
    id: 'd-fit-stage',
    name: 'Stage Night',
    itemIds: ['d-one-slip', 'd-jew-hoops', 'd-jew-cuff', 'd-bot-kilt'],
    favorite: false,
    wearCount: 3,
    occasion: 'performance',
    createdDaysAgo: 80,
    lastWornDaysAgo: 30,
  },
  {
    id: 'd-fit-saturday',
    name: 'Saturday Market',
    itemIds: ['d-top-breton', 'd-bot-denim', 'd-lay-cardi', 'd-shoe-sneaker', 'd-jew-hoops', 'd-acc-tote'],
    favorite: true,
    wearCount: 11,
    occasion: 'casual',
    createdDaysAgo: 160,
    lastWornDaysAgo: 5,
  },
  {
    id: 'd-fit-summer',
    name: 'Warm Day, Linen',
    itemIds: ['d-top-linen', 'd-bot-kilt', 'd-jew-cuff', 'd-shoe-sneaker'],
    favorite: false,
    wearCount: 4,
    occasion: 'casual',
    createdDaysAgo: 100,
    lastWornDaysAgo: 14,
  },
];

// A year of history, weighted toward the outfits actually in rotation, plus a
// couple of planned days in the future so the calendar shows both states.
function buildWearLogs(): WearLog[] {
  const logs: WearLog[] = [];
  const byOutfit: Record<string, string[]> = Object.fromEntries(OUTFITS.map(o => [o.id, o.itemIds]));
  const schedule: Array<[number, string]> = [
    [-2, 'd-fit-monday'], [-4, 'd-fit-saturday'], [-5, 'd-fit-saturday'],
    [-6, 'd-fit-coldsnap'], [-9, 'd-fit-coldsnap'], [-11, 'd-fit-summer'],
    [-14, 'd-fit-summer'], [-16, 'd-fit-gallery'], [-19, 'd-fit-monday'],
    [-21, 'd-fit-coldsnap'], [-25, 'd-fit-gallery'], [-30, 'd-fit-stage'],
    [-33, 'd-fit-monday'], [-40, 'd-fit-stage'], [-47, 'd-fit-saturday'],
    [-54, 'd-fit-monday'], [-61, 'd-fit-coldsnap'], [-75, 'd-fit-saturday'],
    [-90, 'd-fit-monday'], [-104, 'd-fit-gallery'], [-120, 'd-fit-monday'],
    [-140, 'd-fit-saturday'], [-165, 'd-fit-coldsnap'], [-190, 'd-fit-monday'],
  ];
  schedule.forEach(([offset, outfitId], i) => {
    logs.push({ id: `d-log-${i}`, date: D(offset), itemIds: byOutfit[outfitId], outfitId });
  });
  // A few loose-piece days (no saved outfit).
  logs.push({ id: 'd-log-loose-0', date: D(-3), itemIds: ['d-top-breton', 'd-bot-denim', 'd-shoe-sneaker', 'd-jew-signet'] });
  logs.push({ id: 'd-log-loose-1', date: D(-8), itemIds: ['d-one-jumpsuit', 'd-shoe-chelsea', 'd-jew-cuff'] });
  logs.push({ id: 'd-log-loose-2', date: D(-13), itemIds: ['d-one-wrap', 'd-jew-pendant', 'd-shoe-heel'] });
  // Planned days — future logs are plans, not wears.
  logs.push({ id: 'd-log-plan-0', date: D(1), itemIds: byOutfit['d-fit-gallery'], outfitId: 'd-fit-gallery' });
  logs.push({ id: 'd-log-plan-1', date: D(3), itemIds: byOutfit['d-fit-monday'], outfitId: 'd-fit-monday' });
  return logs;
}

function buildWishlist(): WishlistItem[] {
  return [
    {
      id: 'd-wish-cardi',
      name: 'Camel Wool Cardigan',
      category: 'layers',
      color: '#D4A574',
      brand: 'Everlane',
      price: 118,
      priority: 'high',
      dateAdded: D(-4),
      status: 'waiting',
      // Still cooling — silent until it expires.
      coolingOff: { endsAt: D(3), asked: false },
      notes: 'Saw it in the window on the way home.',
    },
    {
      id: 'd-wish-blackdress',
      name: 'Another Black Dress',
      category: 'dresses',
      color: '#201D18',
      brand: 'COS',
      price: 150,
      priority: 'medium',
      dateAdded: D(-12),
      status: 'waiting',
      // Expired — the card asks once, calmly.
      coolingOff: { endsAt: D(-5), asked: false },
    },
    {
      id: 'd-wish-loafers',
      name: 'Penny Loafers',
      category: 'shoes',
      color: '#5E4232',
      brand: 'G.H. Bass',
      price: 175,
      priority: 'medium',
      dateAdded: D(-30),
      status: 'kept',
      coolingOff: { endsAt: D(-23), asked: true },
    },
    {
      id: 'd-wish-jacket',
      name: 'Sequin Jacket',
      category: 'outerwear',
      color: '#8B6B8F',
      brand: 'Zara',
      price: 89,
      priority: 'low',
      dateAdded: D(-45),
      status: 'let-go',
      releasedAt: D(-38),
      coolingOff: { endsAt: D(-38), asked: true },
    },
    {
      id: 'd-wish-necklace',
      name: 'Gold Chain Necklace',
      category: 'jewellery',
      color: '#C9A227',
      brand: 'Missoma',
      price: 140,
      priority: 'low',
      dateAdded: D(-60),
      status: 'let-go',
      releasedAt: D(-52),
      coolingOff: { endsAt: D(-53), asked: true },
    },
    {
      id: 'd-wish-boots',
      name: 'Chelsea Boots',
      category: 'shoes',
      color: '#5E4232',
      brand: 'Blundstone',
      price: 180,
      priority: 'high',
      dateAdded: D(-520),
      status: 'bought',
    },
  ];
}

export function buildDemoState(): AppState {
  const items = buildItems();
  const outfits: Outfit[] = OUTFITS.map(o => ({
    id: o.id,
    name: o.name,
    itemIds: o.itemIds,
    occasion: o.occasion,
    favorite: o.favorite,
    wearCount: o.wearCount,
    dateCreated: D(-o.createdDaysAgo),
    lastWorn: o.lastWornDaysAgo !== undefined ? D(-o.lastWornDaysAgo) : undefined,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    items,
    outfits,
    wearLogs: buildWearLogs(),
    wishlist: buildWishlist(),
    settings: {
      categories: DEFAULT_CATEGORIES,
      occasions: [...DEFAULT_OCCASIONS, 'studio', 'market day'],
      theme: 'dark',
    },
  };
}

/** Headline counts, for the Settings copy that describes what will be loaded. */
export const DEMO_SUMMARY = {
  items: SEEDS.length,
  outfits: OUTFITS.length,
  jewellery: SEEDS.filter(s => s.category === 'jewellery').length,
};
