import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function VetsSection() {
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