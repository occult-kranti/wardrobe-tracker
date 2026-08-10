import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shirt, TrendingUp, Calendar, Heart, ArrowRight } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS } from '../types';

export default function Dashboard() {
  const { items, outfits, wearLogs, getMostWorn, getUnwornItems, getOutfitSuggestions, logWear } = useWardrobe();
  const [suggestions] = useState(() => getOutfitSuggestions());

  const today = new Date().toISOString().split('T')[0];
  const todayLog = wearLogs.find(l => l.date === today);
  const totalItems = items.length;
  const totalOutfits = outfits.length;
  const totalWears = wearLogs.length;
  const unwornCount = getUnwornItems().length;
  const mostWorn = getMostWorn(3);

  const categoryBreakdown = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleLogToday = (outfitId?: string, itemIds?: string[]) => {
    if (outfitId) {
      logWear([], outfitId);
    } else if (itemIds) {
      logWear(itemIds);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
        </h1>
        <p className="text-text-secondary mt-1">
          {totalItems === 0
            ? 'Start by adding your first clothing item to your digital closet.'
            : todayLog
            ? "You've logged today's outfit. Great start!"
            : 'What are you wearing today?'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Items', value: totalItems, icon: Shirt, color: 'text-accent' },
          { label: 'Outfits', value: totalOutfits, icon: Sparkles, color: 'text-rose' },
          { label: 'Total Wears', value: totalWears, icon: TrendingUp, color: 'text-success' },
          { label: 'Unworn', value: unwornCount, icon: Heart, color: 'text-warning' },
        ].map(stat => (
          <div key={stat.label} className="bg-cream border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} className={stat.color} />
              <span className="text-xs text-text-muted font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-semibold text-text">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Today's Outfit Suggestion */}
      {!todayLog && totalItems > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-text">Today's Suggestions</h2>
          </div>
          {suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map(outfit => (
                <div key={outfit.id} className="flex items-center justify-between bg-surface rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {outfit.itemIds.slice(0, 3).map(id => {
                        const item = items.find(i => i.id === id);
                        return item ? (
                          <img
                            key={id}
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-cream"
                          />
                        ) : null;
                      })}
                    </div>
                    <span className="text-sm font-medium text-text">{outfit.name}</span>
                  </div>
                  <button
                    onClick={() => handleLogToday(outfit.id)}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover active:scale-95 transition-all"
                  >
                    Wear This
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-text-secondary">No saved outfits yet.</p>
              <Link to="/outfits" className="inline-flex items-center gap-1 text-sm text-accent mt-2 hover:underline">
                Create your first outfit <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      {totalItems > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">Your Closet Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const count = categoryBreakdown[key] || 0;
              const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
              return (
                <Link
                  key={key}
                  to={`/closet?category=${key}`}
                  className="bg-surface rounded-lg p-3 hover:bg-surface-hover transition-colors"
                >
                  <p className="text-lg font-semibold text-text">{count}</p>
                  <p className="text-xs text-text-muted mt-0.5">{label}</p>
                  {count > 0 && (
                    <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Most Worn */}
      {mostWorn.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">Most Worn Items</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {mostWorn.map(item => (
              <div key={item.id} className="flex-shrink-0 w-28">
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-surface">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium text-text mt-1.5 truncate">{item.name}</p>
                <p className="text-xs text-text-muted">{item.wearCount} wears</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {wearLogs.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-text-muted" />
            <h2 className="text-base font-semibold text-text">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {wearLogs.slice(-5).reverse().map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-xs">
                    {new Date(log.date).getDate()}
                  </div>
                  <div>
                    <p className="text-sm text-text">
                      {log.outfitId
                        ? outfits.find(o => o.id === log.outfitId)?.name || 'Outfit'
                        : `${log.itemIds.length} item${log.itemIds.length > 1 ? 's' : ''}`}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalItems === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto flex items-center justify-center mb-4">
            <Shirt size={28} className="text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text">Your closet is empty</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-sm mx-auto">
            Start building your digital wardrobe by adding your favorite pieces.
          </p>
        </div>
      )}
    </div>
  );
}
