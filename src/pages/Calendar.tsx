import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';

export default function Calendar() {
  const { items, outfits, wearLogs, logWear } = useWardrobe();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeek]);

  const getLogForDate = (dateStr: string) => wearLogs.find(l => l.date === dateStr);

  const handleWearOutfit = (dateStr: string, outfitId: string, itemIds: string[]) => {
    if (getLogForDate(dateStr)) return;
    logWear(itemIds, outfitId);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const monthYear = weekDays[0]?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) || '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">Outfit Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text min-w-[120px] text-center">{monthYear}</span>
          <button onClick={nextWeek} className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-text-muted py-2">{d}</div>
        ))}
        {weekDays.map(day => {
          const dateStr = formatDate(day);
          const log = getLogForDate(dateStr);
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const isPast = dateStr < new Date().toISOString().split('T')[0];

          return (
            <div
              key={dateStr}
              className={`min-h-[140px] bg-cream border rounded-xl p-2 flex flex-col ${
                isToday ? 'border-accent' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-text'}`}>
                  {day.getDate()}
                </span>
                {log && <Check size={14} className="text-success" />}
              </div>

              {log ? (
                <div className="flex-1">
                  {log.outfitId ? (
                    <div className="text-xs text-text-secondary">
                      {outfits.find(o => o.id === log.outfitId)?.name || 'Outfit'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-0.5">
                      {log.itemIds.slice(0, 3).map(id => {
                        const item = items.find(i => i.id === id);
                        return item ? (
                          <img
                            key={id}
                            src={item.imageUrl}
                            alt=""
                            className="w-6 h-6 rounded object-cover"
                          />
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1">
                  {!isPast && outfits.length > 0 && (
                    <div className="space-y-1">
                      {outfits.filter(o => o.favorite).slice(0, 2).map(outfit => (
                        <button
                          key={outfit.id}
                          onClick={() => handleWearOutfit(dateStr, outfit.id, outfit.itemIds)}
                          className="w-full text-left px-2 py-1 rounded bg-surface hover:bg-surface-hover text-[10px] text-text-secondary truncate transition-colors"
                        >
                          {outfit.name}
                        </button>
                      ))}
                      {outfits.filter(o => o.favorite).length === 0 && (
                        <p className="text-[10px] text-text-muted">No outfits</p>
                      )}
                    </div>
                  )}
                  {isPast && <p className="text-[10px] text-text-muted">Not logged</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Schedule */}
      {outfits.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-base font-semibold text-text">Quick Schedule</h2>
          </div>
          <p className="text-sm text-text-secondary mb-3">Click an outfit to schedule it for the next available day.</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {outfits.map(outfit => (
              <button
                key={outfit.id}
                onClick={() => {
                  const nextAvailable = weekDays.find(d => {
                    const ds = formatDate(d);
                    return ds >= new Date().toISOString().split('T')[0] && !getLogForDate(ds);
                  });
                  if (nextAvailable) {
                    handleWearOutfit(formatDate(nextAvailable), outfit.id, outfit.itemIds);
                  }
                }}
                className="flex-shrink-0 bg-surface border border-border rounded-lg p-2 hover:bg-surface-hover transition-colors text-left"
              >
                <div className="flex gap-1 mb-1.5">
                  {outfit.itemIds.slice(0, 3).map(id => {
                    const item = items.find(i => i.id === id);
                    return item ? (
                      <img key={id} src={item.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : null;
                  })}
                </div>
                <p className="text-xs font-medium text-text truncate max-w-[100px]">{outfit.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
