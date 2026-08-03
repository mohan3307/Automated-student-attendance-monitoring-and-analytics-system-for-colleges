const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/courses
router.get('/', (req, res) => {
  let sql = `
    SELECT c.*, u.name AS teacher_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.teacher_id
  `;
  const params = [];

  if (req.user.role === 'teacher') {
    sql += ' WHERE c.teacher_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'student') {
    sql += ` WHERE c.id IN (
      SELECT course_id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE s.user_id = ?
    )`;
    params.push(req.user.id);
  }
  sql += ' ORDER BY c.code ASC';

  const courses = db.prepare(sql).all(...params);
  res.json({ courses });
});

// GET /api/courses/:id
router.get('/:id', (req, res) => {
  const course = db
    .prepare(
      `SELECT c.*, u.name AS teacher_name FROM courses c
       LEFT JOIN users u ON u.id = c.teacher_id WHERE c.id = ?`
    )
    .get(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const students = db
    .prepare(
      `SELECT s.id, s.roll_no, s.name, s.email FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.course_id = ? ORDER BY s.name ASC`
    )
    .all(req.params.id);

  res.json({ course, students });
});

// POST /api/courses  (admin)
router.post(
  '/',
  authorize('admin'),
  [
    body('code').trim().notEmpty().withMessage('Course code is required'),
    body('name').trim().notEmpty().withMessage('Course name is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code, name, department, teacherId, schedule } = req.body;
    const dup = db.prepare('SELECT id FROM courses WHERE code = ?').get(code);
    if (dup) return res.status(409).json({ message: 'A course with this code already exists.' });

    const info = db
      .prepare('INSERT INTO courses (code, name, department, teacher_id, schedule) VALUES (?,?,?,?,?)')
      .run(code, name, department || null, teacherId || null, schedule || null);

    res.status(201).json({ course: db.prepare('SELECT * FROM courses WHERE id = ?').get(info.lastInsertRowid) });
  }
);

// PUT /api/courses/:id  (admin)
router.put('/:id', authorize('admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const { name, department, teacherId, schedule } = req.body;
  db.prepare('UPDATE courses SET name = ?, department = ?, teacher_id = ?, schedule = ? WHERE id = ?').run(
    name ?? course.name,
    department ?? course.department,
    teacherId ?? course.teacher_id,
    schedule ?? course.schedule,
    req.params.id
  );

  res.json({ course: db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id) });
});

// DELETE /api/courses/:id  (admin)
router.delete('/:id', authorize('admin'), (req, res) => {
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Course removed successfully.' });
});

// GET /api/courses/list/teachers (admin) - helper for dropdowns
router.get('/list/teachers', authorize('admin'), (req, res) => {
  const teachers = db.prepare("SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY name").all();
  res.json({ teachers });
});

module.exports = router;
