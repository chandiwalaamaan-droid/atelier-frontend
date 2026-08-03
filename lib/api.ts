// The backend (Express, deployed on Render) lives on a different origin
// than this frontend (Next.js, deployed on Netlify), so every request needs
// an absolute URL plus credentials: "include" so the cross-site session
// cookie is sent/received (see the backend's lib/auth.ts for the matching
// SameSite=None; Secure cookie config).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

/**
 * fetch wrapper for JSON API calls. Prefixes API_URL and always sends
 * cookies cross-site. Pass a FormData body (e.g. avatar upload) as-is —
 * this won't set a Content-Type header for you in that case, which is
 * correct (the browser sets the multipart boundary itself).
 */
export function apiFetch(path: string, init: RequestInit = {}) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: isFormData
      ? init.headers
      : { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

/**
 * Character avatarUrl / backgroundUrl values come back from the backend as
 * absolute B2 proxy URLs like "https://<backend-host>/api/images/atelier/avatars/xyz.png"
 * (the bucket stays private; the backend streams objects itself via GET /api/images/:key).
 * Resolve any relative path against API_URL so <img> tags load correctly regardless
 * of whether the value is absolute or relative.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/assets/")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
