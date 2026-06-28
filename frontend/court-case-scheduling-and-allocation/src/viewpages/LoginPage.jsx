import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getDashboardPathForRole, persistAuthSession } from '../utils/auth';

const ROLE_OPTIONS = [
  { label: 'Advocate / Litigant', value: 'litigant_advocate' },
  { label: 'Court Administrator', value: 'admin' },
  { label: 'Judge', value: 'judge' },
];

const decodeJwtPayload = (token) => {
  try {
    const payloadPart = String(token || '').split('.')[1] || '';
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const roleMatchesSelection = (selectedRole, actualRole) => {
  const normalizedActualRole = String(actualRole || '').toLowerCase();

  if (selectedRole === 'litigant_advocate') {
    return normalizedActualRole === 'litigant' || normalizedActualRole === 'advocate';
  }

  return selectedRole === normalizedActualRole;
};

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (!selectedRole) return setError('Please select a role.');
    if (!email || !password) return setError('Please fill in all fields.');
    setError('');

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: selectedRole }),
      });

      const data = await res.json();
      if (res.ok && data.requires_2fa) {
        const tokenRole = decodeJwtPayload(data.two_factor_token)?.role || '';
        if (!roleMatchesSelection(selectedRole, tokenRole)) {
          setError('Invalid credentials.');
          return;
        }

        navigate('/login/2fa', {
          state: {
            twoFactorToken: data.two_factor_token || '',
            infoMessage: data.message,
            emailDelivery: data.email_delivery || '',
            emailDeliveryReason: data.email_delivery_reason || '',
            emailDeliveryDetail: data.email_delivery_detail || '',
            emailDeliveryProvider: data.email_delivery_provider || '',
            email,
          },
        });
      } else if (res.ok) {
        const user = data?.data || null;
        const token = data?.token || '';

        if (!roleMatchesSelection(selectedRole, user?.role)) {
          setError('Invalid credentials.');
          return;
        }

        persistAuthSession({ token, user });
        navigate(getDashboardPathForRole(user?.role), { replace: true });
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-body">
        <form className="card" onSubmit={handleSubmit}>

          <h3 className="role-header">Are you a</h3>

          <div className="role-row">
            {ROLE_OPTIONS.slice(0, 2).map((role) => (
              <button
                type="button"
                key={role.value}
                onClick={() => {
                  setError('');
                  setSelectedRole(role.value);
                }}
                className={`role-btn ${selectedRole === role.value ? 'role-btn--active' : ''}`}
              >
                {role.label}
              </button>
            ))}
          </div>

          <div className="role-row--center">
            <button
              type="button"
              onClick={() => {
                setError('');
                setSelectedRole(ROLE_OPTIONS[2].value);
              }}
              className={`role-btn ${selectedRole === ROLE_OPTIONS[2].value ? 'role-btn--active' : ''}`}
            >
              {ROLE_OPTIONS[2].label}
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}

          <label className="field-label">E-mail</label>
          <input
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => {
              setError('');
              setEmail(e.target.value);
            }}
          />

          <label className="field-label">Password</label>
          <input
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => {
              setError('');
              setPassword(e.target.value);
            }}
          />

          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : 'Login'}
          </button>

          <p className="form-footer">
            Don&apos;t have an account? <Link to="/register">Register here</Link>
          </p>

        </form>
      </div>
    </div>
  );
}