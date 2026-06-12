import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNavbar } from "../../context/NavbarContext";
import { rescueAdoptionAPI, getImageUrl } from "../../lib/api";
import RescueAdoptionCommentsSection from "./RescueAdoptionCommentsSection";
import RescueModal from "./RescueModal";
import ContactFormModal from "../ContactFormModal";

const URGENCY_COLORS = {
  low: "#00e5a0",
  medium: "#f0a500",
  high: "#ff6b35",
  critical: "#ff4f6a",
};

export default function RescueAdoptionPostDetailsModal({
  open,
  onClose,
  postType,
  post,
  onPostDeleted,
}: any) {
  const { t } = useTranslation("lostfound");
  const { user } = useAuth();
  const { toast } = useToast();
  const { openAuth } = useNavbar();
  const [comments, setComments] = useState<any[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (open && post?.id) {
      setComments([]);
      setCommentsTotal(0);
      setCommentsHasMore(false);
      loadComments(0);
    }
  }, [open, post?.id]);

  const loadComments = async (offset = 0) => {
    if (offset === 0) setLoadingComments(true);
    else setLoadingMoreComments(true);
    try {
      const data = await rescueAdoptionAPI.getComments(postType, post.id, offset);
      setComments((prev) => offset === 0 ? (data.comments || []) : [...prev, ...(data.comments || [])]);
      setCommentsTotal(data.total || 0);
      setCommentsHasMore(data.hasMore || false);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments(false);
      setLoadingMoreComments(false);
    }
  };

  const handleLoadMoreComments = () => loadComments(comments.length);

  const handleDeletePost = async () => {
    if (postType === "adoption") {
      toast(t("rescueDetails.adoptionManageMsg"), "info");
      return;
    }

    if (!window.confirm(t("rescueDetails.deleteConfirm"))) return;

    setDeleting(true);
    try {
      await rescueAdoptionAPI.deleteRescuePost(post.id);
      toast(t("rescueDetails.deleteSuccess"), "success");
      if (onPostDeleted) onPostDeleted();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to delete report", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!open || !post) return null;

  const parseImages = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw) || []; } catch { return []; }
  };

  const images = parseImages(post.images);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  };

  const isRescue = postType === "rescue";
  const isOwner = user && user.id === post.owner_id;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto pb-[96px]"
      style={{ paddingTop: "calc(var(--header-height) + 16px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg w-full max-w-3xl shadow-xl mx-3 md:mx-0 my-4"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isRescue ? t("rescueDetails.rescueTitle") : t("rescueDetails.adoptionTitle")}
          </h2>
          <div className="flex items-center gap-2">
            {isRescue && isOwner && (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="px-3 py-1 text-sm font-semibold bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all"
                >
                  {t("rescueDetails.edit")}
                </button>
                <button
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="px-3 py-1 text-sm font-semibold bg-[var(--danger)] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {deleting ? t("rescueDetails.deleting") : t("rescueDetails.delete")}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Images Gallery */}
          {images.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-xs md:max-w-none mx-auto md:mx-0">
                {images.map((image, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="relative w-full bg-[var(--bg-secondary)] rounded-lg overflow-hidden cursor-zoom-in border-0 p-0"
                    style={{ paddingBottom: "100%" }}
                    aria-label={`View image ${idx + 1} fullscreen`}
                  >
                    <img
                      src={getImageUrl(image)}
                      alt={`Pet image ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform"
                      onError={(e) => {
                        (e.target as any).parentElement.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">📷</div>';
                      }}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2 text-center">
                {t("rescueDetails.tapToEnlarge")}
              </p>
            </div>
          )}

          {/* Urgency Badge (rescue only) */}
          {isRescue && post.urgency && (
            <div className="mb-4">
              <span
                className="px-4 py-2 rounded-full text-sm font-bold text-white"
                style={{ background: URGENCY_COLORS[post.urgency] || URGENCY_COLORS.medium }}
              >
                {t("rescueDetails.urgencyLabel")} {post.urgency.toUpperCase()}
              </span>
            </div>
          )}

          {/* Pet Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {isRescue ? (
              <>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.petType")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.pet_type ? post.pet_type.charAt(0).toUpperCase() + post.pet_type.slice(1) : t("rescueDetails.unknown")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.color")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{post.color || t("rescueDetails.notSpecified")}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.breed")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{post.breed || t("rescueDetails.unknown")}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.gender")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.gender ? post.gender.charAt(0).toUpperCase() + post.gender.slice(1) : t("rescueDetails.notSpecified")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.petName")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{post.name || t("rescueDetails.unknown")}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.type")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : t("rescueDetails.unknown")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.breed")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{post.breed || t("rescueDetails.unknown")}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.gender")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.gender ? post.gender.charAt(0).toUpperCase() + post.gender.slice(1) : t("rescueDetails.notSpecified")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.age")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.age ? t("rescueDetails.ageDisplay", { count: post.age }) : t("rescueDetails.notSpecified")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.color")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{post.color || t("rescueDetails.notSpecified")}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.weight")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.weight ? `${post.weight} kg` : t("rescueDetails.notSpecified")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">{t("rescueDetails.pottyTrained")}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {post.potty_trained === true ? "✅ Yes" : post.potty_trained === false ? "❌ No" : t("rescueDetails.notSpecified")}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Location & Date */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">
                  {isRescue ? t("rescueDetails.rescueLocation") : t("rescueDetails.ownerLocation")}
                </p>
                <p className="text-[var(--text-primary)]">
                  {isRescue ? (post.rescue_location_name || t("rescueDetails.notSpecified")) : t("rescueDetails.contactOwnerForDetails")}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">
                  {isRescue ? t("rescueDetails.dateSpotted") : t("rescueDetails.postedOn")}
                </p>
                <p className="text-[var(--text-primary)]">
                  {isRescue ? formatDate(post.rescue_date) : formatDate(post.posted_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {isRescue && post.description && (
            <div className="mb-6">
              <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2">{t("rescueDetails.description")}</p>
              <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">{post.description}</p>
            </div>
          )}

          {/* Adoption details */}
          {!isRescue && (
            <>
              {post.reason && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2">{t("rescueDetails.reasonForAdoption")}</p>
                  <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">{post.reason}</p>
                </div>
              )}
              {post.adoption_requirements && (
                <div className="mb-6">
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2">{t("rescueDetails.adoptionRequirements")}</p>
                  <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">{post.adoption_requirements}</p>
                </div>
              )}
            </>
          )}

          {/* Owner / Reporter Contact */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
            <p className="text-xs text-[var(--text-secondary)] font-semibold mb-3">
              {isRescue ? t("rescueDetails.reportedBy") : t("rescueDetails.contactOwner")}
            </p>
            <div className="flex items-center gap-3">
              {post.profile_picture ? (
                <img
                  src={post.profile_picture.startsWith("http") ? post.profile_picture : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${post.profile_picture}`}
                  alt={post.owner_name}
                  className="w-10 h-10 rounded-full object-cover bg-[var(--accent)]"
                  onError={(e) => { (e.target as any).style.display = "none"; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold">
                  {post.owner_name ? post.owner_name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">{post.owner_name}</p>
              </div>
              <button
                onClick={() => setContactOpen(true)}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-1 shrink-0"
              >
                📞 Contact Now
              </button>
            </div>
          </div>

          {/* Comments Section */}
          <RescueAdoptionCommentsSection
            postId={post.id}
            postType={postType}
            comments={comments}
            total={commentsTotal}
            hasMore={commentsHasMore}
            loadingMore={loadingMoreComments}
            onCommentAdded={() => loadComments(0)}
            onLoadMore={handleLoadMoreComments}
          />
        </div>
      </div>

      {/* Edit Modal for rescue post */}
      {isRescue && (
        <RescueModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          editPost={post}
          onCreated={() => {
            setEditOpen(false);
            if (onPostDeleted) onPostDeleted();
            onClose();
          }}
        />
      )}

      <ContactFormModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        postId={post.id}
        postType={postType}
        ownerName={post.owner_name}
      />

      {/* Image Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 text-white text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
                className="absolute left-2 md:left-6 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
              >‹</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
                className="absolute right-2 md:right-6 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
              >›</button>
            </>
          )}
          <img
            src={getImageUrl(images[lightboxIndex])}
            alt={`Pet image ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
