"use client";

import { Dispatch, SetStateAction, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiEye,
  FiHelpCircle,
  FiPlayCircle,
  FiShield,
  FiX,
  FiZap,
} from "react-icons/fi";

export interface SoalQuizSettings {
  answer_mode: "list" | "card";
  timer_mode: "none" | "per_question" | "all_questions";
  per_question_seconds: number;
  total_seconds: number;
  extra_time_seconds: number;
  auto_next_on_submit: boolean;
  bulk_submit_mode: boolean;
  allow_back_navigation: boolean;
  lock_question_after_leave: boolean;
  randomize_question_order: boolean;
  random_subset_count: number;
  schedule_start_at: string;
  schedule_end_at: string;
  grace_period_minutes: number;
  attempt_limit: number;
  attempt_scoring_method: "best" | "last";
  attempt_cooldown_minutes: number;
  auto_submit_on_timeout: boolean;
  result_release_mode: "immediate" | "after_close" | "manual";
  result_manual_published: boolean;
  result_manual_published_at: string;
  show_ideal_answer: boolean;
  show_rubric_breakdown: boolean;
  show_rubric_in_question: boolean;
  hide_results_tab: boolean;
  warn_on_tab_switch: boolean;
  max_tab_switch: number;
  auto_lock_on_tab_switch_limit: boolean;
  require_fullscreen: boolean;
  require_read_material: boolean;
}

interface SoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizSettings: SoalQuizSettings;
  setQuizSettings: Dispatch<SetStateAction<SoalQuizSettings>>;
  onSave: () => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

const clampDuration = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.floor(fallback || 0));
  return Math.max(0, Math.floor(parsed));
};

type TabId = "soal" | "timer" | "akses" | "hasil" | "integritas";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "soal", label: "Mode Soal", icon: FiPlayCircle },
  { id: "timer", label: "Timer", icon: FiClock },
  { id: "akses", label: "Akses & Attempt", icon: FiCalendar },
  { id: "hasil", label: "Rilis Hasil", icon: FiEye },
  { id: "integritas", label: "Integritas", icon: FiShield },
];

const PRESETS: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  bg: string;
  iconColor: string;
  apply: Partial<SoalQuizSettings>;
}[] = [
  {
    name: "Ujian Ketat",
    icon: FiShield,
    desc: "Fullscreen, timer total, soal acak, pengawasan tab",
    bg: "bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:border-rose-700 dark:hover:bg-rose-900/50",
    iconColor: "text-rose-500",
    apply: {
      answer_mode: "card",
      timer_mode: "all_questions",
      total_seconds: 3600,
      randomize_question_order: true,
      auto_submit_on_timeout: true,
      require_fullscreen: true,
      warn_on_tab_switch: true,
      max_tab_switch: 3,
      auto_lock_on_tab_switch_limit: true,
      lock_question_after_leave: false,
      allow_back_navigation: true,
      bulk_submit_mode: true,
    },
  },
  {
    name: "Latihan Santai",
    icon: FiBookOpen,
    desc: "Tanpa timer, urutan tetap, navigasi bebas",
    bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-700 dark:hover:bg-emerald-900/50",
    iconColor: "text-emerald-500",
    apply: {
      answer_mode: "list",
      timer_mode: "none",
      randomize_question_order: false,
      allow_back_navigation: true,
      lock_question_after_leave: false,
      require_fullscreen: false,
      warn_on_tab_switch: false,
      bulk_submit_mode: false,
      auto_next_on_submit: false,
    },
  },
  {
    name: "Kuis Cepat",
    icon: FiZap,
    desc: "Timer per soal 30 detik, kartu, auto-next",
    bg: "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:border-amber-700 dark:hover:bg-amber-900/50",
    iconColor: "text-amber-500",
    apply: {
      answer_mode: "card",
      timer_mode: "per_question",
      per_question_seconds: 30,
      randomize_question_order: true,
      auto_next_on_submit: true,
      auto_submit_on_timeout: true,
      require_fullscreen: false,
      warn_on_tab_switch: false,
      lock_question_after_leave: true,
      allow_back_navigation: false,
    },
  },
];

/* ── Reusable small components ── */

function Tip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1 inline-flex cursor-help items-center">
      <FiHelpCircle className="h-3.5 w-3.5 text-slate-400 transition group-hover/tip:text-sky-500" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 dark:bg-slate-600">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-600" />
      </span>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-4 first:mt-0 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{children}</p>;
}

function Seg<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; tip: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-600 dark:bg-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.tip}
          disabled={disabled}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value
              ? "bg-white text-sky-700 shadow-sm dark:bg-slate-500 dark:text-sky-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  tip,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tip: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
        disabled
          ? "cursor-not-allowed opacity-50 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-500 dark:bg-slate-700"
      />
      <span className="flex-1 text-slate-700 dark:text-slate-200">
        {label}
        <Tip text={tip} />
      </span>
    </label>
  );
}

function Num({
  label,
  tip,
  value,
  onChange,
  disabled,
}: {
  label: string;
  tip: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const cls =
    "sage-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  return (
    <label className="block space-y-1.5">
      <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        <Tip text={tip} />
      </span>
      <input
        type="number"
        min={0}
        className={`${cls} ${disabled ? "opacity-50" : ""}`}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(clampDuration(e.target.value, value))}
      />
    </label>
  );
}

/* ── Main component ── */

export default function SoalSettingsModal({
  isOpen,
  onClose,
  quizSettings,
  setQuizSettings,
  onSave,
  saving,
  disabled,
}: SoalSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("soal");

  if (!isOpen) return null;

  const s = quizSettings;
  const set = <K extends keyof SoalQuizSettings>(key: K, val: SoalQuizSettings[K]) =>
    setQuizSettings((prev) => ({ ...prev, [key]: val }));

  const publishedLabel = s.result_manual_published
    ? `Dipublish${s.result_manual_published_at ? `: ${s.result_manual_published_at}` : ""}`
    : "Belum dipublish";

  const toggleManualPublish = (published: boolean) => {
    setQuizSettings((prev) => ({
      ...prev,
      result_manual_published: published,
      result_manual_published_at: published ? new Date().toISOString() : "",
    }));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setQuizSettings((prev) => ({ ...prev, ...preset.apply }));
  };

  /* ── Tab content ── */

  const tabSoal = (
    <div className="space-y-4">
      <SectionLabel>Tampilan Soal</SectionLabel>
      <Seg
        options={[
          { value: "list" as const, label: "Daftar", tip: "Siswa melihat semua soal dalam satu halaman dan bisa scroll." },
          { value: "card" as const, label: "Kartu", tip: "Siswa mengerjakan satu soal per layar. Lebih fokus, cocok untuk ujian." },
        ]}
        value={s.answer_mode}
        onChange={(v) => set("answer_mode", v)}
        disabled={disabled}
      />

      <SectionLabel>Urutan &amp; Jumlah Soal</SectionLabel>
      <Seg
        options={[
          { value: "false", label: "Tetap", tip: "Urutan soal sama persis untuk semua siswa." },
          { value: "true", label: "Acak", tip: "Setiap siswa mendapat urutan soal yang berbeda-beda secara acak." },
        ]}
        value={String(s.randomize_question_order)}
        onChange={(v) => set("randomize_question_order", v === "true")}
        disabled={disabled}
      />
      <Num
        label="Question Pool (0 = semua)"
        tip="Jumlah soal yang diambil secara acak dari bank soal. Isi 0 jika ingin menggunakan semua soal yang tersedia."
        value={s.random_subset_count}
        onChange={(v) => set("random_subset_count", v)}
        disabled={disabled}
      />

      <SectionLabel>Navigasi Soal</SectionLabel>
      <div className="space-y-2">
        <Check checked={s.auto_next_on_submit} onChange={(v) => set("auto_next_on_submit", v)} disabled={disabled} label="Auto-next setelah submit" tip="Setelah siswa mengirim jawaban, layar otomatis berpindah ke soal berikutnya tanpa perlu klik manual." />
        <Check checked={s.allow_back_navigation} onChange={(v) => set("allow_back_navigation", v)} disabled={disabled} label="Izinkan kembali ke soal sebelumnya" tip="Siswa boleh kembali ke soal yang sudah mereka lewati atau jawab sebelumnya." />
        <Check checked={s.lock_question_after_leave} onChange={(v) => set("lock_question_after_leave", v)} disabled={disabled} label="Kunci soal yang sudah dilewati" tip="Soal yang sudah ditinggalkan atau dilewati tidak bisa dibuka lagi oleh siswa." />
      </div>

      <SectionLabel>Pengerjaan</SectionLabel>
      <div className="space-y-2">
        <Check checked={s.bulk_submit_mode} onChange={(v) => set("bulk_submit_mode", v)} disabled={disabled} label="Submit semua jawaban sekaligus" tip="Siswa mengisi semua jawaban terlebih dahulu, lalu mengirim semuanya sekaligus di akhir dengan satu tombol." />
        <Check checked={s.require_read_material} onChange={(v) => set("require_read_material", v)} disabled={disabled} label="Wajib baca materi sebelum menjawab" tip="Siswa harus membaca materi yang diberikan terlebih dahulu sebelum bisa membuka dan mengerjakan soal." />
      </div>
    </div>
  );

  const tabTimer = (
    <div className="space-y-4">
      <SectionLabel>Mode Timer</SectionLabel>
      <Seg
        options={[
          { value: "none" as const, label: "Tanpa Timer", tip: "Tidak ada batas waktu. Siswa bisa mengerjakan selama yang mereka butuhkan." },
          { value: "per_question" as const, label: "Per Soal", tip: "Setiap soal punya batas waktu sendiri-sendiri. Cocok untuk kuis cepat." },
          { value: "all_questions" as const, label: "Total", tip: "Satu timer berjalan untuk seluruh sesi pengerjaan. Cocok untuk ujian." },
        ]}
        value={s.timer_mode}
        onChange={(v) => set("timer_mode", v)}
        disabled={disabled}
      />

      {s.timer_mode !== "none" && (
        <>
          <SectionLabel>Durasi</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {s.timer_mode === "per_question" && (
              <Num label="Per Soal (detik)" tip="Waktu maksimal yang diberikan untuk mengerjakan setiap soal, dalam satuan detik." value={s.per_question_seconds} onChange={(v) => set("per_question_seconds", v)} disabled={disabled} />
            )}
            {s.timer_mode === "all_questions" && (
              <Num label="Total (detik)" tip="Total waktu untuk mengerjakan semua soal dari awal sampai selesai, dalam satuan detik." value={s.total_seconds} onChange={(v) => set("total_seconds", v)} disabled={disabled} />
            )}
            <Num label="Extra Time (detik)" tip="Waktu tambahan di atas batas waktu normal. Berguna untuk siswa yang memerlukan waktu ekstra." value={s.extra_time_seconds} onChange={(v) => set("extra_time_seconds", v)} disabled={disabled} />
          </div>

          <SectionLabel>Saat Waktu Habis</SectionLabel>
          <Check checked={s.auto_submit_on_timeout} onChange={(v) => set("auto_submit_on_timeout", v)} disabled={disabled} label="Auto-submit saat habis waktu" tip="Jika waktu habis, semua jawaban yang sudah diisi akan otomatis dikirim tanpa perlu siswa menekan tombol submit." />
        </>
      )}

      {s.timer_mode === "none" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
          Timer tidak aktif. Siswa bisa mengerjakan tanpa batas waktu.
        </div>
      )}
    </div>
  );

  const tabAkses = (
    <div className="space-y-4">
      <SectionLabel>Jadwal Pengerjaan</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
            Mulai<Tip text="Tanggal dan jam kapan siswa mulai bisa membuka dan mengerjakan soal ini." />
          </span>
          <input type="datetime-local" className="sage-input" disabled={disabled} value={s.schedule_start_at} onChange={(e) => set("schedule_start_at", e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
            Selesai<Tip text="Tanggal dan jam kapan akses pengerjaan soal ditutup untuk siswa." />
          </span>
          <input type="datetime-local" className="sage-input" disabled={disabled} value={s.schedule_end_at} onChange={(e) => set("schedule_end_at", e.target.value)} />
        </label>
      </div>
      <Num label="Toleransi Keterlambatan (menit)" tip="Waktu toleransi setelah jadwal selesai. Siswa yang sudah mulai mengerjakan masih bisa menyelesaikan dalam jeda ini." value={s.grace_period_minutes} onChange={(v) => set("grace_period_minutes", v)} disabled={disabled} />

      <SectionLabel>Percobaan (Attempt)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Num label="Batas percobaan (0 = tanpa batas)" tip="Berapa kali siswa boleh mencoba mengerjakan soal ini. Isi 0 jika siswa boleh mencoba tanpa batas." value={s.attempt_limit} onChange={(v) => set("attempt_limit", v)} disabled={disabled} />
        <Num label="Jeda antar percobaan (menit)" tip="Waktu tunggu yang harus dilalui sebelum siswa boleh mencoba mengerjakan soal lagi setelah selesai satu percobaan." value={s.attempt_cooldown_minutes} onChange={(v) => set("attempt_cooldown_minutes", v)} disabled={disabled} />
      </div>

      <SectionLabel>Skema Penilaian Attempt</SectionLabel>
      <Seg
        options={[
          { value: "last" as const, label: "Nilai terakhir", tip: "Nilai yang dipakai adalah dari percobaan terakhir siswa, bukan yang terbaik." },
          { value: "best" as const, label: "Nilai terbaik", tip: "Sistem otomatis memilih nilai tertinggi dari semua percobaan siswa." },
        ]}
        value={s.attempt_scoring_method}
        onChange={(v) => set("attempt_scoring_method", v)}
        disabled={disabled}
      />
    </div>
  );

  const tabHasil = (
    <div className="space-y-4">
      <SectionLabel>Mode Rilis Hasil</SectionLabel>
      <Seg
        options={[
          { value: "immediate" as const, label: "Langsung", tip: "Siswa langsung bisa melihat nilai dan feedback segera setelah mengirim jawaban." },
          { value: "after_close" as const, label: "Setelah ditutup", tip: "Nilai baru bisa dilihat siswa setelah jadwal pengerjaan resmi berakhir." },
          { value: "manual" as const, label: "Manual", tip: "Anda mengatur sendiri kapan hasil ditampilkan ke siswa menggunakan tombol di bawah." },
        ]}
        value={s.result_release_mode}
        onChange={(v) => set("result_release_mode", v)}
        disabled={disabled}
      />

      {s.result_release_mode === "manual" && (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-900/30">
          <p className="text-xs text-sky-700 dark:text-sky-300">Status: {publishedLabel}</p>
          <div className="flex gap-2">
            <button type="button" className="sage-button-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => toggleManualPublish(true)}>Publish Hasil</button>
            <button type="button" className="sage-button-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => toggleManualPublish(false)}>Tarik Hasil</button>
          </div>
        </div>
      )}

      <SectionLabel>Informasi yang Ditampilkan ke Siswa</SectionLabel>
      <div className="space-y-2">
        <Check checked={s.show_ideal_answer} onChange={(v) => set("show_ideal_answer", v)} disabled={disabled} label="Tampilkan jawaban ideal" tip="Siswa bisa melihat contoh jawaban yang benar setelah hasil dirilis. Membantu siswa belajar dari kesalahan." />
        <Check checked={s.show_rubric_in_question} onChange={(v) => set("show_rubric_in_question", v)} disabled={disabled} label="Tampilkan rubrik saat mengerjakan soal" tip="Rubrik penilaian ditampilkan langsung di halaman soal saat siswa sedang mengerjakan, sehingga siswa tahu aspek apa saja yang dinilai." />
        <Check checked={s.show_rubric_breakdown} onChange={(v) => set("show_rubric_breakdown", v)} disabled={disabled} label="Tampilkan detail rubrik di hasil" tip="Siswa dapat melihat rincian skor per aspek rubrik di halaman hasil mereka." />
        <Check checked={s.hide_results_tab} onChange={(v) => set("hide_results_tab", v)} disabled={disabled} label="Sembunyikan tab Hasil Penilaian" tip="Tab 'Hasil Penilaian' dan tombol 'Lihat Hasil' akan disembunyikan dari siswa. Siswa tidak bisa melihat hasil mereka sama sekali." />
      </div>
    </div>
  );

  const tabIntegritas = (
    <div className="space-y-4">
      <SectionLabel>Pengawasan Layar</SectionLabel>
      <Check checked={s.require_fullscreen} onChange={(v) => set("require_fullscreen", v)} disabled={disabled} label="Wajib fullscreen saat mengerjakan" tip="Siswa wajib membuka soal dalam mode layar penuh. Header dan sidebar akan disembunyikan agar siswa lebih fokus." />

      <SectionLabel>Pemantauan Tab Browser</SectionLabel>
      <Check checked={s.warn_on_tab_switch} onChange={(v) => set("warn_on_tab_switch", v)} disabled={disabled} label="Peringatan saat pindah tab" tip="Sistem akan mencatat dan memberi peringatan jika siswa berpindah ke tab atau aplikasi lain saat mengerjakan soal." />

      {s.warn_on_tab_switch && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/40">
          <Num label="Batas maksimal pindah tab" tip="Berapa kali siswa boleh berpindah tab sebelum dianggap melanggar aturan." value={s.max_tab_switch} onChange={(v) => set("max_tab_switch", v)} disabled={disabled} />
          <Check checked={s.auto_lock_on_tab_switch_limit} onChange={(v) => set("auto_lock_on_tab_switch_limit", v)} disabled={disabled} label="Kunci otomatis jika melebihi batas" tip="Jika siswa sudah melebihi batas pindah tab, pengerjaan soal mereka akan otomatis dikunci dan tidak bisa melanjutkan." />
        </div>
      )}

      {!s.warn_on_tab_switch && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
          Pemantauan tab tidak aktif. Siswa bebas berpindah tab.
        </div>
      )}
    </div>
  );

  const tabContent: Record<TabId, React.ReactNode> = {
    soal: tabSoal,
    timer: tabTimer,
    akses: tabAkses,
    hasil: tabHasil,
    integritas: tabIntegritas,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pengaturan Mode Pengerjaan Siswa</h2>
          <button title="Tutup" onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Presets */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Konfigurasi Cepat</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                disabled={disabled}
                title={p.desc}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${p.bg} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                onClick={() => applyPreset(p)}
              >
                <p.icon className={`h-3.5 w-3.5 ${p.iconColor}`} />
                <span className="dark:text-slate-200">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {disabled && (
          <div className="mx-6 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            Pengaturan ini aktif jika halaman dibuka dari card section soal (<code>sectionCardId</code>).
          </div>
        )}

        {/* Body: sidebar tabs + content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop sidebar tabs */}
          <nav className="flex shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 bg-slate-50/40 p-3 max-md:hidden md:w-44 dark:border-slate-700 dark:bg-slate-900/30">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? "bg-white text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-400"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile horizontal tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 py-2 md:hidden dark:border-slate-700">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">{tabContent[activeTab]}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3 dark:border-slate-700">
          <button type="button" className="sage-button-outline" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="sage-button" disabled={disabled || saving} onClick={() => void onSave()}>
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>
    </div>
  );
}
