import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@college.edu');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(role) {
    const creds = {
      admin: ['admin@college.edu', 'Admin@123'],
      teacher: ['ananya.rao@college.edu', 'Teacher@123'],
      student: ['aarav.sharma@college.edu', 'Student@123'],
    };
    setEmail(creds[role][0]);
    setPassword(creds[role][1]);
  }

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark large">AE</span>
          <h1>AttendEdge</h1>
          <p>Automated attendance monitoring &amp; analytics for colleges</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-row">
          <span>Try a demo account:</span>
          <button onClick={() => fillDemo('admin')} type="button">Admin</button>
          <button onClick={() => fillDemo('teacher')} type="button">Teacher</button>
          <button onClick={() => fillDemo('student')} type="button">Student</button>
        </div>
      </div>

      <div className="login-side">
        <div className="ledger-preview">
          <div className="ledger-title">Weekly Attendance Register</div>
          <div className="ledger-grid">
            {Array.from({ length: 35 }).map((_, i) => {
              const level = Math.floor(Math.random() * 4);
              return <div key={i} className={`ledger-cell l${level}`} />;
            })}
          </div>
          <div className="ledger-caption">Live register data, visualized at a glance.</div>
        </div>
      </div>
    </div>
  );
}
