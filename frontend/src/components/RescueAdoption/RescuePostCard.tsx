import { useState } from "react";
import RescueAdoptionPostDetailsModal from "./RescueAdoptionPostDetailsModal";
import ShareButton from "../ShareButton";
import ReactionBar from "../ReactionBar";
import { useTranslation } from "react-i18next";
import { getImageUrl } from "../../lib/api";
import { parseImages, formatShortDate } from "../../lib/postUtils";

const URGENCY_COLORS = {
  low: "#00e5a0",
  medium: "#f0a500",
  high: "#ff6b35",
  critical: "#ff4f6a",
};

export default function RescuePostCard({ post, onPostDeleted }: any) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { t } = useTranslation(["lostfound", "common"]);

  const petImage = parseImages(post.images)[0] || null;
  const imageUrl = getImageUrl(petImage);

  const formatDate = (dateStr: any) => formatShortDate(dateStr) || t("common:words.unknown");

  const urgency = post.urgency || "medium";
  const urgencyColor = (URGENCY_COLORS as any)[urgency] || URGENCY_COLORS.medium;
  const urgencyLabel = t(`lostfound:urgency.${urgency}`) || t("lostfound:urgency.medium");

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
              alt="Rescue pet"
              className="w-full h-full object-cover"
              onError={(e: any) => { (e.target as any).style.display = "none"; }}
            />
          </div>
        ) : (
          <div className="w-full h-32 sm:h-48 bg-[var(--bg-secondary)] flex items-center justify-center text-4xl">
            🚨
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-1.5 sm:top-3 right-1.5 sm:right-3">
          <span
            className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-white"
            style={{ background: urgencyColor }}
          >
            {post.status === "rescued"
              ? t("lostfound:status.rescued")
              : post.status === "resolved"
              ? t("lostfound:status.resolved")
              : urgencyLabel}
          </span>
        </div>

        {/* Content Section */}
        <div className="p-2 sm:p-4">
          <h3 className="text-xs sm:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1 truncate">
            {post.pet_type
              ? post.pet_type.charAt(0).toUpperCase() + post.pet_type.slice(1)
              : t("common:words.unknown")}{" "}
            {t("lostfound:card.needsRescue")}
          </h3>
          <p className="text-[10px] sm:text-sm text-[var(--text-secondary)] mb-1 sm:mb-3 truncate">
            {post.color ? `${t("lostfound:card.colorLabel")}: ${post.color}` : t("common:words.colorNotSpecified")} •{" "}
            {post.breed || t("common:words.breedUnknown")}
          </p>

          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5 sm:mb-3">
            <span className="truncate">📍 {post.rescue_location_name || t("common:words.locationNotSpecified")}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-1 sm:mb-4">
            <span>📅 {formatDate(post.rescue_date)}</span>
          </div>

          {post.description && (
            <p className="hidden sm:block text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">
              {post.description}
            </p>
          )}

          <div className="flex items-center text-[10px] sm:text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-1.5 sm:pt-3 gap-2">
            <ReactionBar
              base="rescue-adoption"
              postType="rescue"
              postId={post.id}
              initialCounts={{
                love: Number(post.love_count) || 0,
                sad: Number(post.sad_count) || 0,
                angry: Number(post.angry_count) || 0,
              }}
              initialUserReaction={post.user_reaction ?? null}
            />
            <span className="shrink-0">💬 {post.comment_count || 0}</span>
          </div>

          <div className="flex gap-1 sm:gap-2 mt-3">
            <ShareButton
              text={`🚨 ${post.pet_type ? post.pet_type.charAt(0).toUpperCase() + post.pet_type.slice(1) : "Animal"} needs rescue in ${post.rescue_location_name || "Bangladesh"}! Please help share. #Pawliz #RescuePet`}
              url={typeof window !== "undefined" ? `${window.location.origin}/help-board?post=${post.id}&type=rescue` : undefined}
              className="shrink-0"
            />
            <button
              onClick={(e: any) => { e.stopPropagation(); setDetailsOpen(true); }}
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
        postType="rescue"
        post={post}
        onPostDeleted={onPostDeleted}
      />
    </>
  );
}
