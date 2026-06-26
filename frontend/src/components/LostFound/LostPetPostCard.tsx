import { useState } from "react";
import { useRouter } from "next/router";
import PostDetailsModal from "./PostDetailsModal";
import ShareButton from "../ShareButton";
import ReactionBar from "../ReactionBar";
import { useTranslation } from "react-i18next";
import { getImageUrl } from "../../lib/api";
import { parseImages, formatShortDate } from "../../lib/postUtils";

export default function LostPetPostCard({ post, onPostDeleted }: any) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { t } = useTranslation(["lostfound", "common"]);

  const petImage = parseImages(post.images)[0] || null;
  const imageUrl = getImageUrl(petImage);

  const formatDate = (dateStr: any) => formatShortDate(dateStr) || t("common:words.unknown");

  return (
    <>
      <div
        onClick={() => setDetailsOpen(true)}
        className="glass card-hover rounded-[20px] overflow-hidden cursor-pointer relative"
      >
        {/* Image Section */}
        {imageUrl ? (
          <div className="relative w-full h-32 sm:h-48 overflow-hidden" style={{ background: "var(--grad-warm)" }}>
            <img
              src={imageUrl}
              alt={post.name}
              className="w-full h-full object-cover"
              onError={(e: any) => {
                (e.target as any).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="w-full h-32 sm:h-48 flex items-center justify-center text-4xl" style={{ background: "var(--grad-warm)" }}>
            🐾
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-1.5 sm:top-3 right-1.5 sm:right-3">
          <span
            className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-white bg-[var(--danger)]"
            style={{ background: "#ff4f6a" }}
          >
            {post.status === "reunited" ? t("lostfound:status.reunited") : t("lostfound:status.lost")}
          </span>
        </div>

        {/* Content Section */}
        <div className="p-2 sm:p-4">
          {/* Pet Name · Type · Breed — single line */}
          <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] mb-1 sm:mb-2 truncate">
            {post.name || t("common:words.unknown")}{" "}
            <span className="font-normal text-[var(--text-secondary)]">
              · {post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : t("common:words.unknown")} · {post.breed || t("common:words.mixed")}
            </span>
          </p>

          {/* Location & Date */}
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5 sm:mb-3">
            <span className="truncate">📍 {post.lost_location_name || t("common:words.locationNotSpecified")}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] mb-1 sm:mb-4">
            <span>📅 {formatDate(post.lost_date)}</span>
          </div>

          {/* Description Preview — hidden on mobile */}
          {post.additional_details && (
            <p className="hidden sm:block text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">
              {post.additional_details}
            </p>
          )}

          {/* Reactions & Comments */}
          <div className="flex items-center text-[10px] sm:text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-1.5 sm:pt-3 gap-1 sm:gap-2 -ml-1 sm:ml-0">
            <ReactionBar
              base="lost-found"
              postType="lost"
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

          {/* Actions */}
          <div className="flex gap-1 sm:gap-2 mt-3">
            <ShareButton
              text={`🚨 Help find ${post.name || "this pet"}! ${post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : "Pet"} lost in ${post.lost_location_name || "Bangladesh"}. Please share to help reunite them! #Pawliz #LostPet`}
              url={typeof window !== "undefined" ? `${window.location.origin}/help-board?post=${post.id}&type=lost` : undefined}
              className="shrink-0"
            />
            <button
              onClick={(e: any) => {
                e.stopPropagation();
                setDetailsOpen(true);
              }}
              className="btn btn-primary flex-1 py-1 rounded-lg text-xs font-semibold [min-height:0]"
            >
              <span className="sm:hidden">{t("lostfound:card.details", "Details")}</span>
              <span className="hidden sm:inline">{t("lostfound:card.viewDetails")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <PostDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        postType="lost"
        post={post}
        onPostDeleted={onPostDeleted}
      />
    </>
  );
}
