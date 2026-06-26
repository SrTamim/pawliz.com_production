import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

const URGENCY_COLORS = { low: "#00e5a0", medium: "#f0a500", high: "#ff6b35", critical: "#ff4f6a" };
export default function RescuePetsSection() {
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