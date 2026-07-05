const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const AUTH_SESSION_STARTED_AT_KEY = 'auth_session_started_at';
const AUTH_SESSION_TIMEOUT_MS = 45 * 60 * 1000;

const getSessionStartedAt = () => {
  const raw = localStorage.getItem(AUTH_SESSION_STARTED_AT_KEY);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const hasSessionTimedOut = () => {
  const startedAt = getSessionStartedAt();
  if (!startedAt) return false;
  return Date.now() - startedAt >= AUTH_SESSION_TIMEOUT_MS;
};

const ensureSessionValidity = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return false;
  }

  const startedAt = getSessionStartedAt();

  // Keep backwards compatibility with existing sessions created before timeout support.
  if (!startedAt) {
    localStorage.setItem(AUTH_SESSION_STARTED_AT_KEY, String(Date.now()));
    return true;
  }

  if (hasSessionTimedOut()) {
    clearAuthSession();
    return false;
  }

  return true;
};

export const getDashboardPathForRole = (role) => {
  switch (String(role || '').toLowerCase()) {
    case 'judge':
      return '/dashboard/judge';
    case 'admin':
      return '/dashboard/admin';
    case 'litigant':
    case 'advocate':
      return '/dashboard/litigant';
    default:
      return '/login';
  }
};

export const persistAuthSession = ({ token, user }) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_SESSION_STARTED_AT_KEY, String(Date.now()));
  }

  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
};

export const getStoredAuthToken = () => {
  if (!ensureSessionValidity()) return '';
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY);
};

export const getStoredAuthUser = () => {
  if (!ensureSessionValidity()) return null;

  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
