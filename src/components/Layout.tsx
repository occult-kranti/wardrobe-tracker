import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Shirt, Sparkles, CalendarDays, BarChart3, ShoppingBag, Settings, Menu, X, Plus } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import AddItemModal from './AddItemModal';
import { ToastContainer } from './Toast';
import { LogoIcon, DecorativeDivider } from './art';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/closet', label: 'My Closet', icon: Shirt },
  { path: '/outfits', label: 'Outfits', icon: Sparkles },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/stats', label: 'Statistics', icon: BarChart3 },
  { path: '/wishlist', label: 'Wishlist', icon: ShoppingBag },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const location = useLocation();
  const { items } = useWardrobe();

  return (
    <div className="flex min-h-screen bg-bg relative">
      {/* Blob background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent opacity-[0.03] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-wine opacity-[0.03] blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent opacity-[0.02] blur-3xl" />
      </div>

      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-bg-elevated/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoIcon className="w-6 h-6 text-accent" />
            <span className="font-[family-name:var(--font-heading)] text-base font-semibold text-text tracking-tight">
              Atelier
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="w-10 h-10 rounded-lg bg-accent/10 text-accent border border-accent/20 flex items-center justify-center active:scale-95 transition-all hover:bg-accent/20"
              aria-label="Add clothing item"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-10 h-10 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-border bg-bg-elevated px-4 py-3 space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-text-secondary hover:text-text hover:bg-bg-card border border-transparent'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] bg-bg-elevated border-r border-border sticky top-0 h-screen z-10">
        <div className="p-6 pb-4">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoIcon className="w-7 h-7 text-accent" />
            <div>
              <span className="font-[family-name:var(--font-heading)] text-lg font-semibold text-text tracking-tight block leading-none">
                Atelier
              </span>
              <span className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Wardrobe</span>
            </div>
          </Link>
        </div>

        <DecorativeDivider className="mx-4 mb-2" />

        <nav className="flex-1 px-3 space-y-0.5 pt-2" aria-label="Main navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-secondary hover:text-text hover:bg-bg-card border border-transparent'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-3">
          <DecorativeDivider />
          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/20 active:scale-[0.98] transition-all btn-shine"
            aria-label="Add clothing item"
          >
            <Plus size={15} aria-hidden="true" />
            Add Item
          </button>
          <div className="px-3 py-3 bg-bg-card rounded-lg border border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Items</p>
            <p className="text-2xl font-semibold text-text mt-0.5 font-[family-name:var(--font-heading)]">{items.length}</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen lg:pt-0 pt-14 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ToastContainer />
    </div>
  );
}
