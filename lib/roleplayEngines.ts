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
  /** Intensity / depth hint (1–10), matches the backend's intelligence score. */
  badge: number;
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
    description: "Warm, low-friction, snappy replies — the everyday go-to for casual roleplay.",
    minTier: "free",
    spiceLevel: "flirty",
    roleplayStyle: "dialogue",
  },
  {
    id: "strawberry",
    name: "Strawberry",
    emoji: "🍓",
    badge: 6,
    tag: "Popular",
    description: "Bright, playful energy that balances atmosphere and dialogue — your first step into premium quality.",
    minTier: "plus",
    spiceLevel: "flirty",
    roleplayStyle: "balanced",
  },
  {
    id: "chocolate",
    name: "Chocolate",
    emoji: "🍫",
    badge: 8,
    tag: "Best Seller",
    description: "Rich interiority and layered emotion, with tension that builds gradually before it escalates.",
    minTier: "ultra",
    spiceLevel: "spicy",
    roleplayStyle: "narrative",
  },
  {
    id: "hazelnut",
    name: "Hazelnut",
    emoji: "🌰",
    badge: 10,
    tag: "Ultimate Experience",
    description: "🔥 The flagship engine. Vivid, immediate, unmistakably alive — maximum realism for unforgettable moments.",
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
  const explicitOk = engine.minTier === "free" ? !prefs.explicitMode : prefs.explicitMode;
  return (
    explicitOk &&
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
  return {
    explicitMode: engine.minTier !== "free",
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
