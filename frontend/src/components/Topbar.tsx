import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import { useTheme } from '@/context/ThemeContext';
import Image from 'next/image';
import {
  fetchStudentNotifications,
  hydrateStudentNotificationPrefs,
  loadStudentNotificationPrefs,
  STUDENT_NOTIFICATION_PREFS_KEY,
  StudentNotificationPrefs,
} from '@/lib/studentNotifications';
import {
  DEFAULT_NOTIFICATION_POLL_INTERVAL_MS,
  loadNotificationPollIntervalMs,
  subscribeNotificationStream,
} from '@/lib/notificationRealtime';
import {
  fetchTeacherNotifications,
  hydrateTeacherNotificationPrefs,
  loadTeacherNotificationPrefs,
  TEACHER_NOTIFICATION_PREFS_KEY,
  TeacherNotificationPrefs,
} from '@/lib/teacherNotifications';
import {
  fetchSuperadminNotifications,
  hydrateSuperadminNotificationPrefs,
  loadSuperadminNotificationPrefs,
  SUPERADMIN_NOTIFICATION_PREFS_KEY,
  SuperadminNotificationPrefs,
} from '@/lib/superadminNotifications';
import { markAllNotificationCenterItemsRead, markNotificationCenterItemsRead } from '@/lib/notificationCenter';

interface TopbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const NOTIF_READ_STORAGE_PREFIX = 'read_notifications_';
const SEARCH_RECENT_PREFIX = 'topbar_command_recent_';

type CommandCategory = 'Terakhir' | 'Navigasi' | 'Aksi' | 'Kelas' | 'Siswa' | 'Konten';
type SearchKind = 'materi' | 'soal' | 'tugas' | 'general';

type SearchClassItem = {
  id: string;
  name: string;
  code?: string;
  status?: string;
};

type SearchStudentItem = {
  id: string;
  name: string;
  email?: string;
  classId?: string;
  className?: string;
  status?: string;
};

type SearchContentItem = {
  id: string;
  title: string;
  classId?: string;
  className?: string;
  materialId?: string;
  href?: string;
  kind: SearchKind;
  status?: string;
  searchableText?: string;
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  category: CommandCategory;
  keywords: string[];
  actionKey?: string;
  meta?: {
    classId?: string;
    className?: string;
    status?: string;
    kind?: SearchKind;
  };
};

type ParsedSearch = {
  text: string;
  kelas: string;
  status: string;
  jenis: string;
};

const parseCommandSearch = (raw: string): ParsedSearch => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const parsed: ParsedSearch = { text: '', kelas: '', status: '', jenis: '' };
  const free: string[] = [];
  for (const token of tokens) {
    const [k, ...rest] = token.split(':');
    if (!rest.length) {
      free.push(token);
      continue;
    }
    const key = k.toLowerCase().trim();
    const value = rest.join(':').toLowerCase().trim();
    if (!value) continue;
    if (key === 'kelas' || key === 'class') {
      parsed.kelas = value;
      continue;
    }
    if (key === 'status') {
      parsed.status = value;
      continue;
    }
    if (key === 'jenis' || key === 'type') {
      parsed.jenis = value;
      continue;
    }
    free.push(token);
  }
  parsed.text = free.join(' ').toLowerCase();
  return parsed;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const normalizeText = (value: unknown): string => {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const safeParseJson = (value: unknown): unknown | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractMaterialBodyText = (material: Record<string, unknown>): string => {
  const raw = normalizeText(material.isi_materi);
  if (!raw) return '';
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== 'object') return stripHtmlTags(raw);
  const obj = asRecord(parsed);

  if (obj.format === 'sage_blocks' && Array.isArray(obj.blocks)) {
    return normalizeText(
      obj.blocks
        .map((block) => normalizeText(asRecord(block).value))
        .filter(Boolean)
        .join(' ')
    );
  }

  if (obj.format === 'sage_section_cards_v1' && Array.isArray(obj.items)) {
    const merged = obj.items
      .map((item) => {
        const it = asRecord(item);
        const meta = asRecord(it.meta);
        return [
          normalizeText(it.title),
          stripHtmlTags(normalizeText(it.body)),
          stripHtmlTags(normalizeText(meta.materi_description)),
          normalizeText(meta.description),
        ]
          .filter(Boolean)
          .join(' ');
      })
      .filter(Boolean)
      .join(' ');
    return normalizeText(merged);
  }

  return stripHtmlTags(raw);
};

const extractQuestionsText = (questionsRaw: unknown): string => {
  const questions = Array.isArray(questionsRaw) ? questionsRaw : [];
  const chunks: string[] = [];
  for (const rawQuestion of questions) {
    const q = asRecord(rawQuestion);
    chunks.push(normalizeText(q.teks_soal));
    chunks.push(normalizeText(q.ideal_answer));
    const keywordValue = q.keywords;
    if (Array.isArray(keywordValue)) {
      chunks.push(keywordValue.map((k) => normalizeText(k)).filter(Boolean).join(' '));
    } else {
      chunks.push(normalizeText(keywordValue));
    }
    const rubrics = Array.isArray(q.rubrics) ? q.rubrics : [];
    for (const rawRubric of rubrics) {
      const rubric = asRecord(rawRubric);
      chunks.push(normalizeText(rubric.nama_aspek));
      const descriptors = rubric.descriptors;
      if (Array.isArray(descriptors)) {
        for (const row of descriptors) {
          const d = asRecord(row);
          chunks.push(normalizeText(d.score));
          chunks.push(normalizeText(d.description || d.deskripsi));
        }
      } else if (descriptors && typeof descriptors === 'object') {
        const descObj = asRecord(descriptors);
        for (const [score, desc] of Object.entries(descObj)) {
          chunks.push(normalizeText(score));
          chunks.push(normalizeText(desc));
        }
      }
    }
  }
  return normalizeText(chunks.filter(Boolean).join(' '));
};

const Topbar: React.FC<TopbarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    href?: string;
    isRead?: boolean;
  }>>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [teacherNotifPrefs, setTeacherNotifPrefs] = useState<TeacherNotificationPrefs>({
    classRequests: true,
    assessmentUpdates: true,
    appealRequests: true,
    profileApprovals: true,
    systemAnnouncements: true,
    classAnnouncements: true,
    sidebarIndicators: true,
  });
  const [superadminNotifPrefs, setSuperadminNotifPrefs] = useState<SuperadminNotificationPrefs>({
    approvalRequests: true,
    anomalyAlerts: true,
    sidebarIndicators: true,
  });
  const [studentNotifPrefs, setStudentNotifPrefs] = useState<StudentNotificationPrefs>({
    profileApprovals: true,
    classApproved: true,
    classInvited: true,
    classAnnouncements: true,
    systemAnnouncements: true,
    newMaterials: true,
    deadlineReminders: true,
    aiGradingComplete: true,
    reviewedScores: true,
    newQuestions: true,
    appealUpdates: true,
    sidebarIndicators: true,
  });
  const [impersonationActive, setImpersonationActive] = useState(false);
  const [impersonationBusy, setImpersonationBusy] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(DEFAULT_NOTIFICATION_POLL_INTERVAL_MS);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandDataLoaded, setCommandDataLoaded] = useState(false);
  const [commandClasses, setCommandClasses] = useState<SearchClassItem[]>([]);
  const [commandStudents, setCommandStudents] = useState<SearchStudentItem[]>([]);
  const [commandContents, setCommandContents] = useState<SearchContentItem[]>([]);
  const [recentCommands, setRecentCommands] = useState<CommandItem[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [shortcutHint, setShortcutHint] = useState('Ctrl+K');

  const trigger = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const notifTrigger = useRef<HTMLButtonElement>(null);
  const notifPanel = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const getReadStorageKey = useCallback(() => {
    const userKey = user?.id || user?.nama_lengkap || 'anon';
    return `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  const getRecentCommandStorageKey = useCallback(() => {
    const userKey = user?.id || user?.nama_lengkap || 'anon';
    return `${SEARCH_RECENT_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  const loadReadNotifications = () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(getReadStorageKey());
    if (!raw) {
      setReadNotificationIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setReadNotificationIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadNotificationIds([]);
    }
  };

  const persistReadNotifications = (ids: string[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getReadStorageKey(), JSON.stringify(ids));
    setReadNotificationIds(ids);
  };

  const loadRecentCommands = useCallback(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(getRecentCommandStorageKey());
    if (!raw) {
      setRecentCommands([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setRecentCommands(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentCommands([]);
    }
  }, [getRecentCommandStorageKey]);

  const persistRecentCommands = useCallback((items: CommandItem[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getRecentCommandStorageKey(), JSON.stringify(items.slice(0, 8)));
    setRecentCommands(items.slice(0, 8));
  }, [getRecentCommandStorageKey]);

  const loadTeacherNotifPrefs = async () => {
    setTeacherNotifPrefs(loadTeacherNotificationPrefs());
    setTeacherNotifPrefs(await hydrateTeacherNotificationPrefs());
  };

  const loadSuperadminNotifPrefs = async () => {
    setSuperadminNotifPrefs(loadSuperadminNotificationPrefs());
    setSuperadminNotifPrefs(await hydrateSuperadminNotificationPrefs());
  };

  const hydrateStudentNotifPrefs = async () => {
    setStudentNotifPrefs(loadStudentNotificationPrefs());
    setStudentNotifPrefs(await hydrateStudentNotificationPrefs());
  };

  const { theme, toggleTheme } = useTheme();

  const loadImpersonationStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/impersonation/status', { credentials: 'include' });
      if (!res.ok) {
        setImpersonationActive(false);
        return;
      }
      const data = await res.json();
      setImpersonationActive(Boolean(data?.active));
    } catch {
      setImpersonationActive(false);
    }
  };

  const handleStopImpersonation = async () => {
    setImpersonationBusy(true);
    try {
      const res = await fetch('/api/impersonation/stop', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Gagal menghentikan impersonation');
      window.location.href = '/dashboard/superadmin';
    } catch {
      setImpersonationBusy(false);
    }
  };

  const notificationPageByRole = (role?: string) => {
    if (role === 'teacher') return '/dashboard/teacher/notifikasi';
    if (role === 'superadmin') return '/dashboard/superadmin/notifikasi';
    if (role === 'student') return '/dashboard/student/notifikasi';
    return '/dashboard';
  };

  const formatNotifDate = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  };

  const loadNotifications = async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      if (user.peran === 'teacher') {
        const allItems = await fetchTeacherNotifications(teacherNotifPrefs);
        setNotifications(allItems.slice(0, 12));
        setReadNotificationIds(allItems.filter((item) => item.isRead).map((item) => item.id));
        return;
      }

      if (user.peran === 'superadmin') {
        const items = await fetchSuperadminNotifications(superadminNotifPrefs);
        setNotifications(items.slice(0, 12));
        setReadNotificationIds(items.filter((item) => item.isRead).map((item) => item.id));
        return;
      }

      if (user.peran === 'student') {
        const studentItems = await fetchStudentNotifications(studentNotifPrefs);
        setNotifications(studentItems.slice(0, 12));
        setReadNotificationIds(studentItems.filter((item) => item.isRead).map((item) => item.id));
        return;
      }

      setNotifications([]);
      setReadNotificationIds([]);
    } catch {
      setNotifications([]);
      setReadNotificationIds([]);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (user?.peran === 'teacher') void loadTeacherNotifPrefs();
    if (user?.peran === 'superadmin') void loadSuperadminNotifPrefs();
    if (user?.peran === 'student') void hydrateStudentNotifPrefs();
    if (user) loadReadNotifications();
    if (user) loadRecentCommands();
  }, [user?.peran, user?.id, user?.nama_lengkap]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const next = await loadNotificationPollIntervalMs();
      if (active) setPollIntervalMs(next);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?.peran]);

  useEffect(() => {
    if (user?.peran !== 'teacher') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TEACHER_NOTIFICATION_PREFS_KEY) void loadTeacherNotifPrefs();
    };
    const handleFocus = () => void loadTeacherNotifPrefs();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.peran]);

  useEffect(() => {
    if (user?.peran !== 'superadmin') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SUPERADMIN_NOTIFICATION_PREFS_KEY) void loadSuperadminNotifPrefs();
    };
    const handleFocus = () => void loadSuperadminNotifPrefs();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.peran]);

  useEffect(() => {
    if (user?.peran !== 'student') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STUDENT_NOTIFICATION_PREFS_KEY) void hydrateStudentNotifPrefs();
    };
    const handleFocus = () => void hydrateStudentNotifPrefs();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.peran]);

  useEffect(() => {
    loadNotifications();
  }, [
    user,
    teacherNotifPrefs.classRequests,
    teacherNotifPrefs.assessmentUpdates,
    teacherNotifPrefs.appealRequests,
    teacherNotifPrefs.profileApprovals,
    teacherNotifPrefs.systemAnnouncements,
    teacherNotifPrefs.classAnnouncements,
    superadminNotifPrefs.approvalRequests,
    superadminNotifPrefs.anomalyAlerts,
    studentNotifPrefs.profileApprovals,
    studentNotifPrefs.classApproved,
    studentNotifPrefs.classInvited,
    studentNotifPrefs.classAnnouncements,
    studentNotifPrefs.systemAnnouncements,
    studentNotifPrefs.newMaterials,
    studentNotifPrefs.deadlineReminders,
    studentNotifPrefs.aiGradingComplete,
    studentNotifPrefs.reviewedScores,
    studentNotifPrefs.newQuestions,
    studentNotifPrefs.appealUpdates,
  ]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [
    user,
    pollIntervalMs,
    teacherNotifPrefs.classRequests,
    teacherNotifPrefs.assessmentUpdates,
    teacherNotifPrefs.appealRequests,
    teacherNotifPrefs.profileApprovals,
    teacherNotifPrefs.systemAnnouncements,
    teacherNotifPrefs.classAnnouncements,
    superadminNotifPrefs.approvalRequests,
    superadminNotifPrefs.anomalyAlerts,
    studentNotifPrefs.profileApprovals,
    studentNotifPrefs.classApproved,
    studentNotifPrefs.classInvited,
    studentNotifPrefs.classAnnouncements,
    studentNotifPrefs.systemAnnouncements,
    studentNotifPrefs.newMaterials,
    studentNotifPrefs.deadlineReminders,
    studentNotifPrefs.aiGradingComplete,
    studentNotifPrefs.reviewedScores,
    studentNotifPrefs.newQuestions,
    studentNotifPrefs.appealUpdates,
  ]);

  useEffect(() => {
    if (!user) return;
    return subscribeNotificationStream(() => {
      void loadNotifications();
    });
  }, [user?.id, user?.peran, teacherNotifPrefs, superadminNotifPrefs, studentNotifPrefs]);

  useEffect(() => {
    loadImpersonationStatus();
  }, [user?.id, user?.peran]);

  const isNotificationRead = (item: { id: string; isRead?: boolean }) => item.isRead ?? readNotificationIds.includes(item.id);
  const unreadCount = notifications.filter((item) => !isNotificationRead(item)).length;
  const hasNotifications = notifications.length > 0;

  const handleMarkAllRead = async () => {
    if (!notifications.length) return;
    const merged = Array.from(new Set([...readNotificationIds, ...notifications.map((n) => n.id)]));
    await markAllNotificationCenterItemsRead().catch(() => undefined);
    persistReadNotifications(merged);
  };

  const openNotification = async (item: { id: string; href?: string }) => {
    const nextRead = Array.from(new Set([...readNotificationIds, item.id]));
    await markNotificationCenterItemsRead([item.id]).catch(() => undefined);
    persistReadNotifications(nextRead);
    setNotifOpen(false);
    router.push(item.href || notificationPageByRole(user?.peran));
  };

  const ensureCommandData = useCallback(async () => {
    if (!user || commandDataLoaded || commandLoading) return;
    setCommandLoading(true);
    try {
      if (user.peran === 'teacher') {
        const classRes = await fetch('/api/classes', { credentials: 'include' });
        const classesRaw = classRes.ok ? await classRes.json() : [];
        const classes = (Array.isArray(classesRaw) ? classesRaw : []).map((rawCls) => {
          const cls = asRecord(rawCls);
          return {
          id: String(cls.id || ''),
          name: String(cls.class_name || 'Tanpa nama kelas'),
          code: String(cls.class_code || ''),
          status: 'aktif',
        };}).filter((cls: SearchClassItem) => cls.id);
        setCommandClasses(classes);

        const materialBuckets = await Promise.all(
          classes.map(async (cls: SearchClassItem) => {
            const matRes = await fetch(`/api/classes/${cls.id}/materials`, { credentials: 'include' });
            const mats = matRes.ok ? await matRes.json() : [];
            const materials = Array.isArray(mats) ? mats : [];
            const enriched = await Promise.all(
              materials.map(async (rawMaterial) => {
                const m = asRecord(rawMaterial);
                const materialId = String(m.id || '');
                if (!materialId) return null;

                const title = String(m.judul || 'Untitled');
                const kind = (String(m.material_type || 'materi').toLowerCase() as SearchKind);
                const href = `/dashboard/teacher/material/${materialId}`;
                const searchChunks: string[] = [
                  title,
                  cls.name,
                  kind,
                  extractMaterialBodyText(m),
                ];

                try {
                  const [detailRes, qRes] = await Promise.all([
                    fetch(`/api/materials/${materialId}`, { credentials: 'include' }),
                    fetch(`/api/materials/${materialId}/essay-questions`, { credentials: 'include' }),
                  ]);
                  if (detailRes.ok) {
                    const detail = asRecord(await detailRes.json());
                    searchChunks.push(extractMaterialBodyText(detail));
                  }
                  if (qRes.ok) {
                    const questionsRaw = await qRes.json();
                    searchChunks.push(extractQuestionsText(questionsRaw));
                  }
                } catch {
                  // best-effort indexing; keep base search fields if detail fetch fails
                }

                return {
                  id: materialId,
                  title,
                  classId: cls.id,
                  className: cls.name,
                  materialId,
                  href,
                  kind,
                  status: 'aktif',
                  searchableText: normalizeText(searchChunks.filter(Boolean).join(' ')).slice(0, 8000),
                } as SearchContentItem;
              })
            );
            return enriched.filter((item): item is SearchContentItem => item !== null);
          })
        );
        setCommandContents(materialBuckets.flat());

        const studentBuckets = await Promise.all(
          classes.map(async (cls: SearchClassItem) => {
            const stdRes = await fetch(`/api/classes/${cls.id}/students`, { credentials: 'include' });
            const students = stdRes.ok ? await stdRes.json() : [];
            return (Array.isArray(students) ? students : []).map((rawStudent) => {
              const s = asRecord(rawStudent);
              return {
              id: String(s.id || s.member_id || ''),
              name: String(s.student_name || 'Siswa'),
              email: String(s.student_email || ''),
              classId: cls.id,
              className: cls.name,
              status: 'aktif',
            };}).filter((s: SearchStudentItem) => s.id);
          })
        );
        const byStudent = new Map<string, SearchStudentItem>();
        for (const item of studentBuckets.flat()) {
          if (!byStudent.has(item.id)) byStudent.set(item.id, item);
        }
        setCommandStudents(Array.from(byStudent.values()));
      } else if (user.peran === 'student') {
        const [myClassesRes, pendingRes] = await Promise.all([
          fetch('/api/student/my-classes', { credentials: 'include' }),
          fetch('/api/student/pending-classes', { credentials: 'include' }),
        ]);
        const myClassesRaw = myClassesRes.ok ? await myClassesRes.json() : [];
        const pendingRaw = pendingRes.ok ? await pendingRes.json() : [];
        const merged = [
          ...(Array.isArray(myClassesRaw) ? myClassesRaw : []).map((rawCls) => {
            const cls = asRecord(rawCls);
            return {
            id: String(cls.id || ''),
            name: String(cls.class_name || 'Kelas'),
            code: String(cls.class_code || ''),
            status: 'aktif',
          };}),
          ...(Array.isArray(pendingRaw) ? pendingRaw : []).map((rawCls) => {
            const cls = asRecord(rawCls);
            return {
            id: String(cls.id || ''),
            name: String(cls.class_name || 'Kelas'),
            code: String(cls.class_code || ''),
            status: 'pending',
          };}),
        ].filter((c: SearchClassItem) => c.id);
        const dedup = new Map<string, SearchClassItem>();
        for (const item of merged) dedup.set(item.id, item);
        const studentClasses = Array.from(dedup.values());
        setCommandClasses(studentClasses);

        const studentContentBuckets = await Promise.all(
          studentClasses.map(async (cls: SearchClassItem) => {
            const clsRes = await fetch(`/api/student/classes/${cls.id}`, { credentials: 'include' });
            const clsDetail = clsRes.ok ? asRecord(await clsRes.json()) : {};
            const materials = Array.isArray(clsDetail.materials) ? clsDetail.materials : [];
            return materials.map((rawMaterial) => {
              const m = asRecord(rawMaterial);
              const materialId = String(m.id || '');
              if (!materialId) return null;
              const title = String(m.judul || 'Untitled');
              const kind = (String(m.material_type || 'materi').toLowerCase() as SearchKind);
              const href = `/dashboard/student/classes/${cls.id}/materials/${materialId}`;
              const searchChunks = [
                title,
                cls.name,
                kind,
                extractMaterialBodyText(m),
                extractQuestionsText(m.essay_questions),
              ];
              return {
                id: `${cls.id}:${materialId}`,
                title,
                classId: cls.id,
                className: cls.name,
                materialId,
                href,
                kind,
                status: cls.status || 'aktif',
                searchableText: normalizeText(searchChunks.filter(Boolean).join(' ')).slice(0, 8000),
              } as SearchContentItem;
            }).filter((item): item is SearchContentItem => item !== null);
          })
        );
        setCommandContents(studentContentBuckets.flat());
      } else if (user.peran === 'superadmin') {
        setCommandContents([]);
        const usersRes = await fetch('/api/admin/users?sort=last_login', { credentials: 'include' });
        const usersRaw = usersRes.ok ? await usersRes.json() : [];
        const users = Array.isArray(usersRaw) ? usersRaw : [];
        const students = users
          .filter((rawUser) => {
            const u = asRecord(rawUser);
            return String(u.peran || '').toLowerCase() === 'student';
          })
          .map((rawUser) => {
            const u = asRecord(rawUser);
            return {
            id: String(u.id || ''),
            name: String(u.nama_lengkap || u.username || 'Student'),
            email: String(u.email || ''),
            status: String(u.status || 'aktif'),
          };})
          .filter((u: SearchStudentItem) => u.id);
        setCommandStudents(students);
      }
      setCommandDataLoaded(true);
    } catch {
      setCommandDataLoaded(true);
    } finally {
      setCommandLoading(false);
    }
  }, [commandDataLoaded, commandLoading, user]);

  const navigationCommands = useMemo<CommandItem[]>(() => {
    if (!user) return [];
    if (user.peran === 'teacher') {
      return [
        { id: 'nav-t-home', label: 'Beranda Teacher', description: 'Buka dashboard utama teacher', href: '/dashboard/teacher', category: 'Navigasi', keywords: ['beranda', 'home', 'dashboard', 'teacher'] },
        { id: 'nav-t-classes', label: 'Kelas', description: 'Kelola kelas dan section', href: '/dashboard/teacher/classes', category: 'Navigasi', keywords: ['kelas', 'class', 'teacher'] },
        { id: 'nav-t-assess', label: 'Penilaian', description: 'Review submission siswa', href: '/dashboard/teacher/penilaian', category: 'Navigasi', keywords: ['penilaian', 'review', 'submission'] },
        { id: 'nav-t-bank', label: 'Bank Soal', description: 'Kelola bank soal reusable', href: '/dashboard/teacher/bank-soal', category: 'Navigasi', keywords: ['bank', 'soal', 'question bank'] },
        { id: 'nav-t-reports', label: 'Laporan Nilai', description: 'Lihat laporan nilai kelas', href: '/dashboard/teacher/laporan-nilai', category: 'Navigasi', keywords: ['laporan', 'nilai', 'report'] },
      ];
    }
    if (user.peran === 'student') {
      return [
        { id: 'nav-s-home', label: 'Beranda Student', description: 'Buka dashboard student', href: '/dashboard/student', category: 'Navigasi', keywords: ['beranda', 'student', 'dashboard'] },
        { id: 'nav-s-classes', label: 'Kelas Saya', description: 'Daftar kelas yang diikuti', href: '/dashboard/student/my-classes', category: 'Navigasi', keywords: ['kelas', 'my classes'] },
        { id: 'nav-s-assign', label: 'Tugas', description: 'Daftar tugas siswa', href: '/dashboard/student/assignments', category: 'Navigasi', keywords: ['tugas', 'assignment'] },
        { id: 'nav-s-grades', label: 'Nilai', description: 'Lihat nilai dan status grading', href: '/dashboard/student/grades', category: 'Navigasi', keywords: ['nilai', 'grade'] },
      ];
    }
    if (user.peran === 'superadmin') {
      return [
        { id: 'nav-sa-home', label: 'Beranda Superadmin', description: 'Ringkasan sistem', href: '/dashboard/superadmin', category: 'Navigasi', keywords: ['beranda', 'superadmin', 'dashboard'] },
        { id: 'nav-sa-users', label: 'Users', description: 'Kelola user sistem', href: '/dashboard/superadmin/users', category: 'Navigasi', keywords: ['users', 'user', 'akun'] },
        { id: 'nav-sa-queue', label: 'Queue Monitor', description: 'Monitor grading queue', href: '/dashboard/superadmin/queue-monitor', category: 'Navigasi', keywords: ['queue', 'monitor', 'grading'] },
        { id: 'nav-sa-config', label: 'Config Center', description: 'Pengaturan sistem', href: '/dashboard/superadmin/config', category: 'Navigasi', keywords: ['config', 'setting', 'pengaturan'] },
      ];
    }
    return [];
  }, [user]);

  const actionCommands = useMemo<CommandItem[]>(() => {
    if (!user) return [];
    const base: CommandItem[] = [
      { id: 'action-theme', label: theme === 'dark' ? 'Pakai Light Mode' : 'Pakai Dark Mode', description: 'Toggle tema sekarang', category: 'Aksi', keywords: ['theme', 'dark', 'light', 'mode'], actionKey: 'toggle-theme' },
      { id: 'action-notif', label: 'Buka Notifikasi', description: 'Lihat daftar notifikasi terbaru', category: 'Aksi', keywords: ['notif', 'notifikasi'], actionKey: 'open-notif' },
    ];
    if (user.peran === 'teacher') {
      base.push(
        { id: 'action-t-add-question', label: 'Tambah Soal (via Kelas)', description: 'Buka kelas untuk tambah soal', href: '/dashboard/teacher/classes', category: 'Aksi', keywords: ['tambah', 'soal', 'buat soal'] },
        { id: 'action-t-pending', label: 'Lihat Submission Pending', description: 'Buka penilaian dengan fokus pending', href: '/dashboard/teacher/penilaian?status=pending', category: 'Aksi', keywords: ['pending', 'submission', 'review'] },
      );
    }
    return base;
  }, [user, theme]);

  const dynamicCommands = useMemo<CommandItem[]>(() => {
    const classCommands: CommandItem[] = commandClasses.map((cls) => ({
      id: `class-${cls.id}`,
      label: cls.name,
      description: cls.code ? `Kode: ${cls.code}` : 'Kelas',
      href: user?.peran === 'student' ? `/dashboard/student/classes/${cls.id}` : `/dashboard/teacher/class/${cls.id}`,
      category: 'Kelas',
      keywords: [cls.name, cls.code || '', cls.status || '', 'kelas'],
      meta: { classId: cls.id, className: cls.name, status: cls.status || 'aktif', kind: 'general' },
    }));
    const studentCommands: CommandItem[] = commandStudents.map((s) => ({
      id: `student-${s.id}`,
      label: s.name,
      description: s.className ? `${s.className} • ${s.email || '-'}` : (s.email || 'Siswa'),
      href: user?.peran === 'superadmin' ? '/dashboard/superadmin/users' : '/dashboard/teacher/penilaian',
      category: 'Siswa',
      keywords: [s.name, s.email || '', s.className || '', s.status || '', 'siswa', 'student'],
      meta: { classId: s.classId, className: s.className, status: s.status || 'aktif', kind: 'general' },
    }));
    const contentCommands: CommandItem[] = commandContents.map((c) => ({
      id: `content-${c.id}`,
      label: c.title,
      description: `${c.className || '-'} • ${c.kind.toUpperCase()}`,
      href: c.href || (c.materialId ? `/dashboard/teacher/material/${c.materialId}` : undefined),
      category: 'Konten',
      keywords: [c.title, c.className || '', c.kind, c.status || '', c.searchableText || '', 'materi', 'soal', 'tugas', 'konten', 'isi'],
      meta: { classId: c.classId, className: c.className, status: c.status || 'aktif', kind: c.kind },
    }));
    return [...classCommands, ...studentCommands, ...contentCommands];
  }, [commandClasses, commandStudents, commandContents, user?.peran]);

  const allCommandItems = useMemo<CommandItem[]>(
    () => [...navigationCommands, ...actionCommands, ...dynamicCommands],
    [navigationCommands, actionCommands, dynamicCommands]
  );

  const filteredCommandItems = useMemo<CommandItem[]>(() => {
    const parsed = parseCommandSearch(commandQuery);
    const q = parsed.text;
    const list = allCommandItems.filter((item) => {
      if (parsed.kelas) {
        const classText = `${item.meta?.className || ''} ${item.meta?.classId || ''}`.toLowerCase();
        if (!classText.includes(parsed.kelas)) return false;
      }
      if (parsed.status) {
        const statusText = (item.meta?.status || '').toLowerCase();
        if (!statusText.includes(parsed.status)) return false;
      }
      if (parsed.jenis) {
        const kindText = (item.meta?.kind || '').toLowerCase();
        if (!kindText.includes(parsed.jenis)) return false;
      }
      if (!q) return true;
      const haystack = `${item.label} ${item.description || ''} ${item.keywords.join(' ')}`.toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
    if (!commandQuery.trim()) {
      return [...recentCommands.slice(0, 5), ...list.filter((x) => x.category === 'Aksi').slice(0, 5), ...list.filter((x) => x.category === 'Navigasi').slice(0, 8)];
    }
    return list.slice(0, 50);
  }, [allCommandItems, commandQuery, recentCommands]);

  const groupedCommandItems = useMemo(() => {
    const groups: Record<CommandCategory, CommandItem[]> = {
      Terakhir: [],
      Navigasi: [],
      Aksi: [],
      Kelas: [],
      Siswa: [],
      Konten: [],
    };
    for (const item of filteredCommandItems) {
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredCommandItems]);

  const flatCommandItems = useMemo(
    () => (['Terakhir', 'Aksi', 'Navigasi', 'Kelas', 'Siswa', 'Konten'] as CommandCategory[]).flatMap((cat) => groupedCommandItems[cat]),
    [groupedCommandItems]
  );

  const executeCommand = useCallback((item: CommandItem) => {
    const cleanedRecent = recentCommands.filter((cmd) => cmd.id !== item.id);
    persistRecentCommands([{ ...item, category: 'Terakhir' }, ...cleanedRecent]);
    setCommandOpen(false);
    setCommandQuery('');

    if (item.actionKey === 'toggle-theme') {
      toggleTheme();
      return;
    }
    if (item.actionKey === 'open-notif') {
      setNotifOpen(true);
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  }, [persistRecentCommands, recentCommands, router, toggleTheme]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setShortcutHint(navigator.platform.toLowerCase().includes('mac') ? 'Cmd+K' : 'Ctrl+K');
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    void ensureCommandData();
    window.setTimeout(() => {
      commandInputRef.current?.focus();
    }, 10);
  }, [commandOpen, ensureCommandData]);

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandQuery, filteredCommandItems.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (!commandOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setCommandOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedCommandIndex((prev) => Math.min(prev + 1, Math.max(flatCommandItems.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === 'Enter' && flatCommandItems[selectedCommandIndex]) {
        event.preventDefault();
        executeCommand(flatCommandItems[selectedCommandIndex]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen, executeCommand, flatCommandItems, selectedCommandIndex]);

  // Close on click outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (dropdownOpen) {
        if (
          !dropdown.current?.contains(target as Node) &&
          !trigger.current?.contains(target as Node)
        ) {
          setDropdownOpen(false);
        }
      }
      if (notifOpen) {
        if (
          !notifPanel.current?.contains(target as Node) &&
          !notifTrigger.current?.contains(target as Node)
        ) {
          setNotifOpen(false);
        }
      }
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, [dropdownOpen, notifOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push('/login');
  };

  const handleOpenMyProfile = () => {
    setDropdownOpen(false);
    if (!user) return;
    if (user.peran === 'student') {
      router.push('/dashboard/student/profile');
      return;
    }
    if (user.peran === 'teacher') {
      router.push('/dashboard/teacher/profile');
      return;
    }
    router.push('/dashboard/superadmin/settings');
  };

  return (
    <header className="topbar-shell sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-950/90">
      {impersonationActive && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8 flex items-center justify-between dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
          <span>Mode impersonation aktif. Kamu sedang login sebagai user lain.</span>
          <button
            type="button"
            onClick={handleStopImpersonation}
            disabled={impersonationBusy}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-slate-900 dark:hover:bg-amber-900/40"
          >
            {impersonationBusy ? 'Stopping...' : 'Stop & balik superadmin'}
          </button>
        </div>
      )}
      <div className="topbar-surface px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2 sm:h-16 -mb-px">
          {/* Header: Left side */}
          <div className="flex items-center">
            {/* Mobile drawer button with logo */}
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-slate-700 shadow-sm hover:bg-slate-50 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span className="sr-only">Buka sidebar</span>
              <Image 
                src="/logo.png" 
                alt="SAGE Logo" 
                width={28} 
                height={28} 
                className="h-7 w-7 rounded-md object-contain"
                priority
              />
            </button>
          </div>

          {/* Header: Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search / Command */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="topbar-input hidden md:inline-flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 md:w-[360px]"
            >
                <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-300">
                  <svg className="h-5 w-5 text-slate-400 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
                Cari kelas, materi, isi konten, siswa...
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {shortcutHint}
              </span>
            </button>
            
            <button
              type="button"
              onClick={toggleTheme}
              className="topbar-chip inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            
            {/* User Avatar / Profile */}
            {user && (
              <div className="relative inline-flex items-center gap-2">
                <div className="relative inline-block">
                  <button
                    ref={notifTrigger}
                    type="button"
                    onClick={() => setNotifOpen((prev) => !prev)}
                    className="topbar-chip relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label="Notifikasi"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"></path>
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    )}
                  </button>

                  {notifOpen && (
                    <div
                      ref={notifPanel}
                      className="topbar-popover absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifikasi</p>
                        <div className="flex items-center gap-3">
                          {hasNotifications && unreadCount > 0 && (
                            <button
                              type="button"
                              className="text-xs text-slate-600 hover:underline dark:text-slate-300"
                              onClick={handleMarkAllRead}
                            >
                              Tandai sudah dibaca
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-xs text-slate-700 hover:text-slate-900 hover:underline dark:text-slate-200 dark:hover:text-white"
                            onClick={() => {
                              setNotifOpen(false);
                              router.push(notificationPageByRole(user.peran));
                            }}
                          >
                            See all
                          </button>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto px-2 py-2">
                        {notifLoading ? (
                          <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">Memuat notifikasi...</p>
                        ) : notifications.length === 0 ? (
                          <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">Belum ada notifikasi.</p>
                        ) : (
                          notifications.slice(0, 3).map((item) => {
                            const isRead = isNotificationRead(item);
                            return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openNotification(item)}
                              className={`topbar-list-item block w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${isRead ? 'opacity-70' : ''}`}
                            >
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{formatNotifDate(item.createdAt)}</p>
                            </button>
                          )})
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative hidden md:inline-block text-left">
                  <button
                    ref={trigger}
                    type="button"
                    className="topbar-chip inline-flex items-center justify-center gap-x-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
                    id="menu-button"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span className="sr-only">User menu</span>
                    <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-semibold dark:bg-slate-700 dark:text-slate-200">
                      {user.nama_lengkap ? user.nama_lengkap.charAt(0) : '?'}
                    </span>
                    <span className="hidden lg:inline dark:text-slate-100">{user.nama_lengkap || 'Loading...'} ({user.peran})</span>
                    <svg className="-mr-1 hidden h-5 w-5 text-slate-400 sm:block dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div
                      ref={dropdown}
                      className="topbar-popover absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-900 dark:ring-slate-700"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="menu-button"
                      tabIndex={-1}
                    >
                      <div className="py-1" role="none">
                        <button onClick={handleOpenMyProfile} className="text-slate-700 block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" role="menuitem" tabIndex={-1}>
                          My Profile
                        </button>
                        <button onClick={handleLogout} className="text-slate-700 block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" role="menuitem" tabIndex={-1} id="menu-item-0">
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      {commandOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/35 backdrop-blur-[1px] p-3 sm:p-6 dark:bg-slate-950/70" onClick={() => setCommandOpen(false)}>
          <div
            className="mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Cari... (contoh: kelas:12A status:pending jenis:soal fotosintesis rubrik)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Shortcut: <span className="font-semibold">Ctrl/Cmd+K</span> • Arrow untuk navigasi • Enter untuk buka
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {commandLoading ? (
                <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">Memuat data pencarian...</p>
              ) : flatCommandItems.length === 0 ? (
                <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">Tidak ada hasil. Coba kata kunci lain.</p>
              ) : (
                (['Terakhir', 'Aksi', 'Navigasi', 'Kelas', 'Siswa', 'Konten'] as CommandCategory[]).map((cat) => {
                  const items = groupedCommandItems[cat];
                  if (!items.length) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{cat}</p>
                      <div className="space-y-1">
                        {items.map((item) => {
                          const absoluteIndex = flatCommandItems.findIndex((x) => x.id === item.id);
                          const active = absoluteIndex === selectedCommandIndex;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => executeCommand(item)}
                              onMouseEnter={() => setSelectedCommandIndex(absoluteIndex)}
                              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                active ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                              {item.description && <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;
