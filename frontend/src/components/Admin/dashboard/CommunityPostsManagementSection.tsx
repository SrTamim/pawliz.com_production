import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function CommunityPostsManagementSection() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { can } = useAuth();
  const canModerate = can("community-posts.delete");

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminCommunityAPI.getReported();
      setPosts(data.posts || []);
    } catch {
      toast("Failed to load reported posts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const removeFromList = (id: any) => setPosts((p: any) => p.filter((x: any) => x.id !== id));

  const handleDelete = async (id: any) => {
    if (!window.confirm("Delete this post permanently?")) return;
    try {
      await adminCommunityAPI.deletePost(id);
      toast("Post deleted", "success");
      removeFromList(id);
    } catch (err: any) {
      toast(err.message || "Failed to delete", "error");
    }
  };

  const handleDismiss = async (id: any) => {
    try {
      await adminCommunityAPI.dismissPost(id);
      toast("Reports cleared — post restored", "success");
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
          📰 Reported Posts
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Community posts with ≥1 report. Auto-hidden at 3 reports. Delete or dismiss each.
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState icon="✅" title="No reported posts" description="All clear — no posts pending review." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((p: any) => {
            const reasonCounts = (p.reports || []).reduce((acc: any, r: any) => {
              acc[r.reason] = (acc[r.reason] || 0) + 1;
              return acc;
            }, {});
            return (
              <div key={p.id} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{p.author_name || "Unknown"}</span>
                        {p.author_phone && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.author_phone}</span>}
                      </div>
                      <a
                        href={`/community?post=${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", textDecoration: "none" }}
                      >
                        Post ↗
                      </a>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: p.is_hidden ? "#ff4f6a22" : "transparent", color: p.is_hidden ? "var(--danger)" : "var(--text-secondary)", border: `1px solid ${p.is_hidden ? "var(--danger)" : "var(--border)"}` }}>
                        {p.report_count} report{p.report_count !== 1 ? "s" : ""}{p.is_hidden ? " · hidden" : ""}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", marginBottom: 8, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                      {p.body}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {Object.entries(reasonCounts).map(([reason, count]: [any, any]) => (
                        <span key={reason} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                          {reason as any} ×{count as any}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canModerate && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => handleDismiss(p.id)} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ✓ Dismiss
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
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