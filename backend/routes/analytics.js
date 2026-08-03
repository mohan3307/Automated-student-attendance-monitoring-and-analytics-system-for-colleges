const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const LOW_ATTENDANCE_THRESHOLD = 75; // percent, configurable

function scopeCourseFilter(req) {
  // returns { clause, params } restricting to courses the caller may see
  if (req.user.role === 'teacher') {
    return { clause: 'AND c.teacher_id = ?', params: [req.user.id] };
  }
  return { clause: '', params: [] };
}

// GET /api/analytics/overview  -> top-level KPI cards
router.get('/overview', authorize('admin', 'teacher'), (req, res) => {
  const { clause, params } = scopeCourseFilter(req);

  const totalStudents = db
    .prepare(
      `SELECT COUNT(DISTINCT e.student_id) AS count
       FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE 1=1 ${clause}`
    )
    .get(...params).count;

  const totalCourses = db
    .prepare(`SELECT COUNT(*) AS count FROM courses c WHERE 1=1 ${clause}`)
    .get(...params).count;

  const overallRate = db
    .prepare(
      `SELECT
        ROUND(100.0 * SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE 1=1 ${clause}`
    )
    .get(...params).rate;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRate = db
    .prepare(
      `SELECT
        ROUND(100.0 * SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate,
        COUNT(*) AS total
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE s.session_date = ? ${clause}`
    )
    .get(todayStr, ...params);

  // students below threshold overall
  const lowAttendanceCount = computeLowAttendanceStudents(clause, params).length;

  res.json({
    totalStudents,
    totalCourses,
    overallRate: overallRate || 0,
    today: { rate: todayRate.rate || 0, sessionsMarked: todayRate.total || 0, date: todayStr },
    lowAttendanceCount,
    threshold: LOW_ATTENDANCE_THRESHOLD,
  });
});

function computeLowAttendanceStudents(clause, params) {
  const rows = db
    .prepare(
      `SELECT s.id, s.roll_no, s.name,
        COUNT(*) AS total,
        SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       JOIN attendance_sessions sess ON sess.id = ar.session_id
       JOIN courses c ON c.id = sess.course_id
       WHERE 1=1 ${clause}
       GROUP BY s.id`
    )
    .all(...params);

  return rows
    .map((r) => ({ ...r, rate: Math.round((1000 * r.attended) / r.total) / 10 }))
    .filter((r) => r.rate < LOW_ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.rate - b.rate);
}

// GET /api/analytics/low-attendance
router.get('/low-attendance', authorize('admin', 'teacher'), (req, res) => {
  const { clause, params } = scopeCourseFilter(req);
  res.json({ students: computeLowAttendanceStudents(clause, params), threshold: LOW_ATTENDANCE_THRESHOLD });
});

// GET /api/analytics/trend?days=30 -> daily attendance rate over time (for line chart)
router.get('/trend', authorize('admin', 'teacher'), (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const { clause, params } = scopeCourseFilter(req);

  const rows = db
    .prepare(
      `SELECT s.session_date AS date,
        ROUND(100.0 * SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate,
        COUNT(*) AS total
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE s.session_date >= date('now', ?) ${clause}
       GROUP BY s.session_date
       ORDER BY s.session_date ASC`
    )
    .all(`-${days} days`, ...params);

  res.json({ trend: rows });
});

// GET /api/analytics/course-comparison -> attendance rate per course (bar chart)
router.get('/course-comparison', authorize('admin', 'teacher'), (req, res) => {
  const { clause, params } = scopeCourseFilter(req);
  const rows = db
    .prepare(
      `SELECT c.id, c.code, c.name,
        ROUND(100.0 * SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate,
        COUNT(DISTINCT s.id) AS sessions
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE 1=1 ${clause}
       GROUP BY c.id
       ORDER BY c.code ASC`
    )
    .all(...params);
  res.json({ courses: rows });
});

// GET /api/analytics/status-breakdown -> present/absent/late/excused totals (pie chart)
router.get('/status-breakdown', authorize('admin', 'teacher'), (req, res) => {
  const { clause, params } = scopeCourseFilter(req);
  const rows = db
    .prepare(
      `SELECT ar.status, COUNT(*) AS count
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE 1=1 ${clause}
       GROUP BY ar.status`
    )
    .all(...params);
  res.json({ breakdown: rows });
});

// GET /api/analytics/heatmap?days=90 -> daily overall rate for calendar heatmap
router.get('/heatmap', authorize('admin', 'teacher'), (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const { clause, params } = scopeCourseFilter(req);
  const rows = db
    .prepare(
      `SELECT s.session_date AS date,
        ROUND(100.0 * SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE s.session_date >= date('now', ?) ${clause}
       GROUP BY s.session_date
       ORDER BY s.session_date ASC`
    )
    .all(`-${days} days`, ...params);
  res.json({ heatmap: rows });
});

// GET /api/analytics/student/:studentId  -> per-student analytics (for student's own dashboard too)
router.get('/student/:studentId', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  if (req.user.role === 'student' && student.user_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own analytics.' });
  }

  const perCourse = db
    .prepare(
      `SELECT c.id, c.code, c.name,
        COUNT(*) AS total,
        SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN courses c ON c.id = s.course_id
       WHERE ar.student_id = ?
       GROUP BY c.id`
    )
    .all(req.params.studentId)
    .map((r) => ({ ...r, rate: Math.round((1000 * r.attended) / r.total) / 10 }));

  const overall = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
       FROM attendance_records WHERE student_id = ?`
    )
    .get(req.params.studentId);

  const overallRate = overall.total ? Math.round((1000 * overall.attended) / overall.total) / 10 : 0;

  res.json({ perCourse, overallRate, threshold: LOW_ATTENDANCE_THRESHOLD });
});

module.exports = router;
