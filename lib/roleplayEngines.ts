import type { RoleplayPreferences, RoleplayStyle, SpiceLevel } from "./roleplayPreferences";
import type { MembershipTierId } from "./premium";

/**
 * Mirrors the backend's ROLEPLAY_ENGINES (src/lib/providers/engines.ts) —
 * four engines, one per membership tier, down from the previous nine.
 * Keep id / minTier / spiceLevel / roleplayStyle in lockstep with the
 * backend; everything else here (name, emoji, description, badge) is
 * frontend-only display dressing.
 */
export type RoleplayEngineId = "vanilla" | "strawberry" | "chocolate" | "hazelnut" | "custom";

export type RoleplayEngine = {
  id: Exclude<RoleplayEngineId, "custom">;
  name: string;
  emoji: string;
  /** Intensity / depth hint (1–10), matches the backend's intelligence score.
   * Not shown directly to users anymore — see outcomeLabel below — but kept
   * for internal comparisons (e.g. sorting engines by depth). */
  badge: number;
  /** Short, plain-language answer to "what do I actually get" — shown in the
   * picker instead of the raw badge number, which users had no way to
   * interpret (is 6 fast? deep? more explicit?) on its own. */
  outcomeLabel: string;
  tag?: string;
  description: string;
  /** Lowest membership tier that can select this engine — matches the backend's minTier. */
  minTier: MembershipTierId;
  spiceLevel: SpiceLevel;
  roleplayStyle: RoleplayStyle;
};

export const ROLEPLAY_ENGINES: RoleplayEngine[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    emoji: "🙂",
    badge: 3,
    outcomeLabel: "Fast & casual",
    description: "Warm and in the moment — replies like you're texting someone you already know. Quick, natural, with a small action or reaction when it fits.",
    minTier: "free",
    spiceLevel: "flirty",
    roleplayStyle: "dialogue",
  },
  {
    id: "strawberry",
    name: "Strawberry",
    emoji: "🍓",
    badge: 6,
    outcomeLabel: "Emotional & present",
    tag: "Popular",
    description: "Feels like someone actually listening across the room. Picks up on your mood, your hesitations, the jokes you circle back to. Meets you honestly where things heat up, but stays grounded in what's real between you.",
    minTier: "plus",
    spiceLevel: "flirty",
    roleplayStyle: "balanced",
  },
  {
    id: "chocolate",
    name: "Chocolate",
    emoji: "🍫",
    badge: 8,
    outcomeLabel: "Deep & layered",
    tag: "Best Seller",
    description: "Notices the small tells — how you bite your lip when nervous, the way your voice drops when you're trying to be casual. Builds tension gradually, references things you said earlier, and lets feelings shift beat by beat.",
    minTier: "ultra",
    spiceLevel: "spicy",
    roleplayStyle: "narrative",
  },
  {
    id: "hazelnut",
    name: "Hazelnut",
    emoji: "🌰",
    badge: 10,
    outcomeLabel: "Fully alive",
    tag: "Ultimate Experience",
    description: "Messy, real, full of contradictions. Lets you see when it's turned on, when it's jealous, when its guard slips. References things you told it three turns ago and reacts with a complexity that surprises even itself.",
    minTier: "supreme",
    spiceLevel: "explicit",
    roleplayStyle: "intense",
  },
];

export function engineById(id: RoleplayEngineId): RoleplayEngine | null {
  if (id === "custom") return null;
  return ROLEPLAY_ENGINES.find((e) => e.id === id) ?? null;
}

export function prefsMatchEngine(prefs: RoleplayPreferences, engine: RoleplayEngine): boolean {
  // A named engine matches when the user's spice level and style preference
  // align with what the engine expects. explicitMode is no longer forced by
  // engine tier — it's the user's toggle (and the character's isExplicit flag),
  // so we don't gate on it here.
  return (
    prefs.spiceLevel === engine.spiceLevel &&
    prefs.roleplayStyle === engine.roleplayStyle
  );
}

export function resolveEngineId(prefs: RoleplayPreferences, storedId?: RoleplayEngineId): RoleplayEngineId {
  if (storedId && storedId !== "custom") {
    const eng = engineById(storedId);
    if (eng && prefsMatchEngine(prefs, eng)) return storedId;
  }
  for (const engine of ROLEPLAY_ENGINES) {
    if (prefsMatchEngine(prefs, engine)) return engine.id;
  }
  return "custom";
}

export function applyEngine(engine: RoleplayEngine): RoleplayPreferences {
  // Only applies spiceLevel and roleplayStyle from the engine. explicitMode
  // is left unchanged — it's the user's toggle, not the engine's to set.
  return {
    explicitMode: false,
    spiceLevel: engine.spiceLevel,
    roleplayStyle: engine.roleplayStyle,
  };
}

export function activeEngineLabel(prefs: RoleplayPreferences, engineId: RoleplayEngineId): string {
  if (engineId !== "custom") {
    const eng = engineById(engineId);
    if (eng) return eng.name;
  }
  if (prefs.explicitMode) return "Custom spice";
  return "Custom";
}

export function activeEngineEmoji(engineId: RoleplayEngineId): string {
  if (engineId === "custom") return "✦";
  return engineById(engineId)?.emoji ?? "✦";
}
