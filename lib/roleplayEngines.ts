import type { RoleplayPreferences, RoleplayStyle, SpiceLevel } from "./roleplayPreferences";

export type RoleplayEngineId =
  | "vanilla"
  | "vanilla_short"
  | "green_apple"
  | "cayenne"
  | "saffron"
  | "cardamom"
  | "rosemary"
  | "cookie"
  | "grape"
  | "custom";

export type RoleplayEngine = {
  id: Exclude<RoleplayEngineId, "custom">;
  name: string;
  emoji: string;
  /** Intensity / depth hint (1–10), not a paywall — all engines are free on Atelier. */
  badge: number;
  tag?: string;
  description: string;
  section: "free" | "premium";
  spiceLevel: SpiceLevel;
  roleplayStyle: RoleplayStyle;
};

export const ROLEPLAY_ENGINES: RoleplayEngine[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    emoji: "🙂",
    badge: 3,
    description: "Gets into character fast and stays there — balanced everyday roleplay.",
    section: "free",
    spiceLevel: "flirty",
    roleplayStyle: "balanced",
  },
  {
    id: "vanilla_short",
    name: "Vanilla Short",
    emoji: "⚡",
    badge: 2,
    description: "Faster, concise replies with snappy dialogue.",
    section: "free",
    spiceLevel: "flirty",
    roleplayStyle: "dialogue",
  },
  {
    id: "green_apple",
    name: "Green Apple",
    emoji: "🍏",
    badge: 4,
    tag: "Premium",
    description: "Fast, direct, and precise — flirty banter without slowing down.",
    section: "premium",
    spiceLevel: "flirty",
    roleplayStyle: "dialogue",
  },
  {
    id: "cayenne",
    name: "Cayenne",
    emoji: "🌶️",
    badge: 9,
    tag: "High-Tension",
    description: "Vivid, high-tension heat — pulls you into the moment quickly.",
    section: "premium",
    spiceLevel: "explicit",
    roleplayStyle: "intense",
  },
  {
    id: "cardamom",
    name: "Cardamom",
    emoji: "💜",
    badge: 8,
    tag: "Dark Romantic",
    description: "Pushes relationship tension — brooding desire and emotional edge.",
    section: "premium",
    spiceLevel: "spicy",
    roleplayStyle: "intense",
  },
  {
    id: "saffron",
    name: "Saffron",
    emoji: "🧡",
    badge: 7,
    tag: "Slow mood",
    description: "Slower pacing, finer atmosphere — anticipation over rush.",
    section: "premium",
    spiceLevel: "spicy",
    roleplayStyle: "slow_burn",
  },
  {
    id: "cookie",
    name: "Cookie",
    emoji: "🍪",
    badge: 6,
    description: "Literary depth, rich emotion — sensual scenes with feeling.",
    section: "premium",
    spiceLevel: "spicy",
    roleplayStyle: "narrative",
  },
  {
    id: "rosemary",
    name: "Rosemary",
    emoji: "🌿",
    badge: 8,
    description: "Shows every detail you care about — immersive, explicit narration.",
    section: "premium",
    spiceLevel: "explicit",
    roleplayStyle: "narrative",
  },
  {
    id: "grape",
    name: "Grape",
    emoji: "🍇",
    badge: 5,
    description: "Atmospheric scenes, emotional depth, and responsive intimacy.",
    section: "premium",
    spiceLevel: "spicy",
    roleplayStyle: "balanced",
  },
];

export function engineById(id: RoleplayEngineId): RoleplayEngine | null {
  if (id === "custom") return null;
  return ROLEPLAY_ENGINES.find((e) => e.id === id) ?? null;
}

export function prefsMatchEngine(prefs: RoleplayPreferences, engine: RoleplayEngine): boolean {
  const explicitOk = engine.section === "premium" ? prefs.explicitMode : !prefs.explicitMode;
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
    explicitMode: engine.section === "premium",
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
