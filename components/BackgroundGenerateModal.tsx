"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";

type Props = {
  open: boolean;
  characterId: string;
  characterName: string;
  isExplicit?: boolean;
  currentBackgroundUrl?: string | null;
  onClose: () => void;
  /** Called with the new backgroundUrl once an upload or generation succeeds. */
  onUpdated: (backgroundUrl: string | null) => void;
};

/**
 * "Give this chat its own backdrop" panel — upload a file or generate one
 * with AI. Mirrors AvatarGenerateModal, but for the chat background.
 *
 * Important: this hits the *chat-scoped* endpoints (routes/chat.ts), not
 * the character-owner endpoints (routes/chat.ts's `/:characterId/character`
 * override family). That means the result is saved to this user's
 * Conversation.characterOverrides only — it changes what this chat looks
 * like for you, not what the character looks like in Explore/Discover or
 * in anyone else's chat. The character's creator (or you, if you own it)
 * still edits the real thing from the character edit page.
 */
export default function BackgroundGenerateModal({
  open,
  characterId,
  characterName,
  isExplicit,
  currentBackgroundUrl,
  onClose,
  onUpdated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null | undefined>(currentBackgroundUrl);

  useEffect(() => {
    if (open) {
      setPreview(currentBackgroundUrl);
      setError("");
      setPrompt("");
    }
  }, [open, currentBackgroundUrl]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("background", file);
    const res = await apiFetch(`/api/chat/${characterId}/background`, { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const data = await res.json();
    setPreview(data.characterOverrides?.backgroundUrl ?? data.backgroundUrl ?? preview);
    onUpdated(data.characterOverrides?.backgroundUrl ?? data.backgroundUrl ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onGenerate() {
    setError("");
    setGenerating(true);
    const res = await apiFetch(`/api/chat/${characterId}/background/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt: prompt.trim() || undefined }),
    });
    setGenerating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Generation failed. Try again in a moment.");
      return;
    }
    const data = await res.json();
    setPreview(data.characterOverrides?.backgroundUrl ?? data.backgroundUrl ?? preview);
    onUpdated(data.characterOverrides?.backgroundUrl ?? data.backgroundUrl ?? null);
  }

  const busy = uploading || generating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="stitched w-full max-w-sm rounded-2xl bg-plum-deep border border-parchment/20 p-6 shadow-2xl toast-in"
      >
        <p className="font-display text-lg mb-1">Backdrop for {characterName}</p>
        <p className="text-sm text-parchment/60 mb-4">
          Upload an image or generate one with AI. Only visible in your chat — the original stays the same
          in Explore and for everyone else.
        </p>

        {preview && (
          <div className="w-full h-28 rounded-xl overflow-hidden mb-4 bg-cover bg-center" style={{ backgroundImage: `url(${resolveMediaUrl(preview)})` }} />
        )}

        {error && (
          <p className="mb-3 text-sm text-rose bg-rose/10 border border-rose/30 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex-1 text-sm border border-parchment/30 px-3 py-1.5 rounded-full hover:border-gold focus-ring disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="flex-1 text-sm bg-gold text-ink px-3 py-1.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onUpload}
        />

        <label className="block text-xs text-parchment/60 mb-1">
          Custom AI prompt {isExplicit ? "(optional — NSFW allowed)" : "(optional)"}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={4000}
          disabled={busy}
          placeholder={
            isExplicit
              ? "Describe the scene — mature or suggestive styling is fine for explicit characters."
              : "Leave blank to auto-generate from the character's profile."
          }
          className="w-full mb-4 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 text-sm focus-ring disabled:opacity-60"
        />

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-full border border-parchment/20 hover:border-gold/50 focus-ring"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
