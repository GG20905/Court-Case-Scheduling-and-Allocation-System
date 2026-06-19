import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = ['Advocate / Litigant', 'Court Administrator', 'Judge'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!selectedRole) return setError('Please select a role.');
    if (!email || !password) return setError('Please fill in all fields.');
    setError('');
    
     const res = await fetch('/api/auth/login', {
     method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password, role: selectedRole }),
     });
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-body">
        <div className="card">

          <div className="role-row">
            {ROLES.slice(0, 2).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`role-btn ${selectedRole === role ? 'role-btn--active' : ''}`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="role-row--center">
            <button
              onClick={() => setSelectedRole(ROLES[2])}
              className={`role-btn ${selectedRole === ROLES[2] ? 'role-btn--active' : ''}`}
            >
              {ROLES[2]}
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}

          <label className="field-label">E-mail</label>
          <input
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="field-label">Password</label>
          <input
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <p className="form-footer">
            Don&apos;t have an account? <Link to="/register">Register here</Link>
          </p>

        </div>
      </div>
    </div>
  );
}