import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ReactionBar from "../ReactionBar";
import ShareButton from "../ShareButton";
import { communityAPI, getImageUrl } from "../../lib/api";
import type { CommunityPost } from "../../types";

const REPORT_REASONS = ["spam", "harassment", "inappropriate", "misinformation", "other"];

interface Props {
  post: CommunityPost;
  onOpen: (post: CommunityPost) => void;
  onEdit: (post: CommunityPost) => void;
  onDeleted: (postId: number) => void;
  onReported: (postId: number) => void;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  const min = Math.floor(sec / 60), hr = Math.floor(min / 60), days = Math.floor(hr / 24);
  if (days > 0) return `${days}d`;
  if (hr > 0) return `${hr}h`;
  if (min > 0) return `${min}m`;
  return "now";
}

export default function CommunityPostCard({ post, onOpen, onEdit, onDeleted, onReported }: Props) {
  const { t } = useTranslation("community");
  const { user } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [clamped, setClamped] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  const isOwner = !!user && user.id === post.user_id;
  const images = post.images || [];
  const hasImages = images.length > 0;
  const edited = post.updated_at && post.created_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 1000;

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setReportOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Detect whether the clamped body overflows → show "…see more".
  useEffect(() => {
    const el = bodyRef.current;
    if (el) setClamped(el.scrollHeight - el.clientHeight > 2);
  }, [post.body, hasImages]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm(t("card.deleteConfirm"))) return;
    try {
      await communityAPI.deletePost(post.id);
      toast(t("card.deleted"), "success");
      onDeleted(post.id);
    } catch (err: any) {
      toast(err.message || "Failed", "error");
    }
  };

  const submitReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reason) return;
    setBusy(true);
    try {
      await communityAPI.reportPost(post.id, reason);
      toast(t("card.reportThanks"), "success");
      setReportOpen(false);
      onReported(post.id);
    } catch (err: any) {
      if (/already/i.test(err.message)) toast(t("card.alreadyReported"), "info");
      else toast(err.message || "Failed", "error");
      setReportOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/community?post=${post.id}` : undefined;

  return (
    <div
      onClick={() => onOpen(post)}
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex flex-col h-[360px] hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1"
    >
      {/* Header */}
      <div className="p-3 sm:p-4 pb-2 flex items-start gap-3">
        {post.author_picture ? (
          <img src={getImageUrl(post.author_picture) ?? undefined} alt={post.author_name} className="w-9 h-9 rounded-full object-cover bg-[var(--accent)] flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {post.author_name?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)] truncate">{post.author_name}</span>
            <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{timeAgo(post.created_at)}</span>
            {edited && <span className="text-xs text-[var(--text-secondary)] italic flex-shrink-0">· {t("feed.edited")}</span>}
          </div>
          <div className="flex gap-1 mt-1 overflow-hidden flex-nowrap">
            {post.tags?.slice(0, 3).map((tg) => (
              <span key={tg.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)] whitespace-nowrap flex-shrink-0">
                {tg.label}
              </span>
            ))}
          </div>
        </div>

        {/* Kebab + anchored menus */}
        {user && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setReportOpen(false); setMenuOpen((o) => !o); }} aria-label="Menu" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2">⋯</button>
            {menuOpen && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-30 min-w-[120px]">
                {isOwner ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(post); }} className="block w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]">{t("card.edit")}</button>
                    <button onClick={handleDelete} className="block w-full text-left px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--bg-secondary)]">{t("card.delete")}</button>
                  </>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setReason(""); setReportOpen(true); }} className="block w-full text-left px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--bg-secondary)]">{t("card.report")}</button>
                )}
              </div>
            )}
            {/* Report popover — small, anchored at the corner, outside the post body */}
            {reportOpen && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-8 z-30 w-60 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl p-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t("card.reportTitle")}</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-2 py-1 rounded text-xs border transition-all ${reason === r ? "bg-[var(--danger)] border-[var(--danger)] text-white" : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--danger)]"}`}
                    >
                      {t(`reasons.${r}`)}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setReportOpen(false); }} className="px-2.5 py-1 rounded border border-[var(--border)] text-xs text-[var(--text-secondary)]">{t("compose.cancel")}</button>
                  <button onClick={submitReport} disabled={!reason || busy} className="px-2.5 py-1 rounded bg-[var(--danger)] text-white text-xs font-semibold disabled:opacity-50">{t("card.report")}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image band — fixed height so every card matches */}
      {hasImages && (
        <div className={`px-3 sm:px-4 pb-2 grid gap-1.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.slice(0, 2).map((img, i) => (
            <img
              key={i}
              src={getImageUrl(img) ?? undefined}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-36 rounded-lg object-cover bg-[var(--bg-secondary)]"
            />
          ))}
        </div>
      )}

      {/* Body — clamped; fills remaining space so the footer pins to the bottom */}
      <div className="px-3 sm:px-4 flex-1 min-h-0 overflow-hidden">
        <p
          ref={bodyRef}
          className={`text-[var(--text-primary)] whitespace-pre-wrap break-words ${hasImages ? "text-sm line-clamp-3" : "text-base leading-relaxed line-clamp-[8]"}`}
        >
          {post.body}
        </p>
        {clamped && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(post); }}
            className="text-xs font-semibold text-[var(--accent)] mt-0.5 hover:underline"
          >
            {t("card.seeMore")}
          </button>
        )}
      </div>

      {/* Pet chip — null-safe */}
      {post.pet && (
        <div className="px-3 sm:px-4 pt-2" onClick={(e) => e.stopPropagation()}>
          <Link href={`/pet/${post.pet.pet_id}`} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--bg-secondary)] hover:opacity-90 max-w-full">
            {post.pet.images && (Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ? (
              <img src={getImageUrl(Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ?? undefined} alt={post.pet.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <span className="text-xs flex-shrink-0">🐾</span>
            )}
            <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{post.pet.name}</span>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 sm:px-4 py-2.5 mt-auto border-t border-[var(--border)] flex items-center gap-2">
        <ReactionBar
          base="community"
          postType="community"
          postId={post.id}
          initialCounts={{ love: Number(post.love_count) || 0, sad: Number(post.sad_count) || 0, angry: Number(post.angry_count) || 0 }}
          initialUserReaction={post.user_reaction ?? null}
        />
        <span className="text-xs text-[var(--text-secondary)] shrink-0">💬 {post.comment_count || 0}</span>
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <ShareButton text={post.body.slice(0, 80)} url={shareUrl} />
        </div>
      </div>
    </div>
  );
}
