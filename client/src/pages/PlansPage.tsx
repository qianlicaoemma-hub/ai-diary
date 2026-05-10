// ===== Plans 页面 — 种草/长期计划清单 =====
// 设计：暖橙流光主题，两个 Tab，聚合所有日记中的计划条目

import { useState, useEffect } from 'react';
import { TodoItem, PlansStore, PlanCategory, getPlans, savePlans, updatePlanItemInEntry, deletePlanItem, generateId } from '@/lib/storage';
import { toast } from 'sonner';

type TabType = PlanCategory;

const TAB_CONFIG = {
  nextDayPlans: {
    label: '✍️ 次日计划',
    emoji: '✍️',
    title: '次日计划',
    placeholder: '添加明日要做的事...',
    emptyText: '还没有次日计划，去日记里添加吧',
    color: '#FF9F43',
  },
  wantToDo: {
    label: '🌱 种草/想做',
    emoji: '🌱',
    title: '种草清单',
    placeholder: '添加想做的事、想去的地方、想买的东西...',
    emptyText: '还没有种草清单，去日记里添加吧',
    color: '#4CAF50',
  },
  longTermPlans: {
    label: '💡 长期计划',
    emoji: '💡',
    title: '长期目标',
    placeholder: '添加长期目标、人生计划...',
    emptyText: '还没有长期计划，去日记里添加吧',
    color: '#FF7043',
  },
};

function PlanItem({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: TodoItem & { sourceDate?: string };
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const handleEditDone = () => {
    if (editText.trim()) {
      onEdit(editText.trim());
    } else {
      setEditText(item.text);
    }
    setEditing(false);
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-200 group ${
      item.done ? 'bg-gray-50/50' : 'bg-white'
    } border border-orange-50 hover:border-orange-100`}>
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200 ${
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

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={handleEditDone}
            onKeyDown={e => {
              if (e.key === 'Enter') handleEditDone();
              if (e.key === 'Escape') { setEditText(item.text); setEditing(false); }
            }}
            className="w-full text-sm text-[#2D1B0E] bg-orange-50 rounded-lg px-2 py-1 outline-none border border-[#FF7043]/30"
            autoFocus
          />
        ) : (
          <p
            className={`text-sm leading-relaxed cursor-pointer ${
              item.done ? 'line-through text-[#8B6355]/50' : 'text-[#2D1B0E]'
            }`}
            onClick={() => !item.done && setEditing(true)}
          >
            {item.text}
          </p>
        )}
        {(item as { sourceDate?: string }).sourceDate && (
          <p className="text-[10px] text-[#D4A574] mt-0.5">
            来自 {(item as { sourceDate?: string }).sourceDate}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!item.done && (
          <button
            onClick={() => setEditing(true)}
            className="w-6 h-6 rounded-full hover:bg-orange-100 flex items-center justify-center text-[#8B6355] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center text-[#8B6355] hover:text-red-400 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [activeTab, setActiveTab] = useState<TabType>('nextDayPlans');
  const [plans, setPlans] = useState<PlansStore>({ nextDayPlans: [], wantToDo: [], longTermPlans: [] });
  const [newText, setNewText] = useState('');
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setPlans(getPlans());
  }, []);

  const refreshPlans = () => {
    setPlans(getPlans());
  };

  const handleToggle = (itemId: string, type: TabType) => {
    const updatedPlans = { ...plans };
    const items = updatedPlans[type];
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    item.done = !item.done;
    setPlans({ ...updatedPlans });
    savePlans(updatedPlans);
    updatePlanItemInEntry(itemId, type, { done: item.done });
  };

  const handleEdit = (itemId: string, type: TabType, text: string) => {
    const updatedPlans = { ...plans };
    const items = updatedPlans[type];
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    item.text = text;
    setPlans({ ...updatedPlans });
    savePlans(updatedPlans);
    updatePlanItemInEntry(itemId, type, { text });
  };

  const handleDelete = (itemId: string, type: TabType) => {
    deletePlanItem(itemId, type);
    refreshPlans();
    toast.success('已删除');
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    const newItem: TodoItem & { sourceDate?: string } = {
      id: generateId(),
      text: newText.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    const updatedPlans = {
      ...plans,
      [activeTab]: [...plans[activeTab], newItem],
    };
    setPlans(updatedPlans);
    savePlans(updatedPlans);
    setNewText('');
    toast.success('已添加');
  };

  const config = TAB_CONFIG[activeTab];
  const items = plans[activeTab];
  const pendingItems = items.filter(i => !i.done);
  const doneItems = items.filter(i => i.done);
  const displayItems = showDone ? items : pendingItems;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      {/* 顶部标题 */}
      <div className="sticky top-[3px] z-40 bg-[#FFF8F0]/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-orange-100/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            我的清单
          </h1>
          <span className="text-2xl">📋</span>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2">
          {(Object.keys(TAB_CONFIG) as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'btn-gradient text-white shadow-sm'
                  : 'bg-white text-[#8B6355] border border-orange-100 hover:bg-orange-50'
              }`}
            >
              {TAB_CONFIG[tab].label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 显示已完成 toggle (统计信息已下移到底部进度卡,这里只保留切换) */}
        {doneItems.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowDone(!showDone)}
              className="text-xs text-[#8B6355] bg-white border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-50 transition-colors"
            >
              {showDone ? '隐藏已完成' : '显示已完成'}
            </button>
          </div>
        )}

        {/* 添加新条目 */}
        <div className="diary-card p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.emoji}</span>
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={config.placeholder}
              className="flex-1 text-sm text-[#2D1B0E] placeholder:text-[#D4A574] bg-transparent outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="btn-gradient px-4 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              添加
            </button>
          </div>
        </div>

        {/* 列表 */}
        {displayItems.length > 0 ? (
          <div className="space-y-2">
            {displayItems.map(item => (
              <div key={item.id} className="animate-slide-up">
                <PlanItem
                  item={item}
                  onToggle={() => handleToggle(item.id, activeTab)}
                  onEdit={text => handleEdit(item.id, activeTab, text)}
                  onDelete={() => handleDelete(item.id, activeTab)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="diary-card p-8 text-center">
            <p className="text-4xl mb-3">{config.emoji}</p>
            <p className="text-sm text-[#8B6355]">{config.emptyText}</p>
            <p className="text-xs text-[#D4A574] mt-1">
              或者在上方直接添加
            </p>
          </div>
        )}

        {/* 进度条 */}
        {items.length > 0 && (
          <div className="diary-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#8B6355]">完成进度</p>
              <p className="text-xs text-[#8B6355]">
                {doneItems.length} / {items.length}
              </p>
            </div>
            <div className="h-2 bg-orange-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${items.length > 0 ? (doneItems.length / items.length) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #FF7043, #FF5252)',
                }}
              />
            </div>
            <p className="text-[10px] text-[#D4A574] mt-1 text-right">
              {items.length > 0 ? Math.round((doneItems.length / items.length) * 100) : 0}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
