import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  IconToday, IconCloset, IconOutfits, IconCalendar, IconLedger,
  IconWishlist, IconCompare, IconRail, IconSettings, IconPlus, IconTheme, IconMenu, IconClose,
} from './icons';
import { Wordmark, TagMark } from './art';
import { useWardrobe } from '../context/WardrobeContext';
import AddItemModal from './AddItemModal';
import { ToastContainer } from './Toast';
import { IconButton } from './ui';

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
  { path: '/rail', label: 'Shared rail', shortLabel: 'Rail', icon: IconRail },
  { path: '/settings', label: 'Settings', icon: IconSettings },
];

// Five slots in the thumb zone; the rest live behind "More".
const mobilePrimary = ['/', '/closet', '/outfits', '/compare'];

export default function Layout() {
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { activeItems, settings, updateSettings } = useWardrobe();

  const theme = settings.theme ?? 'system';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    updateSettings({ theme: next });
  };

  const primaryNav = navItems.filter(n => mobilePrimary.includes(n.path));
  const secondaryNav = navItems.filter(n => !mobilePrimary.includes(n.path));

  return (
    <div className="flex min-h-screen bg-bg pattern-paper">
      {/* Mobile masthead */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border">
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
          <p className="type-editorial text-[13px] text-text-2 mt-3">Your wardrobe, on record.</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5" aria-label="Main">
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
          <button
            onClick={() => setAddOpen(true)}
            className="w-full h-11 type-label inline-flex items-center justify-center gap-2 bg-ink text-on-ink rounded-[2px] hover:opacity-90 active:translate-y-px transition-[opacity] duration-150"
          >
            <IconPlus size={16} />
            Add a piece
          </button>
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
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom rail — thumb zone */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-14 bg-bg border-t border-border flex"
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
        <div className="lg:hidden fixed bottom-14 inset-x-0 z-50 bg-surface border-t border-border animate-slip">
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
