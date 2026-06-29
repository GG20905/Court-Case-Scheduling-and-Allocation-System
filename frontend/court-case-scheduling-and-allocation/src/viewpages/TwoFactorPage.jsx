import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getDashboardPathForRole, persistAuthSession } from '../utils/auth';

const cleanInfoMessage = (message) =>
  String(message || '')
    .replace(/\s*or contact support\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

export default function TwoFactorPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    cleanInfoMessage(location.state?.infoMessage) || 'Enter the 6-digit code sent to your email.'
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [deliveryProvider, setDeliveryProvider] = useState(location.state?.emailDeliveryProvider || '');
  const [deliveryReason, setDeliveryReason] = useState(location.state?.emailDeliveryReason || '');
  const [deliveryDetail, setDeliveryDetail] = useState(location.state?.emailDeliveryDetail || '');

  const twoFactorToken = useMemo(() => location.state?.twoFactorToken || '', [location.state]);
  const email = location.state?.email || '';

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!twoFactorToken) {
      setError('2FA session missing. Please login again.');
      return;
    }
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setError('');
    setInfo('');

    try {
      setIsVerifying(true);
      const res = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          two_factor_token: twoFactorToken,
          code,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const user = data?.data || null;
        const token = data?.token || '';

        persistAuthSession({ token, user });
        navigate(getDashboardPathForRole(user?.role), { replace: true });
      } else {
        setError(data.message || '2FA verification failed.');
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!twoFactorToken) {
      setError('2FA session missing. Please login again.');
      return;
    }

    setError('');
    setInfo('');

    try {
      setIsResending(true);
      const res = await fetch('/api/auth/login/2fa/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ two_factor_token: twoFactorToken }),
      });

      const data = await res.json();
      if (res.ok) {
        setInfo(cleanInfoMessage(data.message) || 'A new code has been sent to your email.');
        if (data.email_delivery_provider) setDeliveryProvider(data.email_delivery_provider);
        if (data.email_delivery_reason) setDeliveryReason(data.email_delivery_reason);
        if (data.email_delivery_detail) setDeliveryDetail(data.email_delivery_detail);
      } else {
        setError(data.message || 'Failed to resend code.');
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-body">
        <form className="card" onSubmit={handleVerify}>
          <h2 style={{ marginTop: 0 }}>Two-Factor Verification</h2>

          {email && <p className="form-footer">Code destination: {email}</p>}
          {info && <p className="form-footer">{info}</p>}
          {!info && deliveryProvider && (
            <p className="form-footer">Email provider used: {deliveryProvider}</p>
          )}
          {!info && deliveryReason && deliveryReason !== 'sent' && (
            <p className="form-footer">Delivery status: {deliveryReason}</p>
          )}
          {!info && deliveryDetail && (
            <p className="form-footer">Delivery detail: {deliveryDetail}</p>
          )}
          {error && <p className="form-error">{error}</p>}

          <label className="field-label">Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="field-input"
            value={code}
            onChange={(e) => {
              setError('');
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            }}
            placeholder="Enter 6-digit code"
          />

          <button type="submit" className="auth-btn" disabled={isVerifying}>
            {isVerifying ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            className="auth-btn"
            onClick={handleResend}
            disabled={isResending}
            style={{ marginTop: 10 }}
          >
            {isResending ? 'Resending...' : 'Resend Code'}
          </button>

          <p className="form-footer">
            Wrong account? <Link to="/login">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
