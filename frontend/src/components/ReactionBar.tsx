import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavbar } from "../context/NavbarContext";
import { lostFoundAPI, rescueAdoptionAPI, communityAPI } from "../lib/api";
import type { ReactionType, ReactionState } from "../types";

type Base = "lost-found" | "rescue-adoption" | "community";
type Size = "sm" | "lg";

interface ReactionBarProps {
  postId: number | string;
  postType: string;
  base: Base;
  initialCounts?: { love: number; sad: number; angry: number };
  initialUserReaction?: ReactionType | null;
  size?: Size;
  className?: string;
}

const REACTIONS: { type: ReactionType; label: string; emoji: string; color: string; tint: string }[] = [
  { type: "love", label: "Love", emoji: "❤️", color: "#ff4f6a", tint: "rgba(255,79,106,0.14)" },
  { type: "sad", label: "Sad", emoji: "😢", color: "#f0a500", tint: "rgba(240,165,0,0.16)" },
  { type: "angry", label: "Angry", emoji: "😠", color: "#ff6b35", tint: "rgba(255,107,53,0.16)" },
];

export default function ReactionBar({
  postId,
  postType,
  base,
  initialCounts,
  initialUserReaction = null,
  size = "sm",
  className = "",
}: ReactionBarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { openAuth } = useNavbar();

  const [counts, setCounts] = useState({
    love: initialCounts?.love ?? 0,
    sad: initialCounts?.sad ?? 0,
    angry: initialCounts?.angry ?? 0,
  });
  const [userReaction, setUserReaction] = useState<ReactionType | null>(initialUserReaction);
  const [busy, setBusy] = useState(false);

  const api =
    base === "lost-found" ? lostFoundAPI : base === "community" ? communityAPI : rescueAdoptionAPI;

  // Sync counts when parent provides fresh initial values (e.g. feed refetch).
  useEffect(() => {
    setCounts({
      love: initialCounts?.love ?? 0,
      sad: initialCounts?.sad ?? 0,
      angry: initialCounts?.angry ?? 0,
    });
  }, [initialCounts?.love, initialCounts?.sad, initialCounts?.angry]);

  // Learn the logged-in user's current reaction (counts already arrive with feed).
  useEffect(() => {
    let cancelled = false;
    if (user && initialUserReaction == null) {
      api
        .getReactions(postType, postId)
        .then((state: ReactionState) => {
          if (cancelled) return;
          if (state?.counts) setCounts(state.counts);
          setUserReaction(state?.user_reaction ?? null);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, postId, postType]);

  const handleClick = async (e: React.MouseEvent, type: ReactionType) => {
    e.stopPropagation();
    if (!user) {
      toast("Please log in to react", "error");
      openAuth("login");
      return;
    }
    if (busy) return;

    // Optimistic toggle.
    const prevCounts = counts;
    const prevReaction = userReaction;
    const nextCounts = { ...counts };
    let nextReaction: ReactionType | null;

    if (prevReaction === type) {
      nextCounts[type] = Math.max(0, nextCounts[type] - 1);
      nextReaction = null;
    } else {
      if (prevReaction) nextCounts[prevReaction] = Math.max(0, nextCounts[prevReaction] - 1);
      nextCounts[type] += 1;
      nextReaction = type;
    }
    setCounts(nextCounts);
    setUserReaction(nextReaction);
    setBusy(true);

    try {
      const state: ReactionState = await api.setReaction(postId, postType, type);
      if (state?.counts) setCounts(state.counts);
      setUserReaction(state?.user_reaction ?? null);
    } catch (err: any) {
      // Revert on failure.
      setCounts(prevCounts);
      setUserReaction(prevReaction);
      toast(err?.message || "Failed to react", "error");
    } finally {
      setBusy(false);
    }
  };

  const lg = size === "lg";

  return (
    <div className={`flex items-center ${lg ? "gap-2.5" : "gap-0 sm:gap-0.5"} min-w-0 ${className}`}>
      {REACTIONS.map((r) => {
        const active = userReaction === r.type;
        return (
          <button
            key={r.type}
            type="button"
            onClick={(e) => handleClick(e, r.type)}
            aria-label={r.label}
            aria-pressed={active}
            title={r.label}
            disabled={busy}
            className={
              lg
                ? "flex items-center gap-2 rounded-full border font-semibold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 px-3.5 py-2"
                : "flex items-center gap-0.5 rounded-full transition-transform hover:scale-110 active:scale-95 disabled:opacity-60 px-1 py-1"
            }
            style={{
              color: active ? r.color : "var(--text-secondary)",
              background: active ? r.tint : lg ? "var(--bg-secondary)" : "transparent",
              borderColor: lg ? (active ? r.color : "var(--border)") : "transparent",
            }}
          >
            <span className={lg ? "text-xl leading-none" : "text-sm leading-none"} aria-hidden>
              {r.emoji}
            </span>
            <span className={`tabular-nums ${lg ? "text-sm" : "text-[10px] sm:text-xs"}`}>
              {counts[r.type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
