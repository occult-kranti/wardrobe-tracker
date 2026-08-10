import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shirt, TrendingUp, Calendar, Heart, ArrowRight } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS } from '../types';
import { DecorativeDivider } from '../components/art';

export default function Dashboard() {
  const { items, outfits, wearLogs, getMostWorn, getUnwornItems, getOutfitSuggestions, logWear } = useWardrobe();
  const [suggestions] = useState(() => getOutfitSuggestions());

  const today = new Date().toISOString().split('T')[0];
  const todayLog = wearLogs.find(l => l.date === today);
  const totalWears = wearLogs.length;
  const unwornCount = getUnwornItems().length;
  const mostWorn = getMostWorn(3);

  const categoryBreakdown = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative">
        <h1 className="heading-editorial text-3xl sm:text-4xl text-text">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          {items.length > 0
            ? `You have ${items.length} pieces in your collection. ${unwornCount} haven't been worn yet.`
            : 'Start building your wardrobe collection.'}
        </p>
        <DecorativeDivider className="mt-4" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Shirt} label="Total Items" value={items.length} accent="text-accent" />
        <StatCard icon={Calendar} label="Wears Logged" value={totalWears} accent="text-sage" />
        <StatCard icon={Sparkles} label="Outfits" value={outfits.length} accent="text-amber" />
        <StatCard icon={Heart} label="Favorites" value={items.filter(i => i.favorite).length} accent="text-rose" />
      </div>

      {/* Today's Outfit Suggestion */}
      {suggestions.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5 card-lift">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Today's Suggestion</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {suggestions[0].itemIds.map(id => {
              const item = items.find(i => i.id === id);
              if (!item) return null;
              return (
                <div key={id} className="flex-shrink-0 w-20">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1 truncate">{item.name}</p>
                </div>
              );
            })}
          </div>
          {!todayLog && (
            <button
              onClick={() => logWear(suggestions[0].itemIds)}
              className="mt-3 px-4 py-2 bg-accent/10 text-accent border border-accent/30 rounded-lg text-xs font-medium hover:bg-accent/20 transition-all btn-shine"
            >
              I wore this today
            </button>
          )}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most Worn */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Most Worn</h2>
            </div>
            <Link to="/closet" className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {mostWorn.length > 0 ? (
            <div className="space-y-3">
              {mostWorn.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">{CATEGORY_LABELS[item.category]} · {item.wearCount} wears</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted py-4">Start logging wears to see your favorites.</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shirt size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Collection</h2>
          </div>
          {items.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</span>
                      <span className="text-xs text-text-muted">{count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${(count / items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted py-4">Add items to see your collection breakdown.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction to="/closet" label="Browse Closet" icon={Shirt} />
        <QuickAction to="/outfits" label="Build Outfit" icon={Sparkles} />
        <QuickAction to="/calendar" label="View Calendar" icon={Calendar} />
        <QuickAction to="/stats" label="Insights" icon={TrendingUp} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Shirt; label: string; value: number; accent: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 card-lift">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={accent} />
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{value}</p>
    </div>
  );
}

function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Shirt }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 p-4 bg-bg-card border border-border rounded-xl hover:border-border-light hover:bg-bg-card-hover transition-all group"
    >
      <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center group-hover:border-accent/30 transition-colors">
        <Icon size={16} className="text-text-muted group-hover:text-accent transition-colors" />
      </div>
      <span className="text-xs text-text-secondary font-medium">{label}</span>
    </Link>
  );
}
