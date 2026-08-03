# AttendEdge — Automated Student Attendance Monitoring & Analytics System

A full-stack web application for colleges to record daily attendance and
track attendance trends, at-risk students, and per-course analytics.

```
student-attendance-system/
├── backend/     Node.js + Express + SQLite REST API
├── frontend/    React (Vite) single-page app
└── README.md    You are here
```

## Features

- **Role-based accounts** — Admin, Teacher (Faculty), and Student logins, each
  with a tailored view.
- **Student & course management** — add/edit/remove students and courses,
  assign faculty, and manage enrollments (Admin).
- **One-click attendance marking** — pick a course and date, then mark
  Present / Late / Excused / Absent for the whole roster in a single save
  (Admin, Teacher).
- **Analytics dashboard** — overall attendance rate, attendance trend over
  time, per-course comparison, status breakdown, and an automatically
  generated list of students below a configurable attendance threshold.
- **Attendance register heatmap** — a calendar-style visual of daily
  attendance rates, styled like a classic roll-call register.
- **Student self-service** — students can sign in and see their own
  attendance rate per course.
- **JWT authentication** with hashed passwords (bcrypt).
- **SQLite database** — zero-config, file-based, no external DB server to
  install.

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later (v20+ recommended)
- npm (comes with Node.js)

## 1. Backend setup

```bash
cd backend
npm install
npm run seed     # creates the SQLite DB and loads demo data
npm start         # starts the API on http://localhost:5000
```

For auto-restart on file changes during development, use `npm run dev`
instead of `npm start`.

The `npm run seed` step creates:
- 1 admin account
- 2 teacher accounts
- 20 student accounts
- 3 courses, all students enrolled in all 3
- ~6 weeks of realistic attendance history (so the analytics charts have
  something to show immediately)

**Demo logins** (also printed by the seed script):

| Role    | Email                        | Password      |
|---------|-------------------------------|----------------|
| Admin   | admin@college.edu             | Admin@123      |
| Teacher | ananya.rao@college.edu        | Teacher@123    |
| Student | aarav.sharma@college.edu      | Student@123    |

Configuration lives in `backend/.env` (already included with working
defaults — change `JWT_SECRET` before deploying anywhere real).

## 2. Frontend setup

Open a second terminal:

```bash
cd frontend
npm install
npm run dev        # starts the app on http://localhost:5173
```

The Vite dev server proxies any `/api/*` request to the backend at
`http://localhost:5000`, so both servers need to be running at the same
time. Visit **http://localhost:5173** and sign in with one of the demo
accounts above (or use the quick-fill buttons on the login screen).

To build a production bundle:

```bash
npm run build      # outputs static files to frontend/dist
npm run preview    # serve the production build locally
```

## Project structure

```
backend/
├── db/
│   ├── index.js        SQLite connection + schema (auto-creates tables)
│   └── seed.js          Demo data generator
├── middleware/
│   └── auth.js          JWT verification + role guard
├── routes/
│   ├── auth.js           /api/auth      register, login, me
│   ├── students.js       /api/students  CRUD + enrollment
│   ├── courses.js        /api/courses   CRUD
│   ├── attendance.js     /api/attendance session lookup + marking
│   └── analytics.js      /api/analytics dashboards, trends, alerts
└── server.js             App entry point

frontend/
└── src/
    ├── pages/            Login, Dashboard, Students, Courses, Attendance, Analytics
    ├── components/       Sidebar, Modal, PageHeader, Ledger (heatmap), ProtectedRoute
    ├── context/           AuthContext (login state, JWT storage)
    ├── api.js             Axios instance with auth header + 401 handling
    └── styles.css         Design tokens & component styles
```

## Database schema (SQLite)

- `users` — login accounts (admin / teacher / student), bcrypt-hashed passwords
- `students` — student profiles (roll number, name, department, year…),
  optionally linked to a `users` row for self-service login
- `courses` — course code, name, department, assigned teacher, schedule
- `enrollments` — many-to-many between students and courses
- `attendance_sessions` — one row per (course, date) lecture/session
- `attendance_records` — one row per (session, student) with a status of
  `present`, `late`, `excused`, or `absent`

The database file is created automatically at `backend/db/attendance.db` the
first time the server (or seed script) runs — no manual setup required.

## API overview

All endpoints are prefixed with `/api` and (except `/auth/login` and
`/auth/register`) require an `Authorization: Bearer <token>` header.

| Method & Path                              | Who            | Purpose                              |
|---------------------------------------------|----------------|----------------------------------------|
| POST `/auth/login`                          | Public         | Sign in, returns JWT + user            |
| POST `/auth/register`                       | Public         | Create an account                      |
| GET  `/students`                            | Admin, Teacher | List / search students                 |
| POST `/students`                            | Admin          | Create a student (+ optional login)    |
| PUT/DELETE `/students/:id`                  | Admin          | Update / remove a student              |
| POST `/students/:id/enroll`                 | Admin          | Enroll a student in a course           |
| GET  `/courses`                             | Any            | List courses (scoped by role)          |
| POST/PUT/DELETE `/courses/:id`              | Admin          | Manage courses                         |
| GET  `/attendance/session`                  | Admin, Teacher | Roster + existing marks for a date     |
| POST `/attendance/mark`                     | Admin, Teacher | Save attendance for a session          |
| GET  `/analytics/overview`                  | Admin, Teacher | KPI summary for the dashboard          |
| GET  `/analytics/trend`                     | Admin, Teacher | Daily attendance rate over time        |
| GET  `/analytics/course-comparison`         | Admin, Teacher | Attendance rate per course             |
| GET  `/analytics/low-attendance`            | Admin, Teacher | Students below the threshold           |
| GET  `/analytics/student/:studentId`        | Any (scoped)   | Per-student attendance breakdown       |

## Notes & next steps

This project is meant as a solid, runnable foundation rather than a
production deployment. If you want to take it further, reasonable next
steps include: CSV/PDF export of reports, email/SMS alerts for low
attendance, QR-code or biometric check-in, pagination for very large
student lists, and swapping the JWT secret / SQLite file for a managed
secret store and a hosted Postgres database in production.
