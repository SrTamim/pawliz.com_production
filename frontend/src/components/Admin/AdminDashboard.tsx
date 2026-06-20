import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../lib/api";
import {
  Button,
  Loading,
  EmptyState,
  Alert,
  Badge,
  Pagination,
  Input,
  Spinner,
} from "../UI";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { PAGES } from "./permissions";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../VetDashboard/WeeklyScheduleEditor";

export default function AdminDashboard() {
  const router = useRouter();
  const { can, user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Sidebar items the current user may see (admin sees all incl. Role Manager).
  // permissions registry is the single source of truth for nav + gating.
  const visiblePages = PAGES.filter((p: any) => can(p.key));
  const [section, setSection] = useState(
    () => visiblePages[0]?.key || "overview",
  );

  // If the active section is no longer permitted (perms changed mid-session),
  // fall back to the first allowed page so a manager never sees a blank/denied view.
  useEffect(() => {
    if (!visiblePages.find((p: any) => p.key === section)) {
      setSection(visiblePages[0]?.key || "overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.permissions]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        paddingTop: "var(--header-height)",
        height: "calc(100vh - 80px)",
        background: "var(--bg-primary)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sub-header */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          padding: isMobile ? "0 14px" : "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isMobile && (
            <button
              onClick={() => setNavOpen((v: any) => !v)}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ☰
            </button>
          )}
          <div
            style={{
              fontFamily: "Roboto, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            ⚙️ Admin Panel
            <span
              style={{
                padding: "3px 10px",
                background: "var(--accent-dim)",
                border: "1px solid var(--border-accent)",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              DASHBOARD
            </span>
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          ← Back
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Sidebar Nav - overlay on mobile */}
        {(isMobile ? navOpen : true) && (
          <>
            {isMobile && (
              <div
                onClick={() => setNavOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  zIndex: 10,
                }}
              />
            )}
            <nav
              style={{
                width: 220,
                minWidth: 220,
                background: "var(--bg-secondary)",
                borderRight: "1px solid var(--border)",
                padding: "16px 10px",
                overflowY: "auto",
                ...(isMobile
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      zIndex: 11,
                      boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
                    }
                  : {}),
              }}
            >
              {visiblePages.map((item: any) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setSection(item.key);
                    if (isMobile) setNavOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: section === item.key ? 600 : 500,
                    color:
                      section === item.key
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    cursor: "pointer",
                    border: "none",
                    background:
                      section === item.key ? "var(--accent-dim)" : "transparent",
                    fontFamily: "DM Sans, sans-serif",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 3,
                    transition: "all 0.2s",
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>
          </>
        )}

        {/* Content */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 28 }}
        >
          {section === "overview" && <OverviewSection />}
          {section === "vets" && <VetsSection />}
          {section === "claim-requests" && <ClaimRequestsSection />}
          {section === "users" && <UsersSection />}
          {section === "pets" && <PetsSection />}
          {section === "lost-pets-mgmt" && <LostPetsSection />}
          {section === "adoptable-pets" && <AdoptablePetsSection />}
          {section === "found-pets" && <FoundPetsSection />}
          {section === "rescue-pets" && <RescuePetsSection />}
          {section === "reviews" && <ReviewsSection />}
          {section === "donation" && <DonationSection />}
          {section === "comments" && <CommentsManagementSection />}
          {section === "community-posts" && <CommunityPostsManagementSection />}
          {section === "settings" && <SettingsSection />}
          {section === "sms-settings" && <SmsSettingsSection />}
          {section === "roles" && <RolesSection />}
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW ──────────────────────────────────────────────────────────────
function MiniBarChart({ data, height = 120 }: any) {
  const max = Math.max(...data.map((d: any) => d.value), 1);
  const barW = 100 / data.length;
  return (
    <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
      {data.map((d: any, i: any) => {
        const barH = Math.max((d.value / max) * (height - 28), 2);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = height - 20 - barH;
        return (
          <g key={i}>
            <rect
              x={`${x}%`}
              y={y}
              width={`${w}%`}
              height={barH}
              rx={3}
              fill={d.color || "var(--accent)"}
              opacity={0.85}
            />
            <text
              x={`${x + w / 2}%`}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-secondary)"
              fontFamily="DM Sans, sans-serif"
            >
              {d.value}
            </text>
            <text
              x={`${x + w / 2}%`}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted)"
              fontFamily="DM Sans, sans-serif"
            >
              {d.shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments, size = 110 }: any) {
  const r = 40;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s: any, d: any) => s + d.value, 0) || 1;
  let cumAngle = -Math.PI / 2;
  const paths = segments.map((seg: any) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: seg.color, value: seg.value };
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="var(--bg-primary)" />
      {paths.map((p: any, i: any) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="var(--bg-card)" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-primary)" fontFamily="Roboto, sans-serif">
        {total}
      </text>
    </svg>
  );
}

function StatCard({ icon, value, label, color }: any) {
  return (
    <div style={{
      padding: "18px 20px",
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 28, fontWeight: 800, color: color || "var(--accent)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function OverviewSection() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    adminAPI.stats().then(setStats).catch((err: any) => setError(err.message || "Failed to load stats")).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <Alert variant="error">{error}</Alert>;

  const s = stats || {};

  const activityData = [
    { shortLabel: "Lost", value: s.lostPets ?? 0, color: "#f0a500" },
    { shortLabel: "Found", value: s.foundReports ?? 0, color: "#00e5a0" },
    { shortLabel: "Rescue", value: s.rescueReports ?? 0, color: "#ff6b35" },
    { shortLabel: "Adopt", value: s.adoptionPosts ?? 0, color: "#7c6df0" },
    { shortLabel: "Comments", value: s.totalComments ?? 0, color: "#00b4d8" },
    { shortLabel: "Spam", value: s.spamReports ?? 0, color: "#ff4f6a" },
  ];

  const postTypeSegments = [
    { color: "#f0a500", value: s.lostPets ?? 0 },
    { color: "#00e5a0", value: s.foundReports ?? 0 },
    { color: "#ff6b35", value: s.rescueReports ?? 0 },
    { color: "#7c6df0", value: s.adoptionPosts ?? 0 },
  ];

  return (
    <div>
      <SectionTitle>Dashboard Overview</SectionTitle>

      {/* Primary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="👥" value={s.users ?? "–"} label="Registered Users" />
        <StatCard icon="🐾" value={s.pets ?? "–"} label="Total Pets" />
        <StatCard icon="🏥" value={s.vets ?? "–"} label="Vet Clinics" />
        <StatCard icon="⭐" value={s.reviews ?? "–"} label="Reviews" />
        <StatCard icon="💬" value={s.totalComments ?? "–"} label="Comments" />
        <StatCard icon="🚩" value={s.spamReports ?? "–"} label="Spam Reports" color="var(--danger)" />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 24, alignItems: "stretch" }}>
        {/* Bar chart */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 20px 12px" }}>
          <div style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 12 }}>
            Activity Breakdown
          </div>
          <MiniBarChart data={activityData} height={130} />
        </div>
        {/* Donut chart */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: 180 }}>
          <div style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Post Types</div>
          <DonutChart segments={postTypeSegments} size={120} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            {[
              { label: "Lost", color: "#f0a500", value: s.lostPets ?? 0 },
              { label: "Found", color: "#00e5a0", value: s.foundReports ?? 0 },
              { label: "Rescue", color: "#ff6b35", value: s.rescueReports ?? 0 },
              { label: "Adoption", color: "#7c6df0", value: s.adoptionPosts ?? 0 },
            ].map((item: any) => (
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

      {/* Secondary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="🐕" value={s.lostPets ?? "–"} label="Active Lost Pets" color="#f0a500" />
        <StatCard icon="🔍" value={s.foundReports ?? "–"} label="Found Reports" color="#00e5a0" />
        <StatCard icon="🚑" value={s.rescueReports ?? "–"} label="Rescue Reports" color="#ff6b35" />
        <StatCard icon="🏡" value={s.adoptionPosts ?? "–"} label="Adoption Posts" color="#7c6df0" />
      </div>
    </div>
  );
}

// ─── VETS ─────────────────────────────────────────────────────────────────
function VetsSection() {
  const [vets, setVets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null); // null=list, 'new'=add, {id}=edit
  const [togglingStatus, setTogglingStatus] = useState<any>(null);
  const [approving, setApproving] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" = all, "active", "inactive"
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const searchRef = useRef(false);
  const { toast } = useToast();
  const { can } = useAuth();

  // Per-page UI permissions (admin → all true via can()).
  const canCreate = can("vets.create");
  const canEdit = can("vets.edit");
  const canApprove = can("vets.approve");
  const canDelete = can("vets.delete");
  const showActions = canEdit || canApprove || canDelete;

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = (p = page, s = search, af = approvalFilter, sf = statusFilter) => {
    setLoading(true);
    // statusFilter → server-side: "active"/"inactive" map to active=true/false,
    // "" (all) fetches active + inactive via include_inactive.
    const statusParam =
      sf === "active" ? { active: "true" } :
      sf === "inactive" ? { active: "false" } :
      { include_inactive: "true" };
    adminAPI
      .getVets({ page: p, limit: PAGE_SIZE, ...(s ? { search: s } : {}), ...(af ? { approval_status: af } : {}), ...statusParam })
      .then((r: any) => {
        setVets(r.vets || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
  }, []);

  // filters changed → reset to page 1 (debounced)
  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search, approvalFilter, statusFilter); }, 400);
    return () => clearTimeout(t);
  }, [search, approvalFilter, statusFilter]);

  const goToPage = (p: any) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    load(next, search, approvalFilter, statusFilter);
  };

  const handleApprove = async (id: any) => {
    setApproving(id);
    try {
      await adminAPI.approveVet(id);
      toast("Vet approved");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: any) => {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setApproving(id);
    try {
      await adminAPI.rejectVet(id, reason);
      toast("Vet rejected");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setApproving(null);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this vet clinic?")) return;
    try {
      await adminAPI.deleteVet(id);
      toast("Vet deleted");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleToggleStatus = async (id: any, currentStatus: any) => {
    setTogglingStatus(id);
    try {
      await adminAPI.updateVetStatus(id, !currentStatus);
      toast(currentStatus ? "Vet deactivated" : "Vet activated");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setTogglingStatus(null);
    }
  };

  if (editing !== null) {
    return (
      <VetForm
        vet={editing === "new" ? null : vets.find((v: any) => v.id === editing)}
        onSave={() => {
          setEditing(null);
          load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <SectionTitle>Manage Vet Clinics</SectionTitle>
        {canCreate && (
          <Button variant="accent" onClick={() => setEditing("new")}>
            + Add Vet Clinic
          </Button>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name or location..." style={{ flex: 1, minWidth: 180 }} />
        <select
          value={approvalFilter}
          onChange={(e: any) => setApprovalFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer" }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e: any) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer" }}
        >
          <option value="">All (Active + Inactive)</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : (
        <TableWrapper title={`All Clinics (${total})`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <Tr header>
                <Th>Name</Th>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th>Contact</Th>
                <Th>Rating</Th>
                <Th>Claimed</Th>
                <Th>Approval</Th>
                <Th>Status</Th>
                {showActions && <Th>Actions</Th>}
              </Tr>
            </thead>
            <tbody>
              {vets.map((v: any) => (
                <Tr key={v.id}>
                  <Td bold>
                    <span style={!v.is_active ? { opacity: 0.5 } : {}}>
                      {v.name}
                    </span>
                    {v.user_id && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Self-registered</div>}
                    {!v.is_active && <div style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700, marginTop: 2, letterSpacing: "0.5px" }}>DEACTIVATED</div>}
                  </Td>
                  <Td>
                    <Badge color="accent">{v.location_name || "—"}</Badge>
                  </Td>
                  <Td>
                    <Badge color="warning">Clinic</Badge>
                  </Td>
                  <Td>{v.contact || "–"}</Td>
                  <Td>
                    <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                      ★ {parseFloat(v.avg_rating || 0).toFixed(1)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={v.claimed_by ? "accent" : "gray"}>
                      {v.claimed_by ? "Claimed" : "Unclaimed"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge color={v.approval_status === "approved" ? "success" : v.approval_status === "rejected" ? "danger" : "warning"}>
                      {v.approval_status || "approved"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge color={v.is_active ? "success" : "danger"}>
                      {v.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  {showActions && (
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(v.id)}>Edit</Button>
                        )}
                        {canApprove && (v.approval_status === "pending" || v.approval_status === "rejected") && (
                          <Button variant="accent" size="sm" disabled={approving === v.id} onClick={() => handleApprove(v.id)}>
                            {approving === v.id ? "..." : "Approve"}
                          </Button>
                        )}
                        {canApprove && v.approval_status === "approved" && (
                          <Button variant="danger" size="sm" disabled={approving === v.id} onClick={() => handleReject(v.id)}>
                            {approving === v.id ? "..." : "Reject"}
                          </Button>
                        )}
                        {/* Deactivate is destructive (vets.delete); reactivation is an edit (vets.edit) */}
                        {((v.is_active && canDelete) || (!v.is_active && canEdit)) && (
                          <Button
                            variant={v.is_active ? "danger" : "accent"}
                            size="sm"
                            disabled={togglingStatus === v.id}
                            onClick={() => handleToggleStatus(v.id, v.is_active)}
                          >
                            {togglingStatus === v.id ? "..." : v.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="danger" size="sm" onClick={() => handleDelete(v.id)}>Delete</Button>
                        )}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ‹ Prev
              </Button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Next ›
              </Button>
            </div>
          )}
        </TableWrapper>
      )}
    </div>
  );
}

const SERVER_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace("/api", "");
function getAdminImageUrl(path: any) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SERVER_BASE}${path}`;
}

function VetForm({ vet, onSave, onCancel }: any) {
  const isEdit = !!vet;
  const [form, setForm] = useState({
    name: vet?.name || "",
    location_name: vet?.location_name || "",
    latitude: vet?.latitude || "",
    longitude: vet?.longitude || "",
    address: vet?.address || "",
    contact: vet?.contact || "",
    email: vet?.email || "",
    website: vet?.website || "",
    image: vet?.image || "",
    cover_image: vet?.cover_image || "",
    description: vet?.description || "",
    services: Array.isArray(vet?.services) ? vet.services.join(", ") : "",
    vet_type: vet?.vet_type || "clinic",
    checkup_start: vet?.checkup_start ? vet.checkup_start.slice(0, 5) : "",
    checkup_end: vet?.checkup_end ? vet.checkup_end.slice(0, 5) : "",
    weekly_holidays: Array.isArray(vet?.weekly_holidays) ? vet.weekly_holidays.join(", ") : (vet?.weekly_holidays || ""),
    weekly_schedule: buildScheduleFromLegacy(vet?.weekly_schedule, vet?.checkup_start, vet?.checkup_end, vet?.weekly_holidays),
    account_owner_name: vet?.account_owner_name || "",
  });
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [clinicContacts, setClinicContacts] = useState<any[]>([]);
  const [clinicVets, setClinicVets] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const mapContainerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinIconRef = useRef<any>(null);

  useEffect(() => {
    if (!isEdit || !vet?.id) return;
    setLoadingDetails(true);
    adminAPI.getVet(vet.id)
      .then((res: any) => {
        const v = res.vet;
        setForm((f: any) => ({
          ...f,
          website: v.website || "",
          cover_image: v.cover_image || "",
          vet_type: v.vet_type || "clinic",
          checkup_start: v.checkup_start ? v.checkup_start.slice(0, 5) : "",
          checkup_end: v.checkup_end ? v.checkup_end.slice(0, 5) : "",
          weekly_holidays: Array.isArray(v.weekly_holidays) ? v.weekly_holidays.join(", ") : (v.weekly_holidays || ""),
          weekly_schedule: buildScheduleFromLegacy(v.weekly_schedule, v.checkup_start, v.checkup_end, v.weekly_holidays),
          account_owner_name: v.account_owner_name || "",
        }));
        setQualifications(res.qualifications || []);
        setDocuments(res.documents || []);
        setClinicContacts(res.clinic_contacts || []);
        setClinicVets(res.clinic_vets || []);
      })
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, []);

  const F = (key: any) => ({
    value: (form as any)[key],
    onChange: (e: any) => setForm((f: any) => ({ ...f, [key]: e.target.value })),
  });

  // Initialize the location picker map
  useEffect(() => {
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    import("leaflet").then((L: any) => {
      leafletRef.current = L.default || L;
      const Leaf = leafletRef.current;
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      pinIconRef.current = Leaf.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5S25 21.25 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#2563eb" stroke="white" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="white"/></svg>`,
        className: "",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      const initLat = parseFloat(form.latitude) || 23.8103;
      const initLng = parseFloat(form.longitude) || 90.4125;
      const hasInitialCoords = form.latitude && form.longitude;

      const map = Leaf.map(mapContainerRef.current, {
        center: [initLat, initLng],
        zoom: hasInitialCoords ? 15 : 7,
        zoomControl: true,
        attributionControl: false,
      });

      Leaf.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 },
      ).addTo(map);

      if (hasInitialCoords) {
        markerRef.current = Leaf.marker([initLat, initLng], {
          draggable: true,
          icon: pinIconRef.current,
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          setForm((f: any) => ({
            ...f,
            latitude: pos.lat.toFixed(6),
            longitude: pos.lng.toFixed(6),
          }));
        });
      }

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        setForm((f: any) => ({
          ...f,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }));
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Leaf.marker([lat, lng], {
            draggable: true,
            icon: pinIconRef.current,
          }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current.getLatLng();
            setForm((f: any) => ({
              ...f,
              latitude: pos.lat.toFixed(6),
              longitude: pos.lng.toFixed(6),
            }));
          });
        }
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast("Geolocation not supported", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos: any) => {
        const { latitude, longitude } = pos.coords;
        setForm((f: any) => ({
          ...f,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            const Leaf = leafletRef.current;
            markerRef.current = Leaf.marker([latitude, longitude], {
              draggable: true,
              icon: pinIconRef.current,
            }).addTo(mapInstanceRef.current);
            markerRef.current.on("dragend", () => {
              const p = markerRef.current.getLatLng();
              setForm((f: any) => ({
                ...f,
                latitude: p.lat.toFixed(6),
                longitude: p.lng.toFixed(6),
              }));
            });
          }
        }
      },
      () => {
        toast("Could not get your location", "error");
      },
      { enableHighAccuracy: true },
    );
  };

  const handleDeleteQual = async (id: any) => {
    if (!confirm("Delete this qualification?")) return;
    try {
      await adminAPI.deleteVetQualification(id);
      setQualifications((q: any) => q.filter((x: any) => x.id !== id));
      toast("Qualification deleted");
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDeleteContact = async (id: any) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await adminAPI.deleteClinicContact(id);
      setClinicContacts((c: any) => c.filter((x: any) => x.id !== id));
      toast("Contact deleted");
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDeleteClinicVet = async (id: any) => {
    if (!confirm("Remove this vet?")) return;
    try {
      await adminAPI.deleteClinicVet(id);
      setClinicVets((v: any) => v.filter((x: any) => x.id !== id));
      toast("Clinic vet removed");
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.location_name || !form.address) {
      setError("Name, location and address are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        services: form.services.split(",").map((s: any) => s.trim()).filter(Boolean),
        weekly_holidays: form.weekly_holidays ? form.weekly_holidays.split(",").map((s: any) => s.trim()).filter(Boolean) : [],
      };
      if (isEdit) {
        await adminAPI.updateVet(vet.id, data);
        toast("Vet updated!");
      } else {
        await adminAPI.createVet(data);
        toast("Vet clinic added!");
      }
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Button variant="ghost" size="sm" onClick={onCancel}>
          ← Back
        </Button>
        <SectionTitle>
          {isEdit ? "Edit Vet Clinic" : "Add New Vet Clinic"}
        </SectionTitle>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div
        style={{
          maxWidth: 700,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label className="label">Clinic Name *</label>
            <input className="input-field" placeholder="Name" {...F("name")} />
          </div>
          <div>
            <label className="label">Location/Area *</label>
            <input
              className="input-field"
              placeholder="e.g. Mirpur"
              {...F("location_name")}
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Clinic Location *</label>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Click on the map to set location, or drag the marker to adjust. You
            can also use your current location.
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
            >
              📍 Use Current Location
            </Button>
            {form.latitude && form.longitude && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Lat: {form.latitude}, Lng: {form.longitude}
              </span>
            )}
          </div>
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: 280,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Full Address *</label>
          <input
            className="input-field"
            placeholder="Full address"
            {...F("address")}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label className="label">Contact Number</label>
            <input
              className="input-field"
              placeholder="+880 ..."
              {...F("contact")}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input-field"
              type="email"
              placeholder="clinic@email.com"
              {...F("email")}
            />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label className="label">Website</label>
            <input className="input-field" placeholder="https://..." {...F("website")} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Account Owner Name</label>
          <input className="input-field" placeholder="Owner name" {...F("account_owner_name")} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label className="label">Checkup Start</label>
            <input className="input-field" type="time" {...F("checkup_start")} />
          </div>
          <div>
            <label className="label">Checkup End</label>
            <input className="input-field" type="time" {...F("checkup_end")} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Weekly Holidays (comma-separated) — legacy</label>
          <input className="input-field" placeholder="Friday, Saturday" {...F("weekly_holidays")} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Weekly Schedule (per-day hours)</label>
          <WeeklyScheduleEditor
            value={form.weekly_schedule}
            onChange={(next: any) => setForm((f: any) => ({ ...f, weekly_schedule: next }))}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Profile Image URL / Path</label>
          <input
            className="input-field"
            placeholder="https:// or /uploads/..."
            {...F("image")}
          />
          {form.image && (
            <img
              src={getAdminImageUrl(form.image)}
              alt="preview"
              style={{ marginTop: 6, height: 60, borderRadius: 6, objectFit: "cover" }}
              onError={(e: any) => ((e.target as any).style.display = "none")}
            />
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Cover Image URL / Path</label>
          <input
            className="input-field"
            placeholder="https:// or /uploads/..."
            {...F("cover_image")}
          />
          {form.cover_image && (
            <img
              src={getAdminImageUrl(form.cover_image)}
              alt="cover preview"
              style={{ marginTop: 6, height: 60, width: "100%", borderRadius: 6, objectFit: "cover" }}
              onError={(e: any) => ((e.target as any).style.display = "none")}
            />
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Description</label>
          <textarea
            className="input-field"
            rows={3}
            style={{ resize: "vertical" }}
            placeholder="About this clinic..."
            {...F("description")}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Services (comma-separated)</label>
          <input
            className="input-field"
            placeholder="Vaccination, Surgery, Grooming"
            {...F("services")}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <Button variant="accent" loading={saving} onClick={handleSubmit}>
            {isEdit ? "Update Vet" : "Add Vet"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {/* Sub-table management — only in edit mode */}
        {isEdit && !loadingDetails && (
          <div style={{ marginTop: 8 }}>
            {/* Documents */}
            {documents.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  Uploaded Documents
                </div>
                {documents.map((d: any) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.doc_type}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.original_name || d.file_path}</div>
                    </div>
                    <a
                      href={getAdminImageUrl(d.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                    >
                      View ↗
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Clinic Contacts */}
            {clinicContacts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  Clinic Contacts
                </div>
                {clinicContacts.map((c: any) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.contact_type}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.contact_value}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteContact(c.id)}>Delete</Button>
                  </div>
                ))}
              </div>
            )}

            {/* Clinic Vets */}
            {clinicVets.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  Clinic Vets
                </div>
                {clinicVets.map((cv: any) => (
                  <div key={cv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, marginBottom: 6, gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {cv.vet_image && (
                        <img
                          src={getAdminImageUrl(cv.vet_image)}
                          alt={cv.name}
                          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                          onError={(e: any) => ((e.target as any).style.display = "none")}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{cv.name}</div>
                        {cv.designation && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{cv.designation}</div>}
                        {cv.bvc_reg_number && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>BVC: {cv.bvc_reg_number}</div>}
                        {cv.bmdc_reg_number && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>BMDC: {cv.bmdc_reg_number}</div>}
                        {Array.isArray(cv.qualifications) && cv.qualifications.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                            {cv.qualifications.map((q: any) => q.qualification).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteClinicVet(cv.id)}>Remove</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── USERS ────────────────────────────────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const { toast } = useToast();
  const { can } = useAuth();
  const LIMIT = 15;

  // Per-page UI permissions (admin → all true via can()).
  const canReset = can("users.reset_password");
  const canDeactivate = can("users.deactivate");
  const canRole = can("users.role");
  const showActions = canReset || canDeactivate || canRole;

  // Assignable roles for the inline role dropdown. admin is intentionally
  // excluded — it cannot be assigned via the dashboard (backend also rejects it).
  useEffect(() => {
    if (!canRole) return;
    adminAPI
      .getRoles()
      .then((r: any) => setRoleOptions((r.roles || []).filter((x: any) => x.name !== "admin")))
      .catch(() => {});
  }, [canRole]);

  const handleAssignRole = async (id: any, role: any) => {
    try {
      await adminAPI.assignUserRole(id, role);
      toast("Role updated", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const load = (p = page, s = search) => {
    setLoading(true);
    adminAPI
      .getUsers({ page: p, limit: LIMIT, ...(s ? { search: s } : {}) })
      .then((r: any) => {
        setUsers(r.users || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDeactivate = async (id: any) => {
    if (!confirm("Deactivate this user?")) return;
    try {
      await adminAPI.deleteUser(id);
      toast("User deactivated");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleActivate = async (id: any) => {
    if (!confirm("Activate this user?")) return;
    try {
      await adminAPI.updateUser(id, { is_active: true });
      toast("User activated");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }
    setResetting(true);
    try {
      await adminAPI.resetUserPassword(resetTarget.id, newPassword);
      toast(`Password reset for ${resetTarget.name}`, "success");
      setResetTarget(null);
      setNewPassword("");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <SectionTitle>Manage Users</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name, phone or email..." style={{ flex: 1 }} />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <TableWrapper title={`All Users (${total})`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <Tr header>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Pets</Th>
                  <Th>Status</Th>
                  {showActions && <Th>Actions</Th>}
                </Tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <Tr key={u.id}>
                    <Td bold>{u.name}</Td>
                    <Td>{u.phone}</Td>
                    <Td>{u.email || "–"}</Td>
                    <Td>
                      <Badge color={u.role === "admin" ? "gold" : "accent"}>
                        {u.role}
                      </Badge>
                    </Td>
                    <Td>{u.pet_count}</Td>
                    <Td>
                      <Badge color={u.is_active ? "accent" : "danger"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    {showActions && (
                      <Td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {canReset && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setResetTarget(u); setNewPassword(""); }}
                            >
                              🔑 Reset PW
                            </Button>
                          )}
                          {canRole && u.role !== "admin" && (
                            <select
                              className="input-field"
                              value={u.role}
                              onChange={(e: any) => handleAssignRole(u.id, e.target.value)}
                              style={{ height: 30, padding: "0 8px", fontSize: 12, width: "auto" }}
                              title="Assign role"
                            >
                              {/* Ensure the user's current role is selectable even if not in options */}
                              {!roleOptions.find((r: any) => r.name === u.role) && (
                                <option value={u.role}>{u.role}</option>
                              )}
                              {roleOptions.map((r: any) => (
                                <option key={r.name} value={r.name}>{r.name}</option>
                              ))}
                            </select>
                          )}
                          {canDeactivate && u.role !== "admin" &&
                            (u.is_active ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeactivate(u.id)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => handleActivate(u.id)}
                              >
                                Activate
                              </Button>
                            ))}
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={(p: any) => {
              setPage(p);
              load(p);
            }}
          />
        </>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setResetTarget(null)}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400 }}>
            <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 8 }}>Reset Password</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Set new password for <strong style={{ color: "var(--text-primary)" }}>{resetTarget.name}</strong> ({resetTarget.phone})
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>New Password</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e: any) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="primary" onClick={handleResetPassword} disabled={resetting} style={{ flex: 1 }}>
                {resetting ? "Saving..." : "Set Password"}
              </Button>
              <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────
function ReviewsSection() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const { toast } = useToast();
  const { can } = useAuth();
  const canDelete = can("reviews.delete");
  const LIMIT = 15;

  const load = (p = page, s = search) => {
    setLoading(true);
    reviewsAPI
      .getAll({ page: p, limit: LIMIT, ...(s ? { search: s } : {}) })
      .then((r: any) => {
        setReviews(r.reviews || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this review?")) return;
    try {
      await reviewsAPI.delete(id);
      toast("Review deleted");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div>
      <SectionTitle>Manage Reviews</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by user, clinic or comment..." style={{ flex: 1 }} />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <TableWrapper title={`All Reviews (${total})`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <Tr header>
                  <Th>User</Th>
                  <Th>Clinic</Th>
                  <Th>Rating</Th>
                  <Th>Comment</Th>
                  <Th>Date</Th>
                  {canDelete && <Th>Action</Th>}
                </Tr>
              </thead>
              <tbody>
                {reviews.map((r: any) => (
                  <Tr key={r.id}>
                    <Td bold>{r.user_name}</Td>
                    <Td>{r.vet_name}</Td>
                    <Td>
                      <span style={{ color: "var(--gold)" }}>
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </span>
                    </Td>
                    <Td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.comment || "–"}
                    </Td>
                    <Td>
                      {new Date(r.created_at).toLocaleDateString("en-BD")}
                    </Td>
                    {canDelete && (
                      <Td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(r.id)}
                        >
                          Delete
                        </Button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={(p: any) => {
              setPage(p);
              load(p);
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── DONATION ─────────────────────────────────────────────────────────────
function DonationSection() {
  const [don, setDon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [qrPreview, setQrPreview] = useState<any>(null);
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("donation.edit");

  useEffect(() => {
    donationsAPI
      .get()
      .then((r: any) => {
        const donation = r.donation || { id: 1, title: "", message: "", qr_code_image_url: "" };
        setDon(donation);
        if (donation.qr_code_image_url) {
          setQrPreview(getImageUrl(donation.qr_code_image_url));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleQrChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setDon((d: any) => ({ ...d, qr_code_image: file }));
      const reader = new FileReader();
      reader.onload = (ev: any) => setQrPreview(ev.target?.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (don.id) {
        await donationsAPI.update(don.id, don);
      } else {
        await donationsAPI.create(don);
      }
      toast("Donation info saved!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <SectionTitle>Donation Settings</SectionTitle>
      <div
        style={{
          maxWidth: 540,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
        }}
      >
        {saved && <Alert type="success">Settings saved successfully!</Alert>}
        <div style={{ marginBottom: 14 }}>
          <label className="label">Donation Title</label>
          <input
            className="input-field"
            value={don?.title || ""}
            onChange={(e: any) => setDon((d: any) => ({ ...d, title: e.target.value }))}
            placeholder="Support Pawliz"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Donation Message</label>
          <textarea
            className="input-field"
            rows={4}
            style={{ resize: "vertical" }}
            value={don?.message || ""}
            onChange={(e: any) => setDon((d: any) => ({ ...d, message: e.target.value }))}
            placeholder="Your donation helps..."
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="label">QR Code Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleQrChange}
            className="input-field"
          />
          {qrPreview && (
            <div
              style={{
                marginTop: 10,
                width: 120,
                height: 120,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--border-accent)",
              }}
            >
              <img
                src={qrPreview}
                alt="QR Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
        </div>
        {canEdit && (
          <Button variant="accent" loading={saving} onClick={handleSave}>
            Save Donation Info
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────
function SettingsSection() {
  const [settings, setSettings] = useState({ logo_text: "", logo_image: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("settings.edit");

  useEffect(() => {
    adminAPI
      .getSettings()
      .then((r: any) => setSettings(r.settings || {}))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateSettings(settings);
      toast("Settings saved!");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <SectionTitle>Site Settings</SectionTitle>
      <div
        style={{
          maxWidth: 500,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <label className="label">Logo Text</label>
          <input
            className="input-field"
            value={settings.logo_text || ""}
            onChange={(e: any) =>
              setSettings((s: any) => ({ ...s, logo_text: e.target.value }))
            }
            placeholder="Pawliz"
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label className="label">Logo Image URL</label>
          <input
            className="input-field"
            value={settings.logo_image || ""}
            onChange={(e: any) =>
              setSettings((s: any) => ({ ...s, logo_image: e.target.value }))
            }
            placeholder="https://..."
          />
        </div>
        {canEdit && (
          <Button variant="accent" loading={saving} onClick={handleSave}>
            Save Settings
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── TABLE HELPERS ────────────────────────────────────────────────────────
// ─── ROLE MANAGER (RBAC) ─────────────────────────────────────────────────────
function RolesSection() {
  const [roles, setRoles] = useState<any[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null); // role object or {} for create
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([adminAPI.getRoles(), adminAPI.getPermissionRegistry()])
      .then(([r, reg]) => {
        setRoles(r.roles || []);
        setRegistry(reg.pages || []);
      })
      .catch((e: any) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (role: any) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteRole(role.name);
      toast("Role deleted");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const pageCount = (role: any) =>
    Array.isArray(role.permissions?.pages) ? role.permissions.pages.length : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle>Role Manager</SectionTitle>
        <Button variant="accent" onClick={() => setEditing({})}>+ Create Role</Button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -14, marginBottom: 20 }}>
        Create roles with specific dashboard page access. Assign them to users in Manage Users.
        The <strong>admin</strong> role has full access and is managed directly in the database.
      </p>
      {loading ? (
        <Loading />
      ) : (
        <TableWrapper title={`All Roles (${roles.length})`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <Tr header>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Pages</Th>
                <Th>Users</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {roles.map((r: any) => (
                <Tr key={r.name}>
                  <Td bold>
                    {r.name}{" "}
                    {r.is_system && <Badge color="gray">System</Badge>}
                  </Td>
                  <Td>{r.description || "–"}</Td>
                  <Td>{r.is_system && r.name === "admin" ? "all" : pageCount(r)}</Td>
                  <Td>{r.user_count}</Td>
                  <Td>
                    {r.is_system ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(r)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      )}

      {editing && (
        <RoleEditorModal
          role={editing.name ? editing : null}
          registry={registry}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Create / edit modal with a page→ui checkbox tree.
function RoleEditorModal({ role, registry, onClose, onSaved }: any) {
  const isEdit = !!role;
  const { toast } = useToast();
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [pages, setPages] = useState(
    () => new Set(role?.permissions?.pages || []),
  );
  const [ui, setUi] = useState(() => new Set(role?.permissions?.ui || []));
  const [saving, setSaving] = useState(false);

  const togglePage = (key: any) => {
    setPages((prev: any) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Drop this page's UI flags when the page is removed.
        const pg = registry.find((p: any) => p.key === key);
        if (pg) setUi((u: any) => {
          const nu = new Set(u);
          (pg.ui || []).forEach((f: any) => nu.delete(f.key));
          return nu;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleUi = (flagKey: any) => {
    setUi((prev: any) => {
      const next = new Set(prev);
      next.has(flagKey) ? next.delete(flagKey) : next.add(flagKey);
      return next;
    });
  };

  const save = async () => {
    const payload = {
      description,
      permissions: { pages: [...pages], ui: [...ui] },
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminAPI.updateRole(role.name, payload);
        toast("Role updated", "success");
      } else {
        await adminAPI.createRole({ name: name.trim().toLowerCase(), ...payload });
        toast("Role created", "success");
      }
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}
      >
        <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 18 }}>
          {isEdit ? `Edit Role: ${role.name}` : "Create Role"}
        </h3>

        {!isEdit && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
              Role Name
            </label>
            <input
              className="input-field"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="e.g. manager"
              autoFocus
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Lowercase letters, digits, _ or - (2–50 chars).
            </span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
            Description
          </label>
          <input
            className="input-field"
            value={description}
            onChange={(e: any) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 10, textTransform: "uppercase" }}>
          Page Access & Permissions
        </label>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 22 }}>
          {registry.map((pg: any) => {
            const pageOn = pages.has(pg.key);
            return (
              <div key={pg.key} style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                  <input type="checkbox" checked={pageOn} onChange={() => togglePage(pg.key)} />
                  {pg.icon} {pg.label}
                </label>
                {(pg.ui || []).length > 0 && (
                  <div style={{ paddingLeft: 26, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                    {pg.ui.map((f: any) => (
                      <label
                        key={f.key}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: pageOn ? "pointer" : "not-allowed", fontSize: 13, color: pageOn ? "var(--text-secondary)" : "var(--text-muted)", opacity: pageOn ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          disabled={!pageOn}
                          checked={ui.has(f.key)}
                          onChange={() => toggleUi(f.key)}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="accent" onClick={save} disabled={saving || (!isEdit && !name.trim())} style={{ flex: 1 }}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Role"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function TableWrapper({ title, children }: any) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          fontFamily: "Roboto, sans-serif",
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}
function SectionTitle({ children }: any) {
  return (
    <div
      style={{
        fontFamily: "Roboto, sans-serif",
        fontWeight: 800,
        fontSize: 22,
        color: "var(--text-primary)",
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}
function Tr({ children, header }: any) {
  return (
    <tr
      style={{
        background: header ? "var(--bg-elevated)" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e: any) => {
        if (!header) e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e: any) => {
        if (!header) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </tr>
  );
}
// ─── PETS SECTION ──────────────────────────────────────────────────────────
function PetsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("pets.edit");
  const canDelete = can("pets.delete");
  const showActions = canEdit || canDelete;
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const searchRef = useRef(false);
  const [editPet, setEditPet] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async (p = page, s = search, t = typeFilter) => {
    setLoading(true);
    try {
      const data = await adminAPI.getPets({ page: p, limit: 20, search: s, type: t });
      setPets(data.pets || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load pets", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1, search, typeFilter); }, []);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search, typeFilter); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openEdit = (pet: any) => { setEditPet(pet); setEditForm({ name: pet.name, type: pet.type, breed: pet.breed || "", gender: pet.gender || "", age: pet.age || "", color: pet.color || "", weight: pet.weight || "", status: pet.is_for_adoption ? 'adoption' : (pet.status || 'active') }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updatePet(editPet.id, editForm);
      toast("Pet updated", "success");
      setEditPet(null);
      load(page, search, typeFilter);
    } catch (err: any) { toast(err.message || "Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm("Deactivate this pet?")) return;
    try {
      await adminAPI.deletePet(id);
      toast("Pet deactivated", "success");
      load(page, search, typeFilter);
    } catch { toast("Failed to deactivate", "error"); }
  };

  return (
    <div>
      <SectionTitle>Manage Pets</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Input
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          placeholder="Search by name or Pet ID..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          value={typeFilter}
          onChange={(e: any) => { const t = e.target.value; setTypeFilter(t); setPage(1); load(1, search, t); }}
          className="input-field"
          style={{ width: 130 }}
        >
          <option value="">All Types</option>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
          <option value="other">Other</option>
        </select>
      </div>
      {loading ? <Loading /> : pets.length === 0 ? <EmptyState>No pets found</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><Tr header><Th>Pet ID</Th><Th>Name</Th><Th>Type</Th><Th>Owner</Th><Th>Status</Th>{showActions && <Th>Actions</Th>}</Tr></thead>
            <tbody>
              {pets.map((p: any) => (
                <Tr key={p.id}>
                  <Td><code style={{ fontSize: 11 }}>{p.pet_id}</code></Td>
                  <Td bold>{p.name}</Td>
                  <Td>{p.type?.charAt(0).toUpperCase() + p.type?.slice(1)}</Td>
                  <Td>{p.owner_name}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.owner_phone}</span></Td>
                  <Td>
                    <Badge variant={p.is_active ? (p.is_lost ? "warning" : p.is_for_adoption ? "info" : "success") : "danger"}>
                      {p.is_active ? (p.is_lost ? "Lost" : p.is_for_adoption ? "Adoption" : "Active") : "Inactive"}
                    </Badge>
                  </Td>
                  {showActions && (
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>}
                        {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={20} onChange={(p: any) => { setPage(p); load(p, search, typeFilter); }} />
        </div>
      )}
      {editPet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEditPet(null)}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 20 }}>Edit Pet — {editPet.name}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[["name","Name"],["breed","Breed"],["color","Color"]].map(([k,l]) => (
                <div key={k}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>{l}</label>
                <Input value={editForm[k] || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Type</label>
              <select className="input-field" value={editForm.type || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, type: e.target.value }))}>
                <option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Gender</label>
              <select className="input-field" value={editForm.gender || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}>
                <option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Age (years)</label>
              <Input type="number" value={editForm.age || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, age: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Weight (kg)</label>
              <Input type="number" step="0.1" value={editForm.weight || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, weight: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Status</label>
              <select className="input-field" value={editForm.status || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option><option value="lost">Lost</option><option value="safe">Safe</option><option value="adoption">For Adoption</option>
              </select></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Button variant="primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="ghost" onClick={() => setEditPet(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOST PETS SECTION ─────────────────────────────────────────────────────
function LostPetsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  // Mark-active goes through the shared pets update route → gated by pets.edit.
  const canEdit = can("pets.edit");
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [saving, setSaving] = useState<any>(null);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const data = await adminAPI.getPets({ page: p, limit: 20, filter: 'lost', ...(s ? { search: s } : {}) });
      setPets(data.pets || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load lost pets", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleMarkActive = async (pet: any) => {
    setSaving(pet.id);
    try {
      await adminAPI.updatePet(pet.id, { status: 'active' });
      toast(`${pet.name} marked as active`, "success");
      load(page, search);
    } catch (err: any) { toast(err.message || "Failed", "error"); }
    finally { setSaving(null); }
  };

  return (
    <div>
      <SectionTitle>Lost Pets</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name or Pet ID..." style={{ flex: 1 }} />
      </div>
      {loading ? <Loading /> : pets.length === 0 ? <EmptyState>No lost pets found</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><Tr header><Th>Pet ID</Th><Th>Name</Th><Th>Type</Th><Th>Owner</Th>{canEdit && <Th>Actions</Th>}</Tr></thead>
            <tbody>
              {pets.map((p: any) => (
                <Tr key={p.id}>
                  <Td><code style={{ fontSize: 11 }}>{p.pet_id}</code></Td>
                  <Td bold>{p.name}</Td>
                  <Td>{p.type?.charAt(0).toUpperCase() + p.type?.slice(1)}</Td>
                  <Td>{p.owner_name}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.owner_phone}</span></Td>
                  {canEdit && (
                    <Td>
                      <Button size="sm" variant="accent" disabled={saving === p.id} onClick={() => handleMarkActive(p)}>{saving === p.id ? "..." : "Mark Active"}</Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={20} onChange={(p: any) => { setPage(p); load(p, search); }} />
        </div>
      )}
    </div>
  );
}

// ─── ADOPTABLE PETS SECTION ────────────────────────────────────────────────
function AdoptablePetsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  // Remove-from-adoption goes through the shared pets update route → pets.edit.
  const canEdit = can("pets.edit");
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [saving, setSaving] = useState<any>(null);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const data = await adminAPI.getPets({ page: p, limit: 20, filter: 'adoption', ...(s ? { search: s } : {}) });
      setPets(data.pets || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load adoptable pets", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleRemoveAdoption = async (pet: any) => {
    if (!window.confirm(`Remove ${pet.name} from adoption?`)) return;
    setSaving(pet.id);
    try {
      await adminAPI.updatePet(pet.id, { status: 'active' });
      toast(`${pet.name} removed from adoption`, "success");
      load(page, search);
    } catch (err: any) { toast(err.message || "Failed", "error"); }
    finally { setSaving(null); }
  };

  return (
    <div>
      <SectionTitle>Adoptable Pets</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name or Pet ID..." style={{ flex: 1 }} />
      </div>
      {loading ? <Loading /> : pets.length === 0 ? <EmptyState>No adoptable pets found</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><Tr header><Th>Pet ID</Th><Th>Name</Th><Th>Type</Th><Th>Breed</Th><Th>Owner</Th>{canEdit && <Th>Actions</Th>}</Tr></thead>
            <tbody>
              {pets.map((p: any) => (
                <Tr key={p.id}>
                  <Td><code style={{ fontSize: 11 }}>{p.pet_id}</code></Td>
                  <Td bold>{p.name}</Td>
                  <Td>{p.type?.charAt(0).toUpperCase() + p.type?.slice(1)}</Td>
                  <Td>{p.breed || "—"}</Td>
                  <Td>{p.owner_name}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.owner_phone}</span></Td>
                  {canEdit && (
                    <Td>
                      <Button size="sm" variant="danger" disabled={saving === p.id} onClick={() => handleRemoveAdoption(p)}>{saving === p.id ? "..." : "Remove Adoption"}</Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={20} onChange={(p: any) => { setPage(p); load(p, search); }} />
        </div>
      )}
    </div>
  );
}

// ─── FOUND PETS SECTION ────────────────────────────────────────────────────
function FoundPetsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("found-pets.edit");
  const canDelete = can("found-pets.delete");
  const showActions = canEdit || canDelete;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [editPost, setEditPost] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const data = await adminAPI.getFoundPets({ page: p, limit: 20, ...(s ? { search: s } : {}) });
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load found reports", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openEdit = (post: any) => {
    setEditPost(post);
    setEditForm({ pet_type: post.pet_type || "", color: post.color || "", gender: post.gender || "", breed: post.breed || "", found_location_name: post.found_location_name || "", description: post.description || "", status: post.status || "found" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateFoundPet(editPost.id, editForm);
      toast("Report updated", "success");
      setEditPost(null);
      load(page);
    } catch (err: any) { toast(err.message || "Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm("Delete this found report?")) return;
    try {
      await adminAPI.deleteFoundPet(id);
      toast("Report deleted", "success");
      load(page);
    } catch { toast("Failed to delete", "error"); }
  };

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div>
      <SectionTitle>Found Pet Reports</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by type, location, breed..." style={{ flex: 1 }} />
      </div>
      {loading ? <Loading /> : posts.length === 0 ? <EmptyState>No found reports</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><Tr header><Th>Type</Th><Th>Breed / Color</Th><Th>Location</Th><Th>Date</Th><Th>Reporter</Th><Th>Status</Th>{showActions && <Th>Actions</Th>}</Tr></thead>
            <tbody>
              {posts.map((p: any) => (
                <Tr key={p.id}>
                  <Td bold>{p.pet_type?.charAt(0).toUpperCase() + p.pet_type?.slice(1)}</Td>
                  <Td>{p.breed || "—"} / {p.color || "—"}</Td>
                  <Td>{p.found_location_name || "—"}</Td>
                  <Td>{formatDate(p.found_date)}</Td>
                  <Td>{p.reporter_name}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.reporter_phone}</span></Td>
                  <Td><Badge variant={p.status === "resolved" ? "success" : "warning"}>{p.status}</Badge></Td>
                  {showActions && (
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>}
                        {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={20} onChange={(p: any) => { setPage(p); load(p); }} />
        </div>
      )}
      {editPost && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEditPost(null)}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 20 }}>Edit Found Report</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Pet Type</label>
              <select className="input-field" value={editForm.pet_type || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, pet_type: e.target.value }))}>
                <option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Gender</label>
              <select className="input-field" value={editForm.gender || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}>
                <option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option>
              </select></div>
              {[["breed","Breed"],["color","Color"],["found_location_name","Location"]].map(([k,l]) => (
                <div key={k}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>{l}</label>
                <Input value={editForm[k] || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div style={{ gridColumn: "1/-1" }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Description</label>
              <textarea className="input-field" rows={3} value={editForm.description || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Status</label>
              <select className="input-field" value={editForm.status || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                <option value="found">Found</option><option value="resolved">Resolved</option>
              </select></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Button variant="primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="ghost" onClick={() => setEditPost(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RESCUE PETS SECTION ───────────────────────────────────────────────────
const URGENCY_COLORS = { low: "#00e5a0", medium: "#f0a500", high: "#ff6b35", critical: "#ff4f6a" };

function RescuePetsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("rescue-pets.edit");
  const canDelete = can("rescue-pets.delete");
  const showActions = canEdit || canDelete;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [editPost, setEditPost] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const data = await adminAPI.getRescuePets({ page: p, limit: 20, ...(s ? { search: s } : {}) });
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch { toast("Failed to load rescue reports", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openEdit = (post: any) => {
    setEditPost(post);
    setEditForm({ pet_type: post.pet_type || "", color: post.color || "", gender: post.gender || "", breed: post.breed || "", rescue_location_name: post.rescue_location_name || "", description: post.description || "", urgency: post.urgency || "medium", status: post.status || "active" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateRescuePet(editPost.id, editForm);
      toast("Report updated", "success");
      setEditPost(null);
      load(page);
    } catch (err: any) { toast(err.message || "Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm("Delete this rescue report?")) return;
    try {
      await adminAPI.deleteRescuePet(id);
      toast("Report deleted", "success");
      load(page);
    } catch { toast("Failed to delete", "error"); }
  };

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div>
      <SectionTitle>Rescue Reports</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by type, location, breed..." style={{ flex: 1 }} />
      </div>
      {loading ? <Loading /> : posts.length === 0 ? <EmptyState>No rescue reports</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><Tr header><Th>Type</Th><Th>Breed / Color</Th><Th>Location</Th><Th>Date</Th><Th>Urgency</Th><Th>Reporter</Th><Th>Status</Th>{showActions && <Th>Actions</Th>}</Tr></thead>
            <tbody>
              {posts.map((p: any) => (
                <Tr key={p.id}>
                  <Td bold>{p.pet_type?.charAt(0).toUpperCase() + p.pet_type?.slice(1)}</Td>
                  <Td>{p.breed || "—"} / {p.color || "—"}</Td>
                  <Td>{p.rescue_location_name || "—"}</Td>
                  <Td>{formatDate(p.rescue_date)}</Td>
                  <Td><span style={{ color: (URGENCY_COLORS as any)[p.urgency] || URGENCY_COLORS.medium, fontWeight: 700, fontSize: 12 }}>{p.urgency?.toUpperCase()}</span></Td>
                  <Td>{p.reporter_name}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.reporter_phone}</span></Td>
                  <Td><Badge variant={p.status === "rescued" ? "success" : p.status === "resolved" ? "info" : "warning"}>{p.status}</Badge></Td>
                  {showActions && (
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>}
                        {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} pageSize={20} onChange={(p: any) => { setPage(p); load(p); }} />
        </div>
      )}
      {editPost && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEditPost(null)}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 20 }}>Edit Rescue Report</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Pet Type</label>
              <select className="input-field" value={editForm.pet_type || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, pet_type: e.target.value }))}>
                <option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Urgency</label>
              <select className="input-field" value={editForm.urgency || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, urgency: e.target.value }))}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Gender</label>
              <select className="input-field" value={editForm.gender || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}>
                <option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option>
              </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Status</label>
              <select className="input-field" value={editForm.status || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option><option value="rescued">Rescued</option><option value="resolved">Resolved</option>
              </select></div>
              {[["breed","Breed"],["color","Color"],["rescue_location_name","Location"]].map(([k,l]) => (
                <div key={k}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>{l}</label>
                <Input value={editForm[k] || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div style={{ gridColumn: "1/-1" }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Description</label>
              <textarea className="input-field" rows={3} value={editForm.description || ""} onChange={(e: any) => setEditForm((f: any) => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Button variant="primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="ghost" onClick={() => setEditPost(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMMENTS MANAGEMENT ──────────────────────────────────────────────────
function CommentsManagementSection() {
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

// ─── REPORTED COMMUNITY POSTS ───────────────────────────────────────────────
function CommunityPostsManagementSection() {
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

function Th({ children }: any) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
function Td({ children, bold, style }: any) {
  return (
    <td
      style={{
        padding: "13px 16px",
        fontSize: 13,
        color: bold ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: bold ? 600 : 400,
        borderBottom: "1px solid var(--border)",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

// ─── CLAIM REQUESTS ────────────────────────────────────────────────────────
function ClaimRequestsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canAct = can("claim-requests.edit");
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getClaimRequests();
      setClaims(data.claims);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handle = async (vetId: any, action: any) => {
    setActing(vetId);
    try {
      if (action === "approve") await adminAPI.approveClaimRequest(vetId);
      else await adminAPI.rejectClaimRequest(vetId);
      toast(action === "approve" ? "Claim approved" : "Claim rejected", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <Loading />;
  if (!claims.length) return <EmptyState title="No pending claim requests" />;

  return (
    <TableWrapper title="Pending Claim Requests">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th>Vet / Clinic</Th>
            <Th>Requested By</Th>
            <Th>Contact</Th>
            <Th>Requested At</Th>
            <Th>Documents</Th>
            {canAct && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {claims.map((c: any) => (
            <Tr key={c.id}>
              <Td>{c.name || c.clinic_name}</Td>
              <Td>{c.requester_name}</Td>
              <Td>
                {c.requester_phone}
                <br />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.email}</span>
              </Td>
              <Td>{new Date(c.claim_requested_at).toLocaleDateString()}</Td>
              <Td>
                {c.documents?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {c.documents.map((d: any, i: any) => (
                      <a
                        key={i}
                        href={`${API_SERVER}${d.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                      >
                        {d.doc_type.replace(/_/g, " ")} — {d.original_name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>No docs</span>
                )}
              </Td>
              {canAct && (
                <Td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button size="sm" variant="accent" loading={acting === c.id} onClick={() => handle(c.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="danger" loading={acting === c.id} onClick={() => handle(c.id, "reject")}>Reject</Button>
                  </div>
                </Td>
              )}
            </Tr>
          ))}
        </tbody>
      </table>
    </TableWrapper>
  );
}

// ─── SMS SETTINGS ──────────────────────────────────────────────────────────
function SmsSettingsSection() {
  const { can } = useAuth();
  const canEdit = can("sms-settings.edit");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [adminPhone, setAdminPhone] = useState("");
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchSettings = async () => {
    try {
      const data = await adminAPI.getSmsSettings();
      setSmsEnabled(data.sms_enabled);
      setAdminPhone(data.admin_phone || "");
    } catch {
      setError("Failed to load SMS settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const data = await adminAPI.getSmsBalance();
      setBalance(data.balance);
    } catch {
      setBalance({ error: "Failed to fetch balance" });
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBalance();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adminAPI.updateSmsSettings({ sms_enabled: smsEnabled, admin_phone: adminPhone });
      setSuccess("SMS settings saved successfully.");
    } catch {
      setError("Failed to save SMS settings");
    } finally {
      setSaving(false);
    }
  };

  const cardStyle: any = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, fontFamily: "Syne, sans-serif" }}>SMS Update</h2>

      {/* Balance Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>SMS Balance</span>
          <button
            type="button"
            onClick={fetchBalance}
            disabled={balanceLoading}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "var(--accent)", fontFamily: "DM Sans, sans-serif" }}
          >
            {balanceLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {balance ? (
          <pre style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-elevated)", borderRadius: 8, padding: 12, overflowX: "auto", margin: 0 }}>
            {JSON.stringify(balance, null, 2)}
          </pre>
        ) : (
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>Loading balance...</p>
        )}
      </div>

      {/* Settings Card */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Enable SMS OTP Verification</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                When disabled, users can register without OTP verification.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSmsEnabled((v: any) => !v)}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                background: smsEnabled ? "var(--accent)" : "var(--bg-elevated)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: smsEnabled ? 24 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: smsEnabled ? "#000" : "var(--text-secondary)",
                  transition: "left 0.2s",
                  display: "block",
                }}
              />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>
            Admin Phone Number
          </label>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, marginTop: 0 }}>
            Admin receives SMS when a vet/clinic is claimed. Format: 01XXXXXXXXX
          </p>
          <input
            type="tel"
            value={adminPhone}
            onChange={(e: any) => setAdminPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            maxLength={11}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--bg-input, var(--bg-elevated))",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "DM Sans, sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>{error}</p>}
        {success && <p style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10 }}>{success}</p>}

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              background: "var(--accent)",
              border: "none",
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "DM Sans, sans-serif",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </div>
    </div>
  );
}
