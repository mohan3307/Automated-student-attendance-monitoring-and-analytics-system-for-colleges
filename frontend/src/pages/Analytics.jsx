import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const STATUS_COLORS = {
  present: '#3F7D58',
  late: '#C99A3B',
  excused: '#5C6B8A',
  absent: '#C0553A',
};

export default function Analytics() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentAnalytics />;
  return <StaffAnalytics />;
}

function StaffAnalytics() {
  const [comparison, setComparison] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [trend, setTrend] = useState([]);
  const [lowAttendance, setLowAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/analytics/course-comparison'),
      api.get('/analytics/status-breakdown'),
      api.get('/analytics/trend?days=45'),
      api.get('/analytics/low-attendance'),
    ]).then(([c, b, t, l]) => {
      if (!mounted) return;
      setComparison(c.data.courses);
      setBreakdown(b.data.breakdown.map((x) => ({ ...x, name: x.status })));
      setTrend(t.data.trend);
      setLowAttendance(l.data.students);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="loading-state">Crunching the numbers…</div>;

  return (
    <div className="page">
      <PageHeader title="Analytics" subtitle="Deeper patterns across courses and time." />

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Attendance Rate by Course</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparison} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="code" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 8 }}
                formatter={(v, n, p) => [`${v}%`, p.payload.name]} />
              <Bar dataKey="rate" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Status Breakdown</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={breakdown} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {breakdown.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || '#999'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Attendance Trend — last 45 days</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 8 }} />
            <Line type="monotone" dataKey="rate" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="panel-title">All Students Below Threshold</div>
        {lowAttendance.length === 0 ? (
          <div className="empty-state">No students are currently below the attendance threshold.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Roll No</th><th>Name</th><th>Sessions Attended</th><th>Rate</th></tr></thead>
            <tbody>
              {lowAttendance.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.roll_no}</td>
                  <td>{s.name}</td>
                  <td className="mono">{s.attended}/{s.total}</td>
                  <td><span className="pill danger">{s.rate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StudentAnalytics() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const profile = await api.get('/students/me/profile');
        const res = await api.get(`/analytics/student/${profile.data.student.id}`);
        if (mounted) setSummary(res.data);
      } catch (e) {
        if (mounted) setErrorMsg(e.response?.data?.message || 'Could not load your analytics.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="loading-state">Loading your analytics…</div>;
  if (errorMsg) return <div className="page"><div className="empty-state">{errorMsg}</div></div>;

  const chartData = summary.perCourse.map((c) => ({ code: c.code, rate: c.rate }));

  return (
    <div className="page">
      <PageHeader title="My Analytics" subtitle="Your attendance rate across enrolled courses." />
      <div className="panel">
        <div className="panel-title">Attendance Rate by Course</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="code" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 8 }} />
            <Bar dataKey="rate" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
