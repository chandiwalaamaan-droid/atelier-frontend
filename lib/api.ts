// API calls go through this frontend's own /api/* route handler (see
// app/api/[...path]/route.ts), which proxies them server-side to the
// backend (Express, deployed on Render). That makes every request
// same-origin from the browser's point of view, so the session cookie the
// backend sets is a first-party cookie — no cross-site cookie config, and
// no third-party-cookie blocking from iOS Safari/in-app browsers to work
// around. `credentials: "same-origin"` is actually the fetch default, but
// it's set explicitly here since that behavior matters.
export const API_URL = "/api";

/**
 * fetch wrapper for JSON API calls against this frontend's /api proxy.
 * Pass a FormData body (e.g. avatar upload) as-is — this won't set a
 * Content-Type header for you in that case, which is correct (the browser
 * sets the multipart boundary itself).
 */
export function apiFetch(path: string, init: RequestInit = {}) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      // CSRF mitigation: a plain cross-site <form> submission (the classic
      // CSRF vector) can never set a custom header — only fetch()/XHR can.
      // Any cross-origin fetch/XHR that sets one triggers a CORS
      // preflight, and this same-origin proxy has no CORS allowlist at
      // all, so a forged cross-site request never gets a response back to
      // read regardless of whether it fired.
      "X-Requested-With": "atelier-frontend",
      ...(init.headers || {}),
    },
  });
}

/**
 * Character avatarUrl / backgroundUrl values come back from the backend as
 * absolute B2 proxy URLs like "https://<backend-host>/api/images/rolichat/avatars/xyz.png"
 * (the bucket stays private; the backend streams objects itself via GET /api/images/:key).
 * Resolve any relative path against API_URL so <img> tags load correctly regardless
 * of whether the value is absolute or relative.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url; // already a same-origin path (e.g. /assets/... or /api/images/...)
  return `${API_URL}/${url}`;
}
