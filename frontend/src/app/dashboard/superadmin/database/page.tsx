"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight, FiDatabase, FiEdit2, FiEye, FiEyeOff, FiFile, FiFilm, FiGrid, FiImage, FiInfo, FiList, FiMusic, FiPackage, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";

type DatabaseColumn = {
  name: string;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  default_value?: string | null;
  is_primary_key: boolean;
  is_editable: boolean;
};

type DatabaseTableSummary = {
  name: string;
  row_count: number;
  column_count: number;
  primary_key_columns: string[];
  supports_crud: boolean;
  columns: DatabaseColumn[];
};

type DatabaseRowsResponse = {
  table: string;
  page: number;
  size: number;
  total: number;
  columns: DatabaseColumn[];
  primary_key_columns: string[];
  rows: Record<string, unknown>[];
};

type MediaItem = {
  name: string;
  path: string;
  category: "gambar" | "video" | "audio" | "dokumen" | "arsip" | "lainnya";
  extension: string;
  size: number;
  modified_at: string;
  mime_type: string;
};

type DatabaseForeignKey = {
  constraint_name: string;
  source_table: string;
  source_columns: string[];
  target_table: string;
  target_columns: string[];
  delete_rule: string;
  update_rule: string;
};

type DatabaseResetAnalysis = {
  selected_tables: string[];
  recommended_tables: string[];
  delete_order: string[];
  blocking_references: DatabaseForeignKey[];
  related_references: DatabaseForeignKey[];
  potential_errors: string[];
  recommendations: string[];
  cycles?: string[][];
};

type RowModalState =
  | { mode: "create"; row: null }
  | { mode: "edit"; row: Record<string, unknown> };

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toDraftValue(column: DatabaseColumn, value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function buildRowKeys(row: Record<string, unknown>, keys: string[]) {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = row[key];
    return acc;
  }, {});
}

function buildRowSelectionKey(row: Record<string, unknown>, keys: string[], fallbackIndex: number) {
  if (keys.length === 0) return `row-${fallbackIndex}`;
  return keys.map((key) => `${key}:${String(row[key] ?? "")}`).join("|");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)].sort();
}

function isProtectedSuperadminRow(tableName: string, row: Record<string, unknown>) {
  if (tableName !== "users") return false;
  return String(row.peran ?? "").toLowerCase() === "superadmin";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function mediaCategoryIcon(category: MediaItem["category"]) {
  switch (category) {
    case "gambar":
      return FiImage;
    case "video":
      return FiFilm;
    case "audio":
      return FiMusic;
    case "arsip":
      return FiPackage;
    default:
      return FiFile;
  }
}

export default function SuperadminDatabasePage() {
  const [activeWorkspace, setActiveWorkspace] = useState<"tables" | "media" | null>(null);
  const [tablesCollapsed, setTablesCollapsed] = useState(true);
  const [mediaCollapsed, setMediaCollapsed] = useState(true);
  const [tables, setTables] = useState<DatabaseTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [rowsData, setRowsData] = useState<DatabaseRowsResponse | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaCategory, setMediaCategory] = useState<"semua" | "gambar" | "video" | "audio" | "dokumen" | "arsip" | "lainnya">("semua");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaViewMode, setMediaViewMode] = useState<"album" | "list">("album");
  const [mediaSortBy, setMediaSortBy] = useState<"name" | "modified_at" | "size">("modified_at");
  const [mediaSortDir, setMediaSortDir] = useState<"asc" | "desc">("desc");
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPageSizeMode, setMediaPageSizeMode] = useState<"15" | "25" | "50" | "custom">("25");
  const [mediaCustomPageSize, setMediaCustomPageSize] = useState("25");
  const [selectedMediaNames, setSelectedMediaNames] = useState<string[]>([]);
  const [mediaDeleteTarget, setMediaDeleteTarget] = useState<MediaItem | null>(null);
  const [mediaPreviewTarget, setMediaPreviewTarget] = useState<MediaItem | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSizeMode, setPageSizeMode] = useState<"15" | "25" | "50" | "all" | "custom">("25");
  const [customPageSize, setCustomPageSize] = useState("25");
  const [modal, setModal] = useState<RowModalState | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown>[] | null>(null);
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false);
  const [resetDrawerOpen, setResetDrawerOpen] = useState(false);
  const [selectedTablesForReset, setSelectedTablesForReset] = useState<string[]>([]);
  const [resetAnalysis, setResetAnalysis] = useState<DatabaseResetAnalysis | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database/tables", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal memuat daftar tabel");
      const nextTables = Array.isArray(data?.tables) ? data.tables : [];
      setTables(nextTables);
      setSelectedTable((prev) => prev || nextTables[0]?.name || "");
      setSelectedTablesForReset((prev) => prev.filter((item) => nextTables.some((table: DatabaseTableSummary) => table.name === item)));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal memuat daftar tabel"));
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const selectedTableMeta = useMemo(
    () => tables.find((table) => table.name === selectedTable) || null,
    [selectedTable, tables]
  );

  const loadRows = useCallback(async () => {
    if (!selectedTable) {
      setRowsData(null);
      return;
    }
    setRowsLoading(true);
    setError(null);
    try {
      const resolvedPageSize =
        pageSizeMode === "all"
          ? Math.min(200, Math.max(1, selectedTableMeta?.row_count || rowsData?.total || 200))
          : pageSizeMode === "custom"
            ? Math.min(200, Math.max(1, Number.parseInt(customPageSize || "25", 10) || 25))
            : Number.parseInt(pageSizeMode, 10);
      const params = new URLSearchParams({
        page: String(page),
        size: String(resolvedPageSize),
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/database/${selectedTable}?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal memuat data tabel");
      setRowsData(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal memuat data tabel"));
    } finally {
      setRowsLoading(false);
    }
  }, [customPageSize, page, pageSizeMode, query, rowsData?.total, selectedTable, selectedTableMeta?.row_count]);

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      const params = new URLSearchParams();
      if (mediaCategory !== "semua") params.set("category", mediaCategory);
      if (mediaQuery.trim()) params.set("q", mediaQuery.trim());
      const res = await fetch(`/api/admin/media?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal memuat media");
      setMediaItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal memuat media");
      setError(message);
      setMediaError(message);
    } finally {
      setMediaLoading(false);
    }
  }, [mediaCategory, mediaQuery]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (activeWorkspace === "media") {
      void loadMedia();
    }
  }, [activeWorkspace, loadMedia]);

  useEffect(() => {
    setSelectedMediaNames((prev) => prev.filter((name) => mediaItems.some((item) => item.name === name)));
  }, [mediaItems]);

  const effectiveMediaPageSize = useMemo(() => {
    if (mediaPageSizeMode === "custom") {
      return Math.max(1, Number.parseInt(mediaCustomPageSize || "25", 10) || 25);
    }
    return Number.parseInt(mediaPageSizeMode, 10);
  }, [mediaCustomPageSize, mediaPageSizeMode]);

  const resetRecommendedExtras = useMemo(() => {
    if (!resetAnalysis) return [];
    const selected = new Set(resetAnalysis.selected_tables);
    return resetAnalysis.recommended_tables.filter((table) => !selected.has(table));
  }, [resetAnalysis]);

  const allTablesSelected = tables.length > 0 && selectedTablesForReset.length === tables.length;
  const effectivePageSize = useMemo(() => {
    if (pageSizeMode === "all") return "all";
    if (pageSizeMode === "custom") {
      return String(Math.min(200, Math.max(1, Number.parseInt(customPageSize || "25", 10) || 25)));
    }
    return pageSizeMode;
  }, [customPageSize, pageSizeMode]);
  const currentRowKeys = useMemo(() => {
    if (!rowsData) return [];
    return rowsData.rows.map((row, idx) => buildRowSelectionKey(row, rowsData.primary_key_columns, idx));
  }, [rowsData]);
  const selectedRowRecords = useMemo(() => {
    if (!rowsData) return [];
    const selectedSet = new Set(selectedRowKeys);
    return rowsData.rows.filter((row, idx) =>
      selectedSet.has(buildRowSelectionKey(row, rowsData.primary_key_columns, idx))
    );
  }, [rowsData, selectedRowKeys]);
  const allVisibleRowsSelected = currentRowKeys.length > 0 && currentRowKeys.every((key) => selectedRowKeys.includes(key));
  const selectedRowsContainProtectedSuperadmin = useMemo(
    () => selectedTable === "users" && selectedRowRecords.some((row) => isProtectedSuperadminRow(selectedTable, row)),
    [selectedRowRecords, selectedTable]
  );
  const sortedMediaItems = useMemo(() => {
    const items = [...mediaItems];
    items.sort((a, b) => {
      let cmp = 0;
      if (mediaSortBy === "name") cmp = a.name.localeCompare(b.name);
      if (mediaSortBy === "modified_at") cmp = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime();
      if (mediaSortBy === "size") cmp = a.size - b.size;
      return mediaSortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [mediaItems, mediaSortBy, mediaSortDir]);
  const totalMediaPages = Math.max(1, Math.ceil(sortedMediaItems.length / effectiveMediaPageSize));
  const pagedMediaItems = useMemo(() => {
    const start = (mediaPage - 1) * effectiveMediaPageSize;
    return sortedMediaItems.slice(start, start + effectiveMediaPageSize);
  }, [effectiveMediaPageSize, mediaPage, sortedMediaItems]);
  const allVisibleMediaSelected = pagedMediaItems.length > 0 && pagedMediaItems.every((item) => selectedMediaNames.includes(item.name));
  const selectedMediaItems = useMemo(
    () => sortedMediaItems.filter((item) => selectedMediaNames.includes(item.name)),
    [selectedMediaNames, sortedMediaItems]
  );

  useEffect(() => {
    setMediaPage(1);
  }, [effectiveMediaPageSize, mediaCategory, mediaQuery, mediaSortBy, mediaSortDir]);

  useEffect(() => {
    if (mediaPage > totalMediaPages) {
      setMediaPage(totalMediaPages);
    }
  }, [mediaPage, totalMediaPages]);

  const toggleResetTable = (tableName: string) => {
    setSelectedTablesForReset((prev) =>
      prev.includes(tableName) ? prev.filter((item) => item !== tableName) : [...prev, tableName].sort()
    );
  };

  const openResetModal = () => {
    const nextTables = uniqueStrings(
      selectedTablesForReset.length > 0
        ? selectedTablesForReset
        : selectedTable
          ? [selectedTable]
          : []
    );
    setSelectedTablesForReset(nextTables);
    setResetAnalysis(null);
    setResetError(null);
    setResetPasswordVisible(false);
    setResetDrawerOpen(true);
    if (nextTables.length > 0) {
      void runResetAnalysis(nextTables);
    }
  };

  const toggleRowSelection = (row: Record<string, unknown>, index: number) => {
    if (!rowsData) return;
    const key = buildRowSelectionKey(row, rowsData.primary_key_columns, index);
    setSelectedRowKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const toggleAllVisibleRows = () => {
    if (!rowsData) return;
    setSelectedRowKeys((prev) => {
      if (allVisibleRowsSelected) {
        return prev.filter((key) => !currentRowKeys.includes(key));
      }
      return uniqueStrings([...prev, ...currentRowKeys]);
    });
  };

  const openCreateModal = () => {
    if (!rowsData) return;
    const nextDraft: Record<string, string> = {};
    rowsData.columns.forEach((column) => {
      nextDraft[column.name] = "";
    });
    setDraft(nextDraft);
    setModal({ mode: "create", row: null });
  };

  const openEditModal = (row: Record<string, unknown>) => {
    if (!rowsData) return;
    const nextDraft: Record<string, string> = {};
    rowsData.columns.forEach((column) => {
      nextDraft[column.name] = toDraftValue(column, row[column.name]);
    });
    setDraft(nextDraft);
    setModal({ mode: "edit", row });
  };

  const closeModal = () => {
    setModal(null);
    setDraft({});
  };

  const submitRow = async () => {
    if (!rowsData || !modal) return;
    setSaving(true);
    setError(null);
    try {
      const values = rowsData.columns.reduce<Record<string, string>>((acc, column) => {
        if (!column.is_editable) return acc;
        if (modal.mode === "edit" && column.is_primary_key) return acc;
        acc[column.name] = draft[column.name] ?? "";
        return acc;
      }, {});

      const payload =
        modal.mode === "create"
          ? { values }
          : {
              keys: buildRowKeys(modal.row, rowsData.primary_key_columns),
              values,
            };

      const res = await fetch(`/api/admin/database/${rowsData.table}/rows`, {
        method: modal.mode === "create" ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal menyimpan row");
      closeModal();
      void loadTables();
      void loadRows();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal menyimpan row"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rowsData || !deleteTarget) return;
    setSaving(true);
    setError(null);
    setDeleteError(null);
    try {
      for (const target of deleteTarget) {
        const res = await fetch(`/api/admin/database/${rowsData.table}/rows`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keys: buildRowKeys(target, rowsData.primary_key_columns),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Gagal menghapus row");
      }
      setDeleteTarget(null);
      setSelectedRowKeys([]);
      void loadTables();
      void loadRows();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal menghapus row");
      setError(message);
      setDeleteError(message);
    } finally {
      setSaving(false);
    }
  };

  const runResetAnalysis = async (tablesToAnalyze?: string[]) => {
    const fallbackTables =
      selectedTablesForReset.length > 0
        ? selectedTablesForReset
        : selectedTable
          ? [selectedTable]
          : [];
    const tables = uniqueStrings(tablesToAnalyze ?? fallbackTables);
    if (tables.length === 0) {
      const message = "Pilih minimal satu tabel untuk dianalisis.";
      setError(message);
      setResetError(message);
      return;
    }
    setSelectedTablesForReset(tables);
    setResetLoading(true);
    setError(null);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/database/reset-analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal menganalisis reset tabel");
      setResetAnalysis(data);
      setResetDrawerOpen(true);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal menganalisis reset tabel");
      setError(message);
      setResetError(message);
    } finally {
      setResetLoading(false);
    }
  };

  const executeReset = async () => {
    if (!resetAnalysis) return;
    setSaving(true);
    setError(null);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/database/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: resetAnalysis.selected_tables, password: resetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal reset tabel");
      setConfirmResetOpen(false);
      setResetDrawerOpen(false);
      setResetAnalysis(null);
      setSelectedTablesForReset([]);
      setResetPassword("");
      setResetPasswordVisible(false);
      void loadTables();
      void loadRows();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal reset tabel");
      setError(message);
      setResetError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!mediaDeleteTarget) return;
    setSaving(true);
    setMediaError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mediaDeleteTarget.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal menghapus media");
      setMediaDeleteTarget(null);
      setSelectedMediaNames((prev) => prev.filter((name) => name !== mediaDeleteTarget.name));
      void loadMedia();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal menghapus media");
      setError(message);
      setMediaError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelectedMedia = async () => {
    if (selectedMediaItems.length === 0) return;
    setSaving(true);
    setMediaError(null);
    try {
      for (const item of selectedMediaItems) {
        const res = await fetch("/api/admin/media", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Gagal menghapus media ${item.name}`);
      }
      setSelectedMediaNames([]);
      void loadMedia();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Gagal menghapus media terpilih");
      setError(message);
      setMediaError(message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = rowsData ? Math.max(1, Math.ceil(rowsData.total / rowsData.size)) : 1;

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, query, selectedTable, effectivePageSize]);

  return (
    <div className="superadmin-database-view mx-auto max-w-screen-2xl space-y-6 overflow-x-hidden">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <FiDatabase />
              Superadmin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Manajemen Database</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Jelajahi semua tabel database, lihat tipe kolomnya, lalu lakukan create, update, dan delete langsung dari panel superadmin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadTables();
              void loadRows();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="space-y-4">
            <section className={`rounded-2xl border p-3 transition ${
              activeWorkspace === "tables"
                ? "border-sky-400/60 bg-sky-500/10 dark:border-sky-400/60 dark:!bg-sky-950/40"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:!bg-slate-950"
            }`}>
              <button
                type="button"
                onClick={() => {
                  setTablesCollapsed((prev) => {
                    const next = !prev;
                    setActiveWorkspace(!next ? "tables" : activeWorkspace === "tables" ? null : activeWorkspace);
                    return next;
                  });
                }}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daftar Tabel</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tables.length} tabel database</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pr-2">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:!bg-slate-800 dark:!text-slate-100">
                    {tables.length}
                  </span>
                  {tablesCollapsed ? <FiChevronRight className="shrink-0 text-slate-300" /> : <FiChevronDown className="shrink-0 text-slate-300" />}
                </div>
              </button>
              {!tablesCollapsed && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-slate-600 dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedTablesForReset(allTablesSelected ? [] : tables.map((table) => table.name))}
                      className="inline-flex items-start gap-2 text-left font-medium text-slate-700 transition hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={allTablesSelected}
                        readOnly
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:checked:border-sky-400 dark:checked:bg-sky-500"
                      />
                      <span className="dark:text-slate-100">{selectedTablesForReset.length} items selected</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTablesForReset([])}
                      className="font-medium text-slate-600 hover:underline dark:text-slate-100"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tablesLoading ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Memuat daftar tabel...
                      </div>
                    ) : (
                      tables.map((table) => {
                        const active = activeWorkspace === "tables" && table.name === selectedTable;
                        return (
                          <button
                            key={table.name}
                            type="button"
                            onClick={() => {
                              setActiveWorkspace("tables");
                              setSelectedTable(table.name);
                              setTablesCollapsed(false);
                              setPage(1);
                              setQuery("");
                            }}
                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400/80 dark:bg-sky-950/60 dark:text-sky-50"
                                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTablesForReset.includes(table.name)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleResetTable(table.name);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:checked:border-sky-400 dark:checked:bg-sky-500"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{table.name}</p>
                                  <p className={`mt-1 text-xs ${active ? "text-slate-200 dark:text-sky-100/80" : "text-slate-500 dark:text-slate-400"}`}>
                                    {table.column_count} kolom
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  active
                                    ? "bg-white/15 text-white dark:bg-sky-400/15 dark:text-sky-50"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}>
                                  {table.row_count}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </section>

            <section className={`rounded-2xl border p-3 transition ${
              activeWorkspace === "media"
                ? "border-sky-400/60 bg-sky-500/10 dark:border-sky-400/60 dark:!bg-sky-950/40"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:!bg-slate-950"
            }`}>
              <button
                type="button"
                onClick={() => {
                  setMediaCollapsed((prev) => {
                    const next = !prev;
                    setActiveWorkspace(!next ? "media" : activeWorkspace === "media" ? null : activeWorkspace);
                    return next;
                  });
                }}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Media</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload file: gambar, video, dokumen, audio, arsip</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pr-2">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:!bg-slate-800 dark:!text-slate-100">
                    {mediaItems.length}
                  </span>
                  {mediaCollapsed ? <FiChevronRight className="shrink-0 text-slate-300" /> : <FiChevronDown className="shrink-0 text-slate-300" />}
                </div>
              </button>
              {!mediaCollapsed && (
                <div className="mt-3 space-y-2">
                  {["gambar", "video", "dokumen", "audio", "arsip", "lainnya"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setActiveWorkspace("media");
                        setMediaCollapsed(false);
                        setMediaCategory(item as typeof mediaCategory);
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                        activeWorkspace === "media" && mediaCategory === item
                          ? "border-sky-400/60 bg-sky-950/60 text-sky-50"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                      }`}
                    >
                      <span className="min-w-0 flex-1 pr-3 capitalize">{item}</span>
                      <FiChevronRight className="shrink-0 text-xs opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          {activeWorkspace === "tables" ? (
          <div className="grid min-w-0 gap-6">
            <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTableMeta?.name || "Pilih tabel"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedTableMeta
                      ? `${selectedTableMeta.row_count} row, ${selectedTableMeta.column_count} kolom`
                      : "Pilih tabel dari sidebar kiri untuk melihat isinya."}
                  </p>
                </div>
                {selectedTableMeta && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSchemaDrawerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100 dark:hover:bg-[#16355f]"
                    >
                      <FiInfo />
                      Skema
                    </button>
                    <button
                      type="button"
                      onClick={openResetModal}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                    >
                      <FiTrash2 />
                      Reset Database
                    </button>
                    {selectedTableMeta.supports_crud && (
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-[#0d2749] dark:text-slate-100 dark:hover:bg-[#16355f]"
                    >
                      <FiPlus />
                      Tambah Row
                    </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="relative flex-1 min-w-[260px]">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari isi row..."
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-[#0d2749]">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tampil</span>
                  <select
                    value={pageSizeMode}
                    onChange={(e) => {
                      const next = e.target.value as typeof pageSizeMode;
                      setPageSizeMode(next);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="15">15</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="all">All</option>
                    <option value="custom">Custom</option>
                  </select>
                  {pageSizeMode === "custom" && (
                    <input
                      value={customPageSize}
                      onChange={(e) => {
                        setCustomPageSize(e.target.value.replace(/[^\d]/g, ""));
                        setPage(1);
                      }}
                      placeholder="angka"
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void loadRows()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100 dark:hover:bg-[#16355f]"
                >
                  <FiRefreshCw />
                  Muat Ulang
                </button>
              </div>

              <div className="mt-5 w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-[#0d2749]">
                    <tr>
                      <th className="w-12 px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allVisibleRowsSelected}
                          onChange={toggleAllVisibleRows}
                          className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:checked:border-sky-400 dark:checked:bg-sky-500"
                        />
                      </th>
                      {(rowsData?.columns || []).map((column) => (
                        <th key={column.name} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {column.name}
                        </th>
                      ))}
                      {rowsData?.primary_key_columns.length && selectedRowRecords.length === 0 ? (
                        <th className="sticky right-0 z-10 bg-slate-50 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-slate-950 dark:text-slate-400">
                          Aksi
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-[#081a33]">
                    {rowsLoading ? (
                      <tr>
                        <td
                          colSpan={(rowsData?.columns.length || 1) + 1 + (rowsData?.primary_key_columns.length && selectedRowRecords.length === 0 ? 1 : 0)}
                          className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                        >
                          Memuat data tabel...
                        </td>
                      </tr>
                    ) : rowsData?.rows.length ? (
                      rowsData.rows.map((row, idx) => {
                        const rowKey = buildRowSelectionKey(row, rowsData.primary_key_columns, idx);
                        const rowSelected = selectedRowKeys.includes(rowKey);
                        const rowDeleteBlocked = isProtectedSuperadminRow(rowsData.table, row);
                        return (
                          <tr
                            key={rowKey}
                            className={`align-top transition ${rowSelected ? "bg-sky-50/70 dark:bg-sky-500/10" : ""}`}
                          >
                            <td className="px-3 py-3 align-top">
                              <input
                                type="checkbox"
                                checked={rowSelected}
                                onChange={() => toggleRowSelection(row, idx)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:checked:border-sky-400 dark:checked:bg-sky-500"
                              />
                            </td>
                            {rowsData.columns.map((column) => (
                              <td key={column.name} className="max-w-[280px] px-3 py-3 text-slate-700 dark:text-slate-200">
                                <div className="truncate">
                                  {typeof row[column.name] === "object" && row[column.name] !== null
                                    ? JSON.stringify(row[column.name])
                                    : String(row[column.name] ?? "")}
                                </div>
                              </td>
                            ))}
                            {rowsData.primary_key_columns.length && selectedRowRecords.length === 0 ? (
                              <td className="sticky right-0 z-10 bg-white px-3 py-3 shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-slate-900">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    <FiEdit2 />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteError(null);
                                      setDeleteTarget([row]);
                                    }}
                                    disabled={rowDeleteBlocked}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                                    title={rowDeleteBlocked ? "Role superadmin tidak boleh dihapus" : "Hapus row"}
                                  >
                                    <FiTrash2 />
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={(rowsData?.columns.length || 1) + 1 + (rowsData?.primary_key_columns.length && selectedRowRecords.length === 0 ? 1 : 0)}
                          className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                        >
                          Tidak ada data untuk ditampilkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedRowRecords.length > 0 && rowsData?.primary_key_columns.length ? (
                <div className="pointer-events-none sticky bottom-4 z-20 mt-4 flex justify-end">
                  <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {selectedRowRecords.length} row dipilih
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRowRecords.length === 1) openEditModal(selectedRowRecords[0]);
                      }}
                      disabled={selectedRowRecords.length !== 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      <FiEdit2 />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(selectedRowRecords);
                      }}
                      disabled={selectedRowsContainProtectedSuperadmin}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:text-red-300"
                      title={selectedRowsContainProtectedSuperadmin ? "Selection berisi role superadmin yang tidak boleh dihapus" : "Hapus row terpilih"}
                    >
                      <FiTrash2 />
                      Hapus
                    </button>
                  </div>
                </div>
              ) : null}

              {rowsData && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Menampilkan {rowsData.rows.length} dari total {rowsData.total} row. Mode: {effectivePageSize === "all" ? "All" : `${rowsData.size} per halaman`}.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1 || effectivePageSize === "all"}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {rowsData.page}/{totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages || effectivePageSize === "all"}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
          ) : activeWorkspace === "media" ? (
          <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#081a33]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Media Uploads</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Kelola file upload dari folder `backend/uploads`, lihat berdasarkan kategori, lalu hapus bila perlu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadMedia()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100 dark:hover:bg-[#16355f]"
              >
                <FiRefreshCw />
                Refresh Media
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="relative flex-1 min-w-[260px]">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={mediaQuery}
                  onChange={(e) => setMediaQuery(e.target.value)}
                  placeholder="Cari nama file..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {(["semua", "gambar", "video", "dokumen", "audio", "arsip", "lainnya"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMediaCategory(item)}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                      mediaCategory === item
                        ? "bg-slate-900 text-white dark:bg-sky-500/20 dark:text-sky-50"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d2749] dark:text-slate-100 dark:hover:bg-[#16355f]"
                    }`}
                  >
                    {item === "semua" ? "Semua" : item}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-[#0d2749]">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">View</span>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-600 dark:bg-[#081a33]">
                  <button
                    type="button"
                    onClick={() => setMediaViewMode("album")}
                    className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-sm transition ${
                      mediaViewMode === "album"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                    }`}
                    aria-label="View album"
                    title="View album"
                  >
                    <FiGrid />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaViewMode("list")}
                    className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-sm transition ${
                      mediaViewMode === "list"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                    }`}
                    aria-label="View list"
                    title="View list"
                  >
                    <FiList />
                  </button>
                </div>
                <select
                  value={mediaSortBy}
                  onChange={(e) => setMediaSortBy(e.target.value as "name" | "modified_at" | "size")}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-100"
                >
                  <option value="name">Nama</option>
                  <option value="modified_at">Terbaru</option>
                  <option value="size">Size</option>
                </select>
                <button
                  type="button"
                  onClick={() => setMediaSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-200 dark:hover:bg-[#16355f] dark:hover:text-white"
                  aria-label={mediaSortDir === "asc" ? "Urutkan naik" : "Urutkan turun"}
                  title={mediaSortDir === "asc" ? "Urutan naik" : "Urutan turun"}
                >
                  {mediaSortDir === "asc" ? <FiArrowUp /> : <FiArrowDown />}
                </button>
                <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tampil</span>
                <select
                  value={mediaPageSizeMode}
                  onChange={(e) => setMediaPageSizeMode(e.target.value as "15" | "25" | "50" | "custom")}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-100"
                >
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="custom">Custom</option>
                </select>
                {mediaPageSizeMode === "custom" && (
                  <input
                    value={mediaCustomPageSize}
                    onChange={(e) => setMediaCustomPageSize(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="angka"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-100"
                  />
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setSelectedMediaNames(allVisibleMediaSelected ? [] : pagedMediaItems.map((item) => item.name))
                }
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-100"
              >
                <input
                  type="checkbox"
                  checked={allVisibleMediaSelected}
                  readOnly
                  className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-[#081a33] dark:checked:border-sky-400 dark:checked:bg-sky-500"
                />
                <span>{selectedMediaNames.length} media dipilih</span>
              </button>
              {selectedMediaItems.length > 0 ? (
                <button
                  type="button"
                  onClick={handleDeleteSelectedMedia}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                >
                  <FiTrash2 />
                  Hapus Terpilih
                </button>
              ) : null}
            </div>

            {mediaError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {mediaError}
              </div>
            )}

            <div className={`mt-5 ${mediaViewMode === "album" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}`}>
              {mediaLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Memuat media...
                </div>
              ) : pagedMediaItems.length > 0 ? (
                pagedMediaItems.map((item) => {
                  const Icon = mediaCategoryIcon(item.category);
                  return (
                    mediaViewMode === "album" ? (
                      <div key={item.name} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0d2749]">
                        <input
                          type="checkbox"
                          checked={selectedMediaNames.includes(item.name)}
                          onChange={() =>
                            setSelectedMediaNames((prev) =>
                              prev.includes(item.name) ? prev.filter((name) => name !== item.name) : [...prev, item.name]
                            )
                          }
                          className="absolute left-3 top-3 z-20 h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-[#081a33] dark:checked:border-sky-400 dark:checked:bg-sky-500"
                        />
                        <div className="aspect-square w-full overflow-hidden bg-slate-200 dark:bg-[#081a33]">
                          {item.category === "gambar" ? (
                            <img
                              src={item.path}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (next) next.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div className={`h-full w-full items-center justify-center text-slate-600 dark:text-slate-300 ${item.category === "gambar" ? "hidden" : "flex"}`}>
                            <Icon className="text-4xl" />
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                          <div className="pointer-events-auto w-full">
                            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-200">
                              {item.category} • {item.extension || "-"} • {formatFileSize(item.size)}
                            </p>
                            <p className="mt-1 text-xs text-slate-300">
                              {new Date(item.modified_at).toLocaleString("id-ID")}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setMediaPreviewTarget(item)}
                                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
                              >
                                Lihat File
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMediaError(null);
                                  setMediaDeleteTarget(item);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-medium text-red-100 backdrop-blur transition hover:bg-red-500/30"
                              >
                                <FiTrash2 />
                                Hapus
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={item.name} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0d2749]">
                        <div className="flex min-w-0 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedMediaNames.includes(item.name)}
                            onChange={() =>
                              setSelectedMediaNames((prev) =>
                                prev.includes(item.name) ? prev.filter((name) => name !== item.name) : [...prev, item.name]
                              )
                            }
                            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-[#081a33] dark:checked:border-sky-400 dark:checked:bg-sky-500"
                          />
                          {item.category === "gambar" ? (
                            <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-600 dark:bg-[#081a33]">
                              <img
                                src={item.path}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                  if (next) next.style.display = "flex";
                                }}
                              />
                              <div className="hidden h-full w-full items-center justify-center text-slate-600 dark:text-slate-300">
                                <Icon />
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-200 p-2 text-slate-700 dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-200">
                              <Icon />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                            <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">
                              {item.category} • {item.extension || "-"} • {formatFileSize(item.size)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {new Date(item.modified_at).toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setMediaPreviewTarget(item)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-100 dark:hover:bg-[#16355f]"
                          >
                            Lihat File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaError(null);
                              setMediaDeleteTarget(item);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                          >
                            <FiTrash2 />
                            Hapus
                          </button>
                        </div>
                      </div>
                    )
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Tidak ada media untuk kategori ini.
                </div>
              )}
            </div>

            {pagedMediaItems.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Menampilkan {pagedMediaItems.length} dari total {sortedMediaItems.length} media.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaPage((prev) => Math.max(1, prev - 1))}
                    disabled={mediaPage <= 1}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {mediaPage}/{totalMediaPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMediaPage((prev) => Math.min(totalMediaPages, prev + 1))}
                    disabled={mediaPage >= totalMediaPages}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:!bg-slate-950 dark:!text-slate-100">
            Pilih `Daftar Tabel` atau `Media` dari panel kiri untuk mulai mengelola data.
          </div>
          )}
        </section>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {schemaDrawerOpen && selectedTableMeta && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/45" onClick={() => setSchemaDrawerOpen(false)}>
          <aside
            className="h-full w-full max-w-5xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Skema {selectedTableMeta.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ditampilkan dalam 3 kolom agar lebih rapih dan mudah dipindai.</p>
              </div>
              <button type="button" onClick={() => setSchemaDrawerOpen(false)} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <FiX />
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedTableMeta.columns.map((column) => (
                <div key={column.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{column.name}</p>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{column.data_type}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{column.udt_name}</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{column.is_nullable ? "Nullable" : "Required"} • {column.is_editable ? "Editable" : "Read only"}{column.is_primary_key ? " • Primary Key" : ""}</p>
                  {column.default_value ? <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">Default: {column.default_value}</p> : null}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {resetDrawerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onClick={() => setResetDrawerOpen(false)}>
          <div
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reset Database</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Analisis relasi tabel, cek bentrok dependency, lalu reset dengan urutan aman.</p>
              </div>
              <button type="button" onClick={() => setResetDrawerOpen(false)} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <FiX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {resetError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {resetError}
                </div>
              )}
              <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0d2749]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tabel yang akan diproses</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Centang tabel di panel kiri, lalu analisis dependency sebelum reset.</p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    {selectedTablesForReset.length} tabel
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTablesForReset.map((table) => (
                    <span key={table} className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-100">{table}</span>
                  ))}
                </div>
              </div>

              {resetAnalysis && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-600/45 dark:bg-[rgba(245,158,11,0.12)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Tabel lain yang sebaiknya ikut direset</p>
                      <p className="mt-1 text-xs text-amber-800 dark:text-slate-100">Tambahkan tabel yang terhubung agar tidak menimbulkan error dependency.</p>
                    </div>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-slate-900/70 dark:text-amber-200">
                      {resetRecommendedExtras.length} rekomendasi
                    </span>
                  </div>
                  {resetRecommendedExtras.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resetRecommendedExtras.map((table) => (
                        <button
                          key={table}
                          type="button"
                          onClick={() => {
                            const next = uniqueStrings([...selectedTablesForReset, table]);
                            setSelectedTablesForReset(next);
                            void runResetAnalysis(next);
                          }}
                          className="rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-600/50 dark:text-amber-100 dark:hover:bg-slate-900/35"
                        >
                          + Tambahkan {table}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-amber-800 dark:text-slate-50">Tidak ada tabel tambahan yang wajib dipilih.</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-600/45 dark:bg-[rgba(245,158,11,0.12)]">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Note penting</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-amber-800 dark:text-slate-50">Reset hanya menghapus isi row, bukan struktur tabel.</p>
                    <p className="text-amber-800 dark:text-slate-50">Aksi ini permanen dan bisa memutus alur data modul lain jika dependency diabaikan.</p>
                    <p className="text-amber-800 dark:text-slate-50">Password admin wajib diisi sebelum eksekusi.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-100">Password Admin</label>
                  <div className="relative">
                    <input
                      type={resetPasswordVisible ? "text" : "password"}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Masukkan password admin untuk konfirmasi reset"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-11 text-sm outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-[#081a33] dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setResetPasswordVisible((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      aria-label={resetPasswordVisible ? "Sembunyikan password" : "Lihat password"}
                    >
                      {resetPasswordVisible ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runResetAnalysis()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                  <FiRefreshCw />
                    Analisis Ulang
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    disabled={!resetAnalysis || !resetPassword.trim() || resetRecommendedExtras.length > 0 || !!resetAnalysis?.cycles?.length}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                  >
                    <FiTrash2 />
                    Jalankan Reset
                  </button>
                </div>
              </div>
              </div>

              {resetAnalysis ? (
                <div className="mt-6 space-y-5">
                <section>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Bentrok Yang Terdeteksi</h4>
                  <div className="mt-3 space-y-2">
                    {resetAnalysis.potential_errors.length > 0 ? resetAnalysis.potential_errors.map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                        <FiAlertTriangle className="mt-0.5 shrink-0" />
                        <p>{item}</p>
                      </div>
                    )) : <p className="text-sm text-slate-600 dark:text-slate-300">Tidak ada bentrok foreign key yang terdeteksi.</p>}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Urutan Hapus Aman</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resetAnalysis.delete_order.map((table, idx) => (
                      <span key={`${table}-${idx}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{idx + 1}. {table}</span>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Constraint Terkait</h4>
                  <div className="mt-3 space-y-2">
                    {resetAnalysis.related_references.map((ref) => (
                      <div key={ref.constraint_name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{ref.constraint_name}</p>
                        <p className="mt-2 text-slate-600 dark:text-slate-300">{ref.source_table} ({ref.source_columns.join(", ")}) {"->"} {ref.target_table} ({ref.target_columns.join(", ")})</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ON DELETE {ref.delete_rule} • ON UPDATE {ref.update_rule}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rekomendasi</h4>
                  <div className="mt-3 space-y-2">
                    {resetAnalysis.recommendations.map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                        <FiInfo className="mt-0.5 shrink-0" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {modal && rowsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {modal.mode === "create" ? "Tambah Row Baru" : "Edit Row"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Tabel: <span className="font-medium">{rowsData.table}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300"
                >
                  <FiX />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {rowsData.columns.map((column) => {
                  const disabled = !column.is_editable || (modal.mode === "edit" && column.is_primary_key);
                  return (
                    <label key={column.name} className="space-y-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {column.name}
                        <span className="ml-2 text-xs text-slate-400">{column.data_type}</span>
                      </span>
                      {column.data_type === "boolean" ? (
                        <select
                          value={draft[column.name] ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [column.name]: e.target.value }))}
                          disabled={disabled}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="">Kosong</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : column.data_type === "json" || column.data_type === "jsonb" || column.data_type === "text" ? (
                        <textarea
                          value={draft[column.name] ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [column.name]: e.target.value }))}
                          disabled={disabled}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      ) : (
                        <input
                          value={draft[column.name] ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [column.name]: e.target.value }))}
                          disabled={disabled}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void submitRow()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              >
                {modal.mode === "create" ? "Simpan Row" : "Update Row"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus Row"
        message={
          deleteTarget && rowsData
            ? deleteTarget.length === 1
              ? `${deleteError ? `${deleteError}\n\n` : ""}Hapus row dari tabel "${rowsData.table}" dengan key ${JSON.stringify(buildRowKeys(deleteTarget[0], rowsData.primary_key_columns))}?`
              : `${deleteError ? `${deleteError}\n\n` : ""}Hapus ${deleteTarget.length} row terpilih dari tabel "${rowsData.table}"? Aksi ini tidak bisa dibatalkan.`
            : ""
        }
        confirmLabel="Hapus"
        danger
        loading={saving}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />
      <ConfirmDialog
        isOpen={!!mediaDeleteTarget}
        title="Hapus Media"
        message={
          mediaDeleteTarget
            ? `${mediaError ? `${mediaError}\n\n` : ""}Hapus file "${mediaDeleteTarget.name}" dari folder uploads?`
            : ""
        }
        confirmLabel="Hapus File"
        danger
        loading={saving}
        onCancel={() => {
          setMediaDeleteTarget(null);
          setMediaError(null);
        }}
        onConfirm={() => {
          void handleDeleteMedia();
        }}
      />
      {mediaPreviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setMediaPreviewTarget(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">{mediaPreviewTarget.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {mediaPreviewTarget.category} • {mediaPreviewTarget.extension || "-"} • {formatFileSize(mediaPreviewTarget.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMediaPreviewTarget(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300"
              >
                <FiX />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
              {mediaPreviewTarget.category === "gambar" ? (
                <img src={mediaPreviewTarget.path} alt={mediaPreviewTarget.name} className="mx-auto max-h-[70vh] rounded-2xl object-contain" />
              ) : mediaPreviewTarget.category === "video" ? (
                <video src={mediaPreviewTarget.path} controls className="mx-auto max-h-[70vh] w-full rounded-2xl bg-black" />
              ) : mediaPreviewTarget.category === "audio" ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <audio src={mediaPreviewTarget.path} controls className="w-full max-w-xl" />
                </div>
              ) : mediaPreviewTarget.extension === "pdf" ? (
                <iframe src={mediaPreviewTarget.path} title={mediaPreviewTarget.name} className="h-[70vh] w-full rounded-2xl border border-slate-200 dark:border-slate-800" />
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 text-center dark:border-slate-700">
                  <FiFile className="text-4xl text-slate-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Preview langsung tidak tersedia untuk file ini.</p>
                  <a
                    href={mediaPreviewTarget.path}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    Buka File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmResetOpen}
        title="Reset Tabel Database"
        message={
          resetAnalysis
            ? `Kosongkan isi tabel berikut: ${resetAnalysis.selected_tables.join(", ")}? Aksi ini tidak bisa dibatalkan. Password admin yang kamu masukkan akan dipakai untuk otorisasi reset ini.`
            : ""
        }
        confirmLabel="Reset Sekarang"
        danger
        loading={saving}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          void executeReset();
        }}
      />
      <LoadingDialog isOpen={saving || resetLoading} message={resetLoading ? "Menganalisis reset database..." : "Memproses perubahan database..."} />
    </div>
  );
}
