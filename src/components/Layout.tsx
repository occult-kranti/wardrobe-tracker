import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Shirt, Sparkles, BarChart3, Settings, Menu, X, Plus } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import AddItemModal from './AddItemModal';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/closet', label: 'My Closet', icon: Shirt },
  { path: '/outfits', label: 'Outfits', icon: Sparkles },
  { path: '/stats', label: 'Statistics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const location = useLocation();
  const { items } = useWardrobe();

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-cream/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-semibold text-text">
            <span className="text-xl">👕</span>
            <span className="font-[family-name:var(--font-heading)]">Wardrobe</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-border bg-cream px-4 py-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text hover:bg-surface'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-cream border-r border-border sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-text">
            <span className="text-2xl">👕</span>
            <span className="text-lg font-[family-name:var(--font-heading)]">Wardrobe Tracker</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text hover:bg-surface'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all"
          >
            <Plus size={16} />
            Add Item
          </button>
          <div className="mt-4 px-3 py-3 bg-surface rounded-lg">
            <p className="text-xs text-text-muted">Items in closet</p>
            <p className="text-2xl font-semibold text-text mt-0.5">{items.length}</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen lg:pt-0 pt-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
