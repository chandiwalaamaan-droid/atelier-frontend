"use client";

import { resolveMediaUrl } from "@/lib/api";

export type ExploreCardCharacter = {
  id: string;
  name: string;
  tagline: string;
  personality: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  accentColor: string;
  owner?: { displayName: string } | null;
};

const TAG_RULES: { tag: string; re: RegExp }[] = [
  { tag: "Romance", re: /romance|love|girlfriend|boyfriend|wife|husband|dating/i },
  { tag: "Drama", re: /drama|conflict|secret|betray/i },
  { tag: "Slice of life", re: /family|everyday|roommate|neighbor|slice/i },
  { tag: "Adventure", re: /adventure|quest|travel|apocalypse|survival/i },
  { tag: "Comedy", re: /funny|comedy|wit|humor|playful/i },
  { tag: "Fantasy", re: /magic|dragon|fantasy|realm|witch/i },
];

export function inferTags(c: ExploreCardCharacter): string[] {
  const text = `${c.tagline} ${c.personality} ${c.name}`;
  const tags = TAG_RULES.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
  return tags.length ? tags.slice(0, 3) : ["Roleplay"];
}

export function pseudoViews(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const n = 50_000 + (h % 4_950_000);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000).toFixed(1)}K`;
}

type Props = {
  character: ExploreCardCharacter;
  onRemix: () => void;
  remixing: boolean;
  onReport: () => void;
};

export default function ExploreCharacterCard({ character: c, onRemix, remixing, onReport }: Props) {
  const tags = inferTags(c);
  const blurb = c.tagline || c.personality;

  return (
    <article className="group rounded-2xl overflow-hidden bg-surface-card border border-white/5 hover:border-white/15 transition-colors flex flex-col">
      <div className="relative aspect-[3/4] bg-surface-raised overflow-hidden">
        {c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveMediaUrl(c.avatarUrl)}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-6xl"
            style={{ background: `linear-gradient(160deg, ${c.accentColor}44, #121218)` }}
          >
            {c.avatarEmoji}
          </div>
        )}
        <span className="absolute top-2 left-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
          {pseudoViews(c.id)}
        </span>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-parchment truncate">{c.name}</h3>
        <p className="text-xs text-parchment/50 line-clamp-2 mt-1 min-h-[2.5rem]">{blurb}</p>
        <div className="flex flex-wrap gap-1 mt-2 mb-3">
          {tags.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-parchment/45 border border-white/5">
              {t}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemix}
          disabled={remixing}
          className="mt-auto w-full py-2 rounded-full bg-gold text-ink text-sm font-medium hover:brightness-110 focus-ring disabled:opacity-50"
        >
          {remixing ? "Adding…" : "Chat"}
        </button>
        <button type="button" onClick={onReport} className="mt-2 text-[10px] text-parchment/35 hover:text-rose focus-ring">
          Report
        </button>
      </div>
    </article>
  );
}

export function ExploreCharacterCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface-card border border-white/5 animate-pulse">
      <div className="aspect-[3/4] bg-white/5" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-2/3 bg-white/10 rounded" />
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-8 w-full bg-white/10 rounded-full mt-4" />
      </div>
    </div>
  );
}
