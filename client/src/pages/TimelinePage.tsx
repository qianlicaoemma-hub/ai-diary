// ===== Timeline 页面 — 日历热力图 + 日记回看 =====
// 设计：暖橙流光主题，月份切换器 + 热力图 + 日记卡片展开

import { useState, useEffect } from 'react';
import { DiaryEntry, getEntriesByMonth, getEntryByDate, saveEntry, deleteEntry, formatDate, getEnergyColor } from '@/lib/storage';
import DiaryCard from '@/components/DiaryCard';
import { toast } from 'sonner';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

// 将能量值转换为热力图背景色（带透明度）
function getHeatmapBg(energy: number): string {
  const color = getEnergyColor(energy);
  const opacity = 0.25 + (energy / 10) * 0.55; // 0.25 ~ 0.80
  // 将 hex 转 rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export default function TimelinePage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDate, setSavedDate] = useState<string | null>(null);

  useEffect(() => {
    const monthEntries = getEntriesByMonth(viewYear, viewMonth);
    setEntries(monthEntries);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
    setSelectedEntry(null);
  };

  const handleNextMonth = () => {
    const today = new Date();
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
    setSelectedEntry(null);
  };

  const handleBackToToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setSelectedDate(null);
    setSelectedEntry(null);
  };

  const handleDayClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedEntry(null);
      return;
    }
    const entry = getEntryByDate(dateStr);
    setSelectedDate(dateStr);
    setSelectedEntry(entry);
  };

  const handleSave = async (entry: DiaryEntry) => {
    setIsSaving(true);
    try {
      saveEntry(entry);
      setSavedDate(entry.date);
      setEntries(getEntriesByMonth(viewYear, viewMonth));
      toast.success('日记更新成功 ✨');
      setTimeout(() => setSavedDate(null), 2000);
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (date: string) => {
    deleteEntry(date);
    setEntries(getEntriesByMonth(viewYear, viewMonth));
    setSelectedDate(null);
    setSelectedEntry(null);
    toast.success('日记已删除');
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const today = formatDate(new Date());
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  const entryMap = new Map(entries.map(e => [e.date, e]));
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      {/* 顶部标题 */}
      <div className="sticky top-[3px] z-40 bg-[#FFF8F0]/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-orange-100/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            时光轴
          </h1>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFB347] to-[#FF7043] flex items-center justify-center shadow-md">
            <span className="text-white text-lg">📅</span>
          </div>
        </div>

        {/* 月份切换器 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-[#8B6355] hover:bg-orange-100 transition-colors shadow-sm text-lg"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-base font-bold text-[#2D1B0E]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {viewYear}年{viewMonth}月
            </p>
            {isCurrentMonth ? (
              <p className="text-xs text-[#8B6355]">
                已记录 <span className="text-[#FF7043] font-semibold">{entries.length}</span> 天 / {daysInMonth} 天
              </p>
            ) : (
              <button
                onClick={handleBackToToday}
                className="text-[11px] text-[#FF7043] hover:underline mt-0.5"
              >
                回到本月
              </button>
            )}
          </div>
          <button
            onClick={handleNextMonth}
            className={`w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-[#8B6355] transition-colors shadow-sm text-lg ${
              isCurrentMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-orange-100'
            }`}
          >
            ›
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 热力图日历 */}
        <div className="diary-card p-4">
          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-2">
            {weekdays.map(d => (
              <div key={d} className="text-center text-[10px] text-[#8B6355] font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* 日期格子 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 空白填充 */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* 日期 */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entry = entryMap.get(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > today;

              return (
                <button
                  key={day}
                  onClick={() => !isFuture && handleDayClick(dateStr)}
                  disabled={isFuture}
                  className={`
                    heatmap-cell aspect-square flex items-center justify-center text-xs font-medium
                    transition-all duration-150 relative rounded-lg
                    ${isFuture ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                    ${isSelected ? 'ring-2 ring-[#FF7043] ring-offset-1 shadow-sm' : ''}
                  `}
                  style={{
                    backgroundColor: entry
                      ? getHeatmapBg(entry.energy)
                      : isToday
                        ? 'rgba(255, 112, 67, 0.12)'
                        : 'rgba(245, 240, 235, 0.8)',
                    color: isToday && !entry ? '#FF7043' : '#4A3728',
                    fontWeight: isToday ? '700' : '400',
                  }}
                >
                  {day}
                  {entry && (
                    <span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: getEnergyColor(entry.energy) }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 图例 */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-orange-50">
            <span className="text-xs text-[#8B6355]">能量值</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B6355]">低</span>
              {[
                { color: '#64B5F6', opacity: 0.5, label: '低迷' },
                { color: '#FFB74D', opacity: 0.55, label: '平淡' },
                { color: '#FF7043', opacity: 0.65, label: '充实' },
                { color: '#FF5252', opacity: 0.75, label: '满满' },
              ].map(({ color, opacity, label }) => (
                <div
                  key={color}
                  title={label}
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: color + Math.round(opacity * 255).toString(16).padStart(2, '0') }}
                />
              ))}
              <span className="text-xs text-[#8B6355]">高</span>
            </div>
          </div>
        </div>

        {/* 选中日期的日记卡片 */}
        {selectedDate && selectedEntry && (
          <div className="animate-slide-up">
            <p className="text-xs text-[#8B6355] mb-2 px-1 flex items-center gap-1">
              <span>📖</span>
              <span>{selectedDate} 的日记</span>
            </p>
            <DiaryCard
              entry={selectedEntry}
              mode="view"
              onSave={entry => handleSave(entry)}
              onDelete={() => handleDelete(selectedDate)}
              isSaving={isSaving}
              saved={savedDate === selectedDate}
            />
          </div>
        )}

        {/* 无记录提示 */}
        {selectedDate && !selectedEntry && (
          <div className="diary-card p-6 text-center animate-slide-up">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm text-[#8B6355]">{selectedDate} 还没有日记记录</p>
            <p className="text-xs text-[#D4A574] mt-1">去 Home 页面补记一下吧</p>
          </div>
        )}

        {/* 月度统计 */}
        {entries.length > 0 && (
          <div className="diary-card p-4">
            <p className="text-xs font-medium text-[#8B6355] mb-3">📊 本月概览</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-orange-50/50 rounded-xl">
                <p className="text-2xl font-bold text-[#FF7043]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {entries.length}
                </p>
                <p className="text-[10px] text-[#8B6355]">记录天数</p>
              </div>
              <div className="text-center p-2 bg-orange-50/50 rounded-xl">
                <p className="text-2xl font-bold text-[#FF7043]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {(entries.reduce((s, e) => s + e.energy, 0) / entries.length).toFixed(1)}
                </p>
                <p className="text-[10px] text-[#8B6355]">平均能量</p>
              </div>
              <div className="text-center p-2 bg-orange-50/50 rounded-xl">
                <p className="text-2xl font-bold text-[#FF7043]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {Math.max(...entries.map(e => e.energy)).toFixed(1)}
                </p>
                <p className="text-[10px] text-[#8B6355]">最高能量</p>
              </div>
            </div>
          </div>
        )}

        {/* 无数据空状态 */}
        {entries.length === 0 && !selectedDate && (
          <div className="diary-card p-8 text-center">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-sm text-[#8B6355]">本月还没有日记记录</p>
            <p className="text-xs text-[#D4A574] mt-1">去 Home 页面开始记录吧</p>
          </div>
        )}
      </div>
    </div>
  );
}
