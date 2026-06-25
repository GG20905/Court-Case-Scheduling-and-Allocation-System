import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = ['Advocate / Litigant', 'Court Administrator', 'Judge'];

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
        navigate('/login/2fa', {
          state: {
            twoFactorToken: data.two_factor_token || '',
            infoMessage: data.message,
            developmentCode: data.development_code || '',
            emailDelivery: data.email_delivery || '',
            emailDeliveryReason: data.email_delivery_reason || '',
            emailDeliveryDetail: data.email_delivery_detail || '',
            emailDeliveryProvider: data.email_delivery_provider || '',
            email,
          },
        });
      } else if (res.ok) {
        setError('2FA challenge was not returned by the server. Please restart backend with the latest code.');
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
            {ROLES.slice(0, 2).map((role) => (
              <button
                type="button"
                key={role}
                onClick={() => {
                  setError('');
                  setSelectedRole(role);
                }}
                className={`role-btn ${selectedRole === role ? 'role-btn--active' : ''}`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="role-row--center">
            <button
              type="button"
              onClick={() => {
                setError('');
                setSelectedRole(ROLES[2]);
              }}
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