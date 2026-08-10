import { useState } from 'react';
import { ChevronLeft, ChevronRight, Shirt } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { DecorativeDivider } from '../components/art';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const { wearLogs, items } = useWardrobe();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getLogsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return wearLogs.filter(l => l.date === dateStr);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-editorial text-2xl sm:text-3xl text-text">Calendar</h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Track what you wore</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-9 h-9 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-light transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm font-medium text-text min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="w-9 h-9 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-light transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <DecorativeDivider />

      {/* Calendar */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider py-2">{day}</div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const logs = getLogsForDay(day);
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
            return (
              <div key={day} className={`aspect-square rounded-lg border p-1 transition-all ${isToday ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-border-light'}`}>
                <span className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-text'}`}>{day}</span>
                {logs.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {logs.slice(0, 4).map((log, j) => {
                      const item = items.find(i => i.id === log.itemIds[0]);
                      return item ? (
                        <div key={j} className="w-5 h-5 rounded overflow-hidden border border-border">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : null;
                    })}
                    {logs.length > 4 && <span className="text-[8px] text-text-muted">+{logs.length - 4}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shirt size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider">This Month</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{wearLogs.filter(l => l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length}</p>
            <p className="text-xs text-text-muted mt-1">Total Wears</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">
              {new Set(wearLogs.filter(l => l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).map(l => l.itemIds[0])).size}
            </p>
            <p className="text-xs text-text-muted mt-1">Unique Items</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">
              {wearLogs.filter(l => l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length > 0
                ? Math.round(wearLogs.filter(l => l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length / daysInMonth * 100)
                : 0}%
            </p>
            <p className="text-xs text-text-muted mt-1">Utilization</p>
          </div>
        </div>
      </div>
    </div>
  );
}
