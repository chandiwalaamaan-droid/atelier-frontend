// Shared across all pages. Set this to your deployed backend URL.
const API_BASE = window.API_BASE || "https://resume-analyser-backend-5v2u.onrender.com";

// Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID
// (type "Web application"). Client IDs are not secret -- safe to ship in
// frontend JS -- but you MUST add this exact ID here, and also add
// https://ats-resume-checker.com (and any other domain you serve the site
// from, e.g. a Netlify preview URL) under "Authorized JavaScript origins"
// on that same credential, or the Google button will fail to render/verify.
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || "377845169188-24dfobomjfa7bjemgs3ttvqc8osvieof.apps.googleusercontent.com";

const Auth = {
  getToken() {
    return localStorage.getItem("token");
  },
  setSession(token, email, plan) {
    localStorage.setItem("token", token);
    localStorage.setItem("email", email);
    localStorage.setItem("plan", plan);
  },
  clear() {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("plan");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  email() {
    return localStorage.getItem("email") || "";
  },
};

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // non-JSON response body
  }

  if (!res.ok) {
    if (res.status === 401) {
      Auth.clear();
      window.location.href = "login.html";
    }
    const message = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// Renders the right-hand side of the nav bar depending on login state.
// Call this on every page after the header markup is in the DOM.
function renderAuthNav() {
  const slot = document.getElementById("nav-auth-slot");
  if (!slot) return;

  if (Auth.isLoggedIn()) {
    slot.innerHTML = `
      <span style="font-size:0.85rem; color: var(--ink-soft);">${Auth.email()}</span>
      <a class="btn btn-ghost btn-sm" href="app.html">Open analyzer</a>
      <a class="btn btn-ghost btn-sm" href="tracker.html">Tracker</a>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Log out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      Auth.clear();
      window.location.href = "index.html";
    });
  } else {
    slot.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="login.html">Log in</a>
      <a class="btn btn-primary btn-sm" href="signup.html">Sign up free</a>
    `;
  }
}

document.addEventListener("DOMContentLoaded", renderAuthNav);

// ---------------------------------------------------------------------------
// Theme switcher (light/dark), persisted in localStorage, shared across pages
// ---------------------------------------------------------------------------

const Theme = {
  KEY: "theme",
  get() {
    return localStorage.getItem(this.KEY) || "light";
  },
  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  },
  toggle() {
    const next = this.get() === "dark" ? "light" : "dark";
    localStorage.setItem(this.KEY, next);
    this.apply(next);
  },
  init() {
    this.apply(this.get());
  },
};
Theme.init();

function renderThemeToggle() {
  const nav = document.querySelector("nav.primary");
  if (!nav || document.getElementById("theme-toggle-btn")) return;
  const btn = document.createElement("button");
  btn.id = "theme-toggle-btn";
  btn.className = "theme-toggle-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle dark mode");
  btn.innerHTML = `
    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  btn.addEventListener("click", () => Theme.toggle());
  const authSlot = document.getElementById("nav-auth-slot");
  if (authSlot) nav.insertBefore(btn, authSlot);
  else nav.appendChild(btn);
}
document.addEventListener("DOMContentLoaded", renderThemeToggle);

// ---------------------------------------------------------------------------
// Mobile nav toggle -- collapses the nav links + auth buttons into a
// dropdown below ~880px instead of letting them wrap into a tall stack.
// ---------------------------------------------------------------------------

function renderMobileNavToggle() {
  const wrap = document.querySelector("header.site .wrap");
  const nav = document.querySelector("nav.primary");
  if (!wrap || !nav || document.getElementById("nav-toggle-btn")) return;

  const btn = document.createElement("button");
  btn.id = "nav-toggle-btn";
  btn.className = "nav-toggle-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  wrap.insertBefore(btn, nav);
}
document.addEventListener("DOMContentLoaded", renderMobileNavToggle);

// ---------------------------------------------------------------------------
// "Continue with Google" -- shared by login.html and signup.html.
//
// Uses Google Identity Services (GIS), loaded via the <script> tag those
// pages include. We render Google's own button (not a custom-styled one)
// because GIS requires it for the credential flow to fire reliably, and
// because using their exact button is part of Google's brand guidelines
// for "Sign in with Google".
//
// `onCredential(idTokenJwt)` is called once the user picks a Google
// account; the caller is responsible for POSTing it to /api/auth/google
// and handling the result (same AuthResponse shape as password login).
// ---------------------------------------------------------------------------
function initGoogleSignIn(containerId, onCredential) {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    // GIS script hasn't loaded yet (slow network, ad-blocker, etc) -- fail
    // quietly. The email/password form still works fine without it.
    console.warn("Google Identity Services script did not load; Google Sign-In unavailable.");
    return;
  }
  if (GOOGLE_CLIENT_ID.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
    // Not configured yet -- don't render a button that's guaranteed to fail.
    console.warn("GOOGLE_CLIENT_ID is not set -- skipping Google Sign-In button.");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => onCredential(response.credential),
  });

  const container = document.getElementById(containerId);
  if (!container) return;
  // Fixed pixel width, not percentage -- GIS doesn't support responsive
  // sizing natively, so we measure the actual container instead of
  // guessing (auth-card's real content width is narrower than the card
  // itself, once padding is subtracted).
  const measuredWidth = Math.round(container.getBoundingClientRect().width) || 300;
  google.accounts.id.renderButton(container, {
    theme: Theme.get() === "dark" ? "filled_black" : "outline",
    size: "large",
    width: Math.min(Math.max(measuredWidth, 200), 400),
    text: "continue_with",
  });

  // Only reveal the button + divider once we know rendering actually
  // happened -- otherwise (unconfigured client ID, GIS blocked, etc) the
  // form would show a bare "or" divider above an empty gap.
  container.style.display = "flex";
  const divider = container.nextElementSibling;
  if (divider && divider.classList.contains("auth-divider")) divider.style.display = "flex";
}
