import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "../../../lib/api";
import { Loading, Alert } from "../../UI";
import { SectionTitle, StatCard, ActionCard, DonutChart, MiniLineChart } from "./primitives";

// Human-readable labels + icons for the activity feed, keyed by event_type.
const EVENT_META: Record<string, { icon: string; label: string }> = {
  user_registered: { icon: "🎉", label: "New user registered" },
  user_login: { icon: "🔑", label: "User logged in" },
  user_deactivated: { icon: "🚫", label: "User deactivated" },
  user_deleted_permanent: { icon: "🗑️", label: "User permanently deleted" },
  role_changed: { icon: "🛡️", label: "User role changed" },
  vet_created: { icon: "🏥", label: "Vet clinic added" },
  vet_approved: { icon: "✅", label: "Vet approved" },
  vet_rejected: { icon: "❌", label: "Vet rejected" },
  vet_deactivated: { icon: "🚫", label: "Vet deactivated" },
  vet_claim_approved: { icon: "🤝", label: "Clinic claim approved" },
  pet_created: { icon: "🐾", label: "Pet profile created" },
  pet_deleted: { icon: "🗑️", label: "Pet deleted" },
  pet_marked_lost: { icon: "😿", label: "Pet marked lost" },
  pet_marked_found: { icon: "🎊", label: "Pet reunited" },
  pet_marked_for_adoption: { icon: "🏡", label: "Pet listed for adoption" },
  comment_deleted_admin: { icon: "💬", label: "Comment removed" },
  community_post_deleted_admin: { icon: "📝", label: "Community post removed" },
  role_created: { icon: "🛡️", label: "Role created" },
  role_updated: { icon: "🛡️", label: "Role updated" },
  role_deleted: { icon: "🛡️", label: "Role deleted" },
  admin_settings_update: { icon: "⚙️", label: "Settings updated" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const cardTitle: any = { fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" };
const panel: any = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" };

export default function OverviewSection({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  // Trends + activity load independently of core stats so a failure in either
  // degrades gracefully (section hides) instead of blanking the whole page.
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<any[] | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);

  const loadCore = useCallback(() => {
    setLoading(true);
    adminAPI
      .stats()
      .then((s: any) => { setStats(s); setRefreshedAt(new Date()); })
      .catch((err: any) => setError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCore(); }, [loadCore]);

  const loadActivity = useCallback(() => {
    adminAPI.getActivityLogs({ limit: "15" })
      .then((r: any) => setActivity(r.logs || []))
      .catch(() => setActivity(null));
  }, []);

  const loadSeries = useCallback(() => {
    adminAPI.statsTimeseries({ days: String(days) })
      .then((r: any) => setSeries(r.series || []))
      .catch(() => setSeries(null));
  }, [days]);

  useEffect(() => { loadActivity(); }, [loadActivity]);
  useEffect(() => { loadSeries(); }, [loadSeries]);

  const refreshAll = () => { loadCore(); loadActivity(); loadSeries(); };

  if (loading && !stats) return <Loading />;
  if (error && !stats) return <Alert variant="error">{error}</Alert>;

  const s = stats || {};
  const d = s.deltas || {};
  const q = s.queues || {};
  const reunion = s.reunion || { found: 0, total: 0, rate: 0 };

  const activePosts = (s.lostPets ?? 0) + (s.foundReports ?? 0) + (s.rescueReports ?? 0) + (s.adoptionPosts ?? 0);
  const dl = (k: string) => (d[k] ? d[k].current : undefined);
  const dlPrev = (k: string) => (d[k] ? d[k].previous : undefined);

  const postTypeSegments = [
    { color: "#f0a500", value: s.lostPets ?? 0 },
    { color: "#00e5a0", value: s.foundReports ?? 0 },
    { color: "#ff6b35", value: s.rescueReports ?? 0 },
    { color: "#7c6df0", value: s.adoptionPosts ?? 0 },
  ];
  const postLegend = [
    { label: "Lost", color: "#f0a500", value: s.lostPets ?? 0 },
    { label: "Found", color: "#00e5a0", value: s.foundReports ?? 0 },
    { label: "Rescue", color: "#ff6b35", value: s.rescueReports ?? 0 },
    { label: "Adoption", color: "#7c6df0", value: s.adoptionPosts ?? 0 },
  ];

  const lineSeries = [
    { key: "users", color: "#7c6df0", label: "Users" },
    { key: "pets", color: "#00b4d8", label: "Pets" },
    { key: "posts", color: "#f0a500", label: "Posts" },
  ];

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <SectionTitle>Dashboard Overview</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {refreshedAt && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Updated {timeAgo(refreshedAt.toISOString())}</span>
          )}
          <button
            onClick={refreshAll}
            style={{ padding: "7px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI strip — deduplicated, with 7-day deltas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="👥" value={s.users ?? "–"} label="Registered Users" delta={dl("users")} prevDelta={dlPrev("users")} />
        <StatCard icon="🐾" value={s.pets ?? "–"} label="Total Pets" delta={dl("pets")} prevDelta={dlPrev("pets")} />
        <StatCard icon="📋" value={activePosts} label="Active Posts" color="#f0a500" />
        <StatCard icon="🏥" value={s.vets ?? "–"} label="Vet Clinics" />
        <StatCard icon="⭐" value={s.reviews ?? "–"} label="Reviews" delta={dl("reviews")} prevDelta={dlPrev("reviews")} />
      </div>

      {/* Action Center */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...cardTitle, marginBottom: 12 }}>Action Center</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          <ActionCard icon="🏥" count={q.pendingVets ?? 0} label="Pending Vet Approvals" onClick={() => onNavigate?.("vets")} />
          <ActionCard icon="🚩" count={q.reportedComments ?? 0} label="Reported Comments" onClick={() => onNavigate?.("comments")} />
          <ActionCard icon="📝" count={q.reportedCommunityPosts ?? 0} label="Reported Posts" onClick={() => onNavigate?.("community-posts")} />
          <ActionCard icon="🚑" count={q.urgentRescues ?? 0} label="Urgent Rescues" onClick={() => onNavigate?.("rescue-pets")} />
        </div>
      </div>

      {/* Growth trend + content mix */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, marginBottom: 24, alignItems: "stretch" }}>
        {/* Trend chart */}
        <div style={{ ...panel, padding: "18px 20px 14px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={cardTitle}>Growth Trend</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[7, 30, 90].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDays(opt)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                    border: `1px solid ${days === opt ? "var(--border-accent)" : "var(--border)"}`,
                    background: days === opt ? "var(--accent-dim)" : "transparent",
                    color: days === opt ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {opt}d
                </button>
              ))}
            </div>
          </div>
          {series === null ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-muted)" }}>Trend data unavailable</div>
          ) : (
            <>
              <MiniLineChart data={series} series={lineSeries} height={180} />
              <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
                {lineSeries.map((ls) => (
                  <div key={ls.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: ls.color }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ls.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content mix donut */}
        <div style={{ ...panel, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: 190 }}>
          <div style={cardTitle}>Content Mix</div>
          <DonutChart segments={postTypeSegments} size={120} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            {postLegend.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reunion stat + Recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)", gap: 16, alignItems: "stretch" }}>
        {/* Reunion success */}
        <div style={{ ...panel, padding: 20, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
          <div style={cardTitle}>Reunion Success</div>
          <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 44, fontWeight: 800, color: "#00c875", lineHeight: 1 }}>{reunion.rate}%</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {reunion.found} of {reunion.total} lost pets reunited
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--bg-elevated)", overflow: "hidden", marginTop: 4 }}>
            <div style={{ width: `${reunion.rate}%`, height: "100%", background: "#00c875" }} />
          </div>
        </div>

        {/* Recent activity feed */}
        <div style={{ ...panel, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", ...cardTitle }}>Recent Activity</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {activity === null ? (
              <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Activity unavailable.</div>
            ) : activity.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>No recent activity.</div>
            ) : (
              activity.map((a: any) => {
                const meta = EVENT_META[a.event_type] || { icon: "•", label: a.event_type };
                const who = a.user_name || a.user_phone || "System";
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{timeAgo(a.created_at)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
