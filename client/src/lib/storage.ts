// ===== AI 日记小助理 数据层 =====
// 设计：所有数据存储在 localStorage，按日期索引

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  rawInput: string; // 用户原始输入
  mainEvent: string; // AI 整理的最重要的事
  memories: string; // AI 整理的记忆片段
  energy: number; // 能量值 1-10，支持1位小数
  gains: string; // 重要收获
  nextDayPlans: TodoItem[]; // 次日计划
  wantToDo: TodoItem[]; // 种草/想做
  longTermPlans: TodoItem[]; // 长期计划
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'ai-diary-entries';
const PLANS_KEY = 'ai-diary-plans';

// ===== 日记条目操作 =====

export function getAllEntries(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiaryEntry[];
  } catch {
    return [];
  }
}

export function getEntryByDate(date: string): DiaryEntry | null {
  const entries = getAllEntries();
  return entries.find(e => e.date === date) || null;
}

export function getEntriesByMonth(year: number, month: number): DiaryEntry[] {
  const entries = getAllEntries();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return entries.filter(e => e.date.startsWith(prefix));
}

export function saveEntry(entry: DiaryEntry): void {
  const entries = getAllEntries();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) {
    entries[idx] = { ...entry, updatedAt: new Date().toISOString() };
  } else {
    entries.push({ ...entry, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  // 同步 Plans 数据
  syncPlansFromEntry(entry);
}

export function deleteEntry(date: string): void {
  const target = getEntryByDate(date);
  const entries = getAllEntries().filter(e => e.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  // 同步清理 PlansStore 里来自该日记的孤儿条目
  if (target) {
    const plans = getPlans();
    const idsToRemove = new Set([
      ...target.nextDayPlans.map(i => i.id),
      ...target.wantToDo.map(i => i.id),
      ...target.longTermPlans.map(i => i.id),
    ]);
    plans.nextDayPlans = plans.nextDayPlans.filter(p => !idsToRemove.has(p.id));
    plans.wantToDo = plans.wantToDo.filter(p => !idsToRemove.has(p.id));
    plans.longTermPlans = plans.longTermPlans.filter(p => !idsToRemove.has(p.id));
    savePlans(plans);
  }
}

// ===== Plans 独立存储（聚合所有日记中的次日计划/种草/长期计划）=====

export type PlanCategory = 'nextDayPlans' | 'wantToDo' | 'longTermPlans';

export interface PlansStore {
  nextDayPlans: (TodoItem & { sourceDate?: string })[];
  wantToDo: (TodoItem & { sourceDate?: string })[];
  longTermPlans: (TodoItem & { sourceDate?: string })[];
}

export function getPlans(): PlansStore {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (!raw) return { nextDayPlans: [], wantToDo: [], longTermPlans: [] };
    const parsed = JSON.parse(raw) as Partial<PlansStore>;
    // 向后兼容:老数据可能没有 nextDayPlans 字段
    return {
      nextDayPlans: parsed.nextDayPlans ?? [],
      wantToDo: parsed.wantToDo ?? [],
      longTermPlans: parsed.longTermPlans ?? [],
    };
  } catch {
    return { nextDayPlans: [], wantToDo: [], longTermPlans: [] };
  }
}

export function savePlans(plans: PlansStore): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

// 从日记条目同步 Plans
function syncPlansFromEntry(entry: DiaryEntry): void {
  const plans = getPlans();
  const categories: PlanCategory[] = ['nextDayPlans', 'wantToDo', 'longTermPlans'];

  categories.forEach(cat => {
    entry[cat].forEach(item => {
      const existing = plans[cat].find(p => p.id === item.id);
      if (existing) {
        Object.assign(existing, item);
      } else {
        plans[cat].push({ ...item, sourceDate: entry.date });
      }
    });
  });

  savePlans(plans);
}

// 从 Plans 更新回日记条目
export function updatePlanItemInEntry(
  itemId: string,
  type: PlanCategory,
  updates: Partial<TodoItem>
): void {
  const entries = getAllEntries();
  let changed = false;
  entries.forEach(entry => {
    const items = entry[type];
    const item = items.find(i => i.id === itemId);
    if (item) {
      Object.assign(item, updates);
      entry.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

// 从 Plans 和源 entry 同时删除某个条目,避免再次保存时被同步回来
export function deletePlanItem(
  itemId: string,
  type: PlanCategory
): void {
  // 从 PlansStore 删除
  const plans = getPlans();
  plans[type] = plans[type].filter(p => p.id !== itemId);
  savePlans(plans);

  // 从所有源 entry 中删除
  const entries = getAllEntries();
  let changed = false;
  entries.forEach(entry => {
    const before = entry[type].length;
    entry[type] = entry[type].filter(i => i.id !== itemId);
    if (entry[type].length !== before) {
      entry.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

// ===== 工具函数 =====

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${weekdays[date.getDay()]}`;
}

export function getEnergyColor(energy: number): string {
  if (energy <= 3) return '#64B5F6';
  if (energy <= 6) return '#FFB74D';
  if (energy <= 8) return '#FF7043';
  return '#FF5252';
}

export function getEnergyLabel(energy: number): string {
  if (energy <= 2) return '低迷';
  if (energy <= 4) return '平淡';
  if (energy <= 6) return '还好';
  if (energy <= 8) return '充实';
  return '满满当当';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
