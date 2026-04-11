/**
 * Shared API client for Hydronyx frontend.
 */

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let _onSessionExpired: (() => void) | null = null;

/** Register a callback that fires when the server returns 401 (session expired). */
export function setSessionExpiredHandler(fn: () => void) {
  _onSessionExpired = fn;
}

async function _refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${apiUrl}${path}`;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));

  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  // On 401, attempt a single token refresh then retry
  if (res.status === 401) {
    const refreshed = await _refreshAccessToken();
    if (refreshed) {
      res = await fetch(url, { ...options, headers, credentials: 'include' });
    }
    // If still 401 after refresh attempt, session is expired
    if (res.status === 401) {
      _onSessionExpired?.();
    }
  }

  return res;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetchWithAuth(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}
