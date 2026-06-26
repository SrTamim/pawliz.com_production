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
    <article
      onClick={() => onOpen(post)}
      className="glass post card-hover h-[360px] cursor-pointer"
    >
      {/* Header */}
      <div className="post-head" style={{ marginBottom: 10 }}>
        {post.author_picture ? (
          <span className="avatar sm">
            <img src={getImageUrl(post.author_picture) ?? undefined} alt={post.author_name} />
          </span>
        ) : (
          <span className="avatar sm">{post.author_name?.charAt(0).toUpperCase() || "U"}</span>
        )}
        <div className="who grow">
          <h4 className="truncate">
            {post.author_name}
            <span style={{ fontWeight: 400 }}>· {timeAgo(post.created_at)}{edited ? ` · ${t("feed.edited")}` : ""}</span>
          </h4>
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1.5 mt-1 overflow-hidden flex-nowrap">
              {post.tags.slice(0, 3).map((tg) => (
                <span key={tg.id} className="tag tag-mint whitespace-nowrap flex-shrink-0">{tg.label}</span>
              ))}
            </div>
          )}
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

      {/* Image band — gradient placeholder fills until the photo loads */}
      {hasImages && (
        <div className={`post-img ${images.length === 1 ? "" : "grid grid-cols-2 gap-1.5"}`} style={{ height: 150, marginTop: 12 }}>
          {images.slice(0, 2).map((img, i) => (
            <img
              key={i}
              src={getImageUrl(img) ?? undefined}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ))}
        </div>
      )}

      {/* Body — clamped; fills remaining space so the footer pins to the bottom */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ marginTop: 12 }}>
        <p
          ref={bodyRef}
          className={`post-body whitespace-pre-wrap break-words ${hasImages ? "line-clamp-3" : "line-clamp-[8]"}`}
        >
          {post.body}
        </p>
        {clamped && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(post); }}
            className="text-xs font-bold text-[var(--accent)] mt-1 hover:underline"
          >
            {t("card.seeMore")}
          </button>
        )}
      </div>

      {/* Pet chip — null-safe */}
      {post.pet && (
        <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          <Link href={`/pet/${post.pet.pet_id}`} className="inline-flex items-center gap-2 max-w-full" style={{ padding: "5px 10px", borderRadius: "var(--pill)", background: "var(--glass-hi)", border: "1px solid var(--border)" }}>
            {post.pet.images && (Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ? (
              <span className="avatar" style={{ width: 22, height: 22 }}><img src={getImageUrl(Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ?? undefined} alt={post.pet.name} /></span>
            ) : (
              <span className="text-xs flex-shrink-0">🐾</span>
            )}
            <span className="text-xs font-semibold text-[var(--text-secondary)] truncate">{post.pet.name}</span>
          </Link>
        </div>
      )}

      {/* Footer — reaction bar + comments + share (single row, no overlap) */}
      <div className="post-actions mt-auto">
        <ReactionBar
          base="community"
          postType="community"
          postId={post.id}
          initialCounts={{ love: Number(post.love_count) || 0, sad: Number(post.sad_count) || 0, angry: Number(post.angry_count) || 0 }}
          initialUserReaction={post.user_reaction ?? null}
        />
        <span className="react react-comment" style={{ pointerEvents: "none" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 01-12 7.5L3 21l2-6a8.5 8.5 0 1116-3.5z" /></svg>
          {post.comment_count || 0}
        </span>
        <div className="ml-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <ShareButton text={post.body.slice(0, 80)} url={shareUrl} />
        </div>
      </div>
    </article>
  );
}
