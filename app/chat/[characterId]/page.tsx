"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleplayModelPicker from "@/components/RoleplayModelPicker";
import MemoryPanel from "@/components/MemoryPanel";
import AppShell from "@/components/AppShell";
import AvatarGenerateModal from "@/components/AvatarGenerateModal";
import {
  loadRoleplayPreferences,
  saveRoleplayPreferences,
  NORMAL_STARTERS,
  SPICY_STARTERS,
  type RoleplayPreferences,
} from "@/lib/roleplayPreferences";
import {
  activeEngineEmoji,
  activeEngineLabel,
  resolveEngineId,
  type RoleplayEngineId,
} from "@/lib/roleplayEngines";

type Character = {
  id: string;
  name: string;
  tagline: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  accentColor: string;
  greeting: string;
  isExplicit: boolean;
  roleplayNotes?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

const STARTER_PROMPTS = NORMAL_STARTERS;

function buildChatBody(
  prefs: RoleplayPreferences,
  payload: Record<string, unknown>
): string {
  return JSON.stringify({
    ...payload,
    explicitMode: prefs.explicitMode,
    ...(prefs.explicitMode
      ? { spiceLevel: prefs.spiceLevel, roleplayStyle: prefs.roleplayStyle }
      : {}),
    // Send the named engine id so the backend can look up its bespoke
    // voice/pacing directive + temperature (see providers/engines.ts on the
    // backend) — the actual prompt text and sampling params live there, not
    // here, so this is just a fixed id, not anything that could inject
    // arbitrary prompt content.
    ...(prefs.engineId && prefs.engineId !== "custom" ? { engineId: prefs.engineId } : {}),
  });
}

// Mirrors MAX_MESSAGE_LENGTH in the backend's routes/chat.ts.
const MAX_MESSAGE_LENGTH = 4000;

function slugifyAvatar(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `/assets/characters/${slug}.png`;
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Lightweight markdown-ish rendering for message bubbles: **bold**,
 * *italic* (matches the *action* convention roleplay replies commonly use),
 * `inline code`, and paragraph line breaks. Deliberately minimal — no HTML
 * injection risk, just React text nodes, and no full markdown parser needed
 * for the handful of things a reply realistically uses. */
function renderMessageContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <span key={li}>
      {renderInline(line)}
      {li < lines.length - 1 && <br />}
    </span>
  ));
}

function renderInline(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code spans first (so ** inside `code` isn't parsed as bold),
  // then bold, then italic.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(line))) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="bg-plum-deep/60 rounded px-1 py-0.5 text-[0.9em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <em key={key++} className="text-parchment/80">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

const MARKER = "\u0000EVT:";

type StreamSegment = { type: "text"; value: string } | { type: "event"; value: Record<string, unknown> };

/** Incrementally scans a growing buffer for \x00EVT:{...}\x00 markers, emitting an
 * ORDERED list of text/event segments (so a caller can react to an event at the
 * exact point it occurred — e.g. discard only the text that preceded it — rather
 * than getting all text lumped together regardless of where events fell), while
 * holding back a marker that's been split across two network chunks until the
 * rest of it arrives. */
function extractEvents(buffer: string): { segments: StreamSegment[]; rest: string } {
  const segments: StreamSegment[] = [];
  let rest = buffer;
  while (true) {
    const start = rest.indexOf(MARKER);
    if (start === -1) {
      if (rest) segments.push({ type: "text", value: rest });
      rest = "";
      break;
    }
    if (start > 0) segments.push({ type: "text", value: rest.slice(0, start) });
    const end = rest.indexOf("\u0000", start + MARKER.length);
    if (end === -1) {
      // Marker started but hasn't closed yet — wait for the next chunk.
      rest = rest.slice(start);
      break;
    }
    const json = rest.slice(start + MARKER.length, end);
    try {
      segments.push({ type: "event", value: JSON.parse(json) });
    } catch {
      /* malformed event, drop it silently */
    }
    rest = rest.slice(end + 1);
  }
  return { segments, rest };
}

export default function ChatPage() {
  const params = useParams<{ characterId: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [roleplayPrefs, setRoleplayPrefs] = useState<RoleplayPreferences>(() =>
    loadRoleplayPreferences(params.characterId, false)
  );
  const [enginePickerOpen, setEnginePickerOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [sceneImages, setSceneImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const [generatingScene, setGeneratingScene] = useState(false);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch(`/api/chat/${params.characterId}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setCharacter(data.character);
        setMessages(data.messages);
        const prefs = loadRoleplayPreferences(params.characterId, data.character.isExplicit ?? false);
        setRoleplayPrefs(prefs);
      });
  }, [params.characterId]);

  useEffect(() => {
    if (!character) return;
    saveRoleplayPreferences(character.id, roleplayPrefs);
  }, [character, roleplayPrefs]);

  function applyEnginePrefs(prefs: RoleplayPreferences, engineId: RoleplayEngineId) {
    setRoleplayPrefs({ ...prefs, engineId });
  }

  const displayEngineId = roleplayPrefs.engineId ?? resolveEngineId(roleplayPrefs);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    // Only auto-scroll if the user is already near the bottom, so replying
    // to an old message doesn't get yanked away from where they're reading.
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) scrollToBottom();
  }, [messages, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  }

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  const lastActionRef = useRef<{ type: "send"; text: string } | { type: "regenerate" } | null>(null);
  // Tracks the in-flight streaming request so the "Stop" button can cancel
  // it. The reply generated so far is kept (see the backend's req.on("close")
  // handling), so stopping doesn't throw away a partial reply.
  const abortControllerRef = useRef<AbortController | null>(null);

  function isAbortError(err: unknown) {
    return err instanceof DOMException && err.name === "AbortError";
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
  }

  async function runStream(
    res: Response,
    assistantId: string,
    onFatal: (message: string) => void
  ) {
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || "Something went wrong.";
      setError(message);
      onFatal(message);
      setSending(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    let carry = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const { segments, rest } = extractEvents(carry);
      carry = rest;
      for (const seg of segments) {
        if (seg.type === "text") {
          acc += seg.value;
          continue;
        }
        const ev = seg.value;
        if (ev.type === "failover") {
          // The provider that produced everything accumulated so far just
          // died mid-stream. A fresh provider is about to start from
          // scratch, so drop the partial text now rather than letting the
          // next provider's full reply get appended after it — otherwise
          // the bubble ends up showing two different providers' text
          // concatenated together.
          acc = "";
          showToast("Reconnecting to keep the reply on track…");
        } else if (ev.type === "fatal") {
          const message = typeof ev.message === "string" ? ev.message : "Something went wrong.";
          setError(message);
          onFatal(message);
        }
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
      );
    }
  }

  async function sendMessage(userText: string, sceneDirective?: string) {
    setError("");
    setSending(true);
    lastActionRef.current = { type: "send", text: userText || "[scene steer]" };

    const showUserBubble = Boolean(userText.trim());
    const userMsg: Message | null = showUserBubble
      ? { id: `local-${Date.now()}`, role: "user", content: userText }
      : null;
    const assistantId = `local-${Date.now()}-a`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, ...(userMsg ? [userMsg] : []), assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, {
          message: userText,
          ...(sceneDirective ? { sceneDirective } : {}),
        }),
        signal: controller.signal,
      });
      // On a fatal failure no reply was ever saved server-side, so drop the
      // empty placeholder bubble rather than leaving a blank reply on screen.
      await runStream(res, assistantId, () =>
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      );
    } catch (err) {
      // A user-initiated Stop keeps whatever text streamed in so far —
      // the backend already saved it server-side.
      if (!isAbortError(err)) {
        setError("Lost connection while streaming the reply.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  async function steerScene(directive: string) {
    if (sending || messages.length === 0) return;
    await sendMessage("", directive);
  }

  /** Retries a send whose every provider failed. The user's message row was
   * already committed server-side before the failure (see routes/chat.ts),
   * so this must NOT call sendMessage() again — that would POST a brand-new
   * { message } and create a second, duplicate user-message row. Instead it
   * re-requests a reply for the already-saved message, the same way
   * onRegenerate() does, just without anything to delete first. */
  async function retryFailedSend() {
    if (sending) return;
    setError("");
    setSending(true);
    const assistantId = `local-${Date.now()}-a`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, { regenerate: true }),
        signal: controller.signal,
      });
      await runStream(res, assistantId, () =>
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      );
    } catch (err) {
      if (!isAbortError(err)) {
        setError("Lost connection while streaming the reply.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userText = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(userText);
  }

  async function onRegenerate() {
    if (sending || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const previousContent = last.content;

    setError("");
    setSending(true);
    lastActionRef.current = { type: "regenerate" };
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: "" } : m)));

    // The server only deletes the old reply once a new one succeeds, so on
    // failure we restore what was there rather than leaving it blank.
    const restore = () => setMessages((prev) => prev.map((m) => (m.id === last.id ? { ...m, content: previousContent } : m)));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, { regenerate: true }),
        signal: controller.signal,
      });
      await runStream(res, last.id, restore);
    } catch (err) {
      if (!isAbortError(err)) {
        setError("Lost connection while regenerating the reply.");
        restore();
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  async function onRetry() {
    const action = lastActionRef.current;
    if (!action || sending) return;
    // A failed "send" already has its user message committed server-side
    // (see routes/chat.ts) — retrying must ask for a reply to that existing
    // message, not send it again, or the user message ends up duplicated.
    if (action.type === "send") await retryFailedSend();
    else await onRegenerate();
  }

  function onResetConversation() {
    setResetConfirmOpen(true);
  }

  async function confirmResetConversation() {
    setResetConfirmOpen(false);
    setResetting(true);
    try {
      await apiFetch(`/api/chat/${params.characterId}`, { method: "DELETE" });
      setMessages([]);
      setError("");
    } finally {
      setResetting(false);
    }
  }

  function startEdit(id: string, content: string) {
    if (sending) return;
    setEditingId(id);
    setEditDraft(content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  /** Saves an edited user message and regenerates the reply from there.
   * Everything after the edited message (its old reply, and anything later)
   * is discarded server-side — see the editMessageId branch in
   * routes/chat.ts — so this mirrors that locally: trim local state down to
   * the edited message, then stream in a fresh reply. */
  async function submitEdit(id: string) {
    const newContent = editDraft.trim();
    if (!newContent || savingEdit) return;

    const editedIndex = messages.findIndex((m) => m.id === id);
    if (editedIndex === -1) return;
    const previousMessages = messages;

    setSavingEdit(true);
    setError("");
    const assistantId = `local-${Date.now()}-a`;
    setMessages((prev) => [
      ...prev.slice(0, editedIndex).concat({ ...prev[editedIndex], content: newContent }),
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setEditingId(null);
    setEditDraft("");
    setSending(true);
    lastActionRef.current = { type: "regenerate" };

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, { editMessageId: id, editContent: newContent }),
        signal: controller.signal,
      });
      await runStream(res, assistantId, (message) => {
        setError(message);
        setMessages(previousMessages);
      });
    } catch (err) {
      if (!isAbortError(err)) {
        setError("Lost connection while saving the edit.");
        setMessages(previousMessages);
      }
    } finally {
      setSavingEdit(false);
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  function autoResizeEdit() {
    const el = editTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function onSpeak(id: string, content: string) {
    setVoiceError("");
    const audioEl = audioElRef.current;
    if (!audioEl) return;

    // Toggle off if this message is already playing.
    if (playingId === id) {
      audioEl.pause();
      setPlayingId(null);
      return;
    }

    const cached = audioCacheRef.current.get(id);
    if (cached) {
      audioEl.src = cached;
      audioEl.play();
      setPlayingId(id);
      return;
    }

    setLoadingAudioId(id);
    try {
      const res = await apiFetch(`/api/chat/${params.characterId}/speak`, {
        method: "POST",
        body: JSON.stringify({ text: content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setVoiceError(data.error || "Couldn't generate audio.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(id, url);
      audioEl.src = url;
      audioEl.play();
      setPlayingId(id);
    } catch {
      setVoiceError("Couldn't reach the server for voice playback.");
    } finally {
      setLoadingAudioId(null);
    }
  }

  useEffect(() => {
    // Revoke cached object URLs when the page unmounts to release memory.
    const cache = audioCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function onCopy(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard permissions can silently fail; not worth surfacing an error for */
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e as unknown as React.FormEvent);
      return;
    }
    if (e.key === "ArrowUp" && !input && !sending && !editingId) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          e.preventDefault();
          startEdit(messages[i].id, messages[i].content);
          break;
        }
      }
    }
  }

  if (notFound) {
    return (
      <RequireAuth>
        <AppShell>
          <main className="flex-1 flex items-center justify-center gap-4">
            <p className="font-display text-xl">Couldn&apos;t find that character.</p>
            <Link href="/dashboard" className="text-gold hover:underline">
              Back to Studio
            </Link>
          </main>
        </AppShell>
      </RequireAuth>
    );
  }

  if (!character) {
    return (
      <RequireAuth>
        <AppShell variant="chat">
          <main className="flex-1 flex flex-col min-h-0 relative animate-pulse">
            <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <div className="w-6 h-6 rounded bg-white/10" />
              <div className="w-9 h-9 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-3 w-40 rounded bg-white/10" />
              </div>
            </header>
            <div className="flex-1 px-6 py-6 space-y-4">
              <div className="max-w-lg h-16 rounded-2xl bg-surface-card" />
              <div className="max-w-xs h-10 ml-auto rounded-2xl bg-white/5" />
            </div>
          </main>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
    <AppShell variant="chat">
    <main className="flex-1 flex flex-col min-h-0 relative">
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/10 shrink-0 bg-gradient-to-r from-surface-raised to-plum-deep/30">
        <button onClick={() => router.push("/explore")} className="text-parchment/60 hover:text-gold focus-ring rounded px-2 transition-colors">
          ←
        </button>
        {character && (
          <>
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="text-xl w-9 h-9 flex items-center justify-center rounded-full overflow-hidden focus-ring shrink-0 hover:ring-2 hover:ring-gold/50 transition-all shadow-lg"
              style={{ backgroundColor: `${character.accentColor}30` }}
              title="Change portrait"
            >
              {character.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(character.avatarUrl)} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slugifyAvatar(character.name)} alt={character.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </button>
            <div className="flex-1">
              <p className="font-display text-lg">{character.name}</p>
              {character.tagline && <p className="text-xs text-parchment/50">{character.tagline}</p>}
            </div>
            <button
              type="button"
              onClick={() => setEnginePickerOpen(true)}
              className="flex items-center gap-2 max-w-[11rem] sm:max-w-xs rounded-full border border-parchment/15 bg-plum/60 hover:border-gold/40 hover:bg-plum/80 pl-1.5 pr-3 py-1 focus-ring shrink-0 transition-all"
              title="Choose roleplay engine"
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-lg bg-plum-deep/80 shrink-0 shadow-inner">
                {activeEngineEmoji(displayEngineId)}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-xs font-medium text-parchment truncate leading-tight">
                  {activeEngineLabel(roleplayPrefs, displayEngineId)}
                </span>
                <span className="block text-[10px] text-parchment/45 truncate">
                  {roleplayPrefs.explicitMode ? "Premium · 18+" : "Free"}
                </span>
              </span>
            </button>
            <button
              onClick={() => setMemoryOpen(true)}
              className="text-sm text-parchment/50 hover:text-gold focus-ring rounded px-2 py-1 transition-colors"
              title="What this character remembers about your conversation"
            >
              Memory
            </button>
            <button
              onClick={onResetConversation}
              disabled={resetting || messages.length === 0}
              className="text-sm text-parchment/50 hover:text-rose focus-ring rounded px-2 py-1 disabled:opacity-40 transition-colors"
              title="Clear this conversation"
            >
              Clear
            </button>
            <Link
              href={`/characters/${character.id}/edit`}
              className="text-sm text-parchment/50 hover:text-gold focus-ring rounded px-2 py-1 transition-colors"
            >
              Edit
            </Link>
          </>
        )}
      </header>

      <RoleplayModelPicker
        open={enginePickerOpen}
        onClose={() => setEnginePickerOpen(false)}
        prefs={roleplayPrefs}
        engineId={displayEngineId}
        onApply={applyEnginePrefs}
        canSteerScene={messages.length > 0}
        onSteerScene={steerScene}
        steering={sending}
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-6 py-6 md:px-12 space-y-4 bg-cover bg-center bg-no-repeat"
        style={character?.backgroundUrl ? { backgroundImage: `url(${resolveMediaUrl(character.backgroundUrl)})` } : undefined}
      >
        {character && messages.length === 0 && (
          <>
            <div className="max-w-lg bg-plum/60 rounded-2xl rounded-tl-sm px-4 py-3">
              {character.greeting}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(roleplayPrefs.explicitMode ? SPICY_STARTERS : STARTER_PROMPTS).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={sending}
                  className="text-sm text-parchment/70 hover:text-gold border border-parchment/15 hover:border-gold/40 rounded-full px-3 py-1.5 focus-ring disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) => {
          const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
          const isStreamingEmpty = isLastAssistant && sending && !m.content;
          const isEditing = editingId === m.id;
          return (
            <div key={m.id} className="group">
              {isEditing ? (
                <div className="max-w-lg ml-auto rounded-2xl rounded-tr-sm bg-gold/10 border border-gold/40 p-3">
                  <textarea
                    ref={editTextareaRef}
                    autoFocus
                    value={editDraft}
                    onChange={(e) => {
                      setEditDraft(e.target.value);
                      autoResizeEdit();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitEdit(m.id);
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    rows={2}
                    className="w-full bg-transparent resize-none focus:outline-none text-ink placeholder:text-ink/40"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-ink/60 hover:text-ink px-3 py-1 rounded-full focus-ring"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => submitEdit(m.id)}
                      disabled={!editDraft.trim() || savingEdit}
                      className="text-xs bg-ink text-parchment px-3 py-1 rounded-full font-medium hover:brightness-125 focus-ring disabled:opacity-40"
                    >
                      {savingEdit ? "Saving…" : "Save & regenerate"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  aria-live={isLastAssistant ? "polite" : undefined}
                  className={`max-w-lg px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gold text-ink ml-auto rounded-tr-sm"
                      : "bg-plum/60 rounded-tl-sm"
                  }`}
                >
                  {isStreamingEmpty ? (
                    <span className="inline-flex gap-1" aria-label="Character is typing">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-parchment/60 inline-block" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-parchment/60 inline-block" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-parchment/60 inline-block" />
                    </span>
                  ) : (
                    renderMessageContent(m.content)
                  )}
                </div>
              )}
              {m.content && !isEditing && (
                <div
                  className={`flex items-center gap-3 mt-1 text-xs text-parchment/40 opacity-0 group-hover:opacity-100 transition-opacity ${
                    m.role === "user" ? "justify-end pr-1" : "justify-start pl-1"
                  }`}
                >
                  {m.createdAt && <span className="select-none">{formatTime(m.createdAt)}</span>}
                  <button onClick={() => onCopy(m.id, m.content)} className="hover:text-gold focus-ring rounded">
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </button>
                  {m.role === "assistant" && (
                    <button
                      onClick={() => onSpeak(m.id, m.content)}
                      disabled={loadingAudioId === m.id}
                      className="hover:text-gold focus-ring rounded disabled:opacity-50"
                      title="Play this message aloud"
                    >
                      {loadingAudioId === m.id ? "Loading…" : playingId === m.id ? "⏸ Pause" : "🔊 Play"}
                    </button>
                  )}
                  {m.role === "user" && !sending && (
                    <button onClick={() => startEdit(m.id, m.content)} className="hover:text-gold focus-ring rounded">
                      Edit
                    </button>
                  )}
                  {isLastAssistant && !sending && (
                    <button onClick={onRegenerate} className="hover:text-gold focus-ring rounded">
                      Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Scene images displayed inline in the chat */}
        {sceneImages.map((img) => (
          <div key={img.id} className="max-w-lg ml-auto rounded-2xl overflow-hidden border border-gold/20 shadow-lg message-bubble">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url.startsWith("http") ? img.url : resolveMediaUrl(img.url)} alt="Generated scene" className="w-full h-auto object-cover" />
            <div className="px-3 py-2 bg-plum-deep/60 text-xs text-parchment/40 flex items-center justify-between">
              <span>🎨 AI generated scene</span>
              <button
                type="button"
                onClick={() => setSceneImages((prev) => prev.filter((s) => s.id !== img.id))}
                className="hover:text-rose transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title={`Clear this conversation with ${character?.name ?? "this character"}?`}
        description="This deletes every message in this chat. This can't be undone."
        confirmLabel="Clear"
        destructive
        onConfirm={confirmResetConversation}
        onCancel={() => setResetConfirmOpen(false)}
      />

      {character && (
        <AvatarGenerateModal
          open={avatarModalOpen}
          characterId={character.id}
          characterName={character.name}
          isExplicit={character.isExplicit}
          currentAvatarUrl={character.avatarUrl}
          onClose={() => setAvatarModalOpen(false)}
          onUpdated={(avatarUrl) => setCharacter((c) => (c ? { ...c, avatarUrl } : c))}
        />
      )}

      {character && (
        <MemoryPanel
          open={memoryOpen}
          characterId={character.id}
          characterName={character.name}
          onClose={() => setMemoryOpen(false)}
        />
      )}

      {/* Single shared <audio> element for message playback — reused across
          messages so only one can ever play at a time. */}
      <audio ref={audioElRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {voiceError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose/90 text-ink text-sm px-4 py-2 rounded-full shadow-lg toast-in">
          {voiceError}
          <button onClick={() => setVoiceError("")} className="ml-3 underline">
            Dismiss
          </button>
        </div>
      )}
      {showJump && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-plum-deep border border-parchment/20 text-sm px-4 py-1.5 rounded-full hover:border-gold focus-ring shadow-lg"
        >
          ↓ Jump to latest
        </button>
      )}

      {toast && (
        <div
          role="status"
          className="toast-in absolute bottom-24 left-1/2 -translate-x-1/2 bg-plum-deep border border-gold/40 text-sm px-4 py-2 rounded-full shadow-lg max-w-sm text-center"
        >
          {toast}
        </div>
      )}

      {error && (
        <div className="px-6 py-2 flex items-center gap-3 text-sm">
          <p className="text-rose">{error}</p>
          {lastActionRef.current && (
            <button
              onClick={onRetry}
              disabled={sending}
              className="text-parchment/70 hover:text-gold focus-ring rounded px-2 py-0.5 border border-parchment/20 hover:border-gold/50 disabled:opacity-40 shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <form onSubmit={onSend} className="flex gap-2 px-6 py-4 border-t border-parchment/10 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH));
              autoResize();
            }}
            onKeyDown={onKeyDown}
            placeholder="Say something… (Shift+Enter for a new line)"
            rows={1}
            className="w-full rounded-2xl bg-plum-deep border border-parchment/20 px-4 py-2.5 focus-ring resize-none max-h-40 overflow-y-auto"
          />
          {input.length > MAX_MESSAGE_LENGTH - 300 && (
            <span
              className={`absolute bottom-2 right-3 text-[11px] select-none ${
                input.length >= MAX_MESSAGE_LENGTH ? "text-rose" : "text-parchment/40"
              }`}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            if (generatingScene || !character) return;
            setGeneratingScene(true);
            setError("");
            try {
              // Build a rich prompt from conversation context for character continuity
              const recentMessages = messages.slice(-6).map(m => `${m.role === "user" ? "User" : character.name}: ${m.content}`).join("\n");
              const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
              const scenePrompt = `Character: ${character.name}. ${character.tagline}. Scene: ${lastAssistant?.content || character.greeting}. Conversation context: ${recentMessages}. Unique seed: ${Date.now()}`;
              const res = await apiFetch(`/api/characters/${character.id}/image/generate`, {
                method: "POST",
                body: JSON.stringify({ prompt: scenePrompt }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Failed to generate scene image");
              // Add the generated image inline in the chat as a persistent message
              setSceneImages((prev) => [...prev, { id: `scene-${Date.now()}`, url: data.url, prompt: scenePrompt }]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't generate scene image.");
            } finally {
              setGeneratingScene(false);
            }
          }}
          disabled={generatingScene}
          title="Generate scene image"
          className="shrink-0 px-3 py-2.5 rounded-full border border-gold/30 text-gold text-sm font-medium hover:bg-gold/10 focus-ring disabled:opacity-50 transition-colors"
        >
          {generatingScene ? "⏳" : "🖼"}
        </button>
        {sending ? (
          <button
            type="button"
            onClick={stopGenerating}
            className="bg-rose/90 text-ink px-5 py-2.5 rounded-full font-medium hover:brightness-110 focus-ring shrink-0"
          >
            ■ Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-gold text-ink px-5 py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-50 shrink-0"
          >
            Send
          </button>
        )}
      </form>
    </main>
    </AppShell>
    </RequireAuth>
  );
}
