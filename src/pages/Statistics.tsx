import { TrendingUp, TrendingDown, Heart, Clock, DollarSign, Package } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS } from '../types';

export default function Statistics() {
  const { items, outfits, wearLogs, getMostWorn, getLeastWorn, getUnwornItems } = useWardrobe();

  const totalItems = items.length;
  const totalWears = wearLogs.length;
  const totalOutfits = outfits.length;
  const unwornCount = getUnwornItems().length;
  const wornCount = totalItems - unwornCount;
  const mostWorn = getMostWorn(5);
  const leastWorn = getLeastWorn(5);

  const totalCost = items.reduce((sum, i) => sum + (i.cost || 0), 0);
  const avgCostPerWear = totalWears > 0 ? totalCost / totalWears : 0;

  const categoryData = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const catItems = items.filter(i => i.category === key);
    const catWears = catItems.reduce((sum, i) => sum + i.wearCount, 0);
    return { key, label, count: catItems.length, wears: catWears };
  }).filter(d => d.count > 0);

  const monthlyWears = wearLogs.reduce((acc, log) => {
    const month = log.date.slice(0, 7);
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedMonths = Object.entries(monthlyWears).sort().slice(-6);
  const maxMonthly = Math.max(...Object.values(monthlyWears), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">Statistics</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', value: totalItems, icon: Package, color: 'bg-accent/10 text-accent' },
          { label: 'Total Wears', value: totalWears, icon: TrendingUp, color: 'bg-success/10 text-success' },
          { label: 'Outfits', value: totalOutfits, icon: Heart, color: 'bg-rose/10 text-rose' },
          { label: 'Unworn Items', value: unwornCount, icon: TrendingDown, color: 'bg-warning/10 text-warning' },
        ].map(stat => (
          <div key={stat.label} className="bg-cream border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={16} />
            </div>
            <p className="text-2xl font-semibold text-text">{stat.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Wardrobe Utilization */}
      {totalItems > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">Wardrobe Utilization</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E8E4E0" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" stroke="#C4705A" strokeWidth="3"
                  strokeDasharray={`${(wornCount / totalItems) * 100} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold text-text">
                  {Math.round((wornCount / totalItems) * 100)}%
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-text">{wornCount}</span> of{' '}
                <span className="font-semibold text-text">{totalItems}</span> items have been worn
              </p>
              <p className="text-xs text-text-muted mt-1">
                {unwornCount > 0
                  ? `${unwornCount} items haven't been worn yet. Try styling them into new outfits!`
                  : "Amazing! You've worn every item in your closet."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">By Category</h2>
          <div className="space-y-3">
            {categoryData.map(cat => {
              const pct = totalItems > 0 ? (cat.count / totalItems) * 100 : 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-text">{cat.label}</span>
                    <span className="text-text-muted">{cat.count} items · {cat.wears} wears</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Activity */}
      {sortedMonths.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">Monthly Activity</h2>
          <div className="flex items-end gap-3 h-32">
            {sortedMonths.map(([month, count]) => {
              const height = maxMonthly > 0 ? (count / maxMonthly) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-accent rounded-t-md transition-all"
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted">{month.slice(5)}</span>
                  <span className="text-[10px] font-medium text-text">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost Analysis */}
      {totalCost > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-success" />
            <h2 className="text-base font-semibold text-text">Cost Analysis</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted">Total Wardrobe Value</p>
              <p className="text-xl font-semibold text-text">${totalCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Average Cost Per Wear</p>
              <p className="text-xl font-semibold text-text">${avgCostPerWear.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Most Worn */}
      {mostWorn.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-success" />
            <h2 className="text-base font-semibold text-text">Most Worn</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {mostWorn.map(item => (
              <div key={item.id} className="flex-shrink-0 w-24">
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-surface">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium text-text mt-1 truncate">{item.name}</p>
                <p className="text-xs text-success">{item.wearCount} wears</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Least Worn */}
      {leastWorn.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-warning" />
            <h2 className="text-base font-semibold text-text">Needs More Love</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {leastWorn.filter(i => i.wearCount < 3).map(item => (
              <div key={item.id} className="flex-shrink-0 w-24">
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-surface">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium text-text mt-1 truncate">{item.name}</p>
                <p className="text-xs text-warning">{item.wearCount} wears</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalItems === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-text-secondary">Add items to your closet to see statistics.</p>
        </div>
      )}
    </div>
  );
}
