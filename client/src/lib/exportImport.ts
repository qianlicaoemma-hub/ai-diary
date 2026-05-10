// ===== 数据导出 / 导入 =====
// 设计:
// - CSV 用于导出到 Excel / 飞书表格人工查看
// - JSON 用于完整备份 / 恢复(包含 entries + plans)

import {
  DiaryEntry,
  TodoItem,
  PlansStore,
  getAllEntries,
  getPlans,
  savePlans,
  parseDate,
} from './storage';

const STORAGE_KEY = 'ai-diary-entries';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// ---------- CSV ----------

/** CSV 字段转义:含逗号/引号/换行的字段用双引号包裹,内部双引号转义为两个 */
function csvEscape(value: string): string {
  const s = value ?? '';
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function todosToText(items: TodoItem[]): string {
  if (!items?.length) return '';
  return items.map(t => `${t.done ? '☑ ' : '☐ '}${t.text}`).join('\n');
}

/** 生成 CSV 文本(UTF-8 with BOM,Excel 才能正确识别中文) */
export function buildEntriesCSV(entries: DiaryEntry[]): string {
  const headers = [
    '日期',
    '星期',
    '今日重点',
    '记忆片段',
    '能量',
    '重要收获',
    '种草/想做',
    '次日计划',
    '长期计划',
  ];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted.map(e => {
    const weekday = WEEKDAYS[parseDate(e.date).getDay()];
    return [
      e.date,
      `周${weekday}`,
      e.mainEvent,
      e.memories,
      e.energy?.toFixed?.(1) ?? String(e.energy ?? ''),
      e.gains,
      todosToText(e.wantToDo),
      todosToText(e.nextDayPlans),
      todosToText(e.longTermPlans),
    ].map(v => csvEscape(String(v ?? ''))).join(',');
  });

  // BOM 让 Excel 正确识别 UTF-8
  return '﻿' + [headers.join(','), ...rows].join('\n');
}

// ---------- JSON 备份 ----------

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  entries: DiaryEntry[];
  plans: PlansStore;
}

export function buildBackupJSON(): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: getAllEntries(),
    plans: getPlans(),
  };
}

/**
 * 从备份恢复
 * mode: 'replace' 完全覆盖 / 'merge' 按日期合并(导入的优先)
 * 返回:本次写入的 entry 数量
 */
export function restoreFromBackup(
  payload: unknown,
  mode: 'replace' | 'merge' = 'merge'
): { entries: number; mode: typeof mode } {
  if (!payload || typeof payload !== 'object') {
    throw new Error('备份文件格式不正确');
  }
  const p = payload as Partial<BackupPayload>;
  if (!Array.isArray(p.entries)) {
    throw new Error('备份文件缺少 entries 字段');
  }

  let finalEntries: DiaryEntry[];
  if (mode === 'replace') {
    finalEntries = p.entries;
  } else {
    // 合并:按 date 去重,导入数据覆盖现有
    const incomingByDate = new Map(p.entries.map(e => [e.date, e]));
    const existing = getAllEntries();
    const merged: DiaryEntry[] = [];
    const seen = new Set<string>();
    existing.forEach(e => {
      if (incomingByDate.has(e.date)) {
        merged.push(incomingByDate.get(e.date)!);
      } else {
        merged.push(e);
      }
      seen.add(e.date);
    });
    p.entries.forEach(e => {
      if (!seen.has(e.date)) merged.push(e);
    });
    finalEntries = merged;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(finalEntries));

  // plans 直接覆盖(基于 entry id 关联,不易冲突)
  if (p.plans && typeof p.plans === 'object') {
    savePlans({
      nextDayPlans: p.plans.nextDayPlans ?? [],
      wantToDo: p.plans.wantToDo ?? [],
      longTermPlans: p.plans.longTermPlans ?? [],
    });
  }

  return { entries: finalEntries.length, mode };
}

// ---------- 浏览器下载 ----------

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟 revoke,避免某些浏览器尚未触发下载
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
