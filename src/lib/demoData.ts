import { SCHEMA_VERSION, DEFAULT_CATEGORIES, DEFAULT_OCCASIONS, type AppState, type ClothingItem, type Outfit, type Season, type WearLog, type WishlistItem } from '../types';
import { todayLocal, addDays } from './dates';
import { GARMENT_ART } from './garmentArt';

/**
 * A sample wardrobe that exercises every feature at once, so the populated
 * states can be seen without spending an evening photographing clothes.
 *
 * Images are inline SVG data-URIs — nothing is fetched, which keeps the
 * offline-first promise intact even in the demo. Two pieces deliberately have
 * no image so the drawn GarmentPlate stand-in is visible.
 */

/**
 * The drawn plate for a piece, if one exists.
 *
 * These replaced flat colour rectangles with a caption stamped on them. Each is
 * a technical flat — placket, sleeve seams, waistband, hardware — with the
 * textile carrying the colour rhythm, drawn so a garment reads as itself at
 * tile size. Pieces without a plate fall back to the procedural swatch below,
 * and two pieces deliberately have neither so the drawn GarmentPlate stand-in
 * stays visible.
 */
function plate(id: string): string | undefined {
  const svg = GARMENT_ART[id];
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : undefined;
}

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

  // ---- independent makers, added later than the core wardrobe
  // A closet that is all high-street reads as a shopping list. These arrived
  // over the last year, which is also what gives the cost-per-wear curve its
  // steps: every one of them starts the sum again.
  { id: 'd-top-marimekko', name: 'Printed Poplin Shirt', category: 'tops', color: '#F0EBE0', brand: 'Marimekko', source: 'new', fitsLike: 'straight cut, roomy through the body', cost: 165, wearCount: 42, favorite: true, season: ['spring', 'summer'], occasion: ['casual', 'work'], addedDaysAgo: 480, lastWorn: -7, swatch: ['#F0EBE0', '#BE1231', 'Poplin'] },
  { id: 'd-bot-toogood', name: 'Painter Trousers', category: 'bottoms', color: '#D9C4A3', brand: 'Toogood', source: 'new', fitsLike: 'very wide, sits at the natural waist', cost: 290, wearCount: 55, season: ['spring', 'summer', 'fall'], occasion: ['casual', 'performance'], addedDaysAgo: 520, lastWorn: -6, notes: 'The pockets are big enough for a full sketchbook.', swatch: ['#D9C4A3', '#8A7350', 'Painter'] },
  { id: 'd-one-bode', name: 'Quilted Patchwork Dress', category: 'dresses', color: '#C9A227', brand: 'Bode', source: 'secondhand', fitsLike: 'shirt dress cut, wears warm', cost: 240, wearCount: 17, favorite: true, season: ['fall', 'winter'], occasion: ['party', 'casual'], addedDaysAgo: 440, lastWorn: -18, notes: 'Found it secondhand. Someone had already mended the third block.', swatch: ['#C9A227', '#BE1231', 'Quilt', 'check'] },
  { id: 'd-lay-nicholson', name: 'Boiled Wool Overshirt', category: 'layers', color: '#4A5240', brand: 'Studio Nicholson', source: 'new', fitsLike: 'sized to layer over a knit', cost: 310, wearCount: 48, season: ['fall', 'winter', 'spring'], occasion: ['work', 'casual'], addedDaysAgo: 400, lastWorn: -4, swatch: ['#4A5240', '#C4C9B8', 'Overshirt'] },
  { id: 'd-out-ganni', name: 'Cropped Puffer', category: 'outerwear', color: '#771324', brand: 'Ganni', source: 'secondhand', fitsLike: 'cropped at the hip, room for a jumper', cost: 145, wearCount: 26, season: ['winter'], occasion: ['casual'], addedDaysAgo: 460, lastWorn: -12, swatch: ['#771324', '#E0A4AE', 'Puffer'] },
  { id: 'd-shoe-nomasei', name: 'Ecru Leather Mary Janes', category: 'shoes', color: '#E8E2D4', brand: 'Nomasei', source: 'new', fitsLike: 'true to size, strap needs no breaking in', cost: 395, wearCount: 44, favorite: true, season: ['spring', 'summer', 'fall'], occasion: ['work', 'party'], addedDaysAgo: 420, lastWorn: -3, swatch: ['#E8E2D4', '#8A8175', 'Mary Jane'] },
  { id: 'd-acc-telfar', name: 'Small Shopper', category: 'accessories', color: '#771324', brand: 'Telfar', source: 'new', fitsLike: 'holds a laptop, just', cost: 202, wearCount: 63, favorite: true, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'work', 'party'], addedDaysAgo: 390, lastWorn: -2, swatch: ['#771324', '#E0A4AE', 'Shopper'] },
  // Gifted, so it costs the ledger nothing — the one piece that arrives inside
  // the charted year, and it steps the cost-per-wear curve not at all.
  { id: 'd-jew-completedworks', name: 'Ceramic Drop Earrings', category: 'jewellery', color: '#F0EBE0', brand: 'Completedworks', source: 'gifted', fitsLike: 'light, long enough to swing', cost: 0, wearCount: 11, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['party', 'formal', 'performance'], addedDaysAgo: 70, lastWorn: -8, swatch: ['#2A251C', '#F0EBE0', 'Ceramic'] },

  // ---- ceremony, festival, and heritage pieces
  // A wardrobe holds every occasion its owner dresses for — the festival kit and
  // the wedding silks are as daily-real as the oxford. 'drapes' is a CUSTOM
  // category, added in this demo's settings, exercising the rule that taxonomy
  // is user-owned data (focus-group §1.1). Nothing here is gendered; a sari is a
  // garment, and the app asks what you own, never who you are.
  { id: 'd-dra-sari', name: 'Banarasi Silk Sari', category: 'drapes', color: '#771324', source: 'inherited', fitsLike: 'six yards; drapes to any height', cost: 0, wearCount: 6, favorite: true, season: ['fall', 'winter', 'spring'], occasion: ['wedding', 'festival', 'ceremony'], addedDaysAgo: 900, lastWorn: -63, notes: 'My grandmother’s wedding sari. The zari is real gold thread; it goes to the dry cleaner once a decade and to weddings the rest of the time.', swatch: ['#771324', '#C9A227', 'Sari'] },
  { id: 'd-dra-lehenga', name: 'Embroidered Lehenga Set', category: 'drapes', color: '#2E6B4F', brand: 'Sabyasachi', source: 'secondhand', fitsLike: 'skirt drawstring adjusts; choli runs small', cost: 380, wearCount: 4, season: ['fall', 'winter'], occasion: ['wedding', 'festival'], addedDaysAgo: 420, lastWorn: -110, notes: 'Found at a wedding-wear resale. Three kilos of skirt.', swatch: ['#2E6B4F', '#C9A227', 'Lehenga'] },
  { id: 'd-dra-obi', name: 'Vintage Obi Sash', category: 'drapes', color: '#C9A227', source: 'secondhand', fitsLike: 'wraps twice, ties flat', cost: 55, wearCount: 3, season: ['fall', 'winter'], occasion: ['ceremony', 'party'], addedDaysAgo: 300, lastWorn: -95, notes: 'Kyoto flea market. Worn as a belt over the column dress.', swatch: ['#C9A227', '#F0EBE0', 'Obi'] },
  { id: 'd-top-kurta', name: 'Chikankari Kurta', category: 'tops', color: '#FBF8F0', source: 'gifted', fitsLike: 'straight cut, generous side slits', cost: 0, wearCount: 18, favorite: true, season: ['spring', 'summer'], occasion: ['casual', 'festival', 'ceremony'], addedDaysAgo: 560, lastWorn: -9, notes: 'White-on-white shadow work from Lucknow. From my aunt, who insisted it be worn, not kept.', swatch: ['#FBF8F0', '#A89B8C', 'Kurta'] },
  { id: 'd-one-kaftan', name: 'Embroidered Kaftan', category: 'dresses', color: '#31415E', source: 'secondhand', fitsLike: 'one size drapes over everything', cost: 60, wearCount: 9, season: ['summer'], occasion: ['casual', 'festival'], addedDaysAgo: 380, lastWorn: -32, swatch: ['#31415E', '#C9A227', 'Kaftan'] },
  { id: 'd-lay-haori', name: 'Silk Haori Jacket', category: 'layers', color: '#201D18', source: 'secondhand', fitsLike: 'square cut, sits open', cost: 90, wearCount: 12, favorite: true, season: ['fall', 'winter', 'spring'], occasion: ['party', 'formal', 'ceremony'], addedDaysAgo: 340, lastWorn: -16, notes: 'The lining is the whole point. Worn open, indoors, at exactly the right moment.', swatch: ['#201D18', '#BE1231', 'Haori'] },
  { id: 'd-one-sequin', name: 'Sequin Slip Dress', category: 'dresses', color: '#6B6560', brand: 'Rixo', source: 'secondhand', fitsLike: 'bias cut, heavier than it looks', cost: 85, wearCount: 8, favorite: true, season: ['spring', 'summer', 'fall'], occasion: ['festival', 'party'], addedDaysAgo: 310, lastWorn: -25, swatch: ['#6B6560', '#C9C4BC', 'Sequin'] },
  { id: 'd-shoe-jutti', name: 'Zardozi Juttis', category: 'shoes', color: '#771324', source: 'new', fitsLike: 'stiff for the first wedding, moulded by the second', cost: 48, wearCount: 7, season: ['fall', 'winter', 'spring'], occasion: ['wedding', 'festival', 'ceremony'], addedDaysAgo: 400, lastWorn: -63, swatch: ['#771324', '#C9A227', 'Jutti'] },
  { id: 'd-shoe-metallic', name: 'Metallic Ankle Boots', category: 'shoes', color: '#A8A39E', brand: 'Vagabond', source: 'new', fitsLike: 'true to size, walkable heel', cost: 160, wearCount: 10, season: ['spring', 'summer', 'fall'], occasion: ['festival', 'party'], addedDaysAgo: 280, lastWorn: -25, swatch: ['#A8A39E', '#E8E2D4', 'Metallic'] },
  { id: 'd-acc-shawl', name: 'Embroidered Piano Shawl', category: 'accessories', color: '#201D18', source: 'inherited', fitsLike: 'covers everything, catches on nothing', cost: 0, wearCount: 5, season: ['fall', 'winter'], occasion: ['party', 'ceremony', 'festival'], addedDaysAgo: 700, lastWorn: -40, notes: 'The fringe takes ten minutes to untangle and is worth every one of them.', swatch: ['#201D18', '#BE1231', 'Shawl'] },
  { id: 'd-jew-jhumka', name: 'Silver Jhumka Earrings', category: 'jewellery', color: '#A8A39E', source: 'gifted', fitsLike: 'heavier than hoops; fine for an evening', cost: 0, wearCount: 9, favorite: true, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['wedding', 'festival', 'ceremony', 'party'], addedDaysAgo: 520, lastWorn: -63, swatch: ['#A8A39E', '#4A4438', 'Jhumka'] },
  { id: 'd-jew-bangles', name: 'Glass Bangle Set', category: 'jewellery', color: '#BE1231', source: 'new', fitsLike: 'a dozen; wear as many as the day deserves', cost: 24, wearCount: 8, season: ['spring', 'summer', 'fall', 'winter'], occasion: ['festival', 'wedding', 'casual'], addedDaysAgo: 450, lastWorn: -25, swatch: ['#BE1231', '#C9A227', 'Bangles'] },

  // ---- retired (history kept)
  { id: 'd-ret-jacket', name: 'Cropped Denim Jacket', category: 'outerwear', color: '#6B8FA3', brand: 'Zara', source: 'new', cost: 60, wearCount: 3, season: ['spring'], occasion: ['casual'], addedDaysAgo: 800, lastWorn: -300, retiredDaysAgo: 60, retiredReason: 'Not me anymore', swatch: ['#6B8FA3', '#DCE6EC', 'Denim Jkt'] },
  { id: 'd-ret-heels', name: 'Red Patent Heels', category: 'shoes', color: '#A03D3D', brand: 'Zara', source: 'new', cost: 75, wearCount: 1, season: ['summer'], occasion: ['party'], addedDaysAgo: 760, lastWorn: -400, retiredDaysAgo: 120, retiredReason: 'Swapped on', swatch: ['#A03D3D', '#F0D0D0', 'Patent'] },
];

/**
 * Wear counts are DERIVED from the generated history, never asserted beside it.
 *
 * `WardrobeContext.logWear` guarantees one invariant: a non-future log increments
 * `wearCount` by one for every credited piece and moves `lastWorn` forward. The
 * demo used to violate it — the seeds claimed 639 wears while the logs implied
 * 133, so cost-per-wear read $3.61 from the items and $17.33 from the log. Any
 * time-series built on the log therefore contradicted the headline by 4.8×.
 * Deriving both fields here restores the invariant the app itself maintains.
 */
function buildItems(logs: WearLog[]): ClothingItem[] {
  const today = todayLocal();
  const wears = new Map<string, number>();
  const lastWorn = new Map<string, string>();

  for (const log of logs) {
    if (log.date > today) continue; // future logs are plans, not wears
    for (const id of log.itemIds) {
      wears.set(id, (wears.get(id) ?? 0) + 1);
      const seen = lastWorn.get(id);
      if (!seen || log.date > seen) lastWorn.set(id, log.date);
    }
  }

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
      imageUrl:
        plate(s.id) ??
        (s.swatch ? swatch(s.swatch[0], s.swatch[1], s.swatch[2], s.swatch[3] ?? 'plain') : ''),
      dateAdded: D(-s.addedDaysAgo),
      lastWorn: lastWorn.get(s.id),
      wearCount: wears.get(s.id) ?? 0,
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

  // ---- festival
  {
    id: 'd-fit-festival',
    name: 'Festival Rig',
    itemIds: ['d-one-sequin', 'd-shoe-metallic', 'd-jew-hoops', 'd-acc-shawl'],
    favorite: true,
    wearCount: 5,
    occasion: 'festival',
    createdDaysAgo: 290,
  },
  {
    id: 'd-fit-monsoon',
    name: 'Monsoon Market',
    itemIds: ['d-top-kurta', 'd-bot-toogood', 'd-shoe-jutti', 'd-jew-bangles'],
    favorite: false,
    wearCount: 4,
    occasion: 'festival',
    createdDaysAgo: 260,
  },
  {
    id: 'd-fit-midnight',
    name: 'Midnight Sequins',
    itemIds: ['d-one-sequin', 'd-out-coat', 'd-shoe-heel', 'd-jew-jhumka'],
    favorite: false,
    wearCount: 3,
    occasion: 'party',
    createdDaysAgo: 240,
  },

  // ---- weddings and ceremony
  {
    id: 'd-fit-wedding',
    name: 'Wedding Guest',
    itemIds: ['d-dra-sari', 'd-shoe-jutti', 'd-jew-jhumka', 'd-jew-pearls'],
    favorite: true,
    wearCount: 4,
    occasion: 'wedding',
    createdDaysAgo: 420,
  },
  {
    id: 'd-fit-mehndi',
    name: 'Mehndi Morning',
    itemIds: ['d-dra-lehenga', 'd-jew-bangles', 'd-shoe-jutti', 'd-jew-hoops'],
    favorite: false,
    wearCount: 3,
    occasion: 'wedding',
    createdDaysAgo: 400,
  },
  {
    id: 'd-fit-ceremony',
    name: 'Quiet Ceremony',
    itemIds: ['d-top-kurta', 'd-bot-trouser', 'd-jew-pearls', 'd-dra-obi'],
    favorite: false,
    wearCount: 3,
    occasion: 'ceremony',
    createdDaysAgo: 300,
  },

  // ---- evening
  {
    id: 'd-fit-velvet',
    name: 'Velvet Hour',
    itemIds: ['d-one-column', 'd-lay-haori', 'd-shoe-heel', 'd-jew-pendant'],
    favorite: true,
    wearCount: 6,
    occasion: 'party',
    createdDaysAgo: 330,
  },

  // ---- the working week, at its different registers
  {
    id: 'd-fit-studio',
    name: 'Studio Rotation',
    itemIds: ['d-top-marimekko', 'd-bot-toogood', 'd-shoe-sneaker', 'd-jew-cuff'],
    favorite: true,
    wearCount: 8,
    occasion: 'studio',
    createdDaysAgo: 110,
  },
  {
    id: 'd-fit-market',
    name: 'Market Basket',
    itemIds: ['d-top-breton', 'd-bot-denim', 'd-shoe-sneaker', 'd-acc-telfar', 'd-jew-hoops'],
    favorite: false,
    wearCount: 6,
    occasion: 'market day',
    createdDaysAgo: 150,
  },
  {
    id: 'd-fit-patchwork',
    name: 'Patchwork Evening',
    itemIds: ['d-one-bode', 'd-shoe-heel', 'd-jew-completedworks', 'd-acc-telfar'],
    favorite: true,
    wearCount: 4,
    occasion: 'party',
    createdDaysAgo: 55,
  },
  // Contains the never-worn studs on purpose: a saved outfit that has not had
  // its first outing yet is a real state, and the studs stay never-worn.
  {
    id: 'd-fit-october',
    name: 'October Office',
    itemIds: ['d-lay-nicholson', 'd-bot-trouser', 'd-shoe-nomasei', 'd-jew-studs', 'd-acc-telfar'],
    favorite: false,
    wearCount: 0,
    occasion: 'work',
    createdDaysAgo: 15,
  },
  {
    id: 'd-fit-quarterend',
    name: 'Quarter-End Review',
    itemIds: ['d-top-oxford', 'd-bot-trouser', 'd-acc-scarf', 'd-jew-pearls', 'd-shoe-nomasei'],
    favorite: true,
    wearCount: 5,
    occasion: 'formal',
    createdDaysAgo: 170,
  },
  {
    id: 'd-fit-puffer',
    name: 'Puffer Weather',
    itemIds: ['d-out-ganni', 'd-bot-denim', 'd-top-navy', 'd-shoe-chelsea', 'd-jew-cuff'],
    favorite: false,
    wearCount: 7,
    occasion: 'casual',
    createdDaysAgo: 100,
  },
  {
    id: 'd-fit-rehearsal',
    name: 'Cold Rehearsal',
    itemIds: ['d-bot-kilt', 'd-lay-nicholson', 'd-shoe-chelsea', 'd-jew-cuff'],
    favorite: false,
    wearCount: 5,
    occasion: 'performance',
    createdDaysAgo: 95,
  },
];

/* ============================================================
   The wear history

   Fifteen months, simulated a day at a time rather than listed by hand, so the
   analytics have something to find: seasonal swing, a cost-per-wear curve that
   actually falls, and a re-wear rate that means what it says.

   Deterministic on purpose — no Math.random. The sample wardrobe is a fixture,
   and a fixture that reshuffles on every load cannot be screenshotted, reviewed,
   or asserted against.
   ============================================================ */

/**
 * Two years and change. A 12-month chart then has a full cycle behind it, so
 * the seasonal swing is a cycle to compare against rather than a slope, and both
 * winters are complete.
 */
const HISTORY_DAYS = 620;

/** Meteorological seasons, indexed by month number (0 = January). */
const SEASON_BY_MONTH: Season[] = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'fall', 'fall', 'fall', 'winter',
];

/** FNV-1a folded into mulberry32. A stable 0..1 from any set of parts. */
function rand(...parts: Array<string | number>): number {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const seedById = new Map(SEEDS.map(s => [s.id, s]));

/** Acquired by this day, and not yet retired. */
function ownedOn(s: Seed, day: number): boolean {
  if (day < -s.addedDaysAgo) return false;
  return s.retiredDaysAgo === undefined || day < -s.retiredDaysAgo;
}

/**
 * A piece's appetite for a given day. The curated `wearCount` on each seed is
 * kept as the *intent* — how much this piece is in rotation — and the history is
 * generated to match that shape rather than asserting the total outright.
 */
function appetite(s: Seed, day: number, season: Season): number {
  if (s.wearCount === 0) return 0; // never-worn pieces stay never-worn
  if (!ownedOn(s, day)) return 0;
  // Benched pieces are out of rotation now, but they were worn before they broke.
  if ((s.laundry === 'needs-repair' || s.laundry === 'at-tailor') && day > -30) return 0;
  // Out-of-season pieces still surface occasionally; that is what makes the
  // seasonal swing a swing rather than a gate.
  return s.wearCount * (s.season.includes(season) ? 1 : 0.09);
}

function pickWeighted(pool: Seed[], day: number, season: Season, salt: string): Seed | undefined {
  const weighted = pool
    .map(s => ({ s, w: appetite(s, day, season) }))
    .filter(x => x.w > 0);
  if (weighted.length === 0) return undefined;
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let r = rand(salt, day) * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.s;
  }
  return weighted[weighted.length - 1].s;
}

/** How well a saved outfit suits a season — the share of its pieces that fit. */
function outfitSeasonFit(itemIds: string[], season: Season): number {
  const seeds = itemIds.map(id => seedById.get(id)).filter((s): s is Seed => s !== undefined);
  if (seeds.length === 0) return 0;
  return seeds.filter(s => s.season.includes(season)).length / seeds.length;
}

function buildWearLogs(): WearLog[] {
  const logs: WearLog[] = [];
  const inCategory = (c: string) => SEEDS.filter(s => s.category === c);
  let n = 0;

  for (let day = -HISTORY_DAYS; day <= 0; day++) {
    const date = D(day);
    const season = SEASON_BY_MONTH[Number(date.slice(5, 7)) - 1];

    // Not every day gets catalogued. Real logs have gaps, and a chart without
    // any looks generated.
    if (rand('logged', day) > 0.72) continue;

    // Roughly two days in five reach for a saved outfit rather than assembling
    // from scratch — but only one that is actually wearable that day.
    const wearable = OUTFITS.filter(
      o =>
        o.itemIds.every(id => {
          const s = seedById.get(id);
          return s !== undefined && appetite(s, day, season) > 0;
        }) && outfitSeasonFit(o.itemIds, season) >= 0.5
    );
    if (wearable.length > 0 && rand('mode', day) < 0.42) {
      // Weighted by the appetite of what's inside, so the work uniform recurs
      // weekly while the wedding silks surface a handful of times a year.
      const weights = wearable.map(o =>
        o.itemIds.reduce((sum, id) => sum + appetite(seedById.get(id) as Seed, day, season), 0)
      );
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rand('whichfit', day) * total;
      let chosen = wearable[wearable.length - 1];
      for (let i = 0; i < wearable.length; i++) {
        r -= weights[i];
        if (r <= 0) { chosen = wearable[i]; break; }
      }
      logs.push({ id: `d-log-${n++}`, date, itemIds: [...chosen.itemIds], outfitId: chosen.id });
      continue;
    }

    // Otherwise assemble a look the way a person does — a base, then layers,
    // then shoes, then the jewellery that finishes it.
    const ids = new Set<string>();
    // The pick's salt must differ from the gate's: `rand('acc', day) < 0.38`
    // followed by a pick from the SAME roll conditions the pick below 0.38 and
    // parks it on whichever piece sits first in the pool — the Canvas Tote took
    // every accessory day for fifteen months while a weight-63 bag got one wear.
    const take = (pool: Seed[], salt: string) => {
      const s = pickWeighted(pool, day, season, `pick:${salt}`);
      if (s) ids.add(s.id);
    };

    if (rand('shape', day) < 0.3) {
      // Drapes compete in the one-piece slot; their low weights keep the wedding
      // silks to a handful of appearances a year.
      take([...inCategory('dresses'), ...inCategory('drapes')], 'onepiece');
    } else {
      take(inCategory('tops'), 'top');
      take(inCategory('bottoms'), 'bottom');
    }
    if (season !== 'summer' && rand('layer', day) < 0.5) take(inCategory('layers'), 'layer');
    if ((season === 'winter' || season === 'fall') && rand('outer', day) < 0.65) {
      take(inCategory('outerwear'), 'outer');
    }
    take(inCategory('shoes'), 'shoes');
    take(inCategory('jewellery'), 'jewel1');
    if (rand('jewel2', day) < 0.45) take(inCategory('jewellery'), 'jewel2');
    if (rand('acc', day) < 0.38) take(inCategory('accessories'), 'acc');

    if (ids.size > 0) logs.push({ id: `d-log-${n++}`, date, itemIds: [...ids] });
  }

  // Keep each piece's curated recency true. A garment whose caption says it was
  // worn two days ago has to have been worn two days ago, and a 15-month
  // simulation will not land every piece on its mark by itself.
  for (const s of SEEDS) {
    if (s.lastWorn === undefined || s.wearCount === 0) continue;
    const date = D(s.lastWorn);
    const loose = logs.find(l => l.date === date && l.outfitId === undefined);
    if (loose) {
      if (!loose.itemIds.includes(s.id)) loose.itemIds.push(s.id);
    } else {
      logs.push({ id: `d-log-${n++}`, date, itemIds: [s.id] });
    }
  }

  logs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  // Planned days — future logs are plans, not wears.
  logs.push({ id: 'd-log-plan-0', date: D(1), itemIds: [...OUTFITS[1].itemIds], outfitId: OUTFITS[1].id });
  logs.push({ id: 'd-log-plan-1', date: D(3), itemIds: [...OUTFITS[0].itemIds], outfitId: OUTFITS[0].id });
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

/* ============================================================
   The Shared Rail — three closets that lend to each other.

   All local data, like everything else here: profiles are records this closet
   keeps, the way a contact book is. The conversation covers every request
   state — asked, lent, declined, returned — and the declined one reads as a
   neutral fact, because a piece staying home is not a verdict on anyone.
   ============================================================ */

function buildCircle(): AppState['circle'] {
  return {
    profiles: [
      {
        id: 'c-me',
        handle: '@toile',
        name: 'This closet',
        bio: 'The ledger you are reading. Mends before replacing; drafts patterns on the kitchen table; believes the best piece is the one already hanging up.',
        monogram: 'T',
        color: '#BE1231',
        isMe: true,
        lendable: [
          { itemId: 'd-one-bode', name: 'Quilted Patchwork Dress', category: 'dresses' },
          { itemId: 'd-lay-haori', name: 'Silk Haori Jacket', category: 'layers' },
          { itemId: 'd-acc-shawl', name: 'Embroidered Piano Shawl', category: 'accessories' },
          { itemId: 'd-jew-hoops', name: 'Brass Hoop Earrings', category: 'jewellery' },
        ],
        showcase: ['d-fit-wedding', 'd-fit-velvet', 'd-fit-festival', 'd-fit-monday'],
      },
      {
        id: 'c-priya',
        handle: '@priya',
        name: 'Priya',
        bio: 'Keeps heritage silks and knows a real zari border on sight. Lends nearly anything, and asks after it exactly once.',
        monogram: 'P',
        color: '#2E6B4F',
        lendable: [
          { name: 'Kanjeevaram Sari, temple border', category: 'drapes', note: 'the blue one' },
          { name: 'Velvet Opera Coat', category: 'outerwear' },
          { name: 'Gold Kada Bangle', category: 'jewellery' },
        ],
        showcase: [],
      },
      {
        id: 'c-mo',
        handle: '@mo',
        name: 'Mo',
        bio: 'Festival kit shared freely; returns everything mended better than it left. Sews sequins back on as a form of meditation.',
        monogram: 'M',
        color: '#31415E',
        lendable: [
          { name: 'Fringed Suede Jacket', category: 'outerwear' },
          { name: 'Brocade Clutch', category: 'accessories' },
          { name: 'Platform Boots, silver', category: 'shoes', note: 'run half a size small' },
        ],
        showcase: [],
      },
    ],
    groups: [
      {
        id: 'g-rail',
        name: 'The Rail',
        about: 'Three closets within cycling distance. What leaves a closet comes back mended.',
        memberIds: ['c-me', 'c-priya', 'c-mo'],
      },
    ],
    messages: [
      { id: 'm-0', groupId: 'g-rail', authorId: 'c-priya', date: D(-21), text: 'Wedding on the 30th. May I ask after the quilted Bode dress? It photographs like a stained-glass window.', request: { pieceName: 'Quilted Patchwork Dress', status: 'lent' } },
      { id: 'm-1', groupId: 'g-rail', authorId: 'c-me', date: D(-21), text: 'It would be honoured. The third block is already mended — someone before us did it properly.' },
      { id: 'm-2', groupId: 'g-rail', authorId: 'c-mo', date: D(-14), text: 'Field festival Friday. Any chance of the sequin slip?', request: { pieceName: 'Sequin Slip Dress', status: 'declined' } },
      { id: 'm-3', groupId: 'g-rail', authorId: 'c-me', date: D(-14), text: 'It is promised to a stage that night — Stage Night claims it first. The metallic boots are free, though.' },
      { id: 'm-4', groupId: 'g-rail', authorId: 'c-mo', date: D(-13), text: 'Boots it is. They will come back polished.' },
      { id: 'm-5', groupId: 'g-rail', authorId: 'c-me', date: D(-10), text: 'Priya — the jhumkas came home. They carried the whole ceremony; thank you.', request: { pieceName: 'Gold Jhumka Earrings', status: 'returned' } },
      { id: 'm-6', groupId: 'g-rail', authorId: 'c-priya', date: D(-10), text: 'They like being out. The sari blouse you asked about is with the tailor until the 15th.' },
      { id: 'm-7', groupId: 'g-rail', authorId: 'c-me', date: D(-4), text: 'Mo — is the brocade clutch spoken for on the 20th?', request: { pieceName: 'Brocade Clutch', status: 'asked' } },
      { id: 'm-8', groupId: 'g-rail', authorId: 'c-mo', date: D(-2), text: 'Checking whether it is back from its last outing. Word tomorrow.' },
    ],
    loans: [
      { id: 'l-0', pieceName: 'Quilted Patchwork Dress', itemId: 'd-one-bode', withId: 'c-priya', direction: 'to', since: D(-19) },
      { id: 'l-1', pieceName: 'Metallic Ankle Boots', itemId: 'd-shoe-metallic', withId: 'c-mo', direction: 'to', since: D(-13), returned: D(-6) },
      { id: 'l-2', pieceName: 'Gold Jhumka Earrings', withId: 'c-priya', direction: 'from', since: D(-30), returned: D(-10) },
    ],
  };
}

export function buildDemoState(): AppState {
  const wearLogs = buildWearLogs();
  const items = buildItems(wearLogs);
  const today = todayLocal();

  // Outfit totals are read back out of the log for the same reason item totals
  // are: logWear moves both together, so anything else is a number the app
  // itself would never produce.
  const outfits: Outfit[] = OUTFITS.map(o => {
    const worn = wearLogs.filter(l => l.outfitId === o.id && l.date <= today);
    return {
      id: o.id,
      name: o.name,
      itemIds: o.itemIds,
      occasion: o.occasion,
      favorite: o.favorite,
      wearCount: worn.length,
      dateCreated: D(-o.createdDaysAgo),
      lastWorn: worn.length > 0 ? worn[worn.length - 1].date : undefined,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    items,
    outfits,
    wearLogs,
    wishlist: buildWishlist(),
    circle: buildCircle(),
    settings: {
      // 'drapes' is a custom category this closet added — taxonomy is user-owned
      // data, and the demo exercises that rather than just claiming it.
      categories: [...DEFAULT_CATEGORIES, { id: 'drapes', label: 'Drapes & sets' }],
      occasions: [...DEFAULT_OCCASIONS, 'festival', 'wedding', 'ceremony', 'studio', 'market day'],
      theme: 'dark',
    },
  };
}

/** Headline counts, for the Settings copy that describes what will be loaded.
    Counts the ACTIVE closet only — retired pieces keep their history but are not
    what the loader is offering, and quoting SEEDS.length advertised 31 pieces
    against a closet that displays 29. */
const ACTIVE_SEEDS = SEEDS.filter(s => s.retiredDaysAgo === undefined);

export const DEMO_SUMMARY = {
  items: ACTIVE_SEEDS.length,
  outfits: OUTFITS.length,
  jewellery: ACTIVE_SEEDS.filter(s => s.category === 'jewellery').length,
};
