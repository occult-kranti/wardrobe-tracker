/**
 * The sample bench: real photographs, and the honest file the prompt returned
 * for each one.
 *
 * Two of these six hold no clothes at all, and one is a street. They are here
 * on purpose — a prompt that cannot say "nothing here" will cheerfully invent
 * a wardrobe, and the only way to show that this one doesn't is to let anyone
 * run it against a cupboard full of shampoo.
 *
 * Photographs and files both live in public/intake-samples/ and are fetched on
 * demand, so none of this weighs on the app that never opens the bench.
 */

export interface IntakeSample {
  slug: string;
  title: string;
  /** What the photograph actually shows, before the model looked at it. */
  caption: string;
  /** Absent when the photograph is the owner's own and stays on their device. */
  photo?: string;
  /** Shown in the photograph's place when there is nothing bundled to show. */
  photoNote?: string;
  file: string;
  /** What came back — stated up front so the outcome is never a surprise. */
  outcome: string;
  credit?: string;
}

export const INTAKE_SAMPLES: IntakeSample[] = [
  {
    slug: 'bed-flatlay',
    title: 'Laid out on a bed',
    caption: 'Eleven pieces spread on a white bedspread, several still carrying shop tags.',
    // The photograph belongs to whoever took it and was never copied here.
    // Drop a JPEG at public/intake-samples/bed-flatlay.jpg and it appears.
    photoNote: 'Your own photograph — drop it at public/intake-samples/bed-flatlay.jpg to see it here.',
    file: 'intake-samples/bed-flatlay.json',
    outcome: '11 pieces · 3 skipped',
  },
  {
    slug: 'flatlay',
    title: 'A flat lay on floorboards',
    caption: 'A striped top, trainers, and trousers on a hanger — with a notebook in the frame.',
    photo: 'intake-samples/flatlay.jpg',
    file: 'intake-samples/flatlay.json',
    outcome: '3 pieces · the notebook ignored',
    credit: 'Wikimedia Commons',
  },
  {
    slug: 'hanging-closet',
    title: 'A hanging rail, seen sideways',
    caption: 'A crowded rail where every piece is partly behind the one in front of it.',
    photo: 'intake-samples/hanging-closet.jpg',
    file: 'intake-samples/hanging-closet.json',
    outcome: '10 pieces · 3 skipped · four under half-sure',
    credit: 'Wikimedia Commons',
  },
  {
    slug: 'toiletries',
    title: 'A closet with no clothes in it',
    caption: 'Four shelves of shampoo, soap and toothbrushes.',
    photo: 'intake-samples/toiletries.jpg',
    file: 'intake-samples/nothing-wearable.json',
    outcome: 'nothing wearable · and it says so',
    credit: 'Wikimedia Commons',
  },
  {
    slug: 'linens',
    title: 'A linen closet',
    caption: 'Folded towels and sheets on wire shelves, and a rail of empty hangers.',
    photo: 'intake-samples/linens.jpg',
    file: 'intake-samples/nothing-wearable.json',
    outcome: 'nothing wearable · towels are not clothes',
    credit: 'Wikimedia Commons',
  },
  {
    slug: 'kerbside',
    title: 'A heap at the kerb',
    caption: 'A street, with a small pile of fabric dumped by a fence forty feet away.',
    photo: 'intake-samples/kerbside.jpg',
    file: 'intake-samples/nothing-wearable.json',
    outcome: 'too far away to name honestly',
    credit: 'Wikimedia Commons',
  },
];
