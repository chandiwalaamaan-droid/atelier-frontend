/** Per-character chat preferences for mature roleplay (stored locally only). */

import type { RoleplayEngineId } from "./roleplayEngines";
import { applyEngine, resolveEngineId, ROLEPLAY_ENGINES } from "./roleplayEngines";

export type SpiceLevel = "flirty" | "spicy" | "explicit";
export type RoleplayStyle = "balanced" | "narrative" | "dialogue" | "slow_burn" | "intense";
export type ChatLanguage = "english" | "hinglish";

export type RoleplayPreferences = {
  explicitMode: boolean;
  spiceLevel: SpiceLevel;
  roleplayStyle: RoleplayStyle;
  engineId?: RoleplayEngineId;
  /** Per-chat language toggle — independent of engine/spice/style. */
  language: ChatLanguage;
};

const DEFAULTS: RoleplayPreferences = {
  explicitMode: false,
  spiceLevel: "spicy",
  roleplayStyle: "balanced",
  language: "english",
};

export const LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  english: "English",
  hinglish: "Hinglish",
};

function storageKey(characterId: string) {
  return `rolichat:roleplay:${characterId}`;
}

function defaultPrefs(characterIsExplicit: boolean): RoleplayPreferences {
  const engine = ROLEPLAY_ENGINES.find((e) =>
    characterIsExplicit ? e.id === "strawberry" : e.id === "vanilla"
  );
  if (!engine) {
    return { ...DEFAULTS, explicitMode: characterIsExplicit, engineId: "custom" };
  }
  // For 18+ characters, default explicitMode to true so the explicit-capable
  // provider chain (Groq → SambaNova → Cloudflare → NVIDIA) is used right away.
  // The user can toggle it off if they want a character to play coy.
  return { ...applyEngine(engine, DEFAULTS), explicitMode: characterIsExplicit, engineId: engine.id };
}

export function loadRoleplayPreferences(characterId: string, characterIsExplicit: boolean): RoleplayPreferences {
  if (typeof window === "undefined") {
    return defaultPrefs(characterIsExplicit);
  }
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) {
      return defaultPrefs(characterIsExplicit);
    }
    const parsed = JSON.parse(raw) as Partial<RoleplayPreferences>;
    const spiceLevel =
      parsed.spiceLevel === "flirty" || parsed.spiceLevel === "spicy" || parsed.spiceLevel === "explicit"
        ? parsed.spiceLevel
        : DEFAULTS.spiceLevel;
    const roleplayStyle =
      parsed.roleplayStyle === "balanced" ||
      parsed.roleplayStyle === "narrative" ||
      parsed.roleplayStyle === "dialogue" ||
      parsed.roleplayStyle === "slow_burn" ||
      parsed.roleplayStyle === "intense"
        ? parsed.roleplayStyle
        : DEFAULTS.roleplayStyle;
    const language: ChatLanguage = parsed.language === "hinglish" ? "hinglish" : DEFAULTS.language;
    return {
      explicitMode: parsed.explicitMode === true,
      spiceLevel,
      roleplayStyle,
      language,
      engineId: resolveEngineId(
        { explicitMode: parsed.explicitMode === true, spiceLevel, roleplayStyle, language },
        parsed.engineId
      ),
    };
  } catch {
    return defaultPrefs(characterIsExplicit);
  }
}

export function saveRoleplayPreferences(characterId: string, prefs: RoleplayPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(characterId), JSON.stringify(prefs));
}

export const SPICE_LEVEL_LABELS: Record<SpiceLevel, string> = {
  flirty: "Flirty",
  spicy: "Spicy",
  explicit: "Explicit",
};

export const ROLEPLAY_STYLE_LABELS: Record<RoleplayStyle, string> = {
  balanced: "Balanced",
  narrative: "Rich narration",
  dialogue: "Dialogue-forward",
  slow_burn: "Slow burn",
  intense: "Passionate",
};

export const SCENE_STEERS: { label: string; directive: string }[] = [
  { label: "Turn up the heat", directive: "Escalate tension and intimacy in this scene; stay in character." },
  { label: "Slow down", directive: "Pull back to teasing, emotional intimacy, and anticipation rather than rushing." },
  { label: "You take the lead", directive: "Drive the scene forward with bold initiative while checking in with the user." },
  { label: "More detail", directive: "Use richer sensory description and longer, immersive replies." },
];
