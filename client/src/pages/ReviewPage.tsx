// ===== Review 页面 — 月度复盘 =====
// 设计：暖橙流光主题，能量趋势折线图 + AI 月度总结

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { DiaryEntry, getEntriesByMonth, formatDate, getEnergyColor } from '@/lib/storage';
// 使用后端 tRPC 服务
import { toast } from 'sonner';
import SettingsSheet from '@/components/SettingsSheet';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface ChartDataPoint {
  day: number;
  energy: number | null;
  date: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    const energy = payload[0].value;
    return (
      <div className="bg-white rounded-xl px-3 py-2 shadow-lg border border-orange-100 text-xs">
        <p className="text-[#8B6355]">{label}日</p>
        <p className="font-bold text-[#FF7043]">能量 {energy?.toFixed(1)}</p>
      </div>
    );
  }
  return null;
};

export default function ReviewPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewContent, setReviewContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const monthEntries = getEntriesByMonth(viewYear, viewMonth);
    setEntries(monthEntries);
    setReviewContent('');

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const entryMap = new Map(monthEntries.map(e => [e.date, e]));
    const today = formatDate(new Date());

    const data: ChartDataPoint[] = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = entryMap.get(dateStr);
      return {
        day,
        energy: entry ? entry.energy : null,
        date: dateStr,
      };
    }).filter(d => d.date <= today);

    setChartData(data);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    const today = new Date();
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const handleBackToToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
  };

  const handleGenerateReview = async () => {
    if (entries.length === 0) {
      toast.error('本月没有日记记录，无法生成复盘');
      return;
    }
    setIsGenerating(true);
    setReviewContent('');

    // 客户端 90s 超时
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

    try {
      const resp = await fetch('/api/trpc/diary.generateReview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            entries: entries.map(e => ({
              date: e.date,
              mainEvent: e.mainEvent,
              energy: e.energy,
              gains: e.gains,
              nextDayPlans: e.nextDayPlans || [],
              wantToDo: e.wantToDo || [],
              longTermPlans: e.longTermPlans || [],
            })),
            year: viewYear,
            month: viewMonth,
          },
        }),
        credentials: 'include',
        signal: controller.signal,
      });
      const data = await resp.json();
      console.log('[ReviewPage] API Response:', data);
      if (data?.error) {
        throw new Error(data.error?.message || data.error?.json?.message || 'AI 服务返回错误');
      }
      const response = data.result?.data?.json || data.result?.data;

      if (response && response.highlights) {
        const reviewText = `🌟 本月亮点\n${response.highlights}\n\n💪 低谷分析\n${response.challenges}\n\n🚀 成长建议\n${response.suggestions}`;
        setReviewContent(reviewText);
      } else {
        console.error('[ReviewPage] Invalid response structure:', response);
        toast.error('月度复盘数据格式错误');
      }
    } catch (error) {
      console.error('Generate review error:', error);
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('请求超时(90s),AI 这次响应太慢,请重试');
      } else {
        const msg = error instanceof Error ? error.message : '未知错误';
        toast.error(`月度复盘生成失败: ${msg}`);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!reviewContent) return;
    navigator.clipboard.writeText(reviewContent).then(() => {
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const avgEnergy = entries.length > 0
    ? entries.reduce((s, e) => s + e.energy, 0) / entries.length
    : 0;
  const maxEnergy = entries.length > 0 ? Math.max(...entries.map(e => e.energy)) : 0;
  const minEnergy = entries.length > 0 ? Math.min(...entries.map(e => e.energy)) : 0;
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const today = new Date();
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
  const totalDays = isCurrentMonth ? today.getDate() : daysInMonth;

  // 解析 Markdown 为简单 HTML（仅处理标题和段落）
  const renderReview = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="text-base font-bold text-[#2D1B0E] mt-4 mb-2" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            {line.slice(3)}
          </h3>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h4 key={i} className="text-sm font-semibold text-[#4A3728] mt-3 mb-1">
            {line.slice(4)}
          </h4>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-1" />;
      return (
        <p key={i} className="text-sm text-[#4A3728] leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      {/* 顶部标题 */}
      <div className="sticky top-[3px] z-40 bg-[#FFF8F0]/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-orange-100/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            月度复盘
          </h1>
          <div className="flex items-center gap-2">
            <SettingsSheet />
            <span className="text-2xl">📊</span>
          </div>
        </div>

        {/* 月份切换 */}
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
            {!isCurrentMonth && (
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
        {/* 核心统计 */}
        <div className="diary-card p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 平均能量 */}
            <div className="col-span-2 text-center py-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl">
              <p className="text-xs text-[#8B6355] mb-1">本月平均能量值</p>
              <p
                className="text-5xl font-bold"
                style={{
                  fontFamily: 'Playfair Display, serif',
                  color: getEnergyColor(avgEnergy),
                }}
              >
                {avgEnergy > 0 ? avgEnergy.toFixed(1) : '--'}
              </p>
              {avgEnergy > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <div className="h-1.5 w-24 bg-orange-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(avgEnergy / 10) * 100}%`,
                        background: `linear-gradient(90deg, #64B5F6, ${getEnergyColor(avgEnergy)})`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#8B6355]">/ 10</span>
                </div>
              )}
            </div>

            {/* 记录天数 */}
            <div className="text-center p-3 bg-orange-50/50 rounded-xl">
              <p
                className="text-3xl font-bold text-[#FF7043]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {entries.length}
              </p>
              <p className="text-xs text-[#8B6355]">记录天数</p>
              <p className="text-[10px] text-[#D4A574]">共 {totalDays} 天</p>
            </div>

            {/* 坚持率 */}
            <div className="text-center p-3 bg-orange-50/50 rounded-xl">
              <p
                className="text-3xl font-bold text-[#FF7043]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {totalDays > 0 ? Math.round((entries.length / totalDays) * 100) : 0}%
              </p>
              <p className="text-xs text-[#8B6355]">坚持率</p>
              <p className="text-[10px] text-[#D4A574]">
                最高 {maxEnergy > 0 ? maxEnergy.toFixed(1) : '--'} / 最低 {minEnergy > 0 ? minEnergy.toFixed(1) : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* 能量趋势图 */}
        {chartData.filter(d => d.energy !== null).length > 0 ? (
          <div className="diary-card p-4">
            <p className="text-xs font-medium text-[#8B6355] mb-3">⚡ 能量值趋势</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7043" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF7043" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFE0CC" strokeOpacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#8B6355' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 10, fill: '#8B6355' }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 5, 10]}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={5} stroke="#FFB74D" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="energy"
                  stroke="#FF7043"
                  strokeWidth={2}
                  fill="url(#energyGradient)"
                  dot={{ fill: '#FF7043', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#FF5252' }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="diary-card p-6 text-center">
            <p className="text-3xl mb-2">📈</p>
            <p className="text-sm text-[#8B6355]">本月暂无数据</p>
          </div>
        )}

        {/* AI 月度复盘 */}
        <div className="diary-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              🤖 AI 月度复盘
            </p>
            {reviewContent && (
              <button
                onClick={handleCopy}
                className="text-xs text-[#8B6355] bg-orange-50 border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-100 transition-colors flex items-center gap-1"
              >
                {copied ? '✓ 已复制' : '复制全文'}
              </button>
            )}
          </div>

          {!reviewContent && !isGenerating && (
            <div className="text-center py-4">
              <p className="text-xs text-[#8B6355] mb-4">
                基于本月 {entries.length} 篇日记，AI 将生成理性复盘风格的月度总结
              </p>
              <button
                onClick={handleGenerateReview}
                disabled={entries.length === 0}
                className="btn-gradient px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                ✨ 生成月度复盘
              </button>
              {entries.length === 0 && (
                <p className="text-xs text-[#D4A574] mt-2">本月暂无日记记录</p>
              )}
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-[#FF7043] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-xs text-[#8B6355]">AI 正在分析你的月度日记...</p>
            </div>
          )}

          {reviewContent && (
            <div className="space-y-1 animate-slide-up">
              {renderReview(reviewContent)}
              <div className="pt-3 border-t border-orange-100 mt-3">
                <button
                  onClick={handleGenerateReview}
                  className="text-xs text-[#8B6355] hover:text-[#FF7043] transition-colors"
                >
                  重新生成 ↺
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 高光时刻 */}
        {entries.length > 0 && (
          <div className="diary-card p-4">
            <p className="text-xs font-medium text-[#8B6355] mb-3">🌟 本月高光时刻</p>
            <div className="space-y-2">
              {entries
                .sort((a, b) => b.energy - a.energy)
                .slice(0, 3)
                .map(entry => (
                  <div key={entry.date} className="flex items-start gap-3 p-2 rounded-lg bg-orange-50/50">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${getEnergyColor(entry.energy)}, #FF5252)` }}
                    >
                      {entry.energy.toFixed(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#8B6355]">{entry.date}</p>
                      <p className="text-sm text-[#2D1B0E] truncate">{entry.mainEvent}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
