const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

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
  }

  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
};

export const getStoredAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

export const getStoredAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
