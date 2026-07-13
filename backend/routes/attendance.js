const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function assertTeacherOwnsCourse(req, courseId) {
  if (req.user.role !== 'teacher') return true;
  const course = db.prepare('SELECT teacher_id FROM courses WHERE id = ?').get(courseId);
  return course && course.teacher_id === req.user.id;
}

// GET /api/attendance/session?courseId=&date=  -> roster + existing marks for that date
router.get('/session', authorize('admin', 'teacher'), (req, res) => {
  const { courseId, date } = req.query;
  if (!courseId || !date) return res.status(400).json({ message: 'courseId and date are required.' });

  if (!assertTeacherOwnsCourse(req, courseId)) {
    return res.status(403).json({ message: 'You do not teach this course.' });
  }

  const roster = db
    .prepare(
      `SELECT s.id AS student_id, s.roll_no, s.name FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.course_id = ? ORDER BY s.name ASC`
    )
    .all(courseId);

  const session = db
    .prepare('SELECT * FROM attendance_sessions WHERE course_id = ? AND session_date = ?')
    .get(courseId, date);

  let marks = {};
  if (session) {
    const records = db
      .prepare('SELECT student_id, status FROM attendance_records WHERE session_id = ?')
      .all(session.id);
    records.forEach((r) => (marks[r.student_id] = r.status));
  }

  res.json({ roster, marks, sessionExists: !!session });
});

// POST /api/attendance/mark  (admin, teacher)
// body: { courseId, date, topic, records: [{ studentId, status }] }
router.post(
  '/mark',
  authorize('admin', 'teacher'),
  [
    body('courseId').isInt(),
    body('date').isISO8601(),
    body('records').isArray({ min: 1 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'courseId, date and records[] are required.' });

    const { courseId, date, topic, records } = req.body;

    if (!assertTeacherOwnsCourse(req, courseId)) {
      return res.status(403).json({ message: 'You do not teach this course.' });
    }

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    for (const r of records) {
      if (!validStatuses.includes(r.status)) {
        return res.status(400).json({ message: `Invalid status: ${r.status}` });
      }
    }

    const upsertSession = db.prepare(
      `INSERT INTO attendance_sessions (course_id, session_date, topic, created_by)
       VALUES (?,?,?,?)
       ON CONFLICT(course_id, session_date) DO UPDATE SET topic = excluded.topic`
    );
    upsertSession.run(courseId, date, topic || null, req.user.id);

    const session = db
      .prepare('SELECT id FROM attendance_sessions WHERE course_id = ? AND session_date = ?')
      .get(courseId, date);

    const upsertRecord = db.prepare(
      `INSERT INTO attendance_records (session_id, student_id, status)
       VALUES (?,?,?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status, marked_at = datetime('now')`
    );

    const tx = db.transaction((recs) => {
      recs.forEach((r) => upsertRecord.run(session.id, r.studentId, r.status));
    });
    tx(records);

    res.json({ message: 'Attendance saved successfully.', sessionId: session.id });
  }
);

// GET /api/attendance/course/:courseId?from=&to=  -> full attendance grid (sessions x students)
router.get('/course/:courseId', authorize('admin', 'teacher'), (req, res) => {
  const { courseId } = req.params;
  const { from, to } = req.query;

  if (!assertTeacherOwnsCourse(req, courseId)) {
    return res.status(403).json({ message: 'You do not teach this course.' });
  }

  let sessionSql = 'SELECT id, session_date, topic FROM attendance_sessions WHERE course_id = ?';
  const params = [courseId];
  if (from) {
    sessionSql += ' AND session_date >= ?';
    params.push(from);
  }
  if (to) {
    sessionSql += ' AND session_date <= ?';
    params.push(to);
  }
  sessionSql += ' ORDER BY session_date ASC';

  const sessions = db.prepare(sessionSql).all(...params);
  const records = db
    .prepare(
      `SELECT ar.session_id, ar.student_id, ar.status FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       WHERE s.course_id = ?`
    )
    .all(courseId);

  res.json({ sessions, records });
});

// GET /api/attendance/student/:studentId  -> a student's own attendance across courses
router.get('/student/:studentId', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  if (req.user.role === 'student' && student.user_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own attendance.' });
  }

  const rows = db
    .prepare(
      `SELECT c.id AS course_id, c.code, c.name, s.session_date, ar.status
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE ar.student_id = ?
       ORDER BY s.session_date ASC`
    )
    .all(req.params.studentId);

  res.json({ records: rows });
});

module.exports = router;
