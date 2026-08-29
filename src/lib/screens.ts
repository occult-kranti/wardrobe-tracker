import { SCREENS, type Screen } from './usage';

/**
 * ONE ADDRESS-TO-SCREEN TABLE, AND WHY IT IS ITS OWN MODULE.
 *
 * Two surfaces record which room somebody is in — the chrome, on every
 * navigation (src/components/Layout.tsx), and the guides, when a tutorial card
 * is answered (src/components/Tutorial.tsx). Layout renders Tutorial, so the
 * mapping cannot live in either of them without one importing the other in a
 * circle; and it must not be written twice, because two copies drifting is how
 * an event arrives labelled with the wrong room and nobody can tell.
 *
 * A PATHNAME IS NEVER RECORDED, AND THIS IS THE REASON THE TABLE EXISTS.
 * Four of this house's addresses carry an identifier — /profile/:id, /chats/:id,
 * /furniture/:id, /explore/:postId — and one of those identifiers belongs to
 * another person. So the recorder is handed a name from a closed list and never
 * a path. Anything unrecognised becomes 'elsewhere': a route added later is
 * silent until somebody deliberately names it here, which is the failure mode
 * we want (a missing number) rather than the other one (a leaked id).
 */
export function screenOf(pathname: string): Screen {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'today';
  if (p === '/closet') return 'closet';
  if (p === '/outfits') return 'outfits';
  if (p.startsWith('/furniture')) return 'dressing-room';
  if (p === '/calendar') return 'calendar';
  if (p === '/events') return 'events';
  if (p === '/ledger' || p === '/stats') return 'ledger';
  if (p === '/wishlist') return 'wishlist';
  if (p === '/compare') return 'before-you-buy';
  if (p.startsWith('/chats')) return 'chats';
  if (p.startsWith('/profile')) return 'profile';
  if (p.startsWith('/rail')) return 'rail';
  if (p === '/intake') return 'intake';
  if (p === '/settings') return 'settings';
  if (p.startsWith('/open')) return 'wardrobes';
  return 'elsewhere';
}

/**
 * Every name this table can produce must be a name the vocabulary knows.
 *
 * Exported for the suite rather than used at runtime: scripts/test-usage.mjs
 * drives every route in the app's own table through screenOf and asserts the
 * answer is in SCREENS. A typo here would otherwise reach the service, be
 * refused by its enum clamp, and take the whole batch down with it.
 */
export function isKnownScreen(name: string): name is Screen {
  return (SCREENS as readonly string[]).includes(name);
}
