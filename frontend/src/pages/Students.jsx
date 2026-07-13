import React, { useEffect, useState } from 'react';
import api from '../api';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = {
  roll_no: '', name: '', email: '', department: '', year: '', phone: '',
  createLogin: true, password: 'Student@123',
};

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [courses, setCourses] = useState([]);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');

  async function loadStudents() {
    setLoading(true);
    try {
      const res = await api.get('/students', { params: { search } });
      setStudents(res.data.students);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStudents(); }, []); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(loadStudents, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  useEffect(() => {
    api.get('/courses').then((res) => setCourses(res.data.courses));
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(s) {
    setEditingId(s.id);
    setForm({ ...emptyForm, ...s, createLogin: false });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (editingId) {
        await api.put(`/students/${editingId}`, form);
      } else {
        await api.post('/students', form);
      }
      setShowModal(false);
      loadStudents();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save student.');
    }
  }

  async function handleDelete(s) {
    if (!confirm(`Remove ${s.name} (${s.roll_no})? This cannot be undone.`)) return;
    await api.delete(`/students/${s.id}`);
    loadStudents();
  }

  async function handleEnroll() {
    if (!selectedCourse) return;
    await api.post(`/students/${enrollTarget.id}/enroll`, { courseId: selectedCourse });
    setEnrollTarget(null);
    setSelectedCourse('');
  }

  return (
    <div className="page">
      <PageHeader
        title="Students"
        subtitle="Manage student profiles, contact details, and course enrollments."
        actions={
          user.role === 'admin' && (
            <button className="btn-primary" onClick={openCreate}>+ Add Student</button>
          )
        }
      />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by name, roll number, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="panel">
        {loading ? (
          <div className="loading-state">Loading students…</div>
        ) : students.length === 0 ? (
          <div className="empty-state">No students found. Try adjusting your search, or add a new student.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th><th>Name</th><th>Email</th><th>Department</th><th>Year</th>
                {user.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.roll_no}</td>
                  <td>{s.name}</td>
                  <td>{s.email || '—'}</td>
                  <td>{s.department || '—'}</td>
                  <td>{s.year || '—'}</td>
                  {user.role === 'admin' && (
                    <td className="row-actions">
                      <button className="btn-link" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn-link" onClick={() => setEnrollTarget(s)}>Enroll</button>
                      <button className="btn-link danger" onClick={() => handleDelete(s)}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Student' : 'Add Student'}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Roll Number
            <input value={form.roll_no} disabled={!!editingId}
              onChange={(e) => setForm({ ...form, roll_no: e.target.value })} required />
          </label>
          <label>Full Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>Email
            <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Department
            <input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label>Year
            <input type="number" min="1" max="6" value={form.year || ''} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </label>
          <label>Phone
            <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>

          {!editingId && (
            <>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.createLogin}
                  onChange={(e) => setForm({ ...form, createLogin: e.target.checked })} />
                Create a student login account
              </label>
              {form.createLogin && (
                <label>Initial Password
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
              )}
            </>
          )}

          {formError && <div className="form-error span-2">{formError}</div>}

          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Add Student'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!enrollTarget} onClose={() => setEnrollTarget(null)} title={`Enroll ${enrollTarget?.name || ''}`}>
        <div className="form-grid">
          <label>Course
            <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setEnrollTarget(null)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleEnroll}>Enroll</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
