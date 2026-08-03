const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/students  (admin, teacher)
router.get('/', authorize('admin', 'teacher'), (req, res) => {
  const { search, department, year } = req.query;
  let sql = 'SELECT id, roll_no, name, email, department, year, phone, created_at FROM students WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR roll_no LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }
  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }
  sql += ' ORDER BY name ASC';

  const students = db.prepare(sql).all(...params);
  res.json({ students });
});

// GET /api/students/me/profile  (student) - resolves the logged-in user's student record
router.get('/me/profile', authorize('student'), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(req.user.id);
  if (!student) return res.status(404).json({ message: 'No student profile is linked to this account.' });
  res.json({ student });
});

// GET /api/students/:id
router.get('/:id', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  // Students may only view their own record
  if (req.user.role === 'student' && student.user_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own record.' });
  }

  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.name FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.student_id = ?`
    )
    .all(student.id);

  res.json({ student, courses });
});

// POST /api/students  (admin) - creates student profile + optional login account
router.post(
  '/',
  authorize('admin'),
  [
    body('roll_no').trim().notEmpty().withMessage('Roll number is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { roll_no, name, email, department, year, phone, createLogin, password } = req.body;

    const dup = db.prepare('SELECT id FROM students WHERE roll_no = ?').get(roll_no);
    if (dup) return res.status(409).json({ message: 'A student with this roll number already exists.' });

    let userId = null;
    if (createLogin && email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) return res.status(409).json({ message: 'Email already used by another account.' });
      const hashed = bcrypt.hashSync(password || 'Student@123', 10);
      userId = db
        .prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)')
        .run(name, email, hashed, 'student').lastInsertRowid;
    }

    const info = db
      .prepare(
        'INSERT INTO students (user_id, roll_no, name, email, department, year, phone) VALUES (?,?,?,?,?,?,?)'
      )
      .run(userId, roll_no, name, email || null, department || null, year || null, phone || null);

    res.status(201).json({ student: db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid) });
  }
);

// PUT /api/students/:id  (admin)
router.put('/:id', authorize('admin'), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  const { name, email, department, year, phone } = req.body;
  db.prepare(
    'UPDATE students SET name = ?, email = ?, department = ?, year = ?, phone = ? WHERE id = ?'
  ).run(
    name ?? student.name,
    email ?? student.email,
    department ?? student.department,
    year ?? student.year,
    phone ?? student.phone,
    req.params.id
  );

  res.json({ student: db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) });
});

// DELETE /api/students/:id  (admin)
router.delete('/:id', authorize('admin'), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found.' });
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ message: 'Student removed successfully.' });
});

// POST /api/students/:id/enroll  (admin) body: { courseId }
router.post('/:id/enroll', authorize('admin'), (req, res) => {
  const { courseId } = req.body;
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!student || !course) return res.status(404).json({ message: 'Student or course not found.' });

  try {
    db.prepare('INSERT INTO enrollments (student_id, course_id) VALUES (?,?)').run(req.params.id, courseId);
  } catch (e) {
    return res.status(409).json({ message: 'Student is already enrolled in this course.' });
  }
  res.status(201).json({ message: 'Student enrolled successfully.' });
});

// DELETE /api/students/:id/enroll/:courseId  (admin)
router.delete('/:id/enroll/:courseId', authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?').run(
    req.params.id,
    req.params.courseId
  );
  res.json({ message: 'Student unenrolled successfully.' });
});

module.exports = router;
