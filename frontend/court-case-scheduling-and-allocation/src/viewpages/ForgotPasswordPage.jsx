import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();

    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) {
      setError('Please enter your email address.');
      setMessage('');
      return;
    }

    setError('');
    setMessage('');

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Failed to process password reset request.');
        return;
      }

      setMessage(data.message || 'If an account exists for this email, a secure password reset link has been sent.');
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
          <h3 className="role-header">Forgot Password</h3>

          <p style={{ marginBottom: '16px', color: '#475569', fontSize: '14px', textAlign: 'center' }}>
            Enter your registered email to receive a secure password reset link.
          </p>

          {error && <p className="form-error">{error}</p>}
          {message && <p style={{ color: '#166534', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>{message}</p>}

          <label className="field-label">E-mail</label>
          <input
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => {
              setError('');
              setMessage('');
              setEmail(e.target.value);
            }}
          />

          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
          </button>

          <p className="form-footer">
            Remembered your password? <Link to="/login">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
