import React from 'react';
import Link from 'next/link'; // Import Link for navigation
import { usePathname } from 'next/navigation'; // To highlight active link
import { User } from '@/context/AuthContext'; // Import User type

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
};

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, user }) => {
  const pathname = usePathname();
  const userRole = user.peran;
  const isPathActive = (href: string, includeChildren?: boolean) =>
    includeChildren ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  // Define navigation items for Teacher
  const teacherNavItems: NavItem[] = [
    { href: '/dashboard/teacher', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
    ), label: 'Beranda' },
    { href: '/dashboard/teacher/classes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    ), label: 'Manajemen Kelas' },
    { href: '/dashboard/teacher/penilaian', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
    ), label: 'Penilaian' },
    { href: '/dashboard/teacher/bank-soal', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8M8 11h8m-8 4h5m-7 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
    ), label: 'Bank Soal' },
    { href: '/dashboard/teacher/laporan-nilai', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18m-6-6h12m-9-6h6"></path></svg>
    ), label: 'Laporan Nilai' },
  ];

  // Define navigation items for Student
  const studentNavItems: NavItem[] = [
    { href: '/dashboard/student', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
    ), label: 'Dashboard' , includeChildren: false},
    { href: '/dashboard/student/my-classes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
    ), label: 'My Classes', includeChildren: true },
    { href: '/dashboard/student/assignments', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
    ), label: 'Materi & Tugas', includeChildren: false },
    { href: '/dashboard/student/grades', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17a1 1 0 102 0V5a1 1 0 10-2 0v12zm-4 0a1 1 0 102 0V9a1 1 0 10-2 0v8zm8 0a1 1 0 102 0v-4a1 1 0 10-2 0v4z"></path></svg>
    ), label: 'Nilai & Feedback', includeChildren: false },
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
    ), label: 'Approval' },
    { href: '/dashboard/superadmin/users', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H7m4-8a4 4 0 100-8 4 4 0 000 8z"></path></svg>
    ), label: 'Manajemen User' },
  ];

  const navItems =
    userRole === 'student'
      ? studentNavItems
      : userRole === 'superadmin'
      ? superadminNavItems
      : teacherNavItems;

  const logoLink =
    userRole === 'student'
      ? '/dashboard/student'
      : userRole === 'superadmin'
      ? '/dashboard/superadmin'
      : '/dashboard/teacher/classes';

  const settingsLink =
    userRole === 'student'
      ? '/dashboard/student/settings'
      : userRole === 'superadmin'
      ? '/dashboard/superadmin/settings'
      : '/dashboard/teacher/settings';

  const isSettingsActive = pathname === settingsLink || pathname.startsWith(`${settingsLink}/`);

  return (
    <>
      {/* Sidebar backdrop (mobile) */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-30 z-40 md:hidden md:z-auto transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div
        id="sidebar"
        className={`flex flex-col absolute z-40 left-0 top-0 md:static md:left-auto md:top-auto transform h-screen overflow-hidden no-scrollbar w-64 shrink-0 bg-white border-r border-slate-200 px-5 pt-6 pb-4 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-64'
        } md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="flex justify-between mb-8 pr-3 sm:px-2">
          {/* Close button */}
          <button
            className="md:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>
          {/* Logo */}
          <Link href={logoLink} className="block">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                S
              </div>
              <div className="leading-tight">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-700">SAGE</p>
                <p className="text-[11px] text-slate-500">Smart Automated Grading Engine</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Sidebar Links */}
        <div className="space-y-6 flex-1 min-h-0">
          {/* Pages group */}
          <div className="h-full overflow-y-auto pr-1">
            <h3 className="text-xs uppercase text-slate-400 font-semibold pl-3 tracking-[0.24em]">
              Navigasi
            </h3>
            <ul className="mt-3">
              {navItems.map((item) => {
                const active = isPathActive(item.href, item.includeChildren);
                return (
                <li
                  key={item.href}
                  className={`sidebar-nav-item px-3 py-2.5 rounded-xl mb-1 last:mb-0 transition ${
                    active ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <Link
                    href={item.href}
                    className={`sidebar-nav-link flex items-center text-slate-600 ${active && 'text-slate-900 font-semibold'}`}
                    onClick={() => setSidebarOpen(false)} // Close sidebar on mobile
                  >
                    <span className="sidebar-nav-icon text-slate-500">{item.icon}</span>
                    <span className="text-sm font-medium ml-3 lg:opacity-100 duration-200">
                      {item.label}
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 pt-3 border-t border-slate-200">
          <Link
            href={settingsLink}
            className={`sidebar-settings-link flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isSettingsActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="text-slate-500">
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
