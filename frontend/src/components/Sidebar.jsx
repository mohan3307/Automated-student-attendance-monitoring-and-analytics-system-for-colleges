import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>
  ),
  courses: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M4 4h16v2H4V4zm0 7h16v2H4v-2zm0 7h10v2H4v-2z"/></svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M5 9h3v11H5V9zm6-5h3v16h-3V4zm6 8h3v8h-3v-8z"/></svg>
  ),
};

export default function Sidebar() {
  const { user, logout } = useAuth();

  const links = [
    { to: '/', label: 'Dashboard', icon: icons.dashboard, roles: ['admin', 'teacher', 'student'] },
    { to: '/students', label: 'Students', icon: icons.students, roles: ['admin', 'teacher'] },
    { to: '/courses', label: 'Courses', icon: icons.courses, roles: ['admin', 'teacher', 'student'] },
    { to: '/attendance', label: 'Mark Attendance', icon: icons.attendance, roles: ['admin', 'teacher'] },
    { to: '/analytics', label: 'Analytics', icon: icons.analytics, roles: ['admin', 'teacher', 'student'] },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">AE</span>
        <div>
          <div className="brand-name">AttendEdge</div>
          <div className="brand-sub">Attendance &amp; Analytics</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links
          .filter((l) => l.roles.includes(user?.role))
          .map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            >
              <span className="sidebar-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{user?.name?.charAt(0) ?? '?'}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button className="btn-ghost" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}
