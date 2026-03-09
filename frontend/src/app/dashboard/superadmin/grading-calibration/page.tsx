"use client";

import { useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClipboard, FiDownload, FiSearch, FiSliders, FiTarget } from "react-icons/fi";

type CalibrationSample = {
  id: string;
  subject: string;
  rubric_mode: "global" | "per_question";
  question: string;
  ideal_answer: string;
  keywords: string[];
  student_answer: string;
  expected_quality: "high" | "low";
  expected_teacher_score_band: string;
  expected_error_risk: string[];
  notes: string;
};

const samples: CalibrationSample[] = [
  {
    id: "CAL-001",
    subject: "Sejarah Indonesia",
    rubric_mode: "per_question",
    question: "Jelaskan dua dampak politik dari Proklamasi Kemerdekaan Indonesia.",
    ideal_answer: "Proklamasi menandai lahirnya negara Indonesia dan menjadi dasar pembentukan pemerintahan nasional yang sah.",
    keywords: ["proklamasi", "negara", "pemerintahan", "kemerdekaan"],
    student_answer: "Proklamasi membuat Indonesia resmi berdiri sebagai negara merdeka. Setelah itu bangsa Indonesia bisa membentuk pemerintahan sendiri tanpa bergantung pada Jepang.",
    expected_quality: "high",
    expected_teacher_score_band: "80-100",
    expected_error_risk: ["undercredit_short_correct", "false_negative_paraphrase"],
    notes: "Jawaban ringkas tapi inti benar.",
  },
  {
    id: "CAL-002",
    subject: "Sejarah Indonesia",
    rubric_mode: "per_question",
    question: "Jelaskan dua dampak politik dari Proklamasi Kemerdekaan Indonesia.",
    ideal_answer: "Proklamasi menandai lahirnya negara Indonesia dan menjadi dasar pembentukan pemerintahan nasional yang sah.",
    keywords: ["proklamasi", "negara", "pemerintahan", "kemerdekaan"],
    student_answer: "Proklamasi membuat rakyat senang dan semangat. Semua orang menjadi bangga karena Indonesia punya bendera sendiri.",
    expected_quality: "low",
    expected_teacher_score_band: "20-50",
    expected_error_risk: ["false_positive_keyword_match", "overcredit_fluency"],
    notes: "Relevan umum, tetapi tidak menjawab dampak politik inti.",
  },
  {
    id: "CAL-003",
    subject: "Sejarah Indonesia",
    rubric_mode: "global",
    question: "Mengapa BPUPKI dibentuk pada masa pendudukan Jepang?",
    ideal_answer: "BPUPKI dibentuk untuk mempersiapkan kemerdekaan Indonesia, sekaligus menarik simpati rakyat di tengah posisi Jepang yang melemah.",
    keywords: ["BPUPKI", "Jepang", "kemerdekaan", "simpati rakyat"],
    student_answer: "BPUPKI dibentuk karena Jepang mulai terdesak dalam perang. Dengan badan itu Jepang berusaha mengambil hati rakyat Indonesia sambil menyiapkan janji kemerdekaan.",
    expected_quality: "high",
    expected_teacher_score_band: "80-100",
    expected_error_risk: ["global_rubric_too_generic"],
    notes: "Bagus untuk cek apakah rubrik global masih cukup presisi.",
  },
  {
    id: "CAL-004",
    subject: "Sejarah Indonesia",
    rubric_mode: "global",
    question: "Mengapa BPUPKI dibentuk pada masa pendudukan Jepang?",
    ideal_answer: "BPUPKI dibentuk untuk mempersiapkan kemerdekaan Indonesia, sekaligus menarik simpati rakyat di tengah posisi Jepang yang melemah.",
    keywords: ["BPUPKI", "Jepang", "kemerdekaan", "simpati rakyat"],
    student_answer: "BPUPKI dibentuk untuk membuat undang-undang dasar sesudah Indonesia lama merdeka dan supaya Jepang bisa menjadi sekutu Indonesia.",
    expected_quality: "low",
    expected_teacher_score_band: "10-40",
    expected_error_risk: ["false_positive_keyword_match", "rag_override_rubric"],
    notes: "Ada istilah relevan tetapi konsep inti salah.",
  },
  {
    id: "CAL-005",
    subject: "Sejarah Indonesia",
    rubric_mode: "per_question",
    question: "Apa perbedaan utama BPUPKI dan PPKI?",
    ideal_answer: "BPUPKI bertugas menyelidiki dan merumuskan dasar negara serta persiapan kemerdekaan, sedangkan PPKI bertugas mengesahkan dan menjalankan langkah awal setelah kemerdekaan.",
    keywords: ["BPUPKI", "PPKI", "dasar negara", "pengesahan"],
    student_answer: "BPUPKI lebih fokus merancang dan membahas dasar negara. PPKI dipakai untuk mengesahkan hasil dan menjalankan pembentukan negara setelah merdeka.",
    expected_quality: "high",
    expected_teacher_score_band: "85-100",
    expected_error_risk: ["false_negative_paraphrase"],
    notes: "Jawaban tepat dengan wording berbeda.",
  },
  {
    id: "CAL-006",
    subject: "Sejarah Indonesia",
    rubric_mode: "per_question",
    question: "Apa perbedaan utama BPUPKI dan PPKI?",
    ideal_answer: "BPUPKI bertugas menyelidiki dan merumuskan dasar negara serta persiapan kemerdekaan, sedangkan PPKI bertugas mengesahkan dan menjalankan langkah awal setelah kemerdekaan.",
    keywords: ["BPUPKI", "PPKI", "dasar negara", "pengesahan"],
    student_answer: "BPUPKI dan PPKI sama saja karena keduanya dibentuk Jepang untuk membahas kemerdekaan. Bedanya hanya nama.",
    expected_quality: "low",
    expected_teacher_score_band: "0-30",
    expected_error_risk: ["overcredit_fluency", "partial_answer_extreme"],
    notes: "Kalimat rapi, isi tidak akurat.",
  },
];

const errorPatternDescriptions: Record<string, string> = {
  false_negative_paraphrase: "Jawaban benar, phrasing berbeda dari jawaban ideal.",
  false_positive_keyword_match: "Jawaban salah tetapi keyword kebetulan cocok.",
  overcredit_fluency: "Bahasa rapi menutupi isi yang lemah.",
  undercredit_short_correct: "Jawaban singkat tapi benar diberi skor terlalu rendah.",
  rag_override_rubric: "Konteks RAG terlalu dominan dan mengalahkan rubrik.",
  global_rubric_too_generic: "Rubrik global terlalu umum untuk soal spesifik.",
  partial_answer_extreme: "Jawaban parsial dinilai terlalu ekstrem.",
  hallucinated_evidence: "AI mengklaim bukti yang tidak ada di jawaban siswa.",
};

const manualScoreSheetCsv = `sample_id,rubric_mode,question,teacher_name,teacher_final_score,teacher_aspect_notes,ai_final_score,ai_feedback_summary,score_gap,error_pattern,teacher_review_needed,notes
CAL-001,per_question,"Jelaskan dua dampak politik dari Proklamasi Kemerdekaan Indonesia.",,,,,,,,,
CAL-002,per_question,"Jelaskan dua dampak politik dari Proklamasi Kemerdekaan Indonesia.",,,,,,,,,
CAL-003,global,"Mengapa BPUPKI dibentuk pada masa pendudukan Jepang?",,,,,,,,,
CAL-004,global,"Mengapa BPUPKI dibentuk pada masa pendudukan Jepang?",,,,,,,,,
CAL-005,per_question,"Apa perbedaan utama BPUPKI dan PPKI?",,,,,,,,,
CAL-006,per_question,"Apa perbedaan utama BPUPKI dan PPKI?",,,,,,,,,
CAL-007,global,"Mengapa peristiwa Rengasdengklok penting bagi Proklamasi?",,,,,,,,,
CAL-008,global,"Mengapa peristiwa Rengasdengklok penting bagi Proklamasi?",,,,,,,,,
CAL-009,per_question,"Sebutkan satu alasan bangsa Eropa datang ke Nusantara pada awal masa penjelajahan samudra.",,,,,,,,,
CAL-010,per_question,"Sebutkan satu alasan bangsa Eropa datang ke Nusantara pada awal masa penjelajahan samudra.",,,,,,,,,
CAL-011,global,"Jelaskan secara singkat makna Sumpah Pemuda bagi persatuan Indonesia.",,,,,,,,,
CAL-012,global,"Jelaskan secara singkat makna Sumpah Pemuda bagi persatuan Indonesia.",,,,,,,,,`;

export default function SuperadminGradingCalibrationPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "global" | "per_question">("all");
  const [message, setMessage] = useState<string | null>(null);

  const filteredSamples = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return samples.filter((sample) => {
      const modeMatch = mode === "all" || sample.rubric_mode === mode;
      const text = `${sample.id} ${sample.question} ${sample.student_answer} ${sample.keywords.join(" ")} ${sample.expected_error_risk.join(" ")}`.toLowerCase();
      const queryMatch = !needle || text.includes(needle);
      return modeMatch && queryMatch;
    });
  }, [mode, query]);

  const modeCounts = useMemo(
    () => ({
      all: samples.length,
      global: samples.filter((sample) => sample.rubric_mode === "global").length,
      per_question: samples.filter((sample) => sample.rubric_mode === "per_question").length,
    }),
    [],
  );

  const exportJsonSamples = () => {
    const blob = new Blob([JSON.stringify(samples, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grading-calibration-test-set-v1.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("File JSON sample berhasil diunduh.");
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([manualScoreSheetCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grading-calibration-manual-score-sheet.csv";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Template CSV berhasil diunduh.");
  };

  const copyCsvTemplate = async () => {
    try {
      await navigator.clipboard.writeText(manualScoreSheetCsv);
      setMessage("Template CSV berhasil disalin ke clipboard.");
    } catch {
      setMessage("Gagal menyalin CSV ke clipboard. Gunakan file di docs/grading-calibration/manual-score-sheet.csv.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              <FiTarget />
              Grading Calibration
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Benchmark akurasi grading sebelum deploy</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Halaman ini menampilkan paket kalibrasi internal untuk membandingkan hasil AI terhadap penilaian guru, terutama setelah perubahan prompt, light RAG, dan mode rubrik global vs per-soal.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Target minimum</p>
            <p>Rata-rata selisih skor AI ke guru tidak lebih dari 10 poin.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="sage-button inline-flex items-center gap-2" onClick={exportJsonSamples}>
            <FiDownload size={14} />
            Export JSON Samples
          </button>
          <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={downloadCsvTemplate}>
            <FiDownload size={14} />
            Download CSV Template
          </button>
          <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={copyCsvTemplate}>
            <FiClipboard size={14} />
            Copy CSV Template
          </button>
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Sampel" value={String(samples.length)} helper="Campuran global + per-soal." icon={<FiClipboard />} />
        <StatCard title="Rubrik Global" value={String(modeCounts.global)} helper="Cek apakah rubrik terlalu generik." icon={<FiSliders />} />
        <StatCard title="Rubrik Per-Soal" value={String(modeCounts.per_question)} helper="Cek kestabilan soal spesifik." icon={<FiCheckCircle />} />
      </div>

      <div className="sage-panel p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[260px] flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sage-input pl-10"
              placeholder="Cari sample, pertanyaan, atau error pattern..."
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton active={mode === "all"} onClick={() => setMode("all")}>
              Semua ({modeCounts.all})
            </FilterButton>
            <FilterButton active={mode === "global"} onClick={() => setMode("global")}>
              Global ({modeCounts.global})
            </FilterButton>
            <FilterButton active={mode === "per_question"} onClick={() => setMode("per_question")}>
              Per-Soal ({modeCounts.per_question})
            </FilterButton>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gunakan sampel ini bersama file `docs/grading-calibration/manual-score-sheet.csv`. Minta 1-2 guru memberi skor manual, lalu bandingkan hasil AI untuk melihat pola error yang dominan.
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {filteredSamples.map((sample) => (
            <article key={sample.id} className="sage-panel p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{sample.id}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{sample.question}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sample.rubric_mode === "global" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>
                    {sample.rubric_mode === "global" ? "Rubrik Global" : "Rubrik Per-Soal"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sample.expected_quality === "high" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    Expected {sample.expected_quality === "high" ? "High" : "Low"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoBlock title="Ideal Answer" content={sample.ideal_answer} />
                <InfoBlock title="Student Answer" content={sample.student_answer} />
              </div>

              <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ekspektasi Guru</p>
                  <p className="mt-2 text-sm text-slate-700">Score band: <span className="font-semibold text-slate-900">{sample.expected_teacher_score_band}</span></p>
                  <p className="mt-2 text-sm text-slate-600">{sample.notes}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Risk Pattern</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sample.expected_error_risk.map((risk) => (
                      <span key={risk} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {sample.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                    {keyword}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {filteredSamples.length === 0 && (
            <div className="sage-panel p-6 text-sm text-slate-500">Tidak ada sampel yang cocok dengan filter saat ini.</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="sage-panel p-5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiAlertTriangle className="text-amber-600" />
              Error Pattern Checklist
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(errorPatternDescriptions).map(([key, desc]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{key}</p>
                  <p className="mt-1 text-sm text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="sage-panel p-5">
            <p className="text-sm font-semibold text-slate-900">Langkah Review Cepat</p>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li>1. Ambil 10-12 sampel dari halaman ini.</li>
              <li>2. Nilai manual oleh guru tanpa melihat hasil AI.</li>
              <li>3. Jalankan AI grading dan catat skor akhirnya.</li>
              <li>4. Hitung selisih skor dan tandai error pattern dominan.</li>
              <li>5. Jika error dominan di `global`, pindahkan tipe soal itu ke rubrik per-soal.</li>
            </ol>
          </div>

          <div className="sage-panel p-5">
            <p className="text-sm font-semibold text-slate-900">Sumber Internal</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>`docs/grading-calibration/README.md`</p>
              <p>`docs/grading-calibration/test-set-v1.json`</p>
              <p>`docs/grading-calibration/manual-score-sheet.csv`</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="sage-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <span className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</span>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function InfoBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{content}</p>
    </div>
  );
}
