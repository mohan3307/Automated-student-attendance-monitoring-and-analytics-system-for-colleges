/**
 * Seeds the database with an admin user, sample teachers, students,
 * courses, enrollments and ~6 weeks of realistic attendance history
 * so the analytics dashboard has meaningful data out of the box.
 *
 * Run with: npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./index');

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

function upsertUser(name, email, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)')
    .run(name, email, hash(password), role);
  return info.lastInsertRowid;
}

function run() {
  console.log('Seeding database...');

  // ---- Users ----
  const adminId = upsertUser('System Admin', 'admin@college.edu', 'Admin@123', 'admin');
  const teacher1 = upsertUser('Dr. Ananya Rao', 'ananya.rao@college.edu', 'Teacher@123', 'teacher');
  const teacher2 = upsertUser('Prof. Karthik Iyer', 'karthik.iyer@college.edu', 'Teacher@123', 'teacher');

  // ---- Courses ----
  const courseExists = db.prepare('SELECT id FROM courses WHERE code = ?');
  const insertCourse = db.prepare(
    'INSERT INTO courses (code, name, department, teacher_id, schedule) VALUES (?,?,?,?,?)'
  );
  const courses = [
    ['CS301', 'Data Structures & Algorithms', 'Computer Science', teacher1, 'Mon/Wed/Fri 9:00 AM'],
    ['CS302', 'Database Management Systems', 'Computer Science', teacher2, 'Tue/Thu 11:00 AM'],
    ['CS303', 'Computer Networks', 'Computer Science', teacher1, 'Mon/Wed 2:00 PM'],
  ];
  const courseIds = courses.map(([code, name, dept, tid, sched]) => {
    const found = courseExists.get(code);
    if (found) return found.id;
    return insertCourse.run(code, name, dept, tid, sched).lastInsertRowid;
  });

  // ---- Students ----
  const studentNames = [
    'Aarav Sharma', 'Diya Patel', 'Vihaan Reddy', 'Ishaan Nair', 'Ananya Gupta',
    'Kabir Singh', 'Myra Joshi', 'Reyansh Menon', 'Saanvi Iyer', 'Arjun Pillai',
    'Aditi Verma', 'Vivaan Kapoor', 'Anika Rao', 'Rohan Das', 'Kiara Bose',
    'Aryan Chatterjee', 'Sara Fernandes', 'Dhruv Malhotra', 'Navya Krishnan', 'Yash Agarwal',
  ];

  const studentExists = db.prepare('SELECT id FROM students WHERE roll_no = ?');
  const insertStudentUser = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)'
  );
  const insertStudent = db.prepare(
    'INSERT INTO students (user_id, roll_no, name, email, department, year, phone) VALUES (?,?,?,?,?,?,?)'
  );

  const studentIds = studentNames.map((name, idx) => {
    const rollNo = `CS21${String(idx + 1).padStart(3, '0')}`;
    const existing = studentExists.get(rollNo);
    if (existing) return existing.id;

    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@college.edu`;
    const userId = insertUserSafe(email, name);
    const info = insertStudent.run(
      userId,
      rollNo,
      name,
      email,
      'Computer Science',
      3,
      `9${Math.floor(100000000 + Math.random() * 899999999)}`
    );
    return info.lastInsertRowid;
  });

  function insertUserSafe(email, name) {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) return existingUser.id;
    return insertStudentUser.run(name, email, hash('Student@123'), 'student').lastInsertRowid;
  }

  // ---- Enrollments: enroll all students in all 3 courses ----
  const insertEnrollment = db.prepare(
    'INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?,?)'
  );
  studentIds.forEach((sid) => {
    courseIds.forEach((cid) => insertEnrollment.run(sid, cid));
  });

  // ---- Attendance history: last 42 days, weekdays only ----
  const insertSession = db.prepare(
    'INSERT OR IGNORE INTO attendance_sessions (course_id, session_date, topic, created_by) VALUES (?,?,?,?)'
  );
  const getSession = db.prepare(
    'SELECT id FROM attendance_sessions WHERE course_id = ? AND session_date = ?'
  );
  const insertRecord = db.prepare(
    'INSERT OR IGNORE INTO attendance_records (session_id, student_id, status) VALUES (?,?,?)'
  );

  // give each student a "reliability" score so analytics look realistic
  const reliability = studentIds.map(() => 0.65 + Math.random() * 0.33); // 65%-98%

  const today = new Date();
  for (let d = 42; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const dateStr = day.toISOString().slice(0, 10);

    courseIds.forEach((cid, ci) => {
      const teacherFor = courses[ci][3];
      insertSession.run(cid, dateStr, `Lecture on ${dateStr}`, teacherFor);
      const session = getSession.get(cid, dateStr);
      studentIds.forEach((sid, si) => {
        const r = Math.random();
        let status = 'present';
        if (r > reliability[si]) {
          status = r > reliability[si] + 0.06 ? 'absent' : 'late';
        }
        insertRecord.run(session.id, sid, status);
      });
    });
  }

  console.log('Seed complete.');
  console.log('----------------------------------------');
  console.log('Admin login   -> admin@college.edu / Admin@123');
  console.log('Teacher login -> ananya.rao@college.edu / Teacher@123');
  console.log('Student login -> aarav.sharma@college.edu / Student@123');
  console.log('----------------------------------------');
}

run();
