import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function PetsSection() {
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