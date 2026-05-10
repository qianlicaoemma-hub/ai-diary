// ===== 日历日期选择器 =====
// 设计：弹窗式日历，显示当月全景，支持月份切换

import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/storage';

interface CalendarDatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

export default function CalendarDatePicker({ value, onChange }: CalendarDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(value + 'T00:00:00'));
  const containerRef = useRef<HTMLDivElement>(null);
  const today = formatDate(new Date());
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // 外部 value 跨月时,同步弹窗里的视图月份
  useEffect(() => {
    const next = new Date(value + 'T00:00:00');
    setViewDate(prev => {
      if (
        prev.getFullYear() === next.getFullYear() &&
        prev.getMonth() === next.getMonth()
      ) {
        return prev;
      }
      return next;
    });
  }, [value]);

  // 格式化显示日期 — 含年/月/日/星期, 当年省略年份
  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const yearPart = year === now.getFullYear() ? '' : `${year}年`;
    return `${yearPart}${month}月${day}日 周${weekday}`;
  };

  // 获取当月的所有日期
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // 填充前面的空白
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // 填充当月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateStr = formatDate(selectedDate);
    if (dateStr <= today) {
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    if (formatDate(nextMonth) <= today) {
      setViewDate(nextMonth);
    }
  };

  // 日期左右横滑切换
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    
    // 向左滑（下一天）
    if (diff > 50) {
      const nextDate = new Date(new Date(value + 'T00:00:00').getTime() + 86400000);
      const nextDateStr = formatDate(nextDate);
      if (nextDateStr <= today) {
        onChange(nextDateStr);
      }
    }
    // 向右滑（前一天）
    else if (diff < -50) {
      const prevDate = new Date(new Date(value + 'T00:00:00').getTime() - 86400000);
      const prevDateStr = formatDate(prevDate);
      onChange(prevDateStr);
    }
  };

  const days = getDaysInMonth(viewDate);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthYear = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;

  // 关闭弹窗逻辑
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* 选中日期显示 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/90 rounded-full px-4 py-2 shadow-sm border border-orange-100 cursor-pointer hover:bg-orange-50 transition-colors"
      >
        <p className="text-sm text-[#2D1B0E] font-medium whitespace-nowrap">
          📅 {formatDisplayDate(value)}
        </p>
      </button>

      {/* 日历弹窗 */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-orange-100 p-6 w-80">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-[#FF7043] hover:bg-orange-100 transition-colors"
            >
              ‹
            </button>
            <h3 className="text-lg font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              {monthYear}
            </h3>
            <button
              onClick={handleNextMonth}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                formatDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)) > today
                  ? 'opacity-30 cursor-not-allowed'
                  : 'bg-orange-50 text-[#FF7043] hover:bg-orange-100'
              }`}
            >
              ›
            </button>
          </div>

          {/* 周日期头 */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-[#8B6355] py-1">
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const cellDateStr = formatDate(cellDate);
              const isSelected = cellDateStr === value;
              const isToday = cellDateStr === today;
              const isFuture = cellDateStr > today;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  disabled={isFuture}
                  className={`
                    aspect-square rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-[#FF7043] text-white shadow-md'
                      : isToday
                      ? 'bg-orange-100 text-[#FF7043] font-bold'
                      : isFuture
                      ? 'text-[#D4A574]/50 cursor-not-allowed'
                      : 'text-[#2D1B0E] hover:bg-orange-50'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
