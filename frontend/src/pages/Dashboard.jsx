import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import Ledger from '../components/Ledger.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentDashboard />;
  return <StaffDashboard />;
}

function StaffDashboard() {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [lowAttendance, setLowAttendance] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [ov, tr, la, hm] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/trend?days=21'),
          api.get('/analytics/low-attendance'),
          api.get('/analytics/heatmap?days=91'),
        ]);
        if (!mounted) return;
        setOverview(ov.data);
        setTrend(tr.data.trend);
        setLowAttendance(la.data.students.slice(0, 6));
        setHeatmap(hm.data.heatmap);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="loading-state">Loading dashboard…</div>;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="A daily snapshot of attendance across your courses."
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Students</div>
          <div className="kpi-value">{overview.totalStudents}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Courses</div>
          <div className="kpi-value">{overview.totalCourses}</div>
        </div>
        <div className="kpi-card accent">
          <div className="kpi-label">Overall Attendance</div>
          <div className="kpi-value">{overview.overallRate}%</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Below {overview.threshold}% Threshold</div>
          <div className="kpi-value">{overview.lowAttendanceCount}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Attendance Trend — last 3 weeks</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 8 }} />
              <Line type="monotone" dataKey="rate" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Students Needing Attention</div>
          {lowAttendance.length === 0 ? (
            <div className="empty-state">Everyone is above the attendance threshold. Nice work.</div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr><th>Roll No</th><th>Name</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {lowAttendance.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.roll_no}</td>
                    <td>{s.name}</td>
                    <td><span className="pill danger">{s.rate}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Attendance Register — last 13 weeks</div>
        <Ledger data={heatmap} />
      </div>
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const profile = await api.get('/students/me/profile');
        const analytics = await api.get(`/analytics/student/${profile.data.student.id}`);
        if (!mounted) return;
        setSummary(analytics.data);
      } catch (e) {
        if (mounted) setErrorMsg(e.response?.data?.message || 'No student profile is linked to this account yet.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="loading-state">Loading your dashboard…</div>;

  return (
    <div className="page">
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Here is your attendance summary." />

      {errorMsg ? (
        <div className="empty-state" style={{ marginTop: 24 }}>{errorMsg}</div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card accent">
              <div className="kpi-label">Overall Attendance</div>
              <div className="kpi-value">{summary.overallRate}%</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Enrolled Courses</div>
              <div className="kpi-value">{summary.perCourse.length}</div>
            </div>
            <div className="kpi-card warning">
              <div className="kpi-label">Attendance Threshold</div>
              <div className="kpi-value">{summary.threshold}%</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Attendance by Course</div>
            <table className="mini-table">
              <thead>
                <tr><th>Code</th><th>Course</th><th>Sessions</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {summary.perCourse.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.code}</td>
                    <td>{c.name}</td>
                    <td className="mono">{c.attended}/{c.total}</td>
                    <td>
                      <span className={`pill ${c.rate < summary.threshold ? 'danger' : 'success'}`}>
                        {c.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
