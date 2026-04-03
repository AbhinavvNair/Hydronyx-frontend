/**
 * Shared API client for Hydronyx frontend.
 * Uses STGNN and physics-informed backend; all data from real APIs.
 */

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${apiUrl}${path}`;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  // credentials:'include' sends the httpOnly access_token cookie automatically
  return fetch(url, { ...options, headers, credentials: 'include' });
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
