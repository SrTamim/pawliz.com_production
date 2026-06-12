import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { lostFoundAPI } from "../../lib/api";

const REPORT_REASON_KEYS = ["spam", "harassment", "inappropriate", "misinformation", "other"];

export default function CommentsSection({
  postId,
  postType,
  comments = [],
  total = 0,
  hasMore = false,
  loadingMore = false,
  onCommentAdded,
  onLoadMore,
}: any) {
  const { t } = useTranslation("lostfound");
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [reportingId, setReportingId] = useState<any>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Format time ago
  const formatTimeAgo = (dateStr: any) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "now";
  };

  // Add comment
  const handleAddComment = async () => {
    if (!user) {
      toast(t("comments.login"), "error");
      return;
    }

    if (!newComment.trim()) {
      toast(t("comments.empty"), "error");
      return;
    }

    setSubmitting(true);
    try {
      await lostFoundAPI.addComment(postId, postType, newComment.trim());
      toast(t("comments.postBtn"), "success");
      setNewComment("");
      onCommentAdded();
    } catch (err: any) {
      toast(err.message || "Failed to add comment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (commentId: any) => {
    if (!reportReason) { toast(t("comments.reportReason"), "error"); return; }
    setReportSubmitting(true);
    try {
      await lostFoundAPI.reportComment(commentId, reportReason);
      toast(t("comments.report"), "success");
      setReportingId(null);
      setReportReason("");
      onCommentAdded();
    } catch (err: any) {
      toast(err.message || "Failed to report", "error");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: any) => {
    if (!window.confirm(t("comments.deleteConfirm"))) return;

    setDeleting(commentId);
    try {
      await lostFoundAPI.deleteComment(commentId);
      toast(t("comments.deleteBtn"), "success");
      onCommentAdded();
    } catch (err: any) {
      toast(err.message || "Failed to delete comment", "error");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="border-t border-[var(--border)] pt-6">
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
        {t("comments.title", { count: total || comments.length })}
      </h3>

      {/* Add Comment */}
      {user ? (
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex gap-3 mb-3">
            {user && user.profile_picture ? (
              <>
                <img
                  src={
                    user.profile_picture.startsWith("http")
                      ? user.profile_picture
                      : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${user.profile_picture}`
                  }
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-[var(--accent)]"
                  onError={(e: any) => {
                    (e.target as any).style.display = "none";
                    if ((e.target as any).nextElementSibling)
                      (e.target as any).nextElementSibling.style.display = "flex";
                  }}
                />
                <div
                  className="w-8 h-8 rounded-full bg-[var(--accent)] items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ display: "none" }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
              </>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e: any) => setNewComment(e.target.value)}
                placeholder={t("comments.placeholder")}
                maxLength={500}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm resize-none"
                rows={3}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[var(--text-secondary)]">
                  {newComment.length}/500
                </span>
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t("comments.posting") : t("comments.postBtn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
          <p className="text-[var(--text-secondary)] text-sm">
            {t("comments.login")}
          </p>
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[var(--text-secondary)]">
            {t("comments.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment: any) => (
            <div
              key={comment.id}
              className="p-4 bg-[var(--bg-secondary)] rounded-lg"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {comment.profile_picture ? (
                  <img
                    src={
                      comment.profile_picture.startsWith("http")
                        ? comment.profile_picture
                        : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${comment.profile_picture}`
                    }
                    alt={comment.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[var(--accent)]"
                    onError={(e: any) => {
                      (e.target as any).style.display = "none";
                      if ((e.target as any).nextElementSibling)
                        (e.target as any).nextElementSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="w-9 h-9 rounded-full bg-[var(--accent)] items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={
                    comment.profile_picture
                      ? { display: "none" }
                      : { display: "flex" }
                  }
                >
                  {comment.name ? comment.name.charAt(0).toUpperCase() : "U"}
                </div>

                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {comment.name || t("comments.anonymous")}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-[var(--text-primary)] text-sm break-words">
                    {comment.comment_text}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-2">
                    {user && user.id === comment.user_id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deleting === comment.id}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                      >
                        {deleting === comment.id ? t("comments.deleting") : t("comments.deleteBtn")}
                      </button>
                    )}
                    {user && user.id !== comment.user_id && (
                      <button
                        onClick={() => {
                          setReportingId(reportingId === comment.id ? null : comment.id);
                          setReportReason("");
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                      >
                        {reportingId === comment.id ? t("comments.cancel") : t("comments.report")}
                      </button>
                    )}
                  </div>
                  {/* Report form */}
                  {reportingId === comment.id && (
                    <div className="mt-2 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg">
                      <p className="text-xs text-[var(--text-secondary)] mb-2 font-medium">{t("comments.reportReason")}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {REPORT_REASON_KEYS.map((key: any) => (
                          <button
                            key={key}
                            onClick={() => setReportReason(key)}
                            className={`px-2 py-1 rounded text-xs border transition-all ${
                              reportReason === key
                                ? "bg-[var(--danger)] border-[var(--danger)] text-white"
                                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--danger)]"
                            }`}
                          >
                            {t(`comments.reasons.${key}`)}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => handleReport(comment.id)}
                        disabled={!reportReason || reportSubmitting}
                        className="px-3 py-1 bg-[var(--danger)] text-white rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                      >
                        {reportSubmitting ? t("comments.submitting") : t("comments.submitReport")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="px-5 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? t("comments.loading") : t("comments.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
