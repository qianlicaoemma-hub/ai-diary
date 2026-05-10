// ===== 日记卡片组件 =====
// 设计：暖橙流光主题，左侧彩色竖线（对应能量值），可编辑字段

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { DiaryEntry, TodoItem, generateId, getEnergyColor, getEnergyLabel, formatDisplayDate } from '@/lib/storage';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DiaryCardProps {
  entry: DiaryEntry;
  mode?: 'edit' | 'view';
  onSave?: (entry: DiaryEntry) => void;
  onDelete?: () => void;
  isSaving?: boolean;
  saved?: boolean;
  className?: string;
}

// 暴露给外部 (DiaryCard) 在保存时强制提交未确认的输入
interface TodoListHandle {
  commitPending: () => TodoItem[]; // 返回最终 items(包含可能正在输入的那条)
}

const TodoList = forwardRef<TodoListHandle, {
  items: TodoItem[];
  onChange?: (items: TodoItem[]) => void;
  readOnly?: boolean;
  placeholder?: string;
}>(function TodoList({
  items,
  onChange,
  readOnly,
  placeholder,
}, ref) {
  const [newText, setNewText] = useState('');

  const toggle = (id: string) => {
    if (readOnly || !onChange) return;
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const addItem = () => {
    if (!newText.trim() || !onChange) return;
    onChange([...items, { id: generateId(), text: newText.trim(), done: false, createdAt: new Date().toISOString() }]);
    setNewText('');
  };

  const removeItem = (id: string) => {
    if (!onChange) return;
    onChange(items.filter(i => i.id !== id));
  };

  const editItem = (id: string, text: string) => {
    if (!onChange) return;
    onChange(items.map(i => i.id === id ? { ...i, text } : i));
  };

  // 暴露 commitPending: 返回包含 pending 文本的 items 列表,并清空输入框
  useImperativeHandle(ref, () => ({
    commitPending: () => {
      const trimmed = newText.trim();
      if (!trimmed) return items;
      const newItem: TodoItem = {
        id: generateId(),
        text: trimmed,
        done: false,
        createdAt: new Date().toISOString(),
      };
      const finalItems = [...items, newItem];
      // 通知父组件更新 + 清空输入框
      onChange?.(finalItems);
      setNewText('');
      return finalItems;
    },
  }), [items, newText, onChange]);

  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group">
          <button
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-all duration-150 ${
              item.done
                ? 'bg-[#FF7043] border-[#FF7043]'
                : 'border-[#D4A574] hover:border-[#FF7043]'
            }`}
          >
            {item.done && (
              <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
                <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          {readOnly ? (
            <span className={`text-sm flex-1 ${item.done ? 'line-through text-[#8B6355]/50' : 'text-[#4A3728]'}`}>
              {item.text}
            </span>
          ) : (
            <input
              type="text"
              value={item.text}
              onChange={e => editItem(item.id, e.target.value)}
              className={`text-sm flex-1 bg-transparent outline-none border-b border-transparent focus:border-[#FF7043]/30 transition-colors ${
                item.done ? 'line-through text-[#8B6355]/50' : 'text-[#4A3728]'
              }`}
            />
          )}
          {!readOnly && (
            <button
              onClick={() => removeItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-[#8B6355]/50 hover:text-red-400 transition-all text-xs w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-4 rounded border-2 border-dashed border-[#D4A574]/50 flex-shrink-0" />
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder={placeholder || '添加条目...'}
            className="text-sm flex-1 bg-transparent outline-none text-[#8B6355] placeholder:text-[#D4A574]"
          />
          {newText && (
            <button
              onClick={addItem}
              className="text-[#FF7043] text-xs font-medium"
            >
              添加
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default function DiaryCard({
  entry: externalEntry,
  mode = 'edit',
  onSave,
  onDelete,
  isSaving,
  saved,
  className = '',
}: DiaryCardProps) {
  const [entry, setEntry] = useState<DiaryEntry>(externalEntry);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  // 各 TodoList 的 ref,用于在保存时强制提交未确认的输入
  const nextDayPlansRef = useRef<TodoListHandle>(null);
  const wantToDoRef = useRef<TodoListHandle>(null);
  const longTermPlansRef = useRef<TodoListHandle>(null);

  // 同步外部 entry 变化（AI 流式更新时）
  useEffect(() => {
    setEntry(externalEntry);
  }, [externalEntry]);

  const energyColor = getEnergyColor(entry.energy);
  const energyLabel = getEnergyLabel(entry.energy);

  const updateEntry = (updates: Partial<DiaryEntry>) => {
    setEntry(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    // 在保存前,把每个 TodoList 中"打了字但还没按 Enter / 点添加"的 pending 文本提交进 entry
    const finalEntry: DiaryEntry = {
      ...entry,
      nextDayPlans: nextDayPlansRef.current?.commitPending() ?? entry.nextDayPlans,
      wantToDo: wantToDoRef.current?.commitPending() ?? entry.wantToDo,
      longTermPlans: longTermPlansRef.current?.commitPending() ?? entry.longTermPlans,
    };
    onSave?.(finalEntry);
  };

  return (
    <div
      className={`diary-card relative overflow-hidden ${saved ? 'animate-save-bounce' : ''} ${className}`}
      style={{ borderLeft: `4px solid ${energyColor}` }}
    >
      {/* 顶部日期行 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs text-[#8B6355]">📅 {formatDisplayDate(entry.date)}</p>
        <div className="flex items-center gap-2">
          {saved ? (
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" fill="#4CAF50"/>
                <polyline points="3,6 5,8.5 9,4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              已保存
            </span>
          ) : (mode === 'edit' || isEditing) && onSave && (
            <span className="text-xs text-[#FF7043] font-medium flex items-center gap-1">
              <span className="relative inline-flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#FF7043] opacity-50 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#FF7043]" />
              </span>
              未保存
            </span>
          )}
          {mode === 'view' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-[#FF7043] font-medium px-2 py-0.5 rounded-full bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              {isEditing ? '完成' : '编辑'}
            </button>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-xs text-red-400 hover:text-red-500 transition-colors">
                  删除
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除这条日记?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {formatDisplayDate(entry.date)} 的日记将被永久删除,无法恢复。该日记里的种草/长期计划等也会从清单页移除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* 最重要的事 - 支持下滑展开 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-1">🚀 今日重点</p>
          {isEditing ? (
            <textarea
              value={entry.mainEvent}
              onChange={e => updateEntry({ mainEvent: e.target.value })}
              className="w-full text-sm text-[#2D1B0E] font-medium bg-orange-50/50 rounded-lg px-3 py-2 outline-none resize-none border border-transparent focus:border-[#FF7043]/30 transition-colors"
              rows={3}
              placeholder="记录今天完成的最重要的事..."
            />
          ) : (
            <div className="max-h-[120px] overflow-y-auto pr-2 text-sm text-[#2D1B0E] font-medium leading-relaxed break-words">
              {entry.mainEvent}
            </div>
          )}
        </div>

        {/* 记忆片段 - 结构化排版 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-1">🎞️ 记忆片段</p>
          {isEditing ? (
            <textarea
              value={entry.memories}
              onChange={e => updateEntry({ memories: e.target.value })}
              className="w-full text-sm text-[#4A3728] bg-orange-50/50 rounded-lg px-3 py-2 outline-none resize-none border border-transparent focus:border-[#FF7043]/30 transition-colors leading-relaxed"
              rows={4}
              placeholder="记录今天的流水账，每个事件分行记录..."
            />
          ) : (
            <div className="text-sm text-[#4A3728] leading-relaxed space-y-1">
              {entry.memories.split('\n').map((line, i) => (
                <div key={i} className="break-words">
                  {line || <span className="text-transparent">.</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 能量值 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[#8B6355]">⚡ 能量值</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B6355]">{energyLabel}</span>
              <span
                className="text-lg font-bold"
                style={{ color: energyColor, fontFamily: 'Playfair Display, serif' }}
              >
                {entry.energy.toFixed(1)}
              </span>
            </div>
          </div>
          <Slider
            value={[entry.energy]}
            min={1}
            max={10}
            step={0.1}
            onValueChange={([v]) => updateEntry({ energy: v })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-[#D4A574] mt-1">
            <span>低迷 1</span>
            <span>5</span>
            <span>10 满满当当</span>
          </div>
        </div>

        {/* 重要收获 - 可为空 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-1">🧺 重要收获</p>
          {isEditing ? (
            <textarea
              value={entry.gains}
              onChange={e => updateEntry({ gains: e.target.value })}
              className="w-full text-sm text-[#4A3728] bg-orange-50/50 rounded-lg px-3 py-2 outline-none resize-none border border-transparent focus:border-[#FF7043]/30 transition-colors"
              rows={2}
              placeholder="记录有启发性的收获（可为空）..."
            />
          ) : (
            <p className="text-sm text-[#4A3728] leading-relaxed min-h-[1.5em]">
              {entry.gains || <span className="text-[#D4A574]/50 italic">暂无收获</span>}
            </p>
          )}
        </div>

        {/* 次日计划 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-2">✍️ 次日计划</p>
          <TodoList
            ref={nextDayPlansRef}
            items={entry.nextDayPlans}
            onChange={isEditing ? items => updateEntry({ nextDayPlans: items }) : undefined}
            readOnly={!isEditing}
            placeholder="添加明日计划..."
          />
        </div>

        {/* 种草/想做 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-2">🌱 种草/想做</p>
          <TodoList
            ref={wantToDoRef}
            items={entry.wantToDo}
            onChange={isEditing ? items => updateEntry({ wantToDo: items }) : undefined}
            readOnly={!isEditing}
            placeholder="添加想做的事..."
          />
        </div>

        {/* 长期计划 */}
        <div>
          <p className="text-xs font-medium text-[#8B6355] mb-2">💡 长期计划</p>
          <TodoList
            ref={longTermPlansRef}
            items={entry.longTermPlans}
            onChange={isEditing ? items => updateEntry({ longTermPlans: items }) : undefined}
            readOnly={!isEditing}
            placeholder="添加长期目标..."
          />
        </div>

        {/* 保存按钮(未保存时加 ring 强调) */}
        {(mode === 'edit' || isEditing) && onSave && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`btn-gradient w-full py-3 text-sm font-semibold mt-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              !saved && !isSaving ? 'ring-2 ring-[#FF7043]/40 ring-offset-2 ring-offset-white' : ''
            }`}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="30 60"/>
                </svg>
                保存中...
              </span>
            ) : saved ? (
              '✓ 已保存'
            ) : (
              '保存日记'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
