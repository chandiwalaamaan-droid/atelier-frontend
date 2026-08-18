import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Same-origin proxy for the Render backend.
 *
 * Why this exists: the frontend (Netlify) and backend (Render) are
 * different origins, so the backend's session cookie has to be
 * `SameSite=None; Secure` to survive a cross-site request at all — and a
 * lot of real browsers (iOS Safari's "Prevent Cross-Site Tracking", which
 * is on by default, plus most in-app browsers like Instagram/TikTok's)
 * simply drop third-party cookies regardless of that config being
 * technically correct. That used to be worked around by also returning the
 * session JWT in the login/register JSON body and stashing it in
 * localStorage as a Bearer-header fallback — which works, but means an XSS
 * bug anywhere in the app can read a token that grants a full session.
 *
 * Routing every /api/* call through the frontend's own origin instead
 * fixes the root cause: from the browser's point of view, the cookie is
 * now set by (and only ever talks to) the same origin it's already on, so
 * it's a first-party cookie and none of the third-party-cookie blocking
 * above applies. No token needs to touch JS-accessible storage at all.
 *
 * This forwards method/headers/body as-is (streaming both directions, so
 * the chat endpoint's chunked streaming response isn't buffered), and
 * relays Set-Cookie headers verbatim so the backend's cookie config is
 * untouched — this is a transparent passthrough, not a cookie rewrite.
 */
const BACKEND_URL = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
);

// Headers that are per-hop or set automatically by fetch/undici — forwarding
// them verbatim either breaks the request or duplicates something fetch
// will set itself.
const HOP_BY_HOP_REQUEST_HEADERS = new Set(["host", "connection", "content-length"]);
const STRIPPED_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

async function proxy(req: NextRequest, path: string[]) {
  const search = req.nextUrl.search;
  const url = `${BACKEND_URL}/api/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = !["GET", "HEAD"].includes(req.method);

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    ...(hasBody ? { body: req.body, duplex: "half" } : {}),
  };

  let backendRes: Response;
  try {
    backendRes = await fetch(url, init);
  } catch (err) {
    console.error("Proxy request to backend failed:", err);
    return Response.json({ error: "Could not reach the server. Please try again." }, { status: 502 });
  }

  const responseHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });

  const response = new Response(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: responseHeaders,
  });

  // Headers (the standard fetch API object) folds repeated Set-Cookie
  // entries into one comma-joined string, which corrupts cookie parsing —
  // undici (Next's fetch implementation) exposes getSetCookie() to get
  // them back out individually. Re-append each one so multiple cookies in
  // a single response (e.g. a future rotate-and-clear) survive intact.
  const setCookies =
    typeof (backendRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (backendRes.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : backendRes.headers.get("set-cookie")
        ? [backendRes.headers.get("set-cookie") as string]
        : [];
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);

  return response;
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
