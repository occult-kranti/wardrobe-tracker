import { TrendingUp, TrendingDown, Heart, Clock, DollarSign, Package } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS } from '../types';
import { DecorativeDivider } from '../components/art';

export default function Statistics() {
  const { items, wearLogs, getMostWorn, getLeastWorn, getUnwornItems } = useWardrobe();

  const totalItems = items.length;
  const totalWears = wearLogs.length;
  const unwornCount = getUnwornItems().length;
  const mostWorn = getMostWorn(5);
  const leastWorn = getLeastWorn(5);

  const totalCost = items.reduce((sum, i) => sum + (i.cost || 0), 0);
  const avgCostPerWear = totalWears > 0 ? totalCost / totalWears : 0;

  const monthlyWears = wearLogs.reduce((acc, log) => {
    const month = log.date.slice(0, 7);
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-editorial text-2xl sm:text-3xl text-text">Insights</h1>
        <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Your wardrobe at a glance</p>
      </div>
      <DecorativeDivider />

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Items" value={totalItems} color="text-accent" />
        <StatCard icon={Clock} label="Wears" value={totalWears} color="text-sage" />
        <StatCard icon={Heart} label="Favorites" value={items.filter(i => i.favorite).length} color="text-rose" />
        <StatCard icon={DollarSign} label="Value" value={`$${totalCost.toFixed(0)}`} color="text-amber" />
      </div>

      {/* Cost Analysis */}
      {totalCost > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Cost Analysis</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">${totalCost.toFixed(2)}</p>
              <p className="text-xs text-text-muted mt-1">Total Value</p>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">${totalItems > 0 ? (totalCost / totalItems).toFixed(2) : '0.00'}</p>
              <p className="text-xs text-text-muted mt-1">Avg per Item</p>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded-lg">
              <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">${avgCostPerWear.toFixed(2)}</p>
              <p className="text-xs text-text-muted mt-1">Cost per Wear</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {totalItems > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Categories</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(categoryData).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-text">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</span>
                  <span className="text-xs text-text-muted">{count} ({Math.round((count / totalItems) * 100)}%)</span>
                </div>
                <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(count / totalItems) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Activity */}
      {Object.keys(monthlyWears).length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Monthly Activity</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(monthlyWears).sort().map(([month, count]) => {
              const maxCount = Math.max(...Object.values(monthlyWears));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-bg-elevated rounded-t-md relative overflow-hidden" style={{ height: `${height}%` }}>
                    <div className="absolute inset-0 bg-accent/40 rounded-t-md" />
                  </div>
                  <span className="text-[10px] text-text-muted">{month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Most & Least Worn */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-sage" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Most Worn</h2>
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
                    <p className="text-xs text-text-muted">{item.wearCount} wears</p>
                  </div>
                  {item.cost && item.wearCount > 0 && (
                    <span className="text-xs text-text-muted">${(item.cost / item.wearCount).toFixed(2)}/wear</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted py-4">Start logging wears to see insights.</p>
          )}
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-amber" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Least Worn</h2>
          </div>
          {leastWorn.length > 0 ? (
            <div className="space-y-3">
              {leastWorn.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">{item.wearCount} wears</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted py-4">Log more wears to see this data.</p>
          )}
        </div>
      </div>

      {/* Unworn Items Alert */}
      {unwornCount > 0 && (
        <div className="bg-amber/5 border border-amber/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-amber" />
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Wardrobe Alert</h2>
          </div>
          <p className="text-sm text-text-secondary">
            {unwornCount} of your {totalItems} items ({Math.round((unwornCount / totalItems) * 100)}%) haven't been worn yet.
            Consider giving them a try this week.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 card-lift">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{value}</p>
    </div>
  );
}
