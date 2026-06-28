import { getStoredAuthToken } from './auth';

export const authFetchJson = async (url, options = {}) => {
  const token = getStoredAuthToken();

  if (!token) {
    throw new Error('Session expired. Please login again.');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
};
