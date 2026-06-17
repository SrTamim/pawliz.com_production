import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { communityAPI, getImageUrl } from "../../lib/api";
import CommentsSection from "../LostFound/CommentsSection";
import ReactionBar from "../ReactionBar";
import type { CommunityPost } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  post: CommunityPost | null;
}

export default function CommunityPostDetailsModal({ open, onClose, post }: Props) {
  const { t } = useTranslation("community");
  const [comments, setComments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (open && post?.id) {
      setComments([]); setTotal(0); setHasMore(false);
      loadComments(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id]);

  const loadComments = async (offset = 0) => {
    if (offset > 0) setLoadingMore(true);
    try {
      const data = await communityAPI.getComments("community", post!.id, offset);
      setComments((prev) => (offset === 0 ? data.comments || [] : [...prev, ...(data.comments || [])]));
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  };

  if (!open || !post) return null;
  const images = post.images || [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto pb-[96px]"
      style={{ paddingTop: "calc(var(--header-height) + 16px)" }}
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg w-full max-w-2xl shadow-xl mx-3 md:mx-0 my-4" role="dialog" aria-modal="true">
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold font-syne text-[var(--text-primary)]">{t("details.title")}</h2>
          <button onClick={onClose} aria-label={t("compose.cancel")} className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        <div className="p-5">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            {post.author_picture ? (
              <img src={getImageUrl(post.author_picture) ?? undefined} alt={post.author_name} className="w-10 h-10 rounded-full object-cover bg-[var(--accent)]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold">{post.author_name?.charAt(0).toUpperCase() || "U"}</div>
            )}
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{post.author_name}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {post.tags?.map((tg) => (
                  <span key={tg.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{tg.label}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words mb-4">{post.body}</p>

          {images.length > 0 && (
            <div className={`grid gap-2 mb-4 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((img, i) => (
                <img key={i} src={getImageUrl(img) ?? undefined} alt="" loading="lazy" decoding="async" onClick={() => setLightbox(i)} className="w-full rounded-lg object-cover cursor-zoom-in bg-[var(--bg-secondary)]" />
              ))}
            </div>
          )}

          {post.pet && (
            <Link href={`/pet/${post.pet.pet_id}`} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--bg-secondary)] hover:opacity-90 mb-4">
              {post.pet.images && (Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ? (
                <img src={getImageUrl(Array.isArray(post.pet.images) ? post.pet.images[0] : post.pet.images) ?? undefined} alt={post.pet.name} className="w-5 h-5 rounded-full object-cover" />
              ) : <span className="text-xs">🐾</span>}
              <span className="text-xs font-medium text-[var(--text-secondary)]">{post.pet.name}</span>
            </Link>
          )}

          <div className="border-t border-[var(--border)] pt-4 mb-2">
            <ReactionBar
              size="lg"
              base="community"
              postType="community"
              postId={post.id}
              initialCounts={{ love: Number(post.love_count) || 0, sad: Number(post.sad_count) || 0, angry: Number(post.angry_count) || 0 }}
              initialUserReaction={post.user_reaction ?? null}
            />
          </div>

          <CommentsSection
            postId={post.id}
            postType="community"
            api={communityAPI}
            comments={comments}
            total={total}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onCommentAdded={() => loadComments(0)}
            onLoadMore={() => loadComments(comments.length)}
          />
        </div>
      </div>

      {lightbox !== null && images[lightbox] && (
        <div onClick={(e) => { e.stopPropagation(); setLightbox(null); }} className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <img src={getImageUrl(images[lightbox]) ?? undefined} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
