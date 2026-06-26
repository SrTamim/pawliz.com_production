import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function LostPetsSection() {
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