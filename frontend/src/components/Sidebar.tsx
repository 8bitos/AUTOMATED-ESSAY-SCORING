import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link'; // Import Link for navigation
import { usePathname } from 'next/navigation'; // To highlight active link
import { User } from '@/context/AuthContext'; // Import User type
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  fetchStudentNotifications,
  loadStudentNotificationPrefs,
} from '@/lib/studentNotifications';
import {
  DEFAULT_NOTIFICATION_POLL_INTERVAL_MS,
  loadNotificationPollIntervalMs,
} from '@/lib/notificationRealtime';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  user: User; // New prop for user object
}

type NavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  includeChildren?: boolean;
  badgeKey?: string;
  variant?: "default" | "updates";
};

type TeacherNotificationPrefs = {
  classRequests: boolean;
  assessmentUpdates: boolean;
  systemAnnouncements: boolean;
  sidebarIndicators?: boolean;
};

type SuperadminNotificationPrefs = {
  approvalRequests: boolean;
  sidebarIndicators?: boolean;
};

type TeacherClassItem = {
  id: string;
  class_name: string;
};

type StudentClassItem = {
  id: string;
  class_name: string;
};

type AdminProfileRequestItem = {
  id: string;
};

type PublicFeatureFlagItem = {
  key: string;
  value: boolean;
};

const TEACHER_NOTIFICATION_PREFS_KEY = "teacher_notification_preferences";
const SUPERADMIN_NOTIFICATION_PREFS_KEY = "superadmin_notification_preferences";
const NOTIF_READ_STORAGE_PREFIX = "read_notifications_";

const getGradeFromClassName = (className: string): "10" | "11" | "12" | "other" => {
  const normalized = (className || "").trim().toUpperCase();
  if (/(?:^|[^A-Z0-9])XII(?=[^A-Z0-9]|$)/.test(normalized)) return "12";
  if (/(?:^|[^A-Z0-9])XI(?=[^A-Z0-9]|$)/.test(normalized)) return "11";
  if (/(?:^|[^A-Z0-9])X(?=[^A-Z0-9]|$)/.test(normalized)) return "10";
  const match = normalized.match(/(?:^|[^0-9])(10|11|12)(?=[A-Z0-9\s-]|$)/);
  if (!match) return "other";
  if (match[1] === "10") return "10";
  if (match[1] === "11") return "11";
  if (match[1] === "12") return "12";
  return "other";
};

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, user }) => {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();
  const userRole = user.peran;
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  // UI toggle from backend feature flag.
  // Default true so menu is visible unless explicitly disabled by superadmin.
  const [showUpdatesMenu, setShowUpdatesMenu] = useState(true);
  const [badgeMap, setBadgeMap] = useState<Record<string, boolean>>({});
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(DEFAULT_NOTIFICATION_POLL_INTERVAL_MS);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassItem[]>([]);
  const [isTeacherClassesLoading, setTeacherClassesLoading] = useState(false);
  const [isClassSubmenuOpen, setClassSubmenuOpen] = useState(false);
  const [studentClasses, setStudentClasses] = useState<StudentClassItem[]>([]);
  const [isStudentClassesLoading, setStudentClassesLoading] = useState(false);
  const [isStudentClassSubmenuOpen, setStudentClassSubmenuOpen] = useState(false);
  const [openClassGroups, setOpenClassGroups] = useState<Record<string, boolean>>({
    "Kelas 10": false,
    "Kelas 11": false,
    "Kelas 12": false,
    Lainnya: false,
  });
  const isPathActive = (href: string, includeChildren?: boolean) =>
    includeChildren ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
  const currentTeacherClassId = pathname.match(/^\/dashboard\/teacher\/class\/([^/]+)/)?.[1] ?? "";
  const currentStudentClassId = pathname.match(/^\/dashboard\/student\/classes\/([^/]+)/)?.[1] ?? "";
  const isTeacherClassArea = pathname === "/dashboard/teacher/classes" || pathname.startsWith("/dashboard/teacher/class/");
  const isStudentClassArea = pathname === "/dashboard/student/my-classes" || pathname.startsWith("/dashboard/student/classes/");

  const teacherClassesByGrade = useMemo(
    () => ({
      "10": teacherClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "10"),
      "11": teacherClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "11"),
      "12": teacherClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "12"),
      other: teacherClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "other"),
    }),
    [teacherClasses]
  );
  const teacherClassSections = useMemo(
    () => [
      { label: "Kelas 10", items: teacherClassesByGrade["10"] },
      { label: "Kelas 11", items: teacherClassesByGrade["11"] },
      { label: "Kelas 12", items: teacherClassesByGrade["12"] },
      { label: "Lainnya", items: teacherClassesByGrade.other },
    ],
    [teacherClassesByGrade]
  );

  const studentClassesByGrade = useMemo(
    () => ({
      "10": studentClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "10"),
      "11": studentClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "11"),
      "12": studentClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "12"),
      other: studentClasses.filter((cls) => getGradeFromClassName(cls.class_name) === "other"),
    }),
    [studentClasses]
  );
  const studentClassSections = useMemo(
    () => [
      { label: "Kelas 10", items: studentClassesByGrade["10"] },
      { label: "Kelas 11", items: studentClassesByGrade["11"] },
      { label: "Kelas 12", items: studentClassesByGrade["12"] },
      { label: "Lainnya", items: studentClassesByGrade.other },
    ],
    [studentClassesByGrade]
  );

  const fetchTeacherClasses = useCallback(async () => {
    if (userRole !== "teacher") return;
    setTeacherClassesLoading(true);
    try {
      const res = await fetch("/api/classes", { credentials: "include" });
      const data = res.ok ? await res.json() : [];
      setTeacherClasses(Array.isArray(data) ? data : []);
    } catch {
      setTeacherClasses([]);
    } finally {
      setTeacherClassesLoading(false);
    }
  }, [userRole]);

  const fetchStudentClasses = useCallback(async () => {
    if (userRole !== "student") return;
    setStudentClassesLoading(true);
    try {
      const res = await fetch("/api/student/my-classes", { credentials: "include" });
      const data = res.ok ? await res.json() : [];
      setStudentClasses(Array.isArray(data) ? data : []);
    } catch {
      setStudentClasses([]);
    } finally {
      setStudentClassesLoading(false);
    }
  }, [userRole]);

  const getReadIDs = useCallback(() => {
    if (typeof window === "undefined") return new Set<string>();
    const userKey = user?.id || user?.nama_lengkap || "anon";
    const key = `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set<string>(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [user?.id, user?.nama_lengkap]);

  const refreshBadges = useCallback(async () => {
    const next: Record<string, boolean> = {};
    const readIDs = getReadIDs();

    if (userRole === "teacher") {
      let prefs: TeacherNotificationPrefs = {
        classRequests: true,
        assessmentUpdates: true,
        systemAnnouncements: true,
        sidebarIndicators: true,
      };
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(TEACHER_NOTIFICATION_PREFS_KEY);
          if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<TeacherNotificationPrefs>) };
        } catch {
          // noop
        }
      }
      if (!prefs.sidebarIndicators) {
        setBadgeMap({});
        return;
      }
      try {
        const classRes = await fetch("/api/classes", { credentials: "include" });
        const classes = classRes.ok ? await classRes.json() : [];
        if (prefs.classRequests) {
          let hasUnreadJoin = false;
          for (const cls of Array.isArray(classes) ? classes : []) {
            const pendingRes = await fetch(`/api/classes/${cls.id}/join-requests`, { credentials: "include" });
            if (!pendingRes.ok) continue;
            const pendingItems = await pendingRes.json();
            for (const req of Array.isArray(pendingItems) ? pendingItems : []) {
              const notifID = `join-${req.member_id || req.id}`;
              if (!readIDs.has(notifID)) {
                hasUnreadJoin = true;
                break;
              }
            }
            if (hasUnreadJoin) break;
          }
          next.teacher_classes = hasUnreadJoin;
        }

        if (prefs.assessmentUpdates) {
          let hasUnreadAssessment = false;
          for (const cls of Array.isArray(classes) ? classes : []) {
            const materialsRes = await fetch(`/api/classes/${cls.id}/materials`, { credentials: "include" });
            const materials = materialsRes.ok ? await materialsRes.json() : [];
            for (const material of Array.isArray(materials) ? materials : []) {
              const questionRes = await fetch(`/api/materials/${material.id}/essay-questions`, { credentials: "include" });
              const questions = questionRes.ok ? await questionRes.json() : [];
              for (const q of Array.isArray(questions) ? questions : []) {
                const submissionRes = await fetch(`/api/essay-questions/${q.id}/submissions`, { credentials: "include" });
                const submissions = submissionRes.ok ? await submissionRes.json() : [];
                for (const sub of Array.isArray(submissions) ? submissions : []) {
                  const reviewed = sub?.revised_score != null || String(sub?.teacher_feedback || "").trim().length > 0;
                  if (reviewed) continue;
                  const notifID = `assessment-${sub.id}`;
                  if (!readIDs.has(notifID)) {
                    hasUnreadAssessment = true;
                    break;
                  }
                }
                if (hasUnreadAssessment) break;
              }
              if (hasUnreadAssessment) break;
            }
            if (hasUnreadAssessment) break;
          }
          next.teacher_penilaian = hasUnreadAssessment;
        }
      } catch {
        // noop
      }
      setBadgeMap(next);
      return;
    }

    if (userRole === "superadmin") {
      let prefs: SuperadminNotificationPrefs = { approvalRequests: true, sidebarIndicators: true };
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(SUPERADMIN_NOTIFICATION_PREFS_KEY);
          if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<SuperadminNotificationPrefs>) };
        } catch {
          // noop
        }
      }
      if (!prefs.sidebarIndicators) {
        setBadgeMap({});
        return;
      }
      if (prefs.approvalRequests) {
        try {
          const res = await fetch("/api/admin/profile-requests?status=pending", { credentials: "include" });
          const items = res.ok ? await res.json() : [];
          next.superadmin_approval = (Array.isArray(items) ? (items as AdminProfileRequestItem[]) : []).some(
            (item) => !readIDs.has(`profile-${item.id}`)
          );
        } catch {
          next.superadmin_approval = false;
        }
      }
      setBadgeMap(next);
      return;
    }

    if (userRole === "student") {
      const prefs = loadStudentNotificationPrefs();
      if (!prefs.sidebarIndicators) {
        setBadgeMap({});
        return;
      }
      try {
        const items = await fetchStudentNotifications(prefs);
        const unread = items.filter((item) => !readIDs.has(item.id));
        next.student_classes = unread.some((item) => item.id.startsWith("student-class-approved-") || item.id.startsWith("student-class-invited-"));
        next.student_assignments = unread.some((item) => item.id.startsWith("student-material-") || item.id.startsWith("student-question-"));
        next.student_grades = unread.some((item) => item.id.startsWith("student-ai-graded-") || item.id.startsWith("student-review-"));
      } catch {
        // noop
      }
      setBadgeMap(next);
      return;
    }
    setBadgeMap({});
  }, [getReadIDs, userRole]);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await loadNotificationPollIntervalMs();
      if (active) setPollIntervalMs(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    refreshBadges();
    const timer = window.setInterval(refreshBadges, pollIntervalMs);
    const onFocus = () => refreshBadges();
    const onStorage = () => refreshBadges();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [pollIntervalMs, refreshBadges]);

  useEffect(() => {
    fetchTeacherClasses();
  }, [fetchTeacherClasses]);

  useEffect(() => {
    fetchStudentClasses();
  }, [fetchStudentClasses]);

  useEffect(() => {
    if (isTeacherClassArea) setClassSubmenuOpen(true);
  }, [isTeacherClassArea]);

  useEffect(() => {
    if (isStudentClassArea) setStudentClassSubmenuOpen(true);
  }, [isStudentClassArea]);

  useEffect(() => {
    if (!currentTeacherClassId) return;
    const activeClass = teacherClasses.find((cls) => cls.id === currentTeacherClassId);
    if (!activeClass) return;
    const grade = getGradeFromClassName(activeClass.class_name);
    const label = grade === "10" ? "Kelas 10" : grade === "11" ? "Kelas 11" : grade === "12" ? "Kelas 12" : "Lainnya";
    setOpenClassGroups((prev) => ({ ...prev, [label]: true }));
  }, [currentTeacherClassId, teacherClasses]);

  useEffect(() => {
    if (!currentStudentClassId) return;
    const activeClass = studentClasses.find((cls) => cls.id === currentStudentClassId);
    if (!activeClass) return;
    const grade = getGradeFromClassName(activeClass.class_name);
    const label = grade === "10" ? "Kelas 10" : grade === "11" ? "Kelas 11" : grade === "12" ? "Kelas 12" : "Lainnya";
    setOpenClassGroups((prev) => ({ ...prev, [label]: true }));
  }, [currentStudentClassId, studentClasses]);

  useEffect(() => {
    if (!sidebarOpen) setMobileProfileOpen(false);
  }, [sidebarOpen]);

  useEffect(() => {
    let active = true;
    const loadPublicFlags = async () => {
      try {
        const res = await fetch("/api/feature-flags/public", { credentials: "include" });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        const items = Array.isArray(body?.items) ? (body.items as PublicFeatureFlagItem[]) : [];
        const updatesMenuFlag = items.find((item) => item.key === "feature_show_updates_sidebar");
        if (active && updatesMenuFlag) {
          setShowUpdatesMenu(Boolean(updatesMenuFlag.value));
        }
      } catch {
        // Keep default true to avoid accidental menu loss.
      }
    };
    void loadPublicFlags();
    const onFocus = () => void loadPublicFlags();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Define navigation items for Teacher
  const teacherNavItems: NavItem[] = [
    { href: '/dashboard/teacher', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
    ), label: 'Beranda' },
    { href: '/dashboard/teacher/classes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    ), label: 'Kelas', badgeKey: 'teacher_classes' },
    { href: '/dashboard/teacher/penilaian', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
    ), label: 'Penilaian', badgeKey: 'teacher_penilaian' },
    { href: '/dashboard/teacher/bank-soal', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8M8 11h8m-8 4h5m-7 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
    ), label: 'Bank Soal' },
    { href: '/dashboard/teacher/laporan-nilai', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18m-6-6h12m-9-6h6"></path></svg>
    ), label: 'Laporan Nilai' },
    { href: '/dashboard/teacher/help', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9a3.5 3.5 0 116.544 1.667c-.538.917-1.607 1.5-2.272 2.333-.39.488-.5 1-.5 1.5m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    ), label: 'Bantuan' },
  ];

  // Define navigation items for Student
  const studentNavItems: NavItem[] = [
    { href: '/dashboard/student', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
    ), label: 'Dashboard' , includeChildren: false},
    { href: '/dashboard/student/my-classes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    ), label: 'Kelas Saya', includeChildren: true, badgeKey: 'student_classes' },
    { href: '/dashboard/student/assignments', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
    ), label: 'Materi & Tugas', includeChildren: false, badgeKey: 'student_assignments' },
    { href: '/dashboard/student/grades', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17a1 1 0 102 0V5a1 1 0 10-2 0v12zm-4 0a1 1 0 102 0V9a1 1 0 10-2 0v8zm8 0a1 1 0 102 0v-4a1 1 0 10-2 0v4z"></path></svg>
    ), label: 'Nilai & Feedback', includeChildren: false, badgeKey: 'student_grades' },
    { href: '/dashboard/student/calendar', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
    ), label: 'Kalender', includeChildren: false },
    { href: '/dashboard/student/announcements', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l6 3v8l-6 3-6-3V8l6-3z"></path></svg>
    ), label: 'Pengumuman', includeChildren: false },
    { href: '/dashboard/student/help', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9a3.5 3.5 0 116.544 1.667c-.538.917-1.607 1.5-2.272 2.333-.39.488-.5 1-.5 1.5m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    ), label: 'Bantuan', includeChildren: false },
  ];

  const superadminNavItems: NavItem[] = [
    { href: '/dashboard/superadmin', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
    ), label: 'Dashboard' },
    { href: '/dashboard/superadmin/monitoring', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m2-4h.01M4 6h16M4 12h8m-8 6h16"></path></svg>
    ), label: 'Monitoring' },
    { href: '/dashboard/superadmin/impersonate', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A9 9 0 1112 21a8.964 8.964 0 01-6.879-3.196zM15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
    ), label: 'Impersonate' },
    { href: '/dashboard/superadmin/report-builder', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6m3 6V7m3 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
    ), label: 'Report Builder' },
    { href: '/dashboard/superadmin/pengumuman', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l6 3v8l-6 3-6-3V8l6-3zm0 0v14"></path></svg>
    ), label: 'Pengumuman' },
    { href: '/dashboard/superadmin/ai-ops', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6m3 6V7m3 10v-3m-9 7h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
    ), label: 'AI Ops' },
    { href: '/dashboard/superadmin/queue-monitor', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"></path></svg>
    ), label: 'Queue Monitor' },
    { href: '/dashboard/superadmin/audit-log', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m-7-8h8m3 10H5a2 2 0 01-2-2V6a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2z"></path></svg>
    ), label: 'Audit Log' },
    { href: '/dashboard/superadmin/profile-requests', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m-6-8h6m-8 12h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
    ), label: 'Approval', badgeKey: 'superadmin_approval' },
    { href: '/dashboard/superadmin/users', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H7m4-8a4 4 0 100-8 4 4 0 000 8z"></path></svg>
    ), label: 'Manajemen User' },
    { href: '/dashboard/superadmin/database', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3zm0 5c0 1.657 3.582 3 8 3s8-1.343 8-3m-16 5c0 1.657 3.582 3 8 3s8-1.343 8-3"></path></svg>
    ), label: 'Manajemen Database' },
    { href: '/dashboard/superadmin/help', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9a3.5 3.5 0 116.544 1.667c-.538.917-1.607 1.5-2.272 2.333-.39.488-.5 1-.5 1.5m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    ), label: 'Bantuan' },
  ];

  const updatesLink =
    userRole === 'student'
      ? '/dashboard/student/updates'
      : userRole === 'superadmin'
      ? '/dashboard/superadmin/updates'
      : '/dashboard/teacher/updates';

  const updatesNavItem: NavItem = {
    href: updatesLink,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    ),
    label: 'Update Sistem/Revisi',
    variant: 'updates',
  };

  const navItems =
    userRole === 'student'
      ? studentNavItems
      : userRole === 'superadmin'
      ? superadminNavItems
      : teacherNavItems;
  // Single source of truth for sidebar list:
  // this keeps future formatting changes localized in one place.
  const navItemsWithUpdates = showUpdatesMenu ? [...navItems, updatesNavItem] : navItems;

  const settingsLink =
    userRole === 'student'
      ? '/dashboard/student/settings'
      : userRole === 'superadmin'
      ? '/dashboard/superadmin/settings'
      : '/dashboard/teacher/settings';

  const isSettingsActive = pathname === settingsLink || pathname.startsWith(`${settingsLink}/`);
  const userInitial = (user?.nama_lengkap || "?").trim().charAt(0).toUpperCase() || "?";
  const handleOpenMyProfile = () => {
    setMobileProfileOpen(false);
    setSidebarOpen(false);
    if (userRole === "student") {
      router.push("/dashboard/student/profile");
      return;
    }
    if (userRole === "teacher") {
      router.push("/dashboard/teacher/profile");
      return;
    }
    router.push("/dashboard/superadmin/settings");
  };
  const handleLogout = async () => {
    await logout();
    setMobileProfileOpen(false);
    setSidebarOpen(false);
    router.push("/login");
  };

  return (
    <>
      {/* Sidebar backdrop (mobile) */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/45 backdrop-blur-[1px] md:hidden md:z-auto transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 transform flex-col overflow-hidden border-r border-slate-200 bg-white px-5 pb-4 pt-6 shadow-xl transition-transform duration-300 ease-out dark:border-slate-700 dark:bg-slate-900 md:static md:left-auto md:top-auto md:z-40 md:w-64 md:translate-x-0 md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="mb-8 flex items-center justify-between gap-3 pr-3 sm:px-2">
          {/* Close button */}
          <button
            className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left md:hidden"
            onClick={() => setMobileProfileOpen((prev) => !prev)}
            aria-expanded={mobileProfileOpen}
            aria-label="Buka menu profil"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-slate-700 dark:text-slate-100">
              {userInitial}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.nama_lengkap || "Pengguna"}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{userRole}</p>
            </div>
            <svg className={`ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${mobileProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-slate-700 dark:text-slate-100">
              S
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">SAGE</p>
              <p className="text-[9px] uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Smart Automated Grading Engine</p>
            </div>
          </div>
        </div>
        {mobileProfileOpen && (
          <div className="mb-5 -mt-5 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70 md:hidden">
            <button
              type="button"
              onClick={handleOpenMyProfile}
              className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              My Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        )}

        {/* Sidebar Links */}
        <div className="space-y-6 flex-1 min-h-0">
          {/* Pages group */}
          <div className="h-full overflow-y-auto pr-1">
            <h3 className="text-xs uppercase text-slate-400 font-semibold pl-3 tracking-[0.24em] dark:text-slate-500">
              Navigasi
            </h3>
            <ul className="mt-3">
              {navItemsWithUpdates.map((item) => {
                const active = isPathActive(item.href, item.includeChildren);
                const isTeacherClassesMenu = userRole === "teacher" && item.href === "/dashboard/teacher/classes";
                const isStudentClassesMenu = userRole === "student" && item.href === "/dashboard/student/my-classes";
                const hasClassSubmenu = isTeacherClassesMenu || isStudentClassesMenu;
                const isUpdatesItem = item.variant === "updates";
                const classSubmenuOpen = isTeacherClassesMenu ? isClassSubmenuOpen : isStudentClassSubmenuOpen;
                const classSections = isTeacherClassesMenu ? teacherClassSections : studentClassSections;
                const classesLoading = isTeacherClassesMenu ? isTeacherClassesLoading : isStudentClassesLoading;
                const totalClasses = isTeacherClassesMenu ? teacherClasses.length : studentClasses.length;
                const currentClassId = isTeacherClassesMenu ? currentTeacherClassId : currentStudentClassId;
                const classHrefBase = isTeacherClassesMenu ? "/dashboard/teacher/class" : "/dashboard/student/classes";
                const itemContainerClass = hasClassSubmenu
                  ? ""
                  : isUpdatesItem
                  ? active
                    ? "border border-sky-500 bg-slate-200 dark:border-sky-500 dark:bg-slate-800/80"
                    : "border border-slate-300 bg-transparent hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70"
                  : active
                  ? "bg-slate-100 dark:bg-slate-800/80"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/70";
                const itemSpacingClass = hasClassSubmenu ? "px-0 py-0" : "pl-4 pr-3 py-2.5";
                const rowContainerClass = hasClassSubmenu
                  ? active
                    ? "relative w-full pl-4 pr-1 py-2.5 bg-slate-100 rounded-xl transition dark:bg-slate-800/80"
                    : "relative w-full pl-4 pr-1 py-2.5 hover:bg-slate-50 rounded-xl transition dark:hover:bg-slate-800/70"
                  : "";
                const iconClass = isUpdatesItem && active ? "text-sky-700 dark:text-sky-300" : "text-slate-500 dark:text-slate-400";
                const infoBadgeClass = active
                  ? "bg-sky-600 text-white dark:bg-sky-400 dark:text-slate-900"
                  : "border border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
                return (
                <li
                  key={item.href}
                  className={`sidebar-nav-item ${hasClassSubmenu ? 'sidebar-nav-item-has-submenu' : ''} ${itemSpacingClass} rounded-xl mb-1 last:mb-0 transition ${itemContainerClass}`}
                >
                  <div className={`sidebar-nav-row flex items-center ${rowContainerClass}`}>
                    <Link
                      href={item.href}
                      className={`sidebar-nav-link flex w-full items-center text-slate-600 dark:text-slate-300 ${hasClassSubmenu ? 'flex-1 min-w-0 pr-12' : ''} ${active && 'text-slate-900 font-semibold dark:text-slate-100'} ${isUpdatesItem && active ? 'text-sky-800 dark:text-sky-200' : ''}`}
                      onClick={() => setSidebarOpen(false)} // Close sidebar on mobile
                    >
                      <span className={`sidebar-nav-icon ${iconClass}`}>{item.icon}</span>
                      <span className="text-sm font-medium ml-3 lg:opacity-100 duration-200 truncate">
                        {item.label}
                      </span>
                      {isUpdatesItem && (
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${infoBadgeClass}`}>
                          Info
                        </span>
                      )}
                    </Link>
                    {(item.badgeKey && badgeMap[item.badgeKey]) || hasClassSubmenu ? (
                      <div className={hasClassSubmenu ? "absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2" : "ml-auto flex items-center gap-2"}>
                        {item.badgeKey && badgeMap[item.badgeKey] && (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Ada update penting" />
                        )}
                        {hasClassSubmenu && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isTeacherClassesMenu) {
                                setClassSubmenuOpen((prev) => !prev);
                              } else {
                                setStudentClassSubmenuOpen((prev) => !prev);
                              }
                            }}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            aria-label="Toggle submenu manajemen kelas"
                            aria-expanded={classSubmenuOpen}
                          >
                            <svg className={`h-4 w-4 transition-transform ${classSubmenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {hasClassSubmenu && classSubmenuOpen && (
                    <div className="mt-2 ml-9 border-l border-slate-200 pl-3 space-y-2 dark:border-slate-700">
                      {classesLoading && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Memuat kelas...</p>
                      )}
                      {!classesLoading && totalClasses === 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada kelas</p>
                      )}
                      {!classesLoading &&
                        classSections.map((section) => (
                          section.items.length > 0 ? (
                            <div key={section.label}>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenClassGroups((prev) => ({ ...prev, [section.label]: !prev[section.label] }))
                                }
                                className="flex w-full items-center justify-between rounded-md pl-2.5 pr-1 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                aria-expanded={!!openClassGroups[section.label]}
                                aria-label={`Toggle ${section.label}`}
                              >
                                <span>{section.label}</span>
                                <svg className={`h-3.5 w-3.5 transition-transform ${openClassGroups[section.label] ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openClassGroups[section.label] && (
                                <ul className="mt-1 space-y-1">
                                  {section.items.map((cls) => {
                                    const classHref = `${classHrefBase}/${cls.id}`;
                                    const classActive = currentClassId === cls.id;
                                    return (
                                      <li key={cls.id}>
                                        <Link
                                          href={classHref}
                                          onClick={() => {
                                            setSidebarOpen(false);
                                          }}
                                          className={`sidebar-class-subitem block rounded-md px-3 py-1 text-xs transition ${
                                            classActive
                                              ? "bg-slate-200 text-slate-900 font-medium dark:bg-slate-700 dark:text-slate-100"
                                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                          }`}
                                        >
                                          {cls.class_name}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ) : null
                        ))}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Link
            href={settingsLink}
            className={`sidebar-settings-link flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isSettingsActive ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="text-slate-500 dark:text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.3 4.3a1 1 0 011.4 0l.7.7a1 1 0 001 .2l1-.3a1 1 0 011.2.7l.3 1a1 1 0 00.8.7l1 .2a1 1 0 01.8 1.2l-.3 1a1 1 0 00.2 1l.7.7a1 1 0 010 1.4l-.7.7a1 1 0 00-.2 1l.3 1a1 1 0 01-.8 1.2l-1 .2a1 1 0 00-.8.7l-.3 1a1 1 0 01-1.2.7l-1-.3a1 1 0 00-1 .2l-.7.7a1 1 0 01-1.4 0l-.7-.7a1 1 0 00-1-.2l-1 .3a1 1 0 01-1.2-.7l-.3-1a1 1 0 00-.8-.7l-1-.2a1 1 0 01-.8-1.2l.3-1a1 1 0 00-.2-1l-.7-.7a1 1 0 010-1.4l.7-.7a1 1 0 00.2-1l-.3-1a1 1 0 01.8-1.2l1-.2a1 1 0 00.8-.7l.3-1a1 1 0 011.2-.7l1 .3a1 1 0 001-.2l.7-.7z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path></svg>
            </span>
            <span className="ml-3">Setting</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
