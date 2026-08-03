import React, { useEffect, useState } from 'react';
import api from '../api';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { code: '', name: '', department: '', teacherId: '', schedule: '' };

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [detail, setDetail] = useState(null);

  async function loadCourses() {
    setLoading(true);
    try {
      const res = await api.get('/courses');
      setCourses(res.data.courses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
    if (user.role === 'admin') {
      api.get('/courses/list/teachers').then((res) => setTeachers(res.data.teachers));
    }
  }, []); // eslint-disable-line

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(c) {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, department: c.department || '', teacherId: c.teacher_id || '', schedule: c.schedule || '' });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (editingId) await api.put(`/courses/${editingId}`, form);
      else await api.post('/courses', form);
      setShowModal(false);
      loadCourses();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save course.');
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete course ${c.code}? This will remove all attendance history for it.`)) return;
    await api.delete(`/courses/${c.id}`);
    loadCourses();
  }

  async function openDetail(c) {
    const res = await api.get(`/courses/${c.id}`);
    setDetail(res.data);
  }

  return (
    <div className="page">
      <PageHeader
        title="Courses"
        subtitle="Manage course offerings, assigned faculty, and rosters."
        actions={user.role === 'admin' && <button className="btn-primary" onClick={openCreate}>+ Add Course</button>}
      />

      <div className="panel">
        {loading ? (
          <div className="loading-state">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="empty-state">No courses yet. Add your first course to get started.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Department</th><th>Faculty</th><th>Students</th>
                {user.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td><button className="btn-link" onClick={() => openDetail(c)}>{c.name}</button></td>
                  <td>{c.department || '—'}</td>
                  <td>{c.teacher_name || '—'}</td>
                  <td>{c.student_count}</td>
                  {user.role === 'admin' && (
                    <td className="row-actions">
                      <button className="btn-link" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn-link danger" onClick={() => handleDelete(c)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Course' : 'Add Course'}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Course Code
            <input value={form.code} disabled={!!editingId} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </label>
          <label>Course Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>Department
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label>Faculty
            <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">Unassigned</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="span-2">Schedule
            <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="e.g. Mon/Wed/Fri 9:00 AM" />
          </label>

          {formError && <div className="form-error span-2">{formError}</div>}

          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Add Course'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.course.code} — ${detail.course.name}` : ''}>
        {detail && (
          <div>
            <p className="detail-meta">
              {detail.course.department || 'No department'} · {detail.course.teacher_name || 'Unassigned faculty'} · {detail.course.schedule || 'No schedule set'}
            </p>
            <table className="mini-table">
              <thead><tr><th>Roll No</th><th>Name</th><th>Email</th></tr></thead>
              <tbody>
                {detail.students.map((s) => (
                  <tr key={s.id}><td className="mono">{s.roll_no}</td><td>{s.name}</td><td>{s.email || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
