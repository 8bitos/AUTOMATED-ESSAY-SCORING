"use client";

import { Dispatch, SetStateAction } from "react";
import { FiCalendar, FiClock, FiHelpCircle, FiPlayCircle, FiShield, FiShuffle, FiX } from "react-icons/fi";

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

function BaseModal({
  isOpen,
  onClose,
  title,
  panelClassName,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${panelClassName || "max-w-4xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button title="Tutup popup pengaturan soal." onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TooltipHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <FiHelpCircle className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-sky-600" />
      <span className="pointer-events-none absolute left-1/2 top-[115%] z-20 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}

function LabelWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <span>{label}</span>
      <TooltipHint text={hint} />
    </span>
  );
}

export default function SoalSettingsModal({
  isOpen,
  onClose,
  quizSettings,
  setQuizSettings,
  onSave,
  saving,
  disabled,
}: SoalSettingsModalProps) {
  const publishedLabel = quizSettings.result_manual_published
    ? `Dipublish${quizSettings.result_manual_published_at ? `: ${quizSettings.result_manual_published_at}` : ""}`
    : "Belum dipublish";
  const toggleManualPublish = (published: boolean) => {
    setQuizSettings((prev) => ({
      ...prev,
      result_manual_published: published,
      result_manual_published_at: published ? new Date().toISOString() : "",
    }));
  };
  const capsuleBase = "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition border";
  const capsuleOn = "border-sky-600 bg-sky-600 text-white shadow-sm";
  const capsuleOff = "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
  const numberInputClass =
    "sage-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const settingCardClass = "flex h-full flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3";

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Pengaturan Mode Pengerjaan Siswa" panelClassName="max-w-6xl">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Konfigurasi Cepat</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-slate-700">
              <FiPlayCircle className="h-3.5 w-3.5" />
              {quizSettings.answer_mode === "card" ? "Kartu per Soal" : "Daftar Soal"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-slate-700">
              <FiClock className="h-3.5 w-3.5" />
              {quizSettings.timer_mode === "none" ? "Tanpa Timer" : quizSettings.timer_mode === "per_question" ? "Timer per Soal" : "Timer Total"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-slate-700">
              <FiShuffle className="h-3.5 w-3.5" />
              {quizSettings.randomize_question_order ? "Urutan Acak" : "Urutan Tetap"}
            </span>
          </div>
        </div>

        {disabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pengaturan ini aktif jika halaman dibuka dari card section soal (`sectionCardId`).
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiPlayCircle /> Mode Soal
            </h3>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Jawaban</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Siswa melihat semua soal dalam satu daftar dan bisa scroll." disabled={disabled} className={`${capsuleBase} ${quizSettings.answer_mode === "list" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, answer_mode: "list" }))}>Daftar</button>
                <button type="button" title="Siswa fokus satu soal per layar seperti kartu." disabled={disabled} className={`${capsuleBase} ${quizSettings.answer_mode === "card" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, answer_mode: "card" }))}>Kartu</button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urutan Soal</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Urutan soal sama untuk semua siswa." disabled={disabled} className={`${capsuleBase} ${!quizSettings.randomize_question_order ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, randomize_question_order: false }))}>Tetap</button>
                <button type="button" title="Urutan soal diacak agar tiap siswa bisa berbeda." disabled={disabled} className={`${capsuleBase} ${quizSettings.randomize_question_order ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, randomize_question_order: true }))}>Acak</button>
              </div>
            </div>
            <label className="block space-y-1" title="Batasi jumlah soal yang diambil dari bank/section. Isi 0 untuk pakai semua soal.">
              <LabelWithHint label="Question Pool (0 = semua)" hint="Batasi jumlah soal yang diambil. Isi 0 jika semua soal ingin dipakai." />
              <input
                type="number"
                min={0}
                className={numberInputClass}
                value={quizSettings.random_subset_count}
                disabled={disabled}
                onChange={(e) => setQuizSettings((prev) => ({ ...prev, random_subset_count: clampDuration(e.target.value, prev.random_subset_count) }))}
              />
            </label>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Setelah submit, sistem langsung pindah ke soal berikutnya."><input type="checkbox" checked={quizSettings.auto_next_on_submit} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, auto_next_on_submit: e.target.checked }))} />Auto-next setelah submit</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa isi semua jawaban dulu, lalu kirim semua sekaligus dengan satu tombol Submit."><input type="checkbox" checked={quizSettings.bulk_submit_mode} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, bulk_submit_mode: e.target.checked }))} />Submit semua jawaban sekaligus</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa bisa kembali ke soal yang sudah dibuka sebelumnya."><input type="checkbox" checked={quizSettings.allow_back_navigation} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, allow_back_navigation: e.target.checked }))} />Izinkan kembali ke soal sebelumnya</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Soal yang sudah ditinggalkan tidak bisa dibuka lagi."><input type="checkbox" checked={quizSettings.lock_question_after_leave} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, lock_question_after_leave: e.target.checked }))} />Kunci soal yang sudah dilewati</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa harus membaca materi terlebih dahulu sebelum bisa membuka soal."><input type="checkbox" checked={quizSettings.require_read_material} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, require_read_material: e.target.checked }))} />Wajib baca materi sebelum menjawab</label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiClock /> Timer
            </h3>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Timer</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Tidak ada batas waktu otomatis." disabled={disabled} className={`${capsuleBase} ${quizSettings.timer_mode === "none" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, timer_mode: "none" }))}>Tanpa Timer</button>
                <button type="button" title="Setiap soal punya hitungan waktu sendiri." disabled={disabled} className={`${capsuleBase} ${quizSettings.timer_mode === "per_question" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, timer_mode: "per_question" }))}>Per Soal</button>
                <button type="button" title="Satu total waktu untuk semua soal." disabled={disabled} className={`${capsuleBase} ${quizSettings.timer_mode === "all_questions" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, timer_mode: "all_questions" }))}>Total</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1" title="Durasi maksimal tiap soal dalam detik saat mode Per Soal aktif.">
                <LabelWithHint label="Per Soal (detik)" hint="Waktu maksimal untuk tiap soal saat mode Per Soal aktif." />
                <input type="number" min={0} className={numberInputClass} disabled={disabled || quizSettings.timer_mode !== "per_question"} value={quizSettings.per_question_seconds} onChange={(e) => setQuizSettings((prev) => ({ ...prev, per_question_seconds: clampDuration(e.target.value, prev.per_question_seconds) }))} />
              </label>
              <label className="block space-y-1" title="Durasi total pengerjaan dalam detik saat mode Total aktif.">
                <LabelWithHint label="Total (detik)" hint="Total waktu untuk seluruh sesi soal saat mode Total aktif." />
                <input type="number" min={0} className={numberInputClass} disabled={disabled || quizSettings.timer_mode !== "all_questions"} value={quizSettings.total_seconds} onChange={(e) => setQuizSettings((prev) => ({ ...prev, total_seconds: clampDuration(e.target.value, prev.total_seconds) }))} />
              </label>
            </div>
            <label className="block space-y-1" title="Tambahan waktu kompensasi untuk siswa (detik).">
              <LabelWithHint label="Extra Time (detik)" hint="Tambahan waktu kompensasi untuk siswa." />
              <input type="number" min={0} className={numberInputClass} disabled={disabled} value={quizSettings.extra_time_seconds} onChange={(e) => setQuizSettings((prev) => ({ ...prev, extra_time_seconds: clampDuration(e.target.value, prev.extra_time_seconds) }))} />
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Jawaban otomatis dikirim saat timer habis."><input type="checkbox" checked={quizSettings.auto_submit_on_timeout} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, auto_submit_on_timeout: e.target.checked }))} />Auto-submit saat habis waktu</label>
          </section>

          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiCalendar /> Akses & Attempt
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1" title="Waktu mulai siswa bisa mengerjakan soal ini.">
                <LabelWithHint label="Mulai" hint="Tanggal dan jam awal siswa boleh mulai mengerjakan." />
                <input type="datetime-local" className="sage-input" disabled={disabled} value={quizSettings.schedule_start_at} onChange={(e) => setQuizSettings((prev) => ({ ...prev, schedule_start_at: e.target.value }))} />
              </label>
              <label className="block space-y-1" title="Waktu akhir akses soal untuk siswa.">
                <LabelWithHint label="Selesai" hint="Tanggal dan jam akhir akses pengerjaan soal." />
                <input type="datetime-local" className="sage-input" disabled={disabled} value={quizSettings.schedule_end_at} onChange={(e) => setQuizSettings((prev) => ({ ...prev, schedule_end_at: e.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className={settingCardClass} title="Toleransi keterlambatan setelah waktu selesai (menit).">
                <span className="min-h-[1.25rem]">
                  <LabelWithHint label="Grace (menit)" hint="Toleransi keterlambatan setelah waktu selesai." />
                </span>
                <input type="number" min={0} className={numberInputClass} disabled={disabled} value={quizSettings.grace_period_minutes} onChange={(e) => setQuizSettings((prev) => ({ ...prev, grace_period_minutes: clampDuration(e.target.value, prev.grace_period_minutes) }))} />
              </label>
              <label className={settingCardClass} title="Berapa kali siswa boleh mencoba mengerjakan soal. Isi 0 untuk tanpa batas.">
                <span className="min-h-[1.25rem]">
                  <LabelWithHint label="Attempt limit" hint="Jumlah maksimal percobaan siswa. 0 berarti tanpa batas." />
                </span>
                <input type="number" min={0} className={numberInputClass} disabled={disabled} value={quizSettings.attempt_limit} onChange={(e) => setQuizSettings((prev) => ({ ...prev, attempt_limit: clampDuration(e.target.value, prev.attempt_limit) }))} />
              </label>
              <label className={settingCardClass} title="Jeda tunggu (menit) sebelum siswa boleh memulai attempt berikutnya.">
                <span className="min-h-[1.25rem]">
                  <LabelWithHint label="Cooldown (menit)" hint="Jeda tunggu sebelum siswa bisa mencoba kembali." />
                </span>
                <input type="number" min={0} className={numberInputClass} disabled={disabled} value={quizSettings.attempt_cooldown_minutes} onChange={(e) => setQuizSettings((prev) => ({ ...prev, attempt_cooldown_minutes: clampDuration(e.target.value, prev.attempt_cooldown_minutes) }))} />
              </label>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skema Nilai Attempt</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Nilai yang dipakai adalah hasil attempt terakhir siswa." disabled={disabled} className={`${capsuleBase} ${quizSettings.attempt_scoring_method === "last" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, attempt_scoring_method: "last" }))}>Nilai terakhir</button>
                <button type="button" title="Nilai yang dipakai adalah attempt terbaik siswa." disabled={disabled} className={`${capsuleBase} ${quizSettings.attempt_scoring_method === "best" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, attempt_scoring_method: "best" }))}>Nilai terbaik</button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiShuffle /> Rilis Hasil & Feedback
            </h3>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Rilis</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Nilai dan feedback langsung muncul setelah submit." disabled={disabled} className={`${capsuleBase} ${quizSettings.result_release_mode === "immediate" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, result_release_mode: "immediate" }))}>Langsung</button>
                <button type="button" title="Nilai baru muncul setelah jadwal pengerjaan ditutup." disabled={disabled} className={`${capsuleBase} ${quizSettings.result_release_mode === "after_close" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, result_release_mode: "after_close" }))}>Setelah ditutup</button>
                <button type="button" title="Guru mengatur sendiri kapan hasil ditampilkan." disabled={disabled} className={`${capsuleBase} ${quizSettings.result_release_mode === "manual" ? capsuleOn : capsuleOff}`} onClick={() => setQuizSettings((prev) => ({ ...prev, result_release_mode: "manual" }))}>Manual</button>
              </div>
            </div>
            {quizSettings.result_release_mode === "manual" && (
              <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs text-sky-700">Status publish: {publishedLabel}</p>
                <div className="flex gap-2">
                  <button type="button" title="Buka akses nilai untuk siswa sekarang." className="sage-button-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => toggleManualPublish(true)}>Publish Hasil</button>
                  <button type="button" title="Sembunyikan kembali hasil dari siswa." className="sage-button-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => toggleManualPublish(false)}>Tarik Hasil</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 text-sm">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa bisa melihat contoh jawaban ideal saat hasil sudah dirilis."><input type="checkbox" checked={quizSettings.show_ideal_answer} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, show_ideal_answer: e.target.checked }))} />Tampilkan jawaban ideal di hasil</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Rubrik tampil langsung di halaman soal saat siswa mengerjakan."><input type="checkbox" checked={quizSettings.show_rubric_in_question} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, show_rubric_in_question: e.target.checked }))} />Tampilkan rubrik saat siswa mengerjakan soal</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa melihat rincian skor per aspek rubrik di halaman hasil."><input type="checkbox" checked={quizSettings.show_rubric_breakdown} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, show_rubric_breakdown: e.target.checked }))} />Tampilkan detail rubrik di halaman hasil</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title="Siswa tidak bisa membuka 'Hasil Penilaian' atau tombol 'Lihat Hasil' pada halaman soal ini."><input type="checkbox" checked={quizSettings.hide_results_tab} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, hide_results_tab: e.target.checked }))} />Sembunyikan Hasil Penilaian & Lihat Hasil</label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiShield /> Integritas
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Pengerjaan dibuka dalam mode fullscreen tanpa header/sidebar."><input type="checkbox" checked={quizSettings.require_fullscreen} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, require_fullscreen: e.target.checked }))} />Wajib Fullscreen saat mengerjakan</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Siswa diberi peringatan ketika berpindah tab/browser."><input type="checkbox" checked={quizSettings.warn_on_tab_switch} disabled={disabled} onChange={(e) => setQuizSettings((prev) => ({ ...prev, warn_on_tab_switch: e.target.checked }))} />Warn saat pindah tab</label>
              <label className="block space-y-1" title="Batas maksimal pindah tab sebelum dianggap melanggar.">
                <LabelWithHint label="Batas pindah tab" hint="Batas jumlah pindah tab sebelum dianggap melanggar." />
                <input type="number" min={0} className={numberInputClass} disabled={disabled || !quizSettings.warn_on_tab_switch} value={quizSettings.max_tab_switch} onChange={(e) => setQuizSettings((prev) => ({ ...prev, max_tab_switch: clampDuration(e.target.value, prev.max_tab_switch) }))} />
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Jika batas terlampaui, pengerjaan otomatis dikunci."><input type="checkbox" checked={quizSettings.auto_lock_on_tab_switch_limit} disabled={disabled || !quizSettings.warn_on_tab_switch} onChange={(e) => setQuizSettings((prev) => ({ ...prev, auto_lock_on_tab_switch_limit: e.target.checked }))} />Auto lock jika melebihi batas</label>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" title="Tutup popup tanpa menyimpan perubahan baru." className="sage-button-outline" onClick={onClose}>Batal</button>
          <button type="button" title="Simpan semua pengaturan soal untuk section ini." className="sage-button" disabled={disabled || saving} onClick={() => void onSave()}>
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
