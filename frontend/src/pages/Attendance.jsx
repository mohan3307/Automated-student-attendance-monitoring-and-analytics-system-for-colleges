import React, { useEffect, useState } from 'react';
import api from '../api';
import PageHeader from '../components/PageHeader.jsx';

const STATUSES = [
  { key: 'present', label: 'Present', short: 'P' },
  { key: 'late', label: 'Late', short: 'L' },
  { key: 'excused', label: 'Excused', short: 'E' },
  { key: 'absent', label: 'Absent', short: 'A' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [topic, setTopic] = useState('');
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/courses').then((res) => {
      setCourses(res.data.courses);
      if (res.data.courses.length) setCourseId(res.data.courses[0].id);
    });
  }, []);

  useEffect(() => {
    if (!courseId || !date) return;
    setLoading(true);
    setMessage('');
    api
      .get('/attendance/session', { params: { courseId, date } })
      .then((res) => {
        setRoster(res.data.roster);
        setMarks(res.data.marks);
      })
      .finally(() => setLoading(false));
  }, [courseId, date]);

  function setStatus(studentId, status) {
    setMarks((m) => ({ ...m, [studentId]: status }));
  }

  function markAll(status) {
    const next = {};
    roster.forEach((r) => (next[r.student_id] = status));
    setMarks(next);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const records = roster.map((r) => ({
        studentId: r.student_id,
        status: marks[r.student_id] || 'present',
      }));
      await api.post('/attendance/mark', { courseId, date, topic, records });
      setMessage('Attendance saved successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  }

  const presentCount = roster.filter((r) => (marks[r.student_id] || 'present') === 'present').length;

  return (
    <div className="page">
      <PageHeader title="Mark Attendance" subtitle="Record today's session for a course roster in one pass." />

      <div className="attendance-controls panel">
        <label>Course
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="grow">Topic (optional)
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Binary Search Trees" />
        </label>
      </div>

      <div className="panel">
        <div className="attendance-toolbar">
          <div className="attendance-summary">
            <strong>{presentCount}</strong> / {roster.length} marked present
          </div>
          <div className="bulk-actions">
            <span>Mark all:</span>
            {STATUSES.map((s) => (
              <button key={s.key} className="btn-chip" onClick={() => markAll(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading roster…</div>
        ) : roster.length === 0 ? (
          <div className="empty-state">No students are enrolled in this course yet.</div>
        ) : (
          <table className="data-table attendance-table">
            <thead>
              <tr><th>Roll No</th><th>Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const current = marks[r.student_id] || 'present';
                return (
                  <tr key={r.student_id}>
                    <td className="mono">{r.roll_no}</td>
                    <td>{r.name}</td>
                    <td>
                      <div className="status-toggle">
                        {STATUSES.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            className={`status-btn ${s.key} ${current === s.key ? 'active' : ''}`}
                            onClick={() => setStatus(r.student_id, s.key)}
                            title={s.label}
                          >
                            {s.short}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {roster.length > 0 && (
          <div className="form-actions" style={{ marginTop: 20 }}>
            {message && <div className={message.includes('success') ? 'form-success' : 'form-error'}>{message}</div>}
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
