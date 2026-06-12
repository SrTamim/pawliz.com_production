import { useState } from "react";
import RescueAdoptionPostDetailsModal from "./RescueAdoptionPostDetailsModal";
import ShareButton from "../ShareButton";
import { useTranslation } from "react-i18next";
import { getImageUrl } from "../../lib/api";
import { parseImages, formatShortDate } from "../../lib/postUtils";

export default function AdoptionPostCard({ post, onPostDeleted }: any) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { t } = useTranslation(["lostfound", "common"]);

  const petImage = parseImages(post.images)[0] || null;
  const imageUrl = getImageUrl(petImage);

  const formatDate = (dateStr) => formatShortDate(dateStr) || t("common:words.unknown");

  return (
    <>
      <div
        onClick={() => setDetailsOpen(true)}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1 relative"
      >
        {/* Image Section */}
        {imageUrl ? (
          <div className="relative w-full h-32 sm:h-48 bg-[var(--bg-secondary)] overflow-hidden">
            <img
              src={imageUrl}
              alt={post.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as any).style.display = "none"; }}
            />
          </div>
        ) : (
          <div className="w-full h-32 sm:h-48 bg-[var(--bg-secondary)] flex items-center justify-center text-4xl">
            🏠
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-1.5 sm:top-3 right-1.5 sm:right-3">
          <span
            className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-white"
            style={{ background: post.status === "adopted" ? "#00e5a0" : "#7c3aed" }}
          >
            {post.status === "adopted" ? t("lostfound:status.adopted") : t("lostfound:status.forAdoption")}
          </span>
        </div>

        {/* Content Section */}
        <div className="p-2 sm:p-4">
          <h3 className="text-xs sm:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1 truncate">
            {post.name || t("common:words.unknown")}
          </h3>
          <p className="text-[10px] sm:text-sm text-[var(--text-secondary)] mb-1 sm:mb-3 truncate">
            {post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : t("common:words.unknown")}{" "}
            • {post.breed || t("common:words.mixed")}
          </p>

          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-1 sm:mb-3">
            {post.age && (
              <span>🎂 {post.age}{t("common:words.yrs")}</span>
            )}
            {post.gender && (
              <span>{post.gender === "male" ? "♂" : "♀"}</span>
            )}
            {post.color && <span className="hidden sm:inline">🎨 {post.color}</span>}
          </div>

          {post.reason && (
            <p className="hidden sm:block text-sm text-[var(--text-secondary)] mb-3 line-clamp-2 italic">
              "{post.reason}"
            </p>
          )}

          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-1 sm:mb-4">
            <span>📅 {formatDate(post.posted_at)}</span>
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-1.5 sm:pt-3 gap-1">
            <span className="shrink-0">💬 {post.comment_count || 0}</span>
            <span className="font-semibold text-[var(--text-primary)] truncate text-right">
              👤 {post.owner_name || t("common:words.anonymous")}
            </span>
          </div>

          <div className="flex gap-1 sm:gap-2 mt-3">
            <ShareButton
              text={`🏠 ${post.name || "A pet"} needs a loving home! ${post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : "Pet"} available for adoption. #Pawliz #AdoptDontShop`}
              className="shrink-0"
            />
            <button
              onClick={(e) => { e.stopPropagation(); setDetailsOpen(true); }}
              className="flex-1 px-2 sm:px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-xs sm:text-sm font-semibold hover:opacity-90 transition-all"
            >
              <span className="sm:hidden">{t("lostfound:card.details", "Details")}</span>
              <span className="hidden sm:inline">{t("lostfound:card.viewDetails")}</span>
            </button>
          </div>
        </div>
      </div>

      <RescueAdoptionPostDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        postType="adoption"
        post={post}
        onPostDeleted={onPostDeleted}
      />
    </>
  );
}
