"use client";

/// <reference types="react" />
import { useEffect, useRef, useState, useCallback, type ReactNode, type FormEvent, type KeyboardEvent, useMemo } from "react";
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

type Reaction = { emoji: string; count: number; reacted: boolean };

type ChatTheme = "midnight" | "aurora" | "ember";

const STARTER_PROMPTS = NORMAL_STARTERS;

const CHAT_THEMES: { id: ChatTheme; label: string; emoji: string }[] = [
  { id: "midnight", label: "Midnight", emoji: "🌙" },
  { id: "aurora", label: "Aurora", emoji: "🌌" },
  { id: "ember", label: "Ember", emoji: "🔥" },
];

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢"];

function getChatTheme(): ChatTheme {
  if (typeof window === "undefined") return "midnight";
  const stored = localStorage.getItem("atelier:chat:theme");
  if (stored === "midnight" || stored === "aurora" || stored === "ember") return stored;
  return "midnight";
}

function saveChatTheme(theme: ChatTheme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("atelier:chat:theme", theme);
}

function buildChatBody(
  prefs: RoleplayPreferences,
  payload: Record<string, unknown>
): string {
  const engineSelected = Boolean(prefs.engineId && prefs.engineId !== "custom");
  return JSON.stringify({
    ...payload,
    explicitMode: prefs.explicitMode,
    ...(engineSelected ? { engineId: prefs.engineId } : {}),
    ...(engineSelected || prefs.explicitMode
      ? { spiceLevel: prefs.spiceLevel, roleplayStyle: prefs.roleplayStyle }
      : {}),
  });
}

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

function renderMessageContent(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <span key={li}>
      {renderInline(line)}
      {li < lines.length - 1 && <br />}
    </span>
  ));
}

function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]*`)|(\*\*[^*]*\*\*)|(\*[^*]*\*)/g;
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

function getSmartReplies(messages: Message[], characterName: string): string[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return [`Tell me about yourself, ${characterName}.`, "What brings you here?", "Let's start an adventure."];
  
  const msgCount = messages.length;
  if (msgCount <= 2) return ["Tell me more about yourself.", "What's your favorite thing to do?", "That's interesting, go on."];
  if (msgCount <= 5) return ["I'd love to hear more.", "What happened next?", "You're fascinating."];
  if (msgCount <= 10) return ["I'm really enjoying this.", "Tell me something unexpected.", "I could listen to you all day."];
  return ["I feel like I'm getting to know you.", "This is special.", "I don't want this to end."];
}

export default function ChatPage() {
  const { characterId } = useParams<{ characterId: string }>();
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
    characterId ? loadRoleplayPreferences(characterId, false) : loadRoleplayPreferences("", false)
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
  const [theme, setTheme] = useState<ChatTheme>(getChatTheme);
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [relationshipLevel, setRelationshipLevel] = useState(0);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-chat-theme", theme);
    saveChatTheme(theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`/api/chat/${characterId}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace(`/login?next=/chat/${characterId}`);
          return null;
        }
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
        const prefs = loadRoleplayPreferences(characterId, data.character.isExplicit ?? false);
        setRoleplayPrefs(prefs);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load chat:", err);
      });
    return () => controller.abort();
  }, [characterId]);

  useEffect(() => {
    if (!character) return;
    saveRoleplayPreferences(character.id, roleplayPrefs);
  }, [character, roleplayPrefs]);

  useEffect(() => {
    const msgs = messages.length;
    const explicit = roleplayPrefs.explicitMode;
    let level = Math.min(100, Math.floor((msgs / 50) * 100));
    if (explicit) level = Math.min(100, level + 15);
    setRelationshipLevel(level);
  }, [messages.length, roleplayPrefs.explicitMode]);

  function applyEnginePrefs(prefs: RoleplayPreferences, engineId: RoleplayEngineId) {
    setRoleplayPrefs({ ...prefs, engineId });
  }

  const displayEngineId = roleplayPrefs.engineId ?? resolveEngineId(roleplayPrefs);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
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

  const lastActionRef = useRef<{ type: "send"; text: string; sceneDirective?: string } | { type: "regenerate" } | null>(null);
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
          acc = "";
          showToast("Reconnecting to keep the reply on track…");
        } else if (ev.type === "fatal") {
          const message = typeof ev.message === "string" ? ev.message : "Something went wrong.";
          setError(message);
          onFatal(message);
        }
      }
      setMessages((prev: Message[]) =>
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
    setMessages((prev: Message[]) => [...prev, ...(userMsg ? [userMsg] : []), assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, {
          message: userText,
          ...(sceneDirective ? { sceneDirective } : {}),
        }),
        signal: controller.signal,
      });
      await runStream(res, assistantId, () =>
        setMessages((prev: Message[]) => prev.filter((m) => m.id !== assistantId))
      );
    } catch (err) {
      if (!isAbortError(err)) {
        setError("Lost connection while streaming the reply.");
        setMessages((prev: Message[]) => prev.filter((m) => m.id !== assistantId));
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

  async function retryFailedSend() {
    if (sending) return;
    setError("");
    setSending(true);
    const assistantId = `local-${Date.now()}-a`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev: Message[]) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${characterId}`, {
        method: "POST",
        body: buildChatBody(roleplayPrefs, { regenerate: true }),
        signal: controller.signal,
      });
      await runStream(res, assistantId, () =>
        setMessages((prev: Message[]) => prev.filter((m) => m.id !== assistantId))
      );
    } catch (err) {
      if (!isAbortError(err)) {
        setError("Lost connection while streaming the reply.");
        setMessages((prev: Message[]) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  async function onSend(e: FormEvent<HTMLFormElement>) {
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
    setMessages((prev: Message[]) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: "" } : m)));

    const restore = () => setMessages((prev: Message[]) => prev.map((m) => (m.id === last.id ? { ...m, content: previousContent } : m)));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch(`/api/chat/${characterId}`, {
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
      await apiFetch(`/api/chat/${characterId}`, { method: "DELETE" });
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

  async function submitEdit(id: string) {
    const newContent = editDraft.trim();
    if (!newContent || savingEdit) return;

    const editedIndex = messages.findIndex((m) => m.id === id);
    if (editedIndex === -1) return;
    const previousMessages = messages;

    setSavingEdit(true);
    setError("");
    const assistantId = `local-${Date.now()}-a`;
    setMessages((prev: Message[]) => [
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
      const res = await apiFetch(`/api/chat/${characterId}`, {
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

    if (playingId === id) {
      audioEl.pause();
      setPlayingId(null);
      return;
    }

    const cached = audioCacheRef.current.get(id);
    if (cached) {
      audioEl.src = cached;
      audioEl.play().catch(() => {
        setVoiceError("Failed to play audio.");
        setPlayingId(null);
      });
      setPlayingId(id);
      return;
    }

    setLoadingAudioId(id);
    try {
      const res = await apiFetch(`/api/chat/${characterId}/speak`, {
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
      const cache = audioCacheRef.current;
      cache.set(id, url);
      if (cache.size > 20) {
        const oldest = cache.keys().next().value!;
        URL.revokeObjectURL(cache.get(oldest)!);
        cache.delete(oldest);
      }
      audioEl.src = url;
      audioEl.play().catch(() => {
        setVoiceError("Failed to play audio.");
        setPlayingId(null);
      });
      setPlayingId(id);
    } catch {
      setVoiceError("Couldn't reach the server for voice playback.");
    } finally {
      setLoadingAudioId(null);
    }
  }

  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function onCopy(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c: string | null) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard permissions can silently fail */
    }
  }

  function toggleReaction(messageId: string, emoji: string) {
    setReactions((prev) => {
      const next = new Map(prev);
      const msgReactions = next.get(messageId) || [];
      const existing = msgReactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          next.set(
            messageId,
            msgReactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r)
              .filter((r) => r.count > 0)
          );
        } else {
          next.set(
            messageId,
            msgReactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r)
          );
        }
      } else {
        next.set(messageId, [...msgReactions, { emoji, count: 1, reacted: true }]);
      }
      return next;
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e as unknown as FormEvent<HTMLFormElement>);
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

  const smartReplies = useMemo(() => getSmartReplies(messages, character?.name || "Character"), [messages, character?.name]);

  if (notFound) {
    return (
      <RequireAuth>
        <AppShell>
          <main className="flex-1 flex items-center justify-center gap-4">
            <p className="font-display text-xl">Couldn't find that character.</p>
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
          {/* Header */}
          <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/10 shrink-0 bg-gradient-to-r from-surface-raised to-plum-deep/30">
            <button onClick={() => router.push("/explore")} className="text-parchment/60 hover:text-gold focus-ring rounded px-2 transition-colors">
              ←
            </button>
            {character && (
              <>
                <div className="avatar-ring-animated relative text-xl w-9 h-9 flex items-center justify-center rounded-full overflow-hidden focus-ring shrink-0 cursor-pointer" style={{ "--ring-color": `${character.accentColor}80` } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="relative text-xl w-9 h-9 flex items-center justify-center rounded-full overflow-hidden focus-ring shrink-0 shadow-lg"
                    style={{ backgroundColor: `${character.accentColor}30` }}
                    title="Change portrait"
                  >
                    <span className="text-xl">{character.avatarEmoji}</span>
                    <img
                      src={character.avatarUrl ? resolveMediaUrl(character.avatarUrl) : slugifyAvatar(character.name)}
                      alt={character.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-display text-lg">{character.name}</p>
                  {character.tagline && <p className="text-xs text-parchment/50">{character.tagline}</p>}
                </div>

                {/* Relationship Meter */}
                <div className="relationship-meter hidden sm:flex" title={`Relationship level: ${relationshipLevel}%`}>
                  <span>💖</span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="relationship-meter-fill h-full rounded-full" style={{ width: `${relationshipLevel}%` }} />
                  </div>
                </div>

                {/* Theme Toggle */}
                <div className="hidden md:flex items-center gap-1">
                  {CHAT_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`theme-toggle-btn ${theme === t.id ? "border-gold/40 text-gold" : ""}`}
                      title={`${t.label} theme`}
                      aria-label={`Switch to ${t.label} theme`}
                    >
                      {t.emoji}
                    </button>
                  ))}
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

          {/* Messages Area */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-4 bg-cover bg-center bg-no-repeat"
            style={character?.backgroundUrl ? { backgroundImage: `url(${resolveMediaUrl(character.backgroundUrl)})` } : undefined}
          >
            {character && messages.length === 0 && (
              <>
                <div className="max-w-lg chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 message-slide-in">
                  {character.greeting}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(roleplayPrefs.explicitMode ? SPICY_STARTERS : STARTER_PROMPTS).map((prompt: string) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      disabled={sending}
                      className="starter-prompt-card"
                    >
                      <span className="text-sm">✨</span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m: Message, i: number) => {
              const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
              const isStreamingEmpty = isLastAssistant && sending && !m.content;
              const isEditing = editingId === m.id;
              const msgReactions = reactions.get(m.id) || [];
              const lastMsgReactions = isLastAssistant ? msgReactions : [];

              return (
                <div key={m.id} className="group message-slide-in">
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
                        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
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
                          ? "chat-bubble-user ml-auto rounded-tr-sm"
                          : "chat-bubble-assistant rounded-tl-sm"
                      }`}
                    >
                      {isStreamingEmpty ? (
                        <div className="typing-indicator-enhanced">
                          <span className="text-xs text-parchment/60 mr-1">{character.name} is typing</span>
                          <span className="typing-indicator-dot" />
                          <span className="typing-indicator-dot" />
                          <span className="typing-indicator-dot" />
                        </div>
                      ) : (
                        renderMessageContent(m.content)
                      )}
                    </div>
                  )}

                  {/* Reactions */}
                  {m.content && !isEditing && (
                    <div className={`flex flex-wrap items-center gap-1.5 mt-1.5 ${m.role === "user" ? "justify-end pr-1" : "justify-start pl-1"}`}>
                      {REACTION_EMOJIS.map((emoji) => {
                        const existing = msgReactions.find((r) => r.emoji === emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className={`reaction-btn ${existing?.reacted ? "reacted" : ""}`}
                            aria-label={`React with ${emoji}${existing ? ` (${existing.count})` : ""}`}
                          >
                            {emoji}
                            {existing && existing.count > 0 && <span className="text-[10px] font-medium">{existing.count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  {m.content && !isEditing && (
                    <div
                      className={`flex items-center gap-3 mt-1.5 text-xs text-parchment/40 opacity-0 group-hover:opacity-100 transition-opacity ${
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

            {/* Smart Reply Suggestions */}
            {!sending && messages.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 message-slide-in">
                {smartReplies.slice(0, 3).map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(reply)}
                    className="reply-chip"
                  >
                    <span className="text-sm">💬</span>
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick Actions Bar */}
          {showQuickActions && (
            <div ref={quickActionsRef} className="px-4 md:px-12 pb-2">
              <div className="quick-actions-bar max-w-3xl mx-auto">
                <button
                  onClick={() => setShowQuickActions(false)}
                  className="quick-action-btn"
                  title="Close quick actions"
                >
                  ✕
                </button>
                <div className="w-px h-5 bg-parchment/10" />
                <button
                  onClick={onRegenerate}
                  disabled={sending || messages.length === 0}
                  className="quick-action-btn"
                  title="Regenerate last reply"
                >
                  🔄
                </button>
                <button
                  onClick={() => {
                    const last = messages[messages.length - 1];
                    if (last?.content) onCopy(last.id, last.content);
                  }}
                  disabled={messages.length === 0}
                  className="quick-action-btn"
                  title="Copy last message"
                >
                  📋
                </button>
                <button
                  onClick={() => {
                    const last = messages[messages.length - 1];
                    if (last?.content && last.role === "assistant") onSpeak(last.id, last.content);
                  }}
                  disabled={messages.length === 0}
                  className="quick-action-btn"
                  title="Speak last message"
                >
                  🔊
                </button>
                <button
                  onClick={() => {
                    if (messages.length > 0) {
                      const last = messages[messages.length - 1];
                      if (last?.role === "assistant") toggleReaction(last.id, "❤️");
                    }
                  }}
                  disabled={messages.length === 0}
                  className="quick-action-btn"
                  title="Quick react"
                >
                  ❤️
                </button>
              </div>
            </div>
          )}

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

          <audio ref={audioElRef} onEnded={() => setPlayingId(null)} className="hidden" />

          {voiceError && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose/90 text-ink text-sm px-4 py-2 rounded-full shadow-lg toast-in z-50">
              {voiceError}
              <button onClick={() => setVoiceError("")} className="ml-3 underline">
                Dismiss
              </button>
            </div>
          )}
          {showJump && (
            <button
              onClick={() => scrollToBottom()}
              className="scroll-jump-btn"
            >
              ↓ Jump to latest
            </button>
          )}

          {toast && (
            <div
              role="status"
              className="toast-in absolute bottom-24 left-1/2 -translate-x-1/2 bg-plum-deep border border-gold/40 text-sm px-4 py-2 rounded-full shadow-lg max-w-sm text-center z-50"
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

          <form onSubmit={onSend} className="flex gap-2 px-4 md:px-6 py-4 border-t border-parchment/10 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH));
                  autoResize();
                }}
                onKeyDown={onKeyDown}
                placeholder="Say something… (Shift+Enter for new line)"
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
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowQuickActions((s) => !s)}
                className="text-parchment/50 hover:text-parchment/80 focus-ring rounded px-2 py-2.5 transition-colors"
                title="Quick actions"
                aria-label="Toggle quick actions"
              >
                ⚡
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
            </div>
          </form>
        </main>
      </AppShell>
    </RequireAuth>
  );
}