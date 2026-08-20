import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { nextTheme } from '../lib/accounts';
import {
  IconToday, IconCloset, IconOutfits, IconCalendar, IconLedger,
  IconWishlist, IconCompare, IconRail, IconSettings, IconPlus, IconTheme, IconMenu, IconClose,
  IconEvents, IconFeed, IconChats, IconHouse, IconSearch,
} from './icons';
import { GroundFrieze, HangingRail, GutterFigure, ScatterField, Wordmark, TagMark } from './art';
import { useWardrobe } from '../context/WardrobeContext';
import { useSession } from '../context/SessionContext';
import AddItemModal from './AddItemModal';
import { PageGuide } from './Tutorial';
import { ToastContainer } from './Toast';
import { Button, IconButton } from './ui';
import { FEED_ENABLED } from '@almari/shared/flags';
import { barSlots, slotFor } from '@almari/shared/nav';
import { LOOK_BOOK_PATHS } from '../lib/routes';

interface NavItem {
  path: string;
  label: string;
  /** Used in the 5-slot mobile rail only, where the full label will not fit. */
  shortLabel?: string;
  icon: typeof IconToday;
}

/**
 * The five bar addresses take their WORDS from the shared roster
 * (packages/shared/nav.ts, docs/42 §7) rather than from here, so the phone
 * rail and the native house bar cannot drift apart in a rename. The roster
 * carries no icons — each app binds its own by key — so the drawing still
 * lives in this file. Every entry that seats no bar slot names itself.
 *
 * A path the roster does not know falls back to itself, which is an obviously
 * wrong label rather than a plausible one: it would read "/closet" on the rail
 * the first time it rendered.
 */
const words = (path: string): { label: string; shortLabel?: string } => {
  const slot = slotFor(path);
  return { label: slot?.label ?? path, shortLabel: slot?.shortLabel };
};

const ALL_NAV: NavItem[] = [
  { path: '/', ...words('/'), icon: IconToday },
  { path: '/closet', ...words('/closet'), icon: IconCloset },
  { path: '/outfits', label: 'Outfits', icon: IconOutfits },
  { path: '/calendar', label: 'Calendar', icon: IconCalendar },
  { path: '/ledger', label: 'Ledger', icon: IconLedger },
  { path: '/wishlist', label: 'Wishlist', icon: IconWishlist },
  // shortLabel is for the mobile rail only, where "Before you buy" wrapped to two
  // lines and shoved its icon out of the icon column.
  { path: '/compare', label: 'Before you buy', shortLabel: 'Compare', icon: IconCompare },
  { path: '/events', label: 'Events', icon: IconEvents },
  // The Look Book. Its words are the roster's — "Look Book" at full width,
  // "Looks" on the rail — and the flag decides whether it is here at all.
  { path: '/feed', ...words('/feed'), icon: IconFeed },
  // Explore lives here (the More sheet) and behind the Feed's masthead action —
  // never in the five mobile slots, which stay five.
  { path: '/explore', label: 'Explore', icon: IconSearch },
  { path: '/chats', ...words('/chats'), icon: IconChats },
  // HOUSE. The slot label and the masthead were rehung; the address did not
  // move, so every link anyone ever sent to /profile still lands. The glyph
  // is the almirah (docs/42 §1) — the app's namesake wears its own name.
  { path: '/profile', ...words('/profile'), icon: IconHouse },
  { path: '/rail', label: 'Shared rail', shortLabel: 'Rail', icon: IconRail },
  { path: '/settings', label: 'Settings', icon: IconSettings },
  // Its only other entry is the desktop rail's footer, which is `hidden lg:flex`
  // — so below 1024px switching wardrobes meant typing the address.
  { path: '/open', label: 'Wardrobes', icon: IconCloset },
];

/**
 * What the navigation offers this season.
 *
 * Flag off, the Look Book's addresses leave every list at once — the desktop
 * rail, the phone rail and the More sheet all read this one array, so no
 * sheet-only door is left pointing at a room that answers with Today. Hidden,
 * not deleted: the entries are above, and the filter is the whole diff.
 */
const navItems: NavItem[] = ALL_NAV.filter(
  n => FEED_ENABLED || !LOOK_BOOK_PATHS.includes(n.path)
);

/**
 * Furniture is NOT in here, and that is the point.
 *
 * Where a garment lives is a fact ABOUT THE CLOSET, not a sibling of it. Given
 * its own tab it competed with the closet for the same attention and asked to
 * be visited; reached from inside the closet it is what it actually is — a
 * second way of looking at the clothes you were already looking at. The routes
 * stay (/furniture and /furniture/:id), so nothing bookmarked breaks; only the
 * standing invitation goes.
 */

/**
 * Five cells in the thumb zone: four addresses and the More sheet.
 *
 * The four come off the roster in the roster's order, so the phone rail and the
 * native house bar are the same bar read twice (docs/42 §7). Flag off the
 * roster is four long and the rail reads TODAY · CLOSET · CHATS · HOUSE ·
 * MORE; flag on it is five, the Look Book takes the centre, and the House
 * moves to the sheet — because the web's fifth cell is More, and six cells at
 * 320px is a wall we do not build. The slice is that decision, and it is the
 * ONLY place the web bar differs from the native one, which has no More.
 *
 * Outfits leaves the rail for the sheet here. That is the single declared cost
 * of the whole plan — one extra tap — spent to seat the owner's roster.
 */
const mobilePrimary = barSlots().slice(0, 4).map(s => s.path);

/**
 * Does this nav entry own the address we are at?
 *
 * Exact equality was wrong at all three nav sites: a conversation lives at
 * /chats/:id and a neighbour's rail at /rail/:id, so opening either used to
 * unlight the entire navigation and leave the chrome saying nothing about
 * where you were.
 */
/**
 * Addresses reached from INSIDE a page, which that page's tab keeps lit.
 *
 * The dressing room and the photo bench have no tab of their own — they are
 * doors on the Closet — so without this, walking into either put every nav item
 * out and the chrome that is always on screen said nothing about where you
 * were. It is the same defect owns() was already patched for once, for a
 * conversation and a neighbour's rail; it failed here because these two are in
 * no nav list at all.
 */
const HELD_BY: Record<string, string[]> = {
  '/closet': ['/furniture', '/intake'],
  // A story deck is the feed being read one teller at a time — so it lights the
  // feed's tab, and only while there is a feed tab to light. Flag off, /story
  // answers with Today anyway; a held-by entry pointing at an absent tab would
  // be a rule with nothing left to apply it to.
  ...(FEED_ENABLED ? { '/feed': ['/story'] } : {}),
};

function owns(path: string, here: string): boolean {
  if (path === '/') return here === '/';
  if (here === path || here.startsWith(`${path}/`)) return true;
  return (HELD_BY[path] ?? []).some(p => here === p || here.startsWith(`${p}/`));
}

export default function Layout() {
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { activeItems } = useWardrobe();
  const { active, theme, setTheme } = useSession();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Escape closes the sheet from anywhere; the route change above closes it
  // on navigation; the scrim below closes it on a tap outside. Three ways
  // out, the same as every other overlay in the house.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  // The rooms, in the house's order — the dye house first, then the obsidian.
  const cycleTheme = () => setTheme(nextTheme(theme));

  const primaryNav = navItems.filter(n => mobilePrimary.includes(n.path));
  const secondaryNav = navItems.filter(n => !mobilePrimary.includes(n.path));
  // On /ledger or /wishlist the always-on-screen chrome said nothing about
  // where you were, because the page that owns the address is behind More.
  const moreHolds = secondaryNav.some(n => owns(n.path, location.pathname));

  return (
    <div className="flex min-h-dvh bg-bg pattern-paper">
      {/* Each page hangs its own arrangement of the house's closets, with the
          owner's name over the larger pieces in that culture's language, and
          the rail with its hangers at the top edge. z-0 behind the content
          column, which sits at z-10 and scrolls past. */}
      {/* V2: the wall gets parallax. The wrapper is a fixed full-viewport box,
          so its transform re-roots the fixed art to identical geometry and the
          whole hang drifts a breath against the pointer (initGlassLight). */}
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none v2-drift">
        <GroundFrieze name={active?.name} page={location.pathname} />
        <HangingRail page={location.pathname} />
        <GutterFigure page={location.pathname} />
        <ScatterField page={location.pathname} />
      </div>
      {/* Mobile masthead */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border safe-t">
        <div className="flex items-center justify-between masthead-bar px-4">
          <Link to="/" className="flex items-center gap-2 text-text min-h-11 py-1" aria-label="Almari — home">
            <TagMark size={22} />
            <Wordmark className="w-[64px]" />
          </Link>
          <div className="flex items-center gap-1">
            <IconButton label="Change theme" onClick={cycleTheme}>
              <IconTheme size={18} />
            </IconButton>
            <IconButton label="Add a piece" onClick={() => setAddOpen(true)} active>
              <IconPlus size={18} />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Desktop rail */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-border bg-bg sticky top-0 h-screen">
        <div className="px-6 pt-7 pb-6">
          <Link to="/" className="flex items-center gap-2.5 text-text min-h-11 py-1" aria-label="Almari — home">
            <TagMark size={34} />
            <Wordmark className="w-[76px]" />
          </Link>
          <p className="text-[13px] italic text-text-2 mt-3">Your wardrobe, on record.</p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-0.5" aria-label="Main">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = owns(item.path, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 h-11 px-3 type-label text-[13px] whitespace-nowrap transition-colors duration-150 border-l-2 ${
                  active
                    ? 'border-accent text-text bg-surface'
                    : 'border-transparent text-text-2 hover:text-text hover:bg-surface/60'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-4">
          {/* Which wardrobe is open, and the way to another. Reachable from
              every page, because switching is the point of having more than one. */}
          <Link
            to="/open"
            className="w-full h-11 px-3 flex items-center gap-2.5 border border-border rounded-[2px] text-text-2 hover:text-text hover:bg-surface/60 transition-colors duration-150"
          >
            <span className="type-ledger text-[10px] shrink-0">OPEN</span>
            <span className="text-[13px] truncate flex-1 text-left">{active?.name ?? 'A wardrobe'}</span>
          </Link>
          {/* Through the Button primitive like everything else — this was a
              hand-rolled ink fill still carrying hover:opacity-90, the exact
              disabled-looking gesture the rebrand removed from Button itself. */}
          <Button tone="primary" className="w-full" icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            Add a piece
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <p className="type-ledger text-[10px] text-text-2">In the closet</p>
              <p className="type-masthead text-[24px] leading-none tabular mt-1">{activeItems.length}</p>
            </div>
            <IconButton label={`Theme: ${theme}`} onClick={cycleTheme}>
              <IconTheme size={18} />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 min-w-0 pad-masthead lg:pt-0 pad-rail lg:pb-0">
        {/* Keyed by path: each page arrives like a plate set on the table. */}
        <div key={location.pathname} className="v2-route max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
          {/* The page's own guide, at the foot of every screen that has one.
              Here rather than in the pages themselves for two reasons: no page
              file has to know it exists, and the control lands in the same
              place on all of them, which is the only thing that makes a quiet
              affordance findable. Inside the keyed div on purpose — walking to
              another screen remounts it, so an open sheet closes with the page
              it belonged to and the next screen's mark is read fresh. */}
          <PageGuide path={location.pathname} />
        </div>
      </main>

      {/* Mobile bottom rail — thumb zone */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 nav-rail bg-bg border-t border-border flex"
        aria-label="Main"
      >
        {primaryNav.map(item => {
          const Icon = item.icon;
          const active = owns(item.path, location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              // min-w-0 or the longest word steals width from its neighbours
              // and the five slots stop being equal (69.7 vs 68.8, measured).
              // pb-1 reserves the lane the active dot sits in.
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pb-1 ${
                active ? 'text-text' : 'text-text-2'
              }`}
            >
              <Icon size={24} />
              <span className="type-label-rail whitespace-nowrap">
                {item.shortLabel ?? item.label}
              </span>
              {active ? (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(v => !v)}
          aria-expanded={moreOpen}
          aria-label={moreOpen ? 'Close more menu' : 'More pages'}
          className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pb-1 ${
            moreOpen || moreHolds ? 'text-text' : 'text-text-2'
          }`}
        >
          {moreOpen ? <IconClose size={24} /> : <IconMenu size={24} />}
          <span className="type-label-rail whitespace-nowrap">More</span>
          {moreHolds && !moreOpen ? (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
          ) : null}
        </button>
      </nav>

      {moreOpen && (
        <>
          {/* Tap-outside scrim. z-40: the rail itself (z-50) stays above it,
              so the toggle that opened the sheet still answers while it is
              up. The ink wash matches the modal overlay exactly. */}
          <div
            aria-hidden="true"
            className="lg:hidden fixed inset-0 z-40 animate-fade"
            style={{ background: 'rgba(32, 29, 24, 0.4)' }}
            onClick={() => setMoreOpen(false)}
          />
          <div className="lg:hidden fixed above-rail inset-x-0 z-50 bg-surface border-t border-border animate-slip max-h-[60dvh] pane">
            {secondaryNav.map(item => {
              const Icon = item.icon;
              const active = owns(item.path, location.pathname);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 h-12 px-5 type-label text-[13px] border-b border-border last:border-0 ${
                    active ? 'text-text bg-sunken' : 'text-text-2'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ToastContainer />
    </div>
  );
}
