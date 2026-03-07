"use client";

import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

export type WorkspaceTabId = "materials" | "modules" | "students" | "assessment" | "analytics";

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
  badge?: string;
}

interface WorkspaceSidebarProps {
  collapsed: boolean;
  tabs: WorkspaceTab[];
  activeTab: WorkspaceTabId;
  onToggleCollapsed: (collapsed: boolean) => void;
  onSelectTab: (tab: WorkspaceTabId) => void;
}

export default function WorkspaceSidebar({
  collapsed,
  tabs,
  activeTab,
  onToggleCollapsed,
  onSelectTab,
}: WorkspaceSidebarProps) {
  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20 transition-all duration-300 dark:border-slate-700 dark:bg-slate-900 ${
        collapsed ? "p-2" : "p-3"
      }`}
    >
      {collapsed ? (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onToggleCollapsed(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-100 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/35 dark:hover:bg-slate-800 dark:hover:shadow-black/50"
            aria-label="Tampilkan sidebar ruang kelas"
            title="Tampilkan sidebar ruang kelas"
          >
            <FiChevronsRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ruang Kelas</p>
            <button
              type="button"
              onClick={() => onToggleCollapsed(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Sembunyikan sidebar ruang kelas"
              title="Sembunyikan sidebar ruang kelas"
            >
              <FiChevronsLeft size={14} />
            </button>
          </div>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`group relative block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.id ? "bg-slate-900 text-white shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <span
                  className={`absolute inset-y-1 left-1 w-1 rounded-full transition ${
                    activeTab === tab.id ? "bg-white/90 dark:bg-slate-200/90" : "bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600"
                  }`}
                />
                <span className="ml-2 flex items-center justify-between gap-2">
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={`workspace-tab-badge inline-flex min-w-[20px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        activeTab === tab.id
                          ? "workspace-tab-badge-active border border-white/20 bg-white/20 text-white dark:border-slate-500/60 dark:bg-slate-600 dark:text-slate-100"
                          : "border border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}
