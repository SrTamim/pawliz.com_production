import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function CommentsManagementSection() {
  const [comments, setComments] = useState<any[]>([]);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { can } = useAuth();
  // Both Dismiss and Delete go through comments.delete-gated routes.
  const canModerate = can("comments.delete");

  const POST_TYPE_LABEL = { lost: "Lost", found: "Found", rescue: "Rescue", adoption: "Adoption" };
  const POST_URL = (c: any) => {
    if (c.post_type === "lost" || c.post_type === "found")
      return `/lost-found?post=${c.post_id}&type=${c.post_type}`;
    return `/rescue?post=${c.post_id}&type=${c.post_type}`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getReportedComments();
      const list = data.comments || [];
      setAllComments(list);
      setComments(list);
    } catch {
      toast("Failed to load reported comments", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim()) { setComments(allComments); return; }
    const q = search.toLowerCase();
    setComments(allComments.filter((c: any) =>
      (c.commenter_name || "").toLowerCase().includes(q) ||
      (c.commenter_phone || "").toLowerCase().includes(q)
    ));
  }, [search, allComments]);

  const removeFromList = (id: any) => {
    setAllComments((a: any) => a.filter((x: any) => x.id !== id));
    setComments((c: any) => c.filter((x: any) => x.id !== id));
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm("Delete this comment permanently?")) return;
    try {
      await adminAPI.deleteComment(id);
      toast("Comment deleted", "success");
      removeFromList(id);
    } catch (err: any) {
      toast(err.message || "Failed to delete", "error");
    }
  };

  const handleDismiss = async (id: any) => {
    try {
      await adminAPI.dismissComment(id);
      toast("Reports cleared — comment marked safe", "success");
      removeFromList(id);
    } catch (err: any) {
      toast(err.message || "Failed to dismiss", "error");
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text-primary)", marginBottom: 4 }}>
          🚩 Reported Comments
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
          Comments with ≥1 report. Auto-hidden at 3 reports. Delete or dismiss each.
        </p>
        <Input
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          placeholder="Search by name or phone number..."
          style={{ maxWidth: 380 }}
        />
      </div>

      {comments.length === 0 ? (
        <EmptyState icon="✅" title="No reported comments" description="All clear — no comments pending review." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.map((c: any) => {
            const reasonCounts = (c.reports || []).reduce((acc: any, r: any) => {
              acc[r.reason] = (acc[r.reason] || 0) + 1;
              return acc;
            }, {});

            return (
              <div
                key={c.id}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{c.commenter_name || "Unknown"}</span>
                        {c.commenter_phone && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.commenter_phone}</span>
                        )}
                      </div>
                      <a
                        href={POST_URL(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "var(--accent-dim)",
                          color: "var(--accent)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          textDecoration: "none",
                          cursor: "pointer",
                        }}
                      >
                        {(POST_TYPE_LABEL as any)[c.post_type] || c.post_type} · Post ↗
                      </a>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: c.is_hidden ? "#ff4f6a22" : "transparent",
                        color: c.is_hidden ? "var(--danger)" : "var(--text-secondary)",
                        border: `1px solid ${c.is_hidden ? "var(--danger)" : "var(--border)"}`,
                      }}>
                        {c.report_count} report{c.report_count !== 1 ? "s" : ""}{c.is_hidden ? " · hidden" : ""}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 14,
                      color: "var(--text-primary)",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      marginBottom: 8,
                      wordBreak: "break-word",
                    }}>
                      {c.comment_text}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {Object.entries(reasonCounts).map(([reason, count]: [any, any]) => (
                        <span key={reason} style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }}>
                          {reason as any} ×{count as any}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canModerate && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleDismiss(c.id)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 7,
                        border: "1px solid var(--border)",
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✓ Dismiss
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 7,
                        border: "1px solid var(--danger)",
                        background: "transparent",
                        color: "var(--danger)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}