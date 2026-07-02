import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetchJson } from '../utils/api';
import { clearAuthSession, getStoredAuthUser } from '../utils/auth';

const formatRole = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return 'User';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const initialsFromName = (value) => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

export default function ProfileMenu({ accentColor = '#1a3a8c', borderColor = '#a8bfe0' }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(getStoredAuthUser());

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        const result = await authFetchJson('/api/auth/me');
        const nextUser = result?.data || null;
        if (isMounted && nextUser) {
          setUser(nextUser);
        }
      } catch {
        // Keep local storage user if profile refresh fails.
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const displayName = user?.full_name || 'Registered User';

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: '999px',
          backgroundColor: '#fff',
          height: '40px',
          padding: '0 12px 0 6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#E2E8F0',
            color: accentColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {initialsFromName(displayName)}
        </span>
        <span style={{ color: '#1E293B', fontSize: '13px', fontWeight: 600 }}>{displayName}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '46px',
            width: '280px',
            backgroundColor: '#fff',
            border: `1px solid ${borderColor}`,
            borderRadius: '10px',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
            padding: '14px',
            zIndex: 40,
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Signed in as</p>
          <p style={{ margin: '2px 0 10px', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{displayName}</p>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginBottom: '12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#475569' }}><strong>Email:</strong> {user?.email || '-'}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}><strong>Role:</strong> {formatRole(user?.role)}</p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: '#B91C1C',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
