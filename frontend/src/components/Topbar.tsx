import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import {
  fetchStudentNotifications,
  loadStudentNotificationPrefs,
  STUDENT_NOTIFICATION_PREFS_KEY,
  StudentNotificationPrefs,
} from '@/lib/studentNotifications';

interface TopbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

type TeacherNotificationPrefs = {
  classRequests: boolean;
  assessmentUpdates: boolean;
  systemAnnouncements: boolean;
};
type SuperadminNotificationPrefs = {
  approvalRequests: boolean;
};

const TEACHER_NOTIFICATION_PREFS_KEY = 'teacher_notification_preferences';
const SUPERADMIN_NOTIFICATION_PREFS_KEY = 'superadmin_notification_preferences';
const NOTIF_READ_STORAGE_PREFIX = 'read_notifications_';

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
  }>>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [teacherNotifPrefs, setTeacherNotifPrefs] = useState<TeacherNotificationPrefs>({
    classRequests: true,
    assessmentUpdates: true,
    systemAnnouncements: true,
  });
  const [superadminNotifPrefs, setSuperadminNotifPrefs] = useState<SuperadminNotificationPrefs>({
    approvalRequests: true,
  });
  const [studentNotifPrefs, setStudentNotifPrefs] = useState<StudentNotificationPrefs>({
    profileApprovals: true,
    classApproved: true,
    classInvited: true,
    newMaterials: true,
    reviewedScores: true,
    newQuestions: true,
  });

  const trigger = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const notifTrigger = useRef<HTMLButtonElement>(null);
  const notifPanel = useRef<HTMLDivElement>(null);

  const getReadStorageKey = () => {
    const userKey = user?.id || user?.nama_lengkap || 'anon';
    return `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
  };

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

  const loadTeacherNotifPrefs = () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(TEACHER_NOTIFICATION_PREFS_KEY);
    if (!raw) {
      setTeacherNotifPrefs({
        classRequests: true,
        assessmentUpdates: true,
        systemAnnouncements: true,
      });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<TeacherNotificationPrefs>;
      setTeacherNotifPrefs({
        classRequests: parsed.classRequests ?? true,
        assessmentUpdates: parsed.assessmentUpdates ?? true,
        systemAnnouncements: parsed.systemAnnouncements ?? true,
      });
    } catch {
      setTeacherNotifPrefs({
        classRequests: true,
        assessmentUpdates: true,
        systemAnnouncements: true,
      });
    }
  };

  const loadSuperadminNotifPrefs = () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(SUPERADMIN_NOTIFICATION_PREFS_KEY);
    if (!raw) {
      setSuperadminNotifPrefs({ approvalRequests: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<SuperadminNotificationPrefs>;
      setSuperadminNotifPrefs({
        approvalRequests: parsed.approvalRequests ?? true,
      });
    } catch {
      setSuperadminNotifPrefs({ approvalRequests: true });
    }
  };

  const hydrateStudentNotifPrefs = () => {
    setStudentNotifPrefs(loadStudentNotificationPrefs());
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
      year: 'numeric',
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
        const allItems: Array<{ id: string; title: string; message: string; createdAt: string }> = [];
        const classRes = await fetch('/api/classes', { credentials: 'include' });
        if (!classRes.ok) throw new Error('Failed to fetch classes');
        const classes = await classRes.json();

        if (teacherNotifPrefs.classRequests) {
          for (const cls of Array.isArray(classes) ? classes : []) {
            const pendingRes = await fetch(`/api/classes/${cls.id}/join-requests`, { credentials: 'include' });
            if (pendingRes.ok) {
              const pendingItems = await pendingRes.json();
              for (const req of Array.isArray(pendingItems) ? pendingItems : []) {
                allItems.push({
                  id: `join-${req.member_id || req.id}`,
                  title: 'Join Request Baru',
                  message: `${req.student_name || 'Siswa'} meminta bergabung ke ${cls.class_name || 'kelas Anda'}.`,
                  createdAt: req.requested_at || new Date().toISOString(),
                });
              }
            }
          }
        }

        if (teacherNotifPrefs.assessmentUpdates) {
          for (const cls of Array.isArray(classes) ? classes : []) {
            const materialsRes = await fetch(`/api/classes/${cls.id}/materials`, { credentials: 'include' });
            const materials = materialsRes.ok ? await materialsRes.json() : [];

            for (const material of Array.isArray(materials) ? materials : []) {
              const questionRes = await fetch(`/api/materials/${material.id}/essay-questions`, { credentials: 'include' });
              const questions = questionRes.ok ? await questionRes.json() : [];

              for (const question of Array.isArray(questions) ? questions : []) {
                const submissionRes = await fetch(`/api/essay-questions/${question.id}/submissions`, { credentials: 'include' });
                const submissions = submissionRes.ok ? await submissionRes.json() : [];

                for (const submission of Array.isArray(submissions) ? submissions : []) {
                  const reviewed =
                    submission?.revised_score != null ||
                    String(submission?.teacher_feedback || '').trim().length > 0;
                  if (reviewed) continue;

                  allItems.push({
                    id: `assessment-${submission.id}`,
                    title: 'Submission Perlu Review',
                    message: `${submission.student_name || 'Siswa'} mengirim jawaban di ${material.judul || 'materi'} (${cls.class_name || 'kelas'}).`,
                    createdAt: submission.submitted_at || new Date().toISOString(),
                  });
                }
              }
            }
          }
        }

        allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(allItems.slice(0, 12));
        return;
      }

      if (user.peran === 'superadmin') {
        if (!superadminNotifPrefs.approvalRequests) {
          setNotifications([]);
          return;
        }
        const pendingRes = await fetch('/api/admin/profile-requests?status=pending', { credentials: 'include' });
        if (pendingRes.ok) {
          const items = await pendingRes.json();
          const mapped = (Array.isArray(items) ? items : []).map((item: any) => ({
            id: `profile-${item.id}`,
            title: 'Approval Pending',
            message: `${item.user_name || 'User'} menunggu approval (${item.request_type || 'profile_change'}).`,
            createdAt: item.created_at || new Date().toISOString(),
          }));
          mapped.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNotifications(mapped.slice(0, 12));
          return;
        }
      }

      if (user.peran === 'student') {
        const studentItems = await fetchStudentNotifications(studentNotifPrefs);
        setNotifications(studentItems.slice(0, 12));
        return;
      }

      setNotifications([]);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (user?.peran === 'teacher') loadTeacherNotifPrefs();
    if (user?.peran === 'superadmin') loadSuperadminNotifPrefs();
    if (user?.peran === 'student') hydrateStudentNotifPrefs();
    if (user) loadReadNotifications();
  }, [user?.peran, user?.id, user?.nama_lengkap]);

  useEffect(() => {
    if (user?.peran !== 'teacher') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TEACHER_NOTIFICATION_PREFS_KEY) loadTeacherNotifPrefs();
    };
    const handleFocus = () => loadTeacherNotifPrefs();
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
      if (e.key === SUPERADMIN_NOTIFICATION_PREFS_KEY) loadSuperadminNotifPrefs();
    };
    const handleFocus = () => loadSuperadminNotifPrefs();
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
      if (e.key === STUDENT_NOTIFICATION_PREFS_KEY) hydrateStudentNotifPrefs();
    };
    const handleFocus = () => hydrateStudentNotifPrefs();
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
    teacherNotifPrefs.systemAnnouncements,
    superadminNotifPrefs.approvalRequests,
    studentNotifPrefs.profileApprovals,
    studentNotifPrefs.classApproved,
    studentNotifPrefs.classInvited,
    studentNotifPrefs.newMaterials,
    studentNotifPrefs.reviewedScores,
    studentNotifPrefs.newQuestions,
  ]);

  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;
  const hasNotifications = notifications.length > 0;

  const handleMarkAllRead = () => {
    if (!notifications.length) return;
    const merged = Array.from(new Set([...readNotificationIds, ...notifications.map((n) => n.id)]));
    persistReadNotifications(merged);
  };

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
    router.push('/login'); // Ensure redirect to login after logout
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px">
          {/* Header: Left side */}
          <div className="flex">
            {/* Hamburger button */}
            <button
              className="text-slate-500 hover:text-slate-700 md:hidden"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>
          </div>

          {/* Header: Right side */}
          <div className="flex items-center space-x-3">
            {/* Search input */}
            <div className="relative">
              <input
                type="search"
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 md:w-64"
                placeholder="Cari kelas, materi, siswa..."
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            
            {/* User Avatar / Profile */}
            {user && (
              <div className="relative inline-flex items-center gap-2">
                <div className="relative inline-block">
                  <button
                    ref={notifTrigger}
                    type="button"
                    onClick={() => setNotifOpen((prev) => !prev)}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                      className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
                        <div className="flex items-center gap-3">
                          {hasNotifications && unreadCount > 0 && (
                            <button
                              type="button"
                              className="text-xs text-slate-600 hover:underline"
                              onClick={handleMarkAllRead}
                            >
                              Tandai sudah dibaca
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-xs text-[color:var(--sage-700)] hover:underline"
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
                          <p className="px-2 py-3 text-xs text-slate-500">Memuat notifikasi...</p>
                        ) : notifications.length === 0 ? (
                          <p className="px-2 py-3 text-xs text-slate-500">Belum ada notifikasi.</p>
                        ) : (
                          notifications.slice(0, 3).map((item) => {
                            const isRead = readNotificationIds.includes(item.id);
                            return (
                            <div key={item.id} className={`rounded-lg px-2 py-2 hover:bg-slate-50 ${isRead ? 'opacity-70' : ''}`}>
                              <p className="text-sm font-medium text-slate-900">{item.title}</p>
                              <p className="mt-0.5 text-xs text-slate-600">{item.message}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{formatNotifDate(item.createdAt)}</p>
                            </div>
                          )})
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative inline-block text-left">
                  <button
                    ref={trigger}
                    type="button"
                    className="inline-flex justify-center items-center gap-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    id="menu-button"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span className="sr-only">User menu</span>
                    <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-semibold">
                      {user.nama_lengkap ? user.nama_lengkap.charAt(0) : '?'}
                    </span>
                    {user.nama_lengkap || 'Loading...'} ({user.peran})
                    <svg className="-mr-1 h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* Dropdown menu */}
                  {dropdownOpen && (
                    <div
                      ref={dropdown}
                      className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="menu-button"
                      tabIndex={-1}
                    >
                      <div className="py-1" role="none">
                        <button onClick={handleLogout} className="text-slate-700 block w-full px-4 py-2 text-left text-sm hover:bg-slate-50" role="menuitem" tabIndex={-1} id="menu-item-0">
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
    </header>
  );
};

export default Topbar;
