"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import TeacherProfileModal from '@/components/TeacherProfileModal';

interface Class {
  id: string;
  teacher_id: string;
  pengajar_id?: string;
  teacher_name?: string;
  class_name: string;
  deskripsi: string;
  class_code: string;
  created_at: string;
  updated_at: string;
}

interface PendingClass {
  class_id: string;
  class_name: string;
  class_code: string;
  teacher_id: string;
  teacher_name: string;
  status: string;
  requested_at: string;
}

export default function StudentMyClassesPage() {
  const { user } = useAuth();
  const [classCode, setClassCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [fetchingClasses, setFetchingClasses] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);

  const fetchClasses = async () => {
    setFetchingClasses(true);
    try {
      const [classesRes, pendingRes] = await Promise.all([
        fetch(`/api/student/my-classes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
        fetch(`/api/student/pending-classes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
      ]);

      if (!classesRes.ok) throw new Error('Failed to fetch classes.');
      if (!pendingRes.ok) throw new Error('Failed to fetch pending classes.');

      const classesData: Class[] = await classesRes.json();
      const pendingData: PendingClass[] = await pendingRes.json();
      setClasses(Array.isArray(classesData) ? classesData : []);
      setPendingClasses(Array.isArray(pendingData) ? pendingData : []);
    } catch (err: any) {
      setMessage(`Error fetching classes: ${err.message}`);
    } finally {
      setFetchingClasses(false);
    }
  };

  useEffect(() => { fetchClasses(); }, []);

  const openTeacherProfile = (teacherId?: string, teacherName?: string) => {
    setSelectedTeacherId(teacherId || null);
    setSelectedTeacherName(teacherName || null);
    setProfileModalOpen(true);
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch(`/api/student/join-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ class_code: classCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to join class.');
      setMessage(data.message || 'Permintaan bergabung berhasil dikirim.');
      setClassCode('');
      fetchClasses();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8">
      <header className="sage-panel p-6 flex flex-col gap-2">
        <p className="sage-pill">Kelas Saya</p>
        <h1 className="text-3xl text-slate-900">Daftar Kelas Aktif</h1>
        <p className="text-slate-500">
          Welcome, {user?.nama_lengkap} ({user?.peran})
        </p>
      </header>

      <div className="sage-panel p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gabung Kelas Baru</h2>
            <p className="text-sm text-slate-500">Masukkan kode kelas dari guru Anda.</p>
          </div>
          <form onSubmit={handleJoinClass} className="flex w-full max-w-md gap-3">
            <input
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="Kode kelas"
              className="sage-input"
              required
            />
            <button type="submit" disabled={loading} className="sage-button">
              {loading ? "Joining..." : "Join"}
            </button>
          </form>
        </div>
        {message && (
          <p className={`text-sm mt-3 ${message.startsWith('Error:') ? 'text-red-500' : 'text-slate-700'}`}>
            {message}
          </p>
        )}
      </div>

      {!fetchingClasses && pendingClasses.length > 0 && (
        <div className="sage-panel p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Menunggu ACC Guru</h2>
            <span className="sage-pill">{pendingClasses.length} pending</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingClasses.map((item) => (
              <div key={item.class_id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">{item.class_name}</h3>
                <p className="text-sm text-slate-600 mt-1">Code: {item.class_code}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Guru:{" "}
                  <button
                    type="button"
                    onClick={() => openTeacherProfile(item.teacher_id, item.teacher_name)}
                    className="text-[color:var(--sage-700)] hover:underline"
                  >
                    {item.teacher_name || "-"}
                  </button>
                </p>
                <p className="mt-2 text-xs text-amber-800">Status: Menunggu persetujuan</p>
                <p className="text-xs text-slate-500 mt-1">
                  Requested: {new Date(item.requested_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {fetchingClasses ? (
        <p className="text-center text-slate-500 text-lg">Loading classes...</p>
      ) : classes.length === 0 ? (
        <div className="sage-panel p-10 text-center text-slate-500">You haven't joined any classes yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div key={cls.id} className="sage-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">{cls.class_name}</h3>
                <p className="text-slate-600 font-medium mb-2">Code: {cls.class_code}</p>
                <p className="text-slate-500 text-sm mb-2">
                  Guru Pengampu:{" "}
                  <button
                    type="button"
                    onClick={() => openTeacherProfile(cls.teacher_id || cls.pengajar_id, cls.teacher_name)}
                    className="text-[color:var(--sage-700)] hover:underline"
                  >
                    {cls.teacher_name || '-'}
                  </button>
                </p>
                <p className="text-slate-500 text-sm line-clamp-3 mb-4">{cls.deskripsi}</p>
                <Link href={`/dashboard/student/classes/${cls.id}`} className="sage-button-outline">
                  View Class
                </Link>
              </div>
              <p className="text-slate-500 text-xs mt-4">
                Joined: {new Date(cls.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
