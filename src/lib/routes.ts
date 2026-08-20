/**
 * Every address inside a wardrobe, once, with the name to call it in a sentence.
 *
 * Three things read this list and used to disagree: the route table, the guard
 * that decides whether a signed-out deep link is worth remembering, and the
 * door's line telling you what you were reaching for. One list is what makes
 * it impossible for the guard to honour an address that does not exist.
 */
export const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'today' },
  { path: '/closet', name: 'the closet' },
  { path: '/outfits', name: 'outfits' },
  // The ROUTE keeps its old spelling on purpose — it is a bookmarkable address
  // that already exists, and renaming a path to match a label is a 404 for
  // somebody. The words change; the door does not move.
  { path: '/furniture', name: 'the dressing room' },
  { path: '/furniture/:id', name: 'a place' },
  { path: '/calendar', name: 'the calendar' },
  { path: '/events', name: 'events' },
  { path: '/ledger', name: 'the ledger' },
  { path: '/wishlist', name: 'the wishlist' },
  { path: '/compare', name: 'before you buy' },
  { path: '/feed', name: 'the feed' },
  { path: '/explore', name: 'explore' },
  { path: '/explore/:postId', name: 'something on show' },
  { path: '/story/:accountId', name: 'a story' },
  { path: '/chats', name: 'conversations' },
  { path: '/chats/:id', name: 'a conversation' },
  { path: '/profile', name: 'your profile' },
  { path: '/profile/:id', name: 'a profile' },
  { path: '/rail', name: 'the shared rail' },
  { path: '/rail/:id', name: "a neighbour's rail" },
  { path: '/intake', name: 'photo intake' },
  { path: '/settings', name: 'settings' },
  { path: '/admin', name: 'the project lead portal' },
  { path: '/open', name: 'wardrobes' },
  { path: '/open/new', name: 'a new wardrobe' },
];

/** Does this address match a route we actually have? */
export function known(path: string): boolean {
  return ROUTES.some(r => {
    if (!r.path.includes(':')) return r.path === path;
    const stem = r.path.slice(0, r.path.indexOf('/:'));
    if (!path.startsWith(`${stem}/`)) return false;
    const rest = path.slice(stem.length + 1);
    // ':id' is exactly ONE segment. An empty remainder is a 404, and a
    // remainder carrying its own slash is a different address than the table
    // promises — "/rail//evil.com" used to pass here and then 404 in the app.
    return rest.length > 0 && !rest.includes('/');
  });
}

/**
 * Does this address carry a "." or ".." segment?
 *
 * "/profile/../open" is the door wearing a disguise: the raw string matches
 * "/profile/:id", but every URL parser resolves it to "/open" before routing.
 * A guard that matches the raw string approves one address while the app
 * visits another — which is exactly how a redirect guard ends up honouring
 * the thing it promises to refuse.
 *
 * We refuse rather than resolve. Resolving is the more permissive reading and
 * it can be made safe, but nothing in this app ever writes a dot segment into
 * a link, so anything that arrives carrying one is a probe. Refusing keeps
 * the rule small enough to audit at a glance, and it is the rule that has to
 * survive the native app, where a deep link can be sent by any app on the
 * device rather than typed into our own URL bar.
 */
function hasDotSegment(path: string): boolean {
  return path.split('/').some(seg => seg === '.' || seg === '..');
}

/**
 * Where to send someone after they open a wardrobe.
 *
 * In-app paths only. Never a protocol-relative "//host", never an absolute
 * URL, never back to the door itself, and never an address we do not have —
 * a redirect target read off the URL is an open redirect if you let it be one.
 */
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  // A backslash is never a separator we write, and a URL parser rewrites it
  // into one — so the address approved here would not be the address visited.
  // Refuse it outright rather than guess which reading was meant.
  if (raw.includes('\\')) return null;
  const path = raw.split('?')[0].split('#')[0];
  // With no dot segments, no backslash and no "//" lead, the string we match
  // is the address the router visits — the guard and the app cannot drift.
  if (hasDotSegment(path)) return null;
  if (path === '/open' || path.startsWith('/open/')) return null;
  return known(path) ? raw : null;
}

/** What to call an address in a sentence. */
export function nameFor(path: string): string | null {
  return ROUTES.find(r => r.path === path)?.name ?? null;
}
