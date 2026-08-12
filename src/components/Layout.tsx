import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  IconToday, IconCloset, IconOutfits, IconCalendar, IconLedger,
  IconWishlist, IconCompare, IconRail, IconSettings, IconPlus, IconTheme, IconMenu, IconClose,
  IconEvents, IconFeed, IconChats, IconProfile,
} from './icons';
import { GroundFrieze, HangingRail, GutterFigure, ScatterField, Wordmark, TagMark } from './art';
import { useWardrobe } from '../context/WardrobeContext';
import { useSession } from '../context/SessionContext';
import AddItemModal from './AddItemModal';
import { ToastContainer } from './Toast';
import { Button, IconButton } from './ui';

interface NavItem {
  path: string;
  label: string;
  /** Used in the 5-slot mobile rail only, where the full label will not fit. */
  shortLabel?: string;
  icon: typeof IconToday;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Today', icon: IconToday },
  { path: '/closet', label: 'Closet', icon: IconCloset },
  { path: '/outfits', label: 'Outfits', icon: IconOutfits },
  { path: '/calendar', label: 'Calendar', icon: IconCalendar },
  { path: '/ledger', label: 'Ledger', icon: IconLedger },
  { path: '/wishlist', label: 'Wishlist', icon: IconWishlist },
  // shortLabel is for the mobile rail only, where "Before you buy" wrapped to two
  // lines and shoved its icon out of the icon column.
  { path: '/compare', label: 'Before you buy', shortLabel: 'Compare', icon: IconCompare },
  { path: '/events', label: 'Events', icon: IconEvents },
  { path: '/feed', label: 'Feed', icon: IconFeed },
  { path: '/chats', label: 'Conversations', shortLabel: 'Chats', icon: IconChats },
  { path: '/profile', label: 'Profile', icon: IconProfile },
  { path: '/rail', label: 'Shared rail', shortLabel: 'Rail', icon: IconRail },
  { path: '/settings', label: 'Settings', icon: IconSettings },
];

// Five slots in the thumb zone; the rest live behind "More".
const mobilePrimary = ['/', '/closet', '/outfits', '/feed'];

export default function Layout() {
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { activeItems } = useWardrobe();
  const { active, theme, setTheme } = useSession();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Three rooms and the device's own choice, in order.
  const cycleTheme = () => {
    const order = ['dark', 'obsidian', 'dyehouse', 'salon', 'gilt', 'light', 'system'] as const;
    setTheme(order[(order.indexOf(theme as typeof order[number]) + 1) % order.length]);
  };

  const primaryNav = navItems.filter(n => mobilePrimary.includes(n.path));
  const secondaryNav = navItems.filter(n => !mobilePrimary.includes(n.path));

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
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2 text-text min-h-11 py-1" aria-label="Toile — home">
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
          <Link to="/" className="flex items-center gap-2.5 text-text min-h-11 py-1" aria-label="Toile — home">
            <TagMark size={34} />
            <Wordmark className="w-[76px]" />
          </Link>
          <p className="text-[13px] italic text-text-2 mt-3">Your wardrobe, on record.</p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-0.5" aria-label="Main">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
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
      <main className="relative z-10 flex-1 min-w-0 pt-14 lg:pt-0 pad-rail lg:pb-0">
        {/* Keyed by path: each page arrives like a plate set on the table. */}
        <div key={location.pathname} className="v2-route max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom rail — thumb zone */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-14 bg-bg border-t border-border flex safe-b box-content"
        aria-label="Main"
      >
        {primaryNav.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-text' : 'text-text-2'
              }`}
            >
              <Icon size={20} />
              <span className="type-label whitespace-nowrap">
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
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
            moreOpen ? 'text-text' : 'text-text-2'
          }`}
        >
          {moreOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
          <span className="type-label whitespace-nowrap">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed above-rail inset-x-0 z-50 bg-surface border-t border-border animate-slip max-h-[60vh] pane">
          {secondaryNav.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
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
      )}

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ToastContainer />
    </div>
  );
}
