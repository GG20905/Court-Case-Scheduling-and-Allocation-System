import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setMessage('');

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Unable to reset password.');
        return;
      }

      setMessage(data.message || 'Password reset successful.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
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
          <h3 className="role-header">Reset Password</h3>

          {!token && (
            <p className="form-error" style={{ marginBottom: '14px' }}>
              Invalid or missing reset token. Please request a new password reset link.
            </p>
          )}

          {error && <p className="form-error">{error}</p>}
          {message && <p style={{ color: '#166534', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>{message}</p>}

          <label className="field-label">New Password</label>
          <input
            type="password"
            className="field-input"
            value={newPassword}
            onChange={(e) => {
              setError('');
              setMessage('');
              setNewPassword(e.target.value);
            }}
            disabled={!token}
          />

          <label className="field-label">Confirm New Password</label>
          <input
            type="password"
            className="field-input"
            value={confirmPassword}
            onChange={(e) => {
              setError('');
              setMessage('');
              setConfirmPassword(e.target.value);
            }}
            disabled={!token}
          />

          <button type="submit" className="auth-btn" disabled={isSubmitting || !token}>
            {isSubmitting ? 'Updating password...' : 'Reset password'}
          </button>

          <p className="form-footer">
            <Link to="/forgot-password">Request another reset link</Link>
          </p>

          <p className="form-footer" style={{ marginTop: '2px' }}>
            <Link to="/login">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
