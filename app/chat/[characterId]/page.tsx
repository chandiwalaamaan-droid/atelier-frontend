"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";

type Character = {
  id: string;
  name: string;
  tagline: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  accentColor: string;
  greeting: string;
  isExplicit: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STARTER_PROMPTS = [
  "Tell me about yourself.",
  "What's on your mind today?",
  "Let's start a little adventure.",
];

const MARKER = "\u0000EVT:";

/** Incrementally scans a growing buffer for \x00EVT:{...}\x00 markers, emitting
 * clean display text and any parsed events, while holding back a marker that's
 * been split across two network chunks until the rest of it arrives. */
function extractEvents(buffer: string): { text: string; events: Record<string, unknown>[]; rest: string } {
  const events: Record<string, unknown>[] = [];
  let text = "";
  let rest = buffer;
  while (true) {
    const start = rest.indexOf(MARKER);
    if (start === -1) {
      text += rest;
      rest = "";
      break;
    }
    text += rest.slice(0, start);
    const end = rest.indexOf("\u0000", start + MARKER.length);
    if (end === -1) {
      // Marker started but hasn't closed yet — wait for the next chunk.
      rest = rest.slice(start);
      break;
    }
    const json = rest.slice(start + MARKER.length, end);
    try {
      events.push(JSON.parse(json));
    } catch {
      /* malformed event, drop it silently */
    }
    rest = rest.slice(end + 1);
  }
  return { text, events, rest };
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
  const [isExplicitMode, setIsExplicitMode] = useState(false);

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
        setIsExplicitMode(data.character.isExplicit ?? false);
      });
  }, [params.characterId]);

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
      const { text, events, rest } = extractEvents(carry);
      carry = rest;
      acc += text;
      events.forEach((ev) => {
        if (ev.type === "failover") {
          showToast("Reconnecting to keep the reply on track…");
        } else if (ev.type === "fatal") {
          const message = typeof ev.message === "string" ? ev.message : "Something went wrong.";
          setError(message);
          onFatal(message);
        }
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
      );
    }
  }

  async function sendMessage(userText: string) {
    setError("");
    setSending(true);
    lastActionRef.current = { type: "send", text: userText };

    const userMsg: Message = { id: `local-${Date.now()}`, role: "user", content: userText };
    const assistantId = `local-${Date.now()}-a`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: JSON.stringify({ message: userText }),
      });
      // On a fatal failure no reply was ever saved server-side, so drop the
      // empty placeholder bubble rather than leaving a blank reply on screen.
      await runStream(res, assistantId, () =>
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      );
    } catch {
      setError("Lost connection while streaming the reply.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setSending(false);
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

    try {
      const res = await apiFetch(`/api/chat/${params.characterId}`, {
        method: "POST",
        body: JSON.stringify({ regenerate: true }),
      });
      await runStream(res, last.id, restore);
    } catch {
      setError("Lost connection while regenerating the reply.");
      restore();
    } finally {
      setSending(false);
    }
  }

  async function onRetry() {
    const action = lastActionRef.current;
    if (!action || sending) return;
    if (action.type === "send") await sendMessage(action.text);
    else await onRegenerate();
  }

  async function onResetConversation() {
    if (!confirm(`Clear this whole conversation with ${character?.name ?? "this character"}? This can't be undone.`)) {
      return;
    }
    setResetting(true);
    try {
      await apiFetch(`/api/chat/${params.characterId}`, { method: "DELETE" });
      setMessages([]);
      setError("");
    } finally {
      setResetting(false);
    }
  }

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
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-xl">Couldn't find that character.</p>
        <Link href="/dashboard" className="text-gold hover:underline">
          Back to your characters
        </Link>
      </main>
    );
  }

  return (
    <RequireAuth>
    <main className="min-h-screen flex flex-col relative">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-parchment/10">
        <button onClick={() => router.push("/dashboard")} className="text-parchment/60 hover:text-gold focus-ring rounded px-2">
          ←
        </button>
        {character && (
          <>
            <span
              className="text-xl w-9 h-9 flex items-center justify-center rounded-full overflow-hidden"
              style={{ backgroundColor: `${character.accentColor}30` }}
            >
              {character.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(character.avatarUrl)} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                character.avatarEmoji
              )}
            </span>
            <div className="flex-1">
              <p className="font-display">{character.name}</p>
              {character.tagline && <p className="text-xs text-parchment/50">{character.tagline}</p>}
            </div>
            {character.isExplicit && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-parchment/60">Normal</span>
                <button
                  onClick={() => setIsExplicitMode(!isExplicitMode)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                    isExplicitMode ? "bg-rose" : "bg-parchment/20"
                  } focus-ring`}
                  title={isExplicitMode ? "Switch to normal mode" : "Switch to explicit mode"}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-plum-deep shadow-lg transition-transform ${
                      isExplicitMode ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs text-parchment/60">Explicit</span>
              </div>
            )}
            <button
              onClick={onResetConversation}
              disabled={resetting || messages.length === 0}
              className="text-sm text-parchment/60 hover:text-rose focus-ring rounded px-2 py-1 disabled:opacity-40"
              title="Clear this conversation"
            >
              Clear
            </button>
            <Link
              href={`/characters/${character.id}/edit`}
              className="text-sm text-parchment/60 hover:text-gold focus-ring rounded px-2 py-1"
            >
              Edit
            </Link>
          </>
        )}
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 py-6 md:px-12 space-y-4">
        {character && messages.length === 0 && (
          <>
            <div className="max-w-lg bg-plum/60 rounded-2xl rounded-tl-sm px-4 py-3">
              {character.greeting}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {STARTER_PROMPTS.map((prompt) => (
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
          return (
            <div key={m.id} className="group">
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
                  m.content
                )}
              </div>
              {m.content && (
                <div
                  className={`flex gap-3 mt-1 text-xs text-parchment/40 opacity-0 group-hover:opacity-100 transition-opacity ${
                    m.role === "user" ? "justify-end pr-1" : "justify-start pl-1"
                  }`}
                >
                  <button onClick={() => onCopy(m.id, m.content)} className="hover:text-gold focus-ring rounded">
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </button>
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
        <div ref={bottomRef} />
      </div>

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

      <form onSubmit={onSend} className="flex gap-3 px-6 py-4 border-t border-parchment/10 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={onKeyDown}
          placeholder="Say something… (Shift+Enter for a new line)"
          rows={1}
          className="flex-1 rounded-2xl bg-plum-deep border border-parchment/20 px-4 py-2.5 focus-ring resize-none max-h-40 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-gold text-ink px-5 py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </form>
    </main>
    </RequireAuth>
  );
}
