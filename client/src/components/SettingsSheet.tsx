// ===== 设置抽屉:数据导出 / 导入 =====
// 触发器在 PlansPage 头部右上角

import { useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  buildEntriesCSV,
  buildBackupJSON,
  restoreFromBackup,
  downloadFile,
  todayStamp,
} from '@/lib/exportImport';
import { getAllEntries } from '@/lib/storage';
import { toast } from 'sonner';

export default function SettingsSheet() {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    const entries = getAllEntries();
    if (entries.length === 0) {
      toast.error('还没有日记记录可导出');
      return;
    }
    const csv = buildEntriesCSV(entries);
    downloadFile(`ai-diary-${todayStamp()}.csv`, csv, 'text/csv;charset=utf-8');
    toast.success(`已导出 ${entries.length} 条日记 (CSV)`);
  };

  const handleExportJSON = () => {
    const payload = buildBackupJSON();
    if (payload.entries.length === 0) {
      toast.error('还没有任何数据可备份');
      return;
    }
    const json = JSON.stringify(payload, null, 2);
    downloadFile(
      `ai-diary-backup-${todayStamp()}.json`,
      json,
      'application/json'
    );
    toast.success(`已备份 ${payload.entries.length} 条日记`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 清掉 input,允许下次重选同名文件
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const existing = getAllEntries().length;
      const incoming = Array.isArray(payload?.entries) ? payload.entries.length : 0;
      const confirmed = window.confirm(
        `准备从备份恢复\n\n` +
        `当前本地:${existing} 条日记\n` +
        `备份文件:${incoming} 条日记\n\n` +
        `点「确定」按日期合并(同一天以备份为准),取消则放弃恢复。`
      );
      if (!confirmed) return;

      const result = restoreFromBackup(payload, 'merge');
      toast.success(`恢复完成,当前共 ${result.entries} 条日记`);
      setOpen(false);
      // 刷新页面让所有视图都重新读 localStorage
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error('[Import] error', err);
      const msg = err instanceof Error ? err.message : '未知错误';
      toast.error(`恢复失败:${msg}`);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="导出 / 备份"
            className="h-9 px-3 rounded-full bg-white/90 border border-orange-100 flex items-center gap-1.5 text-[#8B6355] hover:bg-orange-50 hover:border-orange-200 transition-colors shadow-sm text-xs font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>导出/备份</span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[88vw] max-w-[400px] sm:max-w-[400px] bg-[#FFF8F0]">
          <SheetHeader>
            <SheetTitle className="text-[#2D1B0E]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              📥 导出 / 备份
            </SheetTitle>
            <SheetDescription className="text-[#8B6355] text-xs">
              所有日记仅保存在本浏览器。建议定期导出 JSON 备份以防丢失。
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-3">
            {/* 导出 CSV */}
            <button
              onClick={handleExportCSV}
              className="w-full text-left bg-white border border-orange-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2D1B0E]">导出表格 (CSV)</p>
                  <p className="text-xs text-[#8B6355] mt-0.5">
                    可用 Excel / 飞书表格直接打开,字段与你的手账格式对齐
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6355" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
            </button>

            {/* 导出 JSON 备份 */}
            <button
              onClick={handleExportJSON}
              className="w-full text-left bg-white border border-orange-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2D1B0E]">完整备份 (JSON)</p>
                  <p className="text-xs text-[#8B6355] mt-0.5">
                    所有日记 + 计划清单的完整快照,用于恢复
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6355" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
            </button>

            {/* 从备份恢复 */}
            <button
              onClick={handleImportClick}
              className="w-full text-left bg-white border border-orange-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2D1B0E]">从备份恢复</p>
                  <p className="text-xs text-[#8B6355] mt-0.5">
                    选择之前导出的 JSON 文件,按日期合并(同一天以备份为准)
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6355" strokeWidth="2">
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                </svg>
              </div>
            </button>

            {/* 数据存储说明 */}
            <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3 mt-2">
              <p className="text-xs font-semibold text-[#8B6355] mb-1">📍 关于数据安全</p>
              <ul className="text-[11px] text-[#8B6355] space-y-1 list-disc list-inside leading-relaxed">
                <li>所有日记仅存在你这台浏览器,不上传到任何服务器</li>
                <li>清浏览器缓存 / 换浏览器会看不到旧数据</li>
                <li>建议每周或每月导出一次 JSON 备份</li>
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
