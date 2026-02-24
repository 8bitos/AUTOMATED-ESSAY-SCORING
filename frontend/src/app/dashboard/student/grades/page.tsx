"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiBarChart2, FiBookOpen, FiClipboard, FiFileText, FiMessageSquare, FiFilter, FiSearch } from "react-icons/fi";
import TeacherProfileModal from "@/components/TeacherProfileModal";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface EssayQuestion {
  id: string;
  submission_id?: string;
  skor_ai?: number;
  revised_score?: number;
  teacher_feedback?: string;
  weight?: number;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  created_at?: string;
  updated_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassItem {
  id: string;
  class_name: string;
  teacher_name?: string;
  teacher_id?: string;
  pengajar_id?: string;
  materials?: Material[];
}

type GradeFilter = "all" | "completed" | "incomplete" | "needs_improvement";
type GradeSort = "latest" | "score_high" | "score_low" | "alphabet";

interface MaterialGradeRow {
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  materialId: string;
  materialType: "materi" | "soal" | "tugas";
  materialTitle: string;
  totalQuestions: number;
  answeredQuestions: number;
  score: number | null;
  updatedAt?: string;
  latestFeedback?: string;
}

export default function StudentGradesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GradeFilter>("all");
  const [sortBy, setSortBy] = useState<GradeSort>("latest");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/my-classes", { credentials: "include" });
        if (!res.ok) throw new Error("Gagal memuat data nilai.");
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const classOptions = useMemo(() => {
    return classes.map((cls) => ({ id: cls.id, name: cls.class_name }));
  }, [classes]);

  const calculateFinalScore = (questions: EssayQuestion[]) => {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) return null;
    const scoredQuestions = questions.filter((q) => {
      const score = q.revised_score ?? q.skor_ai;
      return q.submission_id && typeof score === "number";
    });
    if (scoredQuestions.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;
    scoredQuestions.forEach((q) => {
      const score = (q.revised_score ?? q.skor_ai) as number;
      const weight = typeof q.weight === "number" && q.weight > 0 ? q.weight : 1;
      weightedSum += score * weight;
      totalWeight += weight;
    });
    if (totalWeight <= 0) return 0;
    const weightedAverage = weightedSum / totalWeight;
    const completionFactor = scoredQuestions.length / totalQuestions;
    return weightedAverage * completionFactor;
  };

  const allRows = useMemo<MaterialGradeRow[]>(() => {
    const rows: MaterialGradeRow[] = [];
    classes.forEach((cls) => {
      const materials = Array.isArray(cls.materials) ? cls.materials : [];
      materials.forEach((material) => {
        const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
        const answeredQuestions = questions.filter((q) => !!q.submission_id).length;
        const latestFeedback = questions
          .map((q) => (q.teacher_feedback || "").trim())
          .find((text) => text.length > 0);

        rows.push({
          classId: cls.id,
          className: cls.class_name,
          teacherId: cls.teacher_id || cls.pengajar_id,
          teacherName: cls.teacher_name,
          materialId: material.id,
          materialType: (material.material_type || "materi") as "materi" | "soal" | "tugas",
          materialTitle: material.judul,
          totalQuestions: questions.length,
          answeredQuestions,
          score: calculateFinalScore(questions),
          updatedAt: material.updated_at || material.created_at,
          latestFeedback,
        });
      });
    });
    return rows;
  }, [classes]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      if (selectedClassId !== "all" && row.classId !== selectedClassId) return false;
      const matchQuery =
        !q ||
        row.materialTitle.toLowerCase().includes(q) ||
        row.className.toLowerCase().includes(q) ||
        String(row.teacherName || "").toLowerCase().includes(q);

      const isCompleted = row.totalQuestions > 0 && row.answeredQuestions === row.totalQuestions;
      const isIncomplete = row.totalQuestions > 0 && row.answeredQuestions < row.totalQuestions;
      const needsImprovement = typeof row.score === "number" && row.score < 75;

      const matchFilter =
        filter === "all" ||
        (filter === "completed" && isCompleted) ||
        (filter === "incomplete" && isIncomplete) ||
        (filter === "needs_improvement" && needsImprovement);

      return matchQuery && matchFilter;
    });

    return rows.sort((a, b) => {
      if (sortBy === "score_high") return (b.score ?? -1) - (a.score ?? -1);
      if (sortBy === "score_low") return (a.score ?? 999) - (b.score ?? 999);
      if (sortBy === "alphabet") return a.materialTitle.localeCompare(b.materialTitle, "id", { sensitivity: "base" });
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bt - at;
    });
  }, [allRows, filter, query, selectedClassId, sortBy]);

  const summary = useMemo(() => {
    const numericScores = allRows
      .map((r) => r.score)
      .filter((score): score is number => typeof score === "number");
    const avg = numericScores.length > 0 ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length : 0;
    const completed = allRows.filter((r) => r.totalQuestions > 0 && r.answeredQuestions === r.totalQuestions).length;
    const needsImprovement = allRows.filter((r) => typeof r.score === "number" && (r.score as number) < 75).length;
    const unreadReview = allRows.filter((r) => (r.latestFeedback || "").trim().length > 0).length;

    return {
      averageScore: avg,
      completedMaterials: completed,
      needsImprovement,
      reviewedWithFeedback: unreadReview,
    };
  }, [allRows]);

  const latestFeedbackItems = useMemo(() => {
    return allRows
      .filter((row) => (row.latestFeedback || "").trim().length > 0)
      .sort((a, b) => {
        const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bt - at;
      })
      .slice(0, 5);
  }, [allRows]);

  const scoreDistributionData = useMemo(() => {
    const high = allRows.filter((r) => typeof r.score === "number" && (r.score as number) >= 85).length;
    const medium = allRows.filter((r) => typeof r.score === "number" && (r.score as number) >= 75 && (r.score as number) < 85).length;
    const low = allRows.filter((r) => typeof r.score === "number" && (r.score as number) < 75).length;
    return [
      { name: "≥ 85", value: high, color: "#10b981" },
      { name: "75-84", value: medium, color: "#f59e0b" },
      { name: "< 75", value: low, color: "#ef4444" },
    ];
  }, [allRows]);

  const classAverageData = useMemo(() => {
    return classOptions.map((opt) => {
      const scores = allRows
        .filter((r) => r.classId === opt.id && typeof r.score === "number")
        .map((r) => r.score as number);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        className: opt.name.length > 14 ? `${opt.name.slice(0, 14)}...` : opt.name,
        avg: Number(avg.toFixed(2)),
      };
    });
  }, [allRows, classOptions]);

  const getStatus = (row: MaterialGradeRow) => {
    if (row.totalQuestions === 0) return { label: "Tanpa Soal", cls: "bg-slate-100 text-slate-700" };
    if (row.answeredQuestions < row.totalQuestions) return { label: "Belum Lengkap", cls: "bg-amber-100 text-amber-800" };
    if (typeof row.score === "number" && row.score < 75) return { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" };
    return { label: "Selesai", cls: "bg-emerald-100 text-emerald-800" };
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nilai & Feedback</h1>
        <p className="text-sm text-slate-500">Pantau hasil penilaian akhir materi dan feedback dari guru.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Rata-rata Nilai Akhir</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.averageScore.toFixed(2)}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Materi Selesai</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{summary.completedMaterials}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Perlu Perbaikan (&lt;75)</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{summary.needsImprovement}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Materi Ada Feedback</p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--sage-700)]">{summary.reviewedWithFeedback}</p>
        </div>
      </section>

      <section className="sage-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari materi, kelas, atau guru..."
              className="sage-input pl-10"
            />
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="sage-input pl-10 min-w-52">
              <option value="all">Semua Kelas</option>
              {classOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as GradeFilter)} className="sage-input pl-10 min-w-52">
              <option value="all">Status: Semua</option>
              <option value="completed">Status: Selesai</option>
              <option value="incomplete">Status: Belum Lengkap</option>
              <option value="needs_improvement">Status: Perlu Perbaikan</option>
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as GradeSort)} className="sage-input pl-10 min-w-52">
              <option value="latest">Urutkan: Terbaru</option>
              <option value="score_high">Urutkan: Nilai Tertinggi</option>
              <option value="score_low">Urutkan: Nilai Terendah</option>
              <option value="alphabet">Urutkan: Materi A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] items-start">
        <section className="sage-panel p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Kelas</th>
                <th className="px-3 py-2 font-medium">Materi</th>
                <th className="px-3 py-2 font-medium">Tipe</th>
                <th className="px-3 py-2 font-medium">Nilai Akhir</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Update</th>
                <th className="px-3 py-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Memuat nilai...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Belum ada data nilai sesuai filter.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredRows.map((row) => {
                  const status = getStatus(row);
                  const typeIcon =
                    row.materialType === "soal" ? <FiFileText size={15} className="text-blue-600" /> : row.materialType === "tugas" ? <FiClipboard size={15} className="text-purple-600" /> : <FiBookOpen size={15} className="text-emerald-600" />;
                  return (
                    <tr key={`${row.classId}-${row.materialId}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{row.className}</p>
                        <button
                          type="button"
                          className="text-xs text-[color:var(--sage-700)] hover:underline"
                          onClick={() => {
                            setSelectedTeacherId(row.teacherId || null);
                            setSelectedTeacherName(row.teacherName || null);
                            setProfileModalOpen(true);
                          }}
                        >
                          {row.teacherName || "-"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-2">
                          {typeIcon}
                          <span>{row.materialTitle}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            row.materialType === "soal"
                              ? "bg-blue-100 text-blue-700"
                              : row.materialType === "tugas"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {row.materialType === "soal" ? "Soal" : row.materialType === "tugas" ? "Tugas" : "Materi"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.score == null ? "-" : row.score.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("id-ID") : "-"}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`}
                          className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          Lihat Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>

        <aside className="space-y-4">
          <div className="sage-panel p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiMessageSquare />
              Feedback Terbaru
            </p>
            <div className="mt-3 space-y-3">
              {latestFeedbackItems.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada feedback guru yang tercatat.</p>
              ) : (
                latestFeedbackItems.map((item) => (
                  <div key={`${item.classId}-${item.materialId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{item.className}</p>
                    <p className="text-sm font-medium text-slate-900">{item.materialTitle}</p>
                    <p className="mt-1 text-xs text-slate-700 line-clamp-3">{item.latestFeedback}</p>
                    <Link
                      href={`/dashboard/student/classes/${item.classId}/materials/${item.materialId}`}
                      className="mt-2 inline-flex text-xs text-[color:var(--sage-700)] hover:underline"
                    >
                      Buka materi
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sage-panel p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiBarChart2 />
              Ringkasan Distribusi
            </p>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={38}
                    label
                  >
                    {scoreDistributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1 text-xs">
              {scoreDistributionData.map((item) => (
                <p key={item.name} className="flex items-center justify-between">
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-medium text-slate-900">{item.value}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="sage-panel p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FiBarChart2 />
              Rata-rata per Kelas
            </p>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAverageData} margin={{ left: -18, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#334155" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
      </div>

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
