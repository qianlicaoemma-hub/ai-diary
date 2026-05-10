// ===== Home 页面 — 聊天式日记记录 =====
// 设计：暖橙流光主题，聊天气泡 + AI 整理日记卡片

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DiaryEntry, TodoItem,
  formatDate, getEntryByDate, saveEntry, generateId
} from '@/lib/storage';
import { trpc } from '@/lib/trpc';
import DiaryCard from '@/components/DiaryCard';
import CalendarDatePicker from '@/components/CalendarDatePicker';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
}

// 使用新的日历选择器组件

const GREETING_PROMPTS = [
  '今天有什么有趣的事情发生吗？',
  '今天最让你开心的一刻是什么？',
  '今天学到了什么新东西？',
  '今天和谁有了一次好的交流？',
  '今天完成了什么让你满意的事？',
];

const QUICK_PROMPTS = ['今天很充实', '今天有点累', '学到了新东西', '完成了一个目标'];

export default function HomePage() {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingEntry, setExistingEntry] = useState<DiaryEntry | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const greetingPrompt = GREETING_PROMPTS[new Date().getHours() % GREETING_PROMPTS.length];

  useEffect(() => {
    const entry = getEntryByDate(selectedDate);
    setExistingEntry(entry);
    setCurrentEntry(entry);
    setSaved(!!entry);
    if (entry) {
      setMessages([{
        id: generateId(),
        type: 'system',
        content: `已找到 ${selectedDate} 的日记，可以继续追加内容 ✍️`,
      }]);
    } else {
      setMessages([{
        id: generateId(),
        type: 'ai',
        content: selectedDate === today
          ? `${greetingPrompt} 随便聊聊，我来帮你整理成日记 ✨`
          : `${selectedDate} 发生了什么？来补记一下吧 📝`,
      }]);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentEntry, scrollToBottom]);

  const handleSend = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsProcessing(true);
    setSaved(false);

    const userMsgId = generateId();
    const aiMsgId = generateId();

    setMessages(prev => [
      ...prev,
      { id: userMsgId, type: 'user', content: userText },
      { id: aiMsgId, type: 'ai', content: '正在整理你的日记...' },
    ]);

    try {
      const combinedInput = existingEntry
        ? `[已有记录]\n主要事件：${existingEntry.mainEvent}\n记忆片段：${existingEntry.memories}\n收获：${existingEntry.gains}\n\n[新增内容]\n${userText}`
        : userText;

      // 客户端 90s 超时,避免服务端 hang 时前端一直转圈
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

      let result;
      try {
        const resp = await fetch('/api/trpc/diary.organize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: { rawInput: combinedInput, date: selectedDate },
          }),
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await resp.json();
        console.log('[API Response]', data);
        if (data?.error) {
          throw new Error(data.error?.message || data.error?.json?.message || 'AI 服务返回错误');
        }
        result = data.result?.data?.json || data.result?.data;
        if (!result) {
          throw new Error('AI 返回了空结果');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('请求超时(90s),AI 这次响应太慢,请重试');
        }
        throw err;
      } finally {
        window.clearTimeout(timeoutId);
      }

      const makeItems = (arr: string[]): TodoItem[] => {
        if (!Array.isArray(arr)) return [];
        return arr
          .filter(text => typeof text === 'string' && text.trim())
          .map(text => ({
            id: generateId(),
            text: text.trim(),
            done: false,
            createdAt: new Date().toISOString()
          }));
      };

      // 按 text 归一化(去空白、小写)去重,避免追加时 AI 重复返回相同条目
      const mergeItems = (existing: TodoItem[], incoming: TodoItem[]): TodoItem[] => {
        const norm = (s: string) => s.trim().toLowerCase();
        const seen = new Set(existing.map(i => norm(i.text)));
        const deduped = incoming.filter(i => {
          const k = norm(i.text);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return [...existing, ...deduped];
      };

      console.log('[newEntry data]', result);
      const newEntry: DiaryEntry = {
        id: existingEntry?.id || generateId(),
        date: selectedDate,
        rawInput: combinedInput,
        mainEvent: result?.mainEvent || '',
        memories: Array.isArray(result?.memories) ? result.memories.join('\n') : (typeof result?.memories === 'string' ? result.memories : ''),
        energy: result?.energyLevel || 5,
        gains: result?.insights || '',
        nextDayPlans: existingEntry
          ? mergeItems(existingEntry.nextDayPlans, makeItems(result?.nextDayPlans || []))
          : makeItems(result?.nextDayPlans || []),
        wantToDo: existingEntry
          ? mergeItems(existingEntry.wantToDo, makeItems(result?.seedsToPlant || []))
          : makeItems(result?.seedsToPlant || []),
        longTermPlans: existingEntry
          ? mergeItems(existingEntry.longTermPlans, makeItems(result?.longTermGoals || []))
          : makeItems(result?.longTermGoals || []),
        createdAt: existingEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('[setCurrentEntry]', newEntry);
      // AI 整理完后立即自动保存,避免用户切走丢数据
      // 用户后续手动调整后,点保存按钮再写一次即可
      try {
        saveEntry(newEntry);
        setCurrentEntry(newEntry);
        setExistingEntry(newEntry);
        setSaved(true);
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: '日记卡片已整理好并自动保存,可继续在卡片上微调 ✨', type: 'ai' }
            : m
        ));
      } catch (saveErr) {
        console.error('[Auto-save] error', saveErr);
        // 保存失败不阻塞 — 至少把卡片显示出来,提醒用户手动保存
        setCurrentEntry(newEntry);
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: '日记卡片已整理好,请检查后点「保存日记」👇', type: 'ai' }
            : m
        ));
        toast.error('自动保存失败,请手动点保存');
      }
    } catch (error) {
      console.error('[AI Error]', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`AI 整理失败: ${errorMsg}`);
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: '整理失败，请稍后重试 🙅', type: 'system' }
          : m
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (entry: DiaryEntry) => {
    setIsSaving(true);
    try {
      saveEntry(entry);
      setCurrentEntry(entry);
      setExistingEntry(entry);
      setSaved(true);
      toast.success('日记保存成功 ✨');
      setMessages(prev => [...prev, {
        id: generateId(),
        type: 'system',
        content: '日记已保存！今天也辛苦了 🌟',
      }]);
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="max-w-[480px] mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* 顶部区域 */}
      <div className="sticky top-[3px] z-40 bg-[#FFF8F0]/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-orange-100/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              Diary Agent
            </h1>
            <p className="text-xs text-[#8B6355]">记录每一天的精彩</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFB347] to-[#FF7043] flex items-center justify-center shadow-md text-lg">
            📔
          </div>
        </div>
        <CalendarDatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`animate-slide-up flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.type === 'user' ? (
              <div className="chat-bubble-user">
                {msg.content}
              </div>
            ) : msg.type === 'ai' ? (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF7043] to-[#FF5252] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5 shadow-sm">
                  AI
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm border border-orange-100 text-sm text-[#4A3728] leading-relaxed">
                  {isProcessing && msg === messages[messages.length - 1] ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex gap-0.5">
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 bg-[#FF7043] rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                      <span className="text-[#8B6355]">{msg.content}</span>
                    </span>
                  ) : msg.content}
                </div>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <span className="text-xs text-[#8B6355]/70 bg-orange-50 px-3 py-1 rounded-full border border-orange-100/50">
                  {msg.content}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* 日记卡片 */}
        {currentEntry && (
          <div className="animate-slide-up mt-2">
            <DiaryCard
              entry={currentEntry}
              mode="edit"
              onSave={handleSave}
              isSaving={isSaving}
              saved={saved}
            />
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* 输入区域 */}
      <div className="sticky bottom-0 bg-[#FFF8F0]/95 backdrop-blur-sm px-4 py-2.5 border-t border-orange-100/50">
        {/* Quick prompts — 常驻可点 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => {
                setInputText(prompt);
                requestAnimationFrame(() => {
                  autoResize();
                  textareaRef.current?.focus();
                });
              }}
              disabled={isProcessing}
              className="flex-shrink-0 text-[11px] bg-white border border-orange-100 text-[#8B6355] px-2.5 py-1 rounded-full hover:bg-orange-50 hover:border-orange-200 transition-all duration-150 shadow-sm disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden focus-within:border-[#FF7043]/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => { setInputText(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder={existingEntry ? '继续追加今天的内容...' : '今天发生了什么？随便聊聊...'}
              className="w-full px-4 py-3 text-sm text-[#2D1B0E] placeholder:text-[#D4A574] outline-none resize-none bg-transparent"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isProcessing}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className="w-11 h-11 rounded-2xl btn-gradient flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isProcessing ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="30 60"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#D4A574] text-center mt-1.5">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
