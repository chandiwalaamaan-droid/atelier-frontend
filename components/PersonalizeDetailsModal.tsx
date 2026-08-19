"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Details = {
  name: string;
  tagline: string;
  greeting: string;
  avatarEmoji: string;
  accentColor: string;
};

type Props = {
  open: boolean;
  characterId: string;
  current: Details;
  onClose: () => void;
  /** Called with whichever fields the backend actually accepted/stored. */
  onUpdated: (overrides: Partial<Details>) => void;
};

const PRESET_COLORS = ["#d4af7a", "#e08b8b", "#8bb7e0", "#a98be0", "#8be0b0", "#e0c88b"];

/**
 * Personalize a public character's name/tagline/greeting/color/emoji for
 * *this chat only* — PUT /api/chat/:characterId/character, which writes to
 * this user's Conversation.characterOverrides. Never touches the real
 * Character record, so Explore/Discover and everyone else's chat keep
 * showing the creator's original.
 */
export default function PersonalizeDetailsModal({ open, characterId, current, onClose, onUpdated }: Props) {
  const [name, setName] = useState(current.name);
  const [tagline, setTagline] = useState(current.tagline);
  const [greeting, setGreeting] = useState(current.greeting);
  const [avatarEmoji, setAvatarEmoji] = useState(current.avatarEmoji);
  const [accentColor, setAccentColor] = useState(current.accentColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(current.name);
    setTagline(current.tagline);
    setGreeting(current.greeting);
    setAvatarEmoji(current.avatarEmoji);
    setAccentColor(current.accentColor);
    setError("");
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function onSave() {
    setError("");
    setSaving(true);
    const res = await apiFetch(`/api/chat/${characterId}/character`, {
      method: "PUT",
      body: JSON.stringify({ name, tagline, greeting, avatarEmoji, accentColor }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save your changes.");
      return;
    }
    const data = await res.json();
    onUpdated(data.characterOverrides ?? { name, tagline, greeting, avatarEmoji, accentColor });
    onClose();
  }

  async function onReset() {
    setError("");
    setSaving(true);
    // Clearing an override means sending nothing for it isn't enough — the
    // backend only overwrites keys it's given, so an empty-string reset here
    // just means "revert this modal's local view"; the underlying character
    // fields (from `current`, which is already merged with any prior
    // override) are what get resubmitted, effectively re-saving the same
    // values. To fully clear, the simplest UI-level move is closing without
    // saving — so Reset just restores the fields shown in this modal to the
    // character's own current values before you touched them.
    setName(current.name);
    setTagline(current.tagline);
    setGreeting(current.greeting);
    setAvatarEmoji(current.avatarEmoji);
    setAccentColor(current.accentColor);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="stitched w-full max-w-sm rounded-2xl bg-plum-deep border border-parchment/20 p-6 shadow-2xl toast-in max-h-[85vh] overflow-y-auto"
      >
        <p className="font-display text-lg mb-1">Personalize this chat</p>
        <p className="text-sm text-parchment/60 mb-4">
          Changes here are just for you — Explore, Discover, and anyone else chatting with this character
          still see the original.
        </p>

        {error && <p className="mb-3 text-sm text-rose bg-rose/10 border border-rose/30 rounded px-3 py-2">{error}</p>}

        <label className="block text-xs text-parchment/60 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 120))}
          disabled={saving}
          className="w-full mb-3 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 text-sm focus-ring disabled:opacity-60"
        />

        <label className="block text-xs text-parchment/60 mb-1">Tagline</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value.slice(0, 120))}
          disabled={saving}
          className="w-full mb-3 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 text-sm focus-ring disabled:opacity-60"
        />

        <label className="block text-xs text-parchment/60 mb-1">Greeting</label>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value.slice(0, 4000))}
          rows={3}
          disabled={saving}
          className="w-full mb-3 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 text-sm focus-ring disabled:opacity-60 resize-none"
        />

        <label className="block text-xs text-parchment/60 mb-1">Emoji (used when there's no portrait)</label>
        <input
          value={avatarEmoji}
          onChange={(e) => setAvatarEmoji(e.target.value.slice(0, 8))}
          disabled={saving}
          className="w-24 mb-3 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 text-sm focus-ring disabled:opacity-60"
        />

        <label className="block text-xs text-parchment/60 mb-2">Accent color</label>
        <div className="flex gap-2 mb-4">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccentColor(c)}
              disabled={saving}
              aria-label={`Use ${c}`}
              className={`w-7 h-7 rounded-full border-2 transition-transform disabled:opacity-60 ${
                accentColor.toLowerCase() === c.toLowerCase() ? "border-gold scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#d4af7a"}
            onChange={(e) => setAccentColor(e.target.value)}
            disabled={saving}
            className="w-7 h-7 rounded-full overflow-hidden border-2 border-parchment/20 bg-transparent cursor-pointer disabled:opacity-60"
            title="Custom color"
          />
        </div>

        <div className="flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="text-xs text-parchment/50 hover:text-parchment/80 focus-ring rounded px-2 py-2 disabled:opacity-50"
          >
            Undo changes
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-full border border-parchment/20 hover:border-gold/50 focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving || !name.trim() || !greeting.trim()}
              className="text-sm bg-gold text-ink px-4 py-2 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
