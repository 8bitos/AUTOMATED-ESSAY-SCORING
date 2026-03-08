"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiDatabase, FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
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

export default function SuperadminDatabasePage() {
  const [tables, setTables] = useState<DatabaseTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [rowsData, setRowsData] = useState<DatabaseRowsResponse | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<RowModalState | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal memuat daftar tabel"));
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (!selectedTable) {
      setRowsData(null);
      return;
    }
    setRowsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: "20",
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
  }, [page, query, selectedTable]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selectedTableMeta = useMemo(
    () => tables.find((table) => table.name === selectedTable) || null,
    [selectedTable, tables]
  );

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
    try {
      const res = await fetch(`/api/admin/database/${rowsData.table}/rows`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys: buildRowKeys(deleteTarget, rowsData.primary_key_columns),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal menghapus row");
      setDeleteTarget(null);
      void loadTables();
      void loadRows();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal menghapus row"));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = rowsData ? Math.max(1, Math.ceil(rowsData.total / rowsData.size)) : 1;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daftar Tabel</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {tables.length} tabel
            </span>
          </div>
          <div className="space-y-2">
            {tablesLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Memuat daftar tabel...
              </div>
            ) : (
              tables.map((table) => {
                const active = table.name === selectedTable;
                return (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => {
                      setSelectedTable(table.name);
                      setPage(1);
                      setQuery("");
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{table.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/15 text-white dark:bg-slate-900 dark:text-slate-100" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {table.row_count}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${active ? "text-slate-200 dark:text-slate-700" : "text-slate-500 dark:text-slate-400"}`}>
                      {table.column_count} kolom
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                {selectedTableMeta?.supports_crud && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                  >
                    <FiPlus />
                    Tambah Row
                  </button>
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
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadRows()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FiRefreshCw />
                  Muat Ulang
                </button>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      {(rowsData?.columns || []).map((column) => (
                        <th key={column.name} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {column.name}
                        </th>
                      ))}
                      {rowsData?.primary_key_columns.length ? (
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Aksi
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {rowsLoading ? (
                      <tr>
                        <td colSpan={(rowsData?.columns.length || 1) + 1} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                          Memuat data tabel...
                        </td>
                      </tr>
                    ) : rowsData?.rows.length ? (
                      rowsData.rows.map((row, idx) => (
                        <tr key={rowsData.primary_key_columns.map((key) => String(row[key])).join("|") || idx} className="align-top">
                          {rowsData.columns.map((column) => (
                            <td key={column.name} className="max-w-[280px] px-3 py-3 text-slate-700 dark:text-slate-200">
                              <div className="truncate">
                                {typeof row[column.name] === "object" && row[column.name] !== null
                                  ? JSON.stringify(row[column.name])
                                  : String(row[column.name] ?? "")}
                              </div>
                            </td>
                          ))}
                          {rowsData.primary_key_columns.length ? (
                            <td className="px-3 py-3">
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
                                  onClick={() => setDeleteTarget(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
                                >
                                  <FiTrash2 />
                                  Hapus
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={(rowsData?.columns.length || 1) + 1} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                          Tidak ada data untuk ditampilkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {rowsData && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Menampilkan halaman {rowsData.page} dari {totalPages} dengan total {rowsData.total} row.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Skema & Klasifikasi</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Tipe kolom, default value, nullable, dan penanda primary key.
              </p>
              <div className="mt-4 space-y-3">
                {(selectedTableMeta?.columns || []).map((column) => (
                  <div key={column.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{column.name}</p>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {column.data_type}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {column.udt_name}
                      </span>
                      {column.is_primary_key && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Primary Key
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        column.is_nullable
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                      }`}>
                        {column.is_nullable ? "Nullable" : "Required"}
                      </span>
                    </div>
                    {column.default_value ? (
                      <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
                        Default: {column.default_value}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {modal && rowsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {modal.mode === "create" ? "Tambah Row Baru" : "Edit Row"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tabel: <span className="font-medium">{rowsData.table}</span>
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            <div className="mt-6 flex justify-end gap-2">
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
            ? `Hapus row dari tabel "${rowsData.table}" dengan key ${JSON.stringify(buildRowKeys(deleteTarget, rowsData.primary_key_columns))}?`
            : ""
        }
        confirmLabel="Hapus"
        danger
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
      <LoadingDialog isOpen={saving} message="Memproses perubahan database..." />
    </div>
  );
}
