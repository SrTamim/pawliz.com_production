import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { petsAPI } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import ImageGallery from "../UI/ImageGallery";
import LostPetModal from "./LostPetModal";
import AdoptionModal from "./AdoptionModal";

// TABS are now derived from translation in the component

// ── Vaccination due-status helper (client-side, vs today) ──────────────────
// Returns { kind, days } where kind is "overdue" | "soon" | "ok" | "none".
// No next-due date → one-time vaccine, treated as Done (green). A due date drives
// overdue / due-soon / ok states.
function vaccineDueStatus(nextDue: any): { kind: "overdue" | "soon" | "ok" | "done"; days: number } {
  if (!nextDue) return { kind: "done", days: 0 };
  const due = new Date(nextDue);
  if (isNaN(due.getTime())) return { kind: "done", days: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= 30) return { kind: "soon", days };
  return { kind: "ok", days };
}

const DUE_BADGE: Record<string, { bg: string; color: string; dot: string }> = {
  overdue: { bg: "rgba(255,79,106,0.12)", color: "var(--danger)", dot: "🔴" },
  soon: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", dot: "🟡" },
  ok: { bg: "rgba(0,230,118,0.10)", color: "var(--accent)", dot: "🟢" },
  done: { bg: "rgba(0,230,118,0.10)", color: "var(--accent)", dot: "✅" },
};

const EMPTY_PET = {
  name: "",
  type: "dog",
  breed: "",
  gender: "",
  age: "",
  color: "",
  weight: "",
  medical_conditions: "",
  allergies: "",
  current_medicines: "",
  temperament: "",
  potty_trained: null,
  knows_commands: null,
  good_with_strangers: null,
  good_with_kids: null,
  good_with_pets: null,
  special_notes: "",
  images: [],
  food_types: "",
  meals_per_day: "",
  dietary_restrictions: "",
  appetite_notes: "",
};

export function AddPetCard({ onCreated, hideTrigger = false, onClose }: any) {
  const { toast } = useToast();
  const { t } = useTranslation("pets");
  const [open, setOpen] = useState(hideTrigger);
  const [form, setForm] = useState(EMPTY_PET);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);

  const set = (k: any, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast("Pet name is required", "error");
      return;
    }
    if (!form.type) {
      toast("Pet type is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await petsAPI.create(form);
      toast(`${form.name} added successfully! 🐾`, "success");
      onCreated(res.pet);
      setOpen(false);
      setForm(EMPTY_PET);
      setTab(0);
      onClose?.();
    } catch (err: any) {
      toast(err.message || "Failed to add pet", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    if (hideTrigger) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "var(--bg-card)",
          border: "2px dashed var(--border)",
          borderRadius: "var(--radius)",
          padding: "32px 24px",
          width: "100%",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          transition: "all 0.2s",
          color: "var(--text-muted)",
        }}
        onMouseEnter={(e: any) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.background = "rgba(0,230,118,0.04)";
        }}
        onMouseLeave={(e: any) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.background = "var(--bg-card)";
        }}
      >
        <span style={{ fontSize: 32 }}>🐾</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: "var(--text-primary)",
          }}
        >
          {t("addNewPet")}
        </span>
        <span style={{ fontSize: 13 }}>{t("registerAnotherPet")}</span>
      </button>
    );
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            color: "var(--text-primary)",
          }}
        >
          {t("newPetProfile")}
        </div>
        <button onClick={() => { setOpen(false); onClose?.(); }} style={iconBtnStyle}>
          ✕
        </button>
      </div>
      <PetForm
        form={form}
        setField={set}
        tab={tab}
        setTab={setTab}
        isNew
        uploadingImages={false}
        imagesInputRef={{ current: null }}
        handleImagesUpload={() => {}}
        handleDeleteImageInForm={() => {}}
        vaccinations={[]}
        weightLogs={[]}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={() => setOpen(false)} style={cancelBtnStyle}>
          {t("common:buttons.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={saveBtnStyle(saving)}
        >
          {saving ? t("common:buttons.saving") : t("addPetBtn")}
        </button>
      </div>
    </div>
  );
}

export default function PetCard({ pet: initialPet, onDeleted, onUpdated }: any) {
  const { toast } = useToast();
  const { t } = useTranslation(["pets", "common"]);
  const [pet, setPet] = useState(initialPet);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [adoptionOpen, setAdoptionOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const imagesInputRef = useRef<any>(null);

  const autoSaveTimer = useRef<any>(null);

  // Health sub-records (fetched separately from the main pet, like images).
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [healthLoaded, setHealthLoaded] = useState(false);

  const loadHealth = useCallback(async () => {
    if (!pet.id) return;
    try {
      const [vRes, wRes] = await Promise.all([
        petsAPI.listVaccinations(pet.id),
        petsAPI.listWeightLogs(pet.id),
      ]);
      setVaccinations(vRes.records || []);
      setWeightLogs(wRes.logs || []);
      setHealthLoaded(true);
    } catch {
      // non-fatal; sections render empty
      setHealthLoaded(true);
    }
  }, [pet.id]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const bigIconBtn = {
    ...iconBtnStyle,
    width: isMobile ? 44 : 40,
    height: isMobile ? 44 : 40,
    fontSize: isMobile ? 20 : 18,
  };
  const labelStyle: any = {
    fontSize: isMobile ? 13 : 12,
    color: "var(--accent)",
  };

  const set = useCallback((k: any, v: any) => setForm((f: any) => ({ ...f, [k]: v })), []);

  const startEdit = () => {
    setForm({
      name: pet.name || "",
      type: pet.type || "dog",
      breed: pet.breed || "",
      gender: pet.gender || "",
      age: pet.age || "",
      color: pet.color || "",
      weight: pet.weight || "",
      medical_conditions: pet.medical_conditions || "",
      allergies: pet.allergies || "",
      current_medicines: pet.current_medicines || "",
      temperament: pet.temperament || "",
      potty_trained: pet.potty_trained,
      knows_commands: pet.knows_commands,
      good_with_strangers: pet.good_with_strangers,
      good_with_kids: pet.good_with_kids,
      good_with_pets: pet.good_with_pets,
      special_notes: pet.special_notes || "",
      images: pet.images
        ? Array.isArray(pet.images)
          ? pet.images
          : JSON.parse(pet.images || "[]")
        : [],
      food_types: pet.food_types || "",
      meals_per_day: pet.meals_per_day || "",
      dietary_restrictions: pet.dietary_restrictions || "",
      appetite_notes: pet.appetite_notes || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast("Pet name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await petsAPI.update(pet.id, form);
      setPet(res.pet);
      setEditing(false);
      toast(`${res.pet.name} updated!`, "success");
      if (onUpdated) onUpdated(res.pet);
      // Weight may have auto-created a log entry on the backend — refresh history.
      loadHealth();
    } catch (err: any) {
      toast(err.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await petsAPI.delete(pet.id);
      toast(`${pet.name} removed`, "success");
      if (onDeleted) onDeleted(pet.id);
    } catch (err: any) {
      toast(err.message || "Failed to remove pet", "error");
      setDeleting(false);
    }
  };

  const handleMarkedLost = (petId: any) => {
    setPet((p: any) => ({ ...p, is_lost: true }));
    if (onUpdated) onUpdated({ ...pet, is_lost: true });
  };

  const handleMarkedForAdoption = (petId: any) => {
    setPet((p: any) => ({ ...p, is_for_adoption: true }));
    if (onUpdated) onUpdated({ ...pet, is_for_adoption: true });
  };

  const handleMarkAdopted = async () => {
    try {
      await petsAPI.markAdopted(pet.id);
      setPet((p: any) => ({ ...p, is_for_adoption: false }));
      toast(`${pet.name} marked as adopted! 🎉`, "success");
      if (onUpdated) onUpdated({ ...pet, is_for_adoption: false });
    } catch (err: any) {
      toast(err.message || "Failed to update", "error");
    }
  };

  const handleMarkFound = async () => {
    try {
      await petsAPI.markFound(pet.id);
      setPet((p: any) => ({ ...p, is_lost: false }));
      toast(`${pet.name} marked as found! 🎉`, "success");
      if (onUpdated) onUpdated({ ...pet, is_lost: false });
    } catch (err: any) {
      toast(err.message || "Failed to mark as found", "error");
    }
  };

  const handleImagesUpload = async (files: any) => {
    if (files.length === 0) return;
    setUploadingImages(true);
    try {
      const res = await petsAPI.uploadImages(pet.id, Array.from(files));
      setPet((p: any) => ({ ...p, images: res.images }));
      // Update form.images if in edit mode
      setForm((f: any) => ({ ...f, images: res.images }));
      toast(
        `Uploaded ${files.length} image${files.length !== 1 ? "s" : ""}!`,
        "success",
      );
    } catch (err: any) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageIndex: any) => {
    try {
      const res = await petsAPI.deleteImage(pet.id, imageIndex);
      setPet((p: any) => ({ ...p, images: res.images }));
      toast("Image removed", "success");
    } catch (err: any) {
      toast(err.message || "Failed to remove image", "error");
    }
  };

  const handleDeleteImageInForm = async (imageIndex: any, imageToDelete: any) => {
    try {
      // Find the actual index in the pet's images array (the one stored on server)
      const actualImages = Array.isArray(pet.images)
        ? pet.images
        : JSON.parse(pet.images || "[]");
      const serverIndex = actualImages.indexOf(imageToDelete);

      if (serverIndex >= 0) {
        await petsAPI.deleteImage(pet.id, serverIndex);
      }

      // Update both pet and form state
      const newImages = form.images.filter((_: any, i: any) => i !== imageIndex);
      setPet((p: any) => ({ ...p, images: newImages }));
      set("images", newImages);
      toast("Image removed", "success");
    } catch (err: any) {
      toast(err.message || "Failed to remove image", "error");
    }
  };

  // ── Vaccination record handlers ──────────────────────────────────────────
  const handleAddVaccination = async (data: any) => {
    try {
      const res = await petsAPI.addVaccination(pet.id, data);
      setVaccinations((v: any[]) => [...v, res.record]);
      toast(t("pets:health.vaccinationAdded"), "success");
      return true;
    } catch (err: any) {
      toast(err.message || t("pets:health.saveFailed"), "error");
      return false;
    }
  };

  const handleUpdateVaccination = async (recordId: any, data: any) => {
    try {
      const res = await petsAPI.updateVaccination(pet.id, recordId, data);
      setVaccinations((v: any[]) => v.map((r: any) => (r.id === recordId ? res.record : r)));
      toast(t("pets:health.vaccinationUpdated"), "success");
      return true;
    } catch (err: any) {
      toast(err.message || t("pets:health.saveFailed"), "error");
      return false;
    }
  };

  const handleDeleteVaccination = async (recordId: any) => {
    try {
      await petsAPI.deleteVaccination(pet.id, recordId);
      setVaccinations((v: any[]) => v.filter((r: any) => r.id !== recordId));
      toast(t("pets:health.vaccinationRemoved"), "success");
    } catch (err: any) {
      toast(err.message || t("pets:health.saveFailed"), "error");
    }
  };

  // Weight logs are read-only history, auto-created server-side on weight change.

  // Top-card alert: only overdue vaccines, or those due within 3 days.
  const vaccineAlert = (() => {
    let best: { rec: any; status: ReturnType<typeof vaccineDueStatus> } | null = null;
    for (const rec of vaccinations) {
      const s = vaccineDueStatus(rec.next_due_date);
      const actionable = s.kind === "overdue" || (s.kind === "soon" && s.days <= 3);
      if (!actionable) continue;
      if (!best || s.days < best.status.days || (best.status.kind !== "overdue" && s.kind === "overdue")) {
        best = { rec, status: s };
      }
    }
    return best;
  })();

  const TABS = [
    t("pets:tabs.basic"),
    t("pets:tabs.medical"),
    t("pets:tabs.food"),
    t("pets:tabs.behavior"),
  ];

  const typeEmoji =
    pet.type === "cat" ? "🐱" : pet.type === "dog" ? "🐕" : "🐾";
  const ageDisplay = pet.age ? pet.age : null;

  return (
    <>
      <div style={{ ...cardStyle, position: "relative" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, var(--accent), #00b87a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            {typeEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                rowGap: 4,
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 18,
                  color: "var(--text-primary)",
                }}
              >
                {pet.name}
              </span>
              {!isMobile && pet.is_lost && (
                <span style={{ ...statusBadge, background: "var(--danger)", color: "#fff", animation: "pulse 1.5s ease-in-out infinite" }}>
                  🔴 {t("pets:status.lost").toUpperCase()}
                </span>
              )}
              {!isMobile && !pet.is_lost && pet.status === "safe" && (
                <span style={{ ...statusBadge, background: "var(--accent)", color: "#0a0d12" }}>
                  ✅ {t("pets:status.safe").toUpperCase()}
                </span>
              )}
              {!isMobile && pet.is_for_adoption && !pet.is_lost && (
                <span style={{ ...statusBadge, background: "rgba(124,58,237,0.9)", color: "#fff" }}>
                  🏠 {t("pets:status.forAdoption").toUpperCase()}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--accent)",
                marginTop: 3,
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              ID: {pet.pet_id}
            </div>
            {isMobile && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {pet.is_lost && (
                  <span style={{ ...statusBadge, background: "var(--danger)", color: "#fff", animation: "pulse 1.5s ease-in-out infinite" }}>
                    🔴 {t("pets:status.lost").toUpperCase()}
                  </span>
                )}
                {!pet.is_lost && pet.status === "safe" && (
                  <span style={{ ...statusBadge, background: "var(--accent)", color: "#0a0d12" }}>
                    ✅ {t("pets:status.safe").toUpperCase()}
                  </span>
                )}
                {pet.is_for_adoption && !pet.is_lost && (
                  <span style={{ ...statusBadge, background: "rgba(124,58,237,0.9)", color: "#fff", fontSize: 9, padding: "2px 6px", letterSpacing: "0.3px" }}>
                    🏠 {t("pets:status.forAdoption").toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            style={
              isMobile
                ? {
                    display: "grid",
                    gridAutoFlow: "column",
                    gridTemplateRows: "1fr 1fr",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    flexShrink: 0,
                  }
                : { display: "flex", gap: 6, flexShrink: 0 }
            }
          >
            {!editing && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button onClick={startEdit} style={bigIconBtn} title="Edit">
                  ✏️
                </button>
                <span style={labelStyle}>
                  {t("common:buttons.edit")}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={() => { setShowQr((v: any) => !v); setShowShare(false); }}
                style={bigIconBtn}
                title="QR Code"
              >
                {showQr ? "🔼" : "📱"}
              </button>
              <span style={labelStyle}>
                {showQr ? t("pets:hideQr") : t("pets:showQr")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={() => { setShowShare((v: any) => !v); setShowQr(false); }}
                style={bigIconBtn}
                title={t("pets:shareTitle")}
              >
                {showShare ? "🔼" : "🔗"}
              </button>
              <span style={labelStyle}>
                {showShare ? t("pets:hideShare") : t("pets:share")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                style={{ ...bigIconBtn, color: "var(--danger)" }}
                title="Remove"
              >
                {deleting ? "..." : "🗑️"}
              </button>
              <span style={{ fontSize: isMobile ? 13 : 12, color: "var(--danger)" }}>
                {t("common:buttons.delete")}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code section */}
        {showQr && pet.pet_id && (
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {t("pets:qr.desc")}
            </div>
            <img
              src={`/api/v1/pets/public/${pet.pet_id}/qr`}
              alt={`QR for ${pet.name}`}
              style={{
                width: 160,
                height: 160,
                borderRadius: 8,
                border: "3px solid var(--bg-card)",
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "monospace",
              }}
            >
              {pet.pet_id}
            </div>
            <a
              href={`/api/v1/pets/public/${pet.pet_id}/qr`}
              download={`${pet.name}-qr.png`}
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t("pets:qr.download")}
            </a>
          </div>
        )}

        {/* Share link panel */}
        {showShare && pet.pet_id && (
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {t("pets:shareTitle")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontFamily: "monospace",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  wordBreak: "break-all",
                }}
              >
                {window.location.origin + "/pet/" + pet.pet_id}
              </span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.origin + "/pet/" + pet.pet_id);
                  toast(t("pets:shareCopied"), "success");
                  setTimeout(() => setShowShare(false), 2000);
                }}
                style={{ ...iconBtnStyle, flexShrink: 0, color: "var(--accent)" }}
                title={t("pets:shareCopyTitle")}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span>📋</span>
                  <span style={{ fontSize: 9, color: "var(--accent)" }}>{t("pets:shareCopyTitle")}</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Lost/Found status info */}
        {pet.is_lost && pet.lost_location_name && (
          <div
            style={{
              background: "rgba(255,79,106,0.08)",
              border: "1px solid rgba(255,79,106,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 700, color: "var(--danger)" }}>
              {t("pets:lastSeen")}{" "}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {pet.lost_location_name}
              {pet.lost_date
                ? ` on ${new Date(pet.lost_date).toLocaleDateString()}`
                : ""}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "nowrap",
            marginBottom: 18,
          }}
        >
          {pet.is_lost ? (
            <button onClick={handleMarkFound} style={{ ...foundBtnStyle, flex: 1, minWidth: 0, fontSize: isMobile ? 11 : 13, padding: isMobile ? "8px 6px" : "8px 16px", whiteSpace: "nowrap" }}>
              ✅ {t("pets:actions.markFound")}
            </button>
          ) : (
            <button onClick={() => setLostOpen(true)} style={{ ...lostBtnStyle, flex: 1, minWidth: 0, fontSize: isMobile ? 11 : 13, padding: isMobile ? "8px 6px" : "8px 16px", whiteSpace: "nowrap" }}>
              🔴 {t("pets:actions.markLost")}
            </button>
          )}
          {pet.is_for_adoption ? (
            <button onClick={handleMarkAdopted} style={{ ...adoptedBtnStyle, flex: 1, minWidth: 0, fontSize: isMobile ? 11 : 13, padding: isMobile ? "8px 6px" : "8px 16px", whiteSpace: "nowrap" }}>
              ✅ {t("pets:actions.markAdopted")}
            </button>
          ) : (
            <button onClick={() => setAdoptionOpen(true)} style={{ ...adoptionBtnStyle, flex: 1, minWidth: 0, fontSize: isMobile ? 11 : 13, padding: isMobile ? "8px 6px" : "8px 16px", whiteSpace: "nowrap" }}>
              🏠 {t("pets:actions.markForAdoption")}
            </button>
          )}
        </div>

        {/* Vaccination due alert */}
        {vaccineAlert && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: DUE_BADGE[vaccineAlert.status.kind].bg,
              border: `1px solid ${DUE_BADGE[vaccineAlert.status.kind].color}`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: DUE_BADGE[vaccineAlert.status.kind].color,
              fontWeight: 600,
            }}
          >
            <span>⚠️</span>
            <span>
              {vaccineAlert.status.kind === "overdue"
                ? t("pets:health.alertOverdue", {
                    name: vaccineAlert.rec.vaccine_name,
                    days: vaccineAlert.status.days,
                  })
                : t("pets:health.alertDueSoon", {
                    name: vaccineAlert.rec.vaccine_name,
                    days: vaccineAlert.status.days,
                  })}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 18,
            borderBottom: "1px solid var(--border)",
            paddingBottom: 0,
            justifyContent: isMobile ? "center" : "flex-start",
          }}
        >
          {TABS.map((tabLabel: any, i: any) => (
            <button
              key={tabLabel}
              onClick={() => setTab(i)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px 8px 0 0",
                border: "none",
                background: tab === i ? "var(--bg-elevated)" : "transparent",
                color: tab === i ? "var(--accent)" : "var(--text-muted)",
                fontWeight: tab === i ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                borderBottom:
                  tab === i
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {tabLabel}
            </button>
          ))}
        </div>

        {/* Content */}
        {editing ? (
          <PetForm
            form={form}
            setField={set}
            tab={tab}
            setTab={setTab}
            uploadingImages={uploadingImages}
            imagesInputRef={imagesInputRef}
            handleImagesUpload={handleImagesUpload}
            handleDeleteImageInForm={handleDeleteImageInForm}
            vaccinations={vaccinations}
            weightLogs={weightLogs}
            onAddVaccination={handleAddVaccination}
            onEditVaccination={handleUpdateVaccination}
            onDeleteVaccination={handleDeleteVaccination}
            editing
          />
        ) : (
          <PetView pet={pet} tab={tab} vaccinations={vaccinations} weightLogs={weightLogs} />
        )}

        {/* Pet images section - MOVED TO BASIC TAB IN EDIT MODE */}

        {/* Edit action buttons */}
        {editing && (
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditing(false)} style={cancelBtnStyle}>
              {t("common:buttons.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={saveBtnStyle(saving)}
            >
              {saving ? t("common:buttons.saving") : t("common:buttons.saveChanges")}
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "24px",
              maxWidth: 360,
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              {t("pets:deleteConfirm.title", { name: pet.name })}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              {t("pets:deleteConfirm.message", { name: pet.name })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("common:buttons.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                {deleting ? t("pets:deleteConfirm.removing") : t("pets:deleteConfirm.remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      <LostPetModal
        pet={pet}
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        onMarkedLost={handleMarkedLost}
      />
      <AdoptionModal
        pet={pet}
        open={adoptionOpen}
        onClose={() => setAdoptionOpen(false)}
        onMarkedForAdoption={handleMarkedForAdoption}
      />
    </>
  );
}

// ── Vaccination record add/edit form fields (shared) ──────────────────────
function VaccineFields({ draft, setDraft, onSave, onCancel, saving, saveLabel }: any) {
  const { t } = useTranslation("pets");
  return (
    <div
      style={{
        marginTop: 10,
        border: "1px dashed var(--border)",
        borderRadius: 10,
        padding: 12,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      <div style={{ gridColumn: "1/-1" }}>
        <label style={labelStyle}>{t("health.vaccineName")}</label>
        <input
          className="input-field"
          value={draft.vaccine_name}
          onChange={(e: any) => setDraft((d: any) => ({ ...d, vaccine_name: e.target.value }))}
          placeholder="Rabies"
        />
      </div>
      <div>
        <label style={labelStyle}>{t("health.dateGiven")}</label>
        <input
          type="date"
          className="input-field"
          max={new Date().toISOString().split("T")[0]}
          value={draft.date_given}
          onChange={(e: any) => setDraft((d: any) => ({ ...d, date_given: e.target.value }))}
        />
      </div>
      <div>
        <label style={labelStyle}>{t("health.nextDue")}</label>
        <input
          type="date"
          className="input-field"
          value={draft.next_due_date}
          onChange={(e: any) => setDraft((d: any) => ({ ...d, next_due_date: e.target.value }))}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {t("health.nextDueHint")}
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t("health.vetName")}</label>
        <input
          className="input-field"
          value={draft.vet_name}
          onChange={(e: any) => setDraft((d: any) => ({ ...d, vet_name: e.target.value }))}
          placeholder="Dr. Karim"
        />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <label style={labelStyle}>{t("health.notes")}</label>
        <input
          className="input-field"
          value={draft.notes}
          onChange={(e: any) => setDraft((d: any) => ({ ...d, notes: e.target.value }))}
        />
      </div>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={cancelBtnStyle}>
          {t("common:buttons.cancel")}
        </button>
        <button onClick={onSave} disabled={saving || !draft.vaccine_name.trim()} style={saveBtnStyle(saving)}>
          {saving ? t("common:buttons.saving") : saveLabel}
        </button>
      </div>
    </div>
  );
}

const EMPTY_VACCINE = { vaccine_name: "", date_given: "", next_due_date: "", vet_name: "", notes: "" };

// ── Vaccination records list (shared by view + edit) ──────────────────────
function VaccinationList({ records, editable, onAdd, onEdit, onDelete }: any) {
  const { t } = useTranslation("pets");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [draft, setDraft] = useState<any>(EMPTY_VACCINE);
  const [saving, setSaving] = useState(false);

  const toYmd = (d: any) => (d ? String(d).split("T")[0] : "");

  const startAdd = () => {
    setEditingId(null);
    setDraft(EMPTY_VACCINE);
    setAdding(true);
  };

  const startEdit = (rec: any) => {
    setAdding(false);
    setEditingId(rec.id);
    setDraft({
      vaccine_name: rec.vaccine_name || "",
      date_given: toYmd(rec.date_given),
      next_due_date: toYmd(rec.next_due_date),
      vet_name: rec.vet_name || "",
      notes: rec.notes || "",
    });
  };

  const submitAdd = async () => {
    if (!draft.vaccine_name.trim()) return;
    setSaving(true);
    const ok = await onAdd(draft);
    setSaving(false);
    if (ok) {
      setDraft(EMPTY_VACCINE);
      setAdding(false);
    }
  };

  const submitEdit = async () => {
    if (!draft.vaccine_name.trim()) return;
    setSaving(true);
    const ok = await onEdit(editingId, draft);
    setSaving(false);
    if (ok) setEditingId(null);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          {t("health.vaccinations")}
        </div>
        {editable && !adding && editingId === null && (
          <button onClick={startAdd} style={addBtnStyle}>
            + {t("health.add")}
          </button>
        )}
      </div>

      {records.length === 0 && !adding && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          {t("health.noVaccinations")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {records.map((rec: any) => {
          if (editable && editingId === rec.id) {
            return (
              <VaccineFields
                key={rec.id}
                draft={draft}
                setDraft={setDraft}
                onSave={submitEdit}
                onCancel={() => setEditingId(null)}
                saving={saving}
                saveLabel={t("common:buttons.saveChanges")}
              />
            );
          }
          const s = vaccineDueStatus(rec.next_due_date);
          const badge = DUE_BADGE[s.kind];
          const label =
            s.kind === "overdue"
              ? t("health.badgeOverdue", { days: s.days })
              : s.kind === "soon"
                ? t("health.badgeDueSoon", { days: s.days })
                : s.kind === "ok"
                  ? t("health.badgeOk")
                  : t("health.badgeDone");
          return (
            <div
              key={rec.id}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                  {rec.vaccine_name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      borderRadius: 20,
                      padding: "3px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.dot} {label}
                  </span>
                  {editable && (
                    <>
                      <button
                        onClick={() => startEdit(rec)}
                        style={{ ...iconBtnStyle, width: 28, height: 28, fontSize: 12 }}
                        title={t("health.edit")}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(rec.id)}
                        style={{ ...iconBtnStyle, width: 28, height: 28, fontSize: 12, color: "var(--danger)" }}
                        title={t("health.remove")}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {rec.date_given && (
                  <span>
                    {t("health.given")} {new Date(rec.date_given).toLocaleDateString()}
                  </span>
                )}
                {rec.next_due_date && (
                  <span>
                    {rec.date_given ? " · " : ""}
                    {t("health.due")} {new Date(rec.next_due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {rec.vet_name && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {rec.vet_name}
                </div>
              )}
              {rec.notes && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {rec.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && adding && (
        <VaccineFields
          draft={draft}
          setDraft={setDraft}
          onSave={submitAdd}
          onCancel={() => setAdding(false)}
          saving={saving}
          saveLabel={t("health.add")}
        />
      )}
    </div>
  );
}

// ── Weight chart (read-only, compact wide line chart) ─────────────────────
// History is auto-recorded whenever the pet's weight field changes on save.
function WeightSection({ logs }: any) {
  const { t } = useTranslation("pets");

  // On narrow screens the aspect-locked svg renders very short — use a taller
  // viewBox on mobile so the plot stays visible.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const points = logs
    .map((l: any) => ({ w: parseFloat(l.weight), d: l.logged_date }))
    .filter((p: any) => !isNaN(p.w));

  // Chart geometry: wide viewBox, scaled uniformly (no aspect distortion so text
  // stays legible). Top band reserved for weight value labels, bottom for dates.
  const W = 600;
  const H = 75;
  const PAD_X = 24;
  const PAD_TOP = isMobile ? 18 : 14; // room for weight value labels above points
  const PAD_BOT = isMobile ? 18 : 16; // room for date ticks below
  const min = Math.min(...points.map((p: any) => p.w));
  const max = Math.max(...points.map((p: any) => p.w));
  const span = max - min || 1;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i / (n - 1)) * (W - PAD_X * 2));
  const y = (w: number) => PAD_TOP + (1 - (w - min) / span) * (H - PAD_TOP - PAD_BOT);
  const line = points.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ");

  // Thin date ticks so at most ~7 show; always include the last point.
  const step = Math.max(1, Math.ceil(n / 7));
  const fmtDate = (d: any) =>
    new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });

  const latest = points[n - 1];
  const prev = points[n - 2];
  const delta = latest && prev ? latest.w - prev.w : null;
  const deltaStr = delta === null || delta === 0 ? null : `${delta > 0 ? "▲ +" : "▼ "}${delta.toFixed(1)} kg`;
  const deltaColor = delta && delta > 0 ? "#f59e0b" : "var(--accent)";

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          {t("health.weightLog")}
        </div>
        {deltaStr && (
          <div style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>{deltaStr}</div>
        )}
      </div>

      {n === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("health.noWeightLogs")}</div>
      )}

      {n === 1 && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {latest.w} kg · {new Date(latest.d).toLocaleDateString()}
        </div>
      )}

      {n >= 2 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* filled area under the line */}
          <polyline
            points={`${x(0)},${H - PAD_BOT} ${points.map((p: any, i: number) => `${x(i)},${y(p.w)}`).join(" ")} ${x(n - 1)},${H - PAD_BOT}`}
            fill="var(--accent)"
            opacity={0.08}
          />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p: any, i: number) => {
            const showTick = i % step === 0 || i === n - 1;
            return (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.w)} r={2} fill="var(--accent)" />
                {/* weight value above the point */}
                <text
                  x={x(i)}
                  y={y(p.w) - 5}
                  textAnchor="middle"
                  fontSize={isMobile ? 11 : 7}
                  fontWeight={700}
                  fill="var(--text-primary)"
                >
                  {p.w}
                </text>
                {/* date tick below the chart (thinned) */}
                {showTick && (
                  <text
                    x={x(i)}
                    y={H - 4}
                    textAnchor="middle"
                    fontSize={isMobile ? 10 : 6.5}
                    fill="var(--text-muted)"
                  >
                    {fmtDate(p.d)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ── PetView (read-only display) ───────────────────────────────────────────
function PetView({ pet, tab, vaccinations = [], weightLogs = [] }: any) {
  const { t } = useTranslation("pets");
  if (tab === 0) {
    const fields = [
      {
        label: t("basic.type"),
        value: pet.type
          ? pet.type.charAt(0).toUpperCase() + pet.type.slice(1)
          : null,
      },
      { label: t("basic.breed"), value: pet.breed },
      {
        label: t("basic.gender"),
        value: pet.gender
          ? pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)
          : null,
      },
      { label: t("basic.age"), value: pet.age || null },
      { label: t("basic.colorMarkings"), value: pet.color },
      { label: t("basic.weight"), value: pet.weight ? `${pet.weight} kg` : null },
      {
        label: t("basic.pottyTrained"),
        value:
          pet.potty_trained === true
            ? t("form.yesEmoji")
            : pet.potty_trained === false
              ? t("form.noEmoji")
              : null,
      },
    ];
    return (
      <div>
        <InfoGrid fields={fields} />
        {/* Pet images display in Basic tab */}
        {pet.images && pet.images.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {t("basic.petPhotos", { count: pet.images?.length || 0 })}
            </div>
            <ImageGallery
              images={(Array.isArray(pet.images)
                ? pet.images
                : JSON.parse(pet.images || "[]")
              ).map((img: any) =>
                img.startsWith("http")
                  ? img
                  : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${img}`
              )}
            />
          </div>
        )}
      </div>
    );
  }

  if (tab === 1) {
    const fields = [
      { label: t("medical.medicalConditions"), value: pet.medical_conditions, full: true },
      { label: t("medical.allergies"), value: pet.allergies, full: true },
      { label: t("medical.currentMedicines"), value: pet.current_medicines, full: true },
    ];
    return (
      <div>
        <VaccinationList records={vaccinations} editable={false} />
        <div style={{ marginTop: 18 }}>
          <InfoGrid fields={fields} />
        </div>
        <WeightSection logs={weightLogs} />
      </div>
    );
  }

  if (tab === 2) {
    const fields = [
      { label: t("food.foodTypes"), value: pet.food_types, full: true },
      { label: t("food.mealsPerDay"), value: pet.meals_per_day || null },
      { label: t("food.dietaryRestrictions"), value: pet.dietary_restrictions, full: true },
      { label: t("food.appetiteNotes"), value: pet.appetite_notes, full: true },
    ];
    return <InfoGrid fields={fields} />;
  }

  if (tab === 3) {
    const bool2str = (v: any) =>
      v === true ? t("form.yesEmoji") : v === false ? t("form.noEmoji") : null;
    const fields = [
      {
        label: t("behavior.temperament"),
        value: pet.temperament
          ? pet.temperament.charAt(0).toUpperCase() + pet.temperament.slice(1)
          : null,
      },
      { label: t("behavior.knowsCommands"), value: bool2str(pet.knows_commands) },
      {
        label: t("behavior.goodWithStrangers"),
        value: bool2str(pet.good_with_strangers),
      },
      { label: t("behavior.goodWithKids"), value: bool2str(pet.good_with_kids) },
      { label: t("behavior.goodWithPets"), value: bool2str(pet.good_with_pets) },
      { label: t("behavior.specialNotes"), value: pet.special_notes, full: true },
    ];
    return <InfoGrid fields={fields} />;
  }
  return null;
}

function InfoGrid({ fields }: any) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 12,
      }}
    >
      {fields.map(({ label, value, full }: any) =>
        value !== null && value !== undefined && value !== "" ? (
          <div key={label} style={full ? { gridColumn: "1/-1" } : {}}>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              {value}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ── PetForm (editable form) ───────────────────────────────────────────────
function PetForm({
  form,
  setField,
  tab,
  uploadingImages,
  imagesInputRef,
  handleImagesUpload,
  handleDeleteImageInForm,
  isNew,
  vaccinations = [],
  weightLogs = [],
  onAddVaccination,
  onEditVaccination,
  onDeleteVaccination,
}: any) {
  const { t } = useTranslation("pets");
  const BoolSelect = ({ field, label }: any) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        className="input-field"
        value={
          form[field] === null || form[field] === undefined
            ? ""
            : String(form[field])
        }
        onChange={(e: any) => {
          const v = e.target.value;
          setField(field, v === "" ? null : v === "true");
        }}
      >
        <option value="">{t("form.notSpecified")}</option>
        <option value="true">{t("form.yes")}</option>
        <option value="false">{t("form.no")}</option>
      </select>
    </div>
  );

  if (tab === 0)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("form.nameRequired")}</label>
          <input
            className="input-field"
            value={form.name}
            onChange={(e: any) => setField("name", e.target.value)}
            placeholder="Buddy"
            required
          />
        </div>
        <div>
          <label style={labelStyle}>{t("form.typeRequired")}</label>
          <select
            className="input-field"
            value={form.type}
            onChange={(e: any) => setField("type", e.target.value)}
          >
            <option value="dog">🐕 Dog</option>
            <option value="cat">🐱 Cat</option>
            <option value="other">🐾 Other</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t("form.breed")}</label>
          <input
            className="input-field"
            value={form.breed}
            onChange={(e: any) => setField("breed", e.target.value)}
            placeholder="German Shepherd"
          />
        </div>
        <div>
          <label style={labelStyle}>{t("form.gender")}</label>
          <select
            className="input-field"
            value={form.gender || ""}
            onChange={(e: any) => setField("gender", e.target.value)}
          >
            <option value="">{t("form.notSpecified")}</option>
            <option value="male">{t("form.male")}</option>
            <option value="female">{t("form.female")}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t("form.ageYears")}</label>
          <input
            type="text"
            maxLength={30}
            className="input-field"
            value={form.age || ""}
            onChange={(e: any) => setField("age", e.target.value)}
            placeholder="1 year 3 month"
          />
        </div>
        <div>
          <label style={labelStyle}>{t("form.color")}</label>
          <input
            className="input-field"
            value={form.color}
            onChange={(e: any) => setField("color", e.target.value)}
            placeholder="Golden with white patches"
          />
        </div>
        <div>
          <label style={labelStyle}>{t("form.weight")}</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="input-field"
            value={form.weight}
            onChange={(e: any) => setField("weight", e.target.value)}
            placeholder="12.5"
          />
        </div>
        <BoolSelect field="potty_trained" label={t("form.pottyTrained")} />
        {!isNew && <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>
            {t("form.petPhotos", { count: form.images?.length || 0 })}
          </label>
          {form.images && form.images.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {(Array.isArray(form.images)
                ? form.images
                : JSON.parse(form.images || "[]")
              ).map((img: any, idx: any) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    paddingBottom: "100%",
                    background: "var(--bg-elevated)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={
                      img.startsWith("http")
                        ? img
                        : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${img}`
                    }
                    alt={`Pet ${idx + 1}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    onClick={() => handleDeleteImageInForm(idx, img)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {(!form.images || form.images.length < 3) && (
            <button
              onClick={() => imagesInputRef.current?.click()}
              disabled={uploadingImages}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: uploadingImages ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                width: "100%",
              }}
            >
              {uploadingImages
                ? t("form.uploading")
                : t("form.addPhoto", { count: form.images?.length || 0 })}
            </button>
          )}
          <input
            ref={imagesInputRef}
            type="file"
            accept="image/*"
            multiple
            max="3"
            style={{ display: "none" }}
            onChange={(e: any) => {
              if (e.target.files) handleImagesUpload(e.target.files);
            }}
          />
        </div>}
      </div>
    );

  if (tab === 1)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div style={{ gridColumn: "1/-1" }}>
          {isNew ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("health.saveFirstVaccinations")}
            </div>
          ) : (
            <VaccinationList
              records={vaccinations}
              editable
              onAdd={onAddVaccination}
              onEdit={onEditVaccination}
              onDelete={onDeleteVaccination}
            />
          )}
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("form.medicalConditions")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.medical_conditions}
            onChange={(e: any) => setField("medical_conditions", e.target.value)}
            placeholder="Hip dysplasia, ear infections..."
            style={{ resize: "vertical" }}
          />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("form.allergies")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.allergies}
            onChange={(e: any) => setField("allergies", e.target.value)}
            placeholder="Chicken, grass pollen..."
            style={{ resize: "vertical" }}
          />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("form.currentMedicines")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.current_medicines}
            onChange={(e: any) => setField("current_medicines", e.target.value)}
            placeholder="Monthly flea prevention..."
            style={{ resize: "vertical" }}
          />
        </div>
        {!isNew && (
          <div style={{ gridColumn: "1/-1" }}>
            <WeightSection logs={weightLogs} />
          </div>
        )}
      </div>
    );

  if (tab === 2)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("food.foodTypes")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.food_types || ""}
            onChange={(e: any) => setField("food_types", e.target.value)}
            placeholder="Dry kibble, boiled chicken, rice"
            style={{ resize: "vertical" }}
          />
        </div>
        <div>
          <label style={labelStyle}>{t("food.mealsPerDay")}</label>
          <input
            type="text"
            maxLength={50}
            className="input-field"
            value={form.meals_per_day || ""}
            onChange={(e: any) => setField("meals_per_day", e.target.value)}
            placeholder="2-3 times"
          />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("food.dietaryRestrictions")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.dietary_restrictions || ""}
            onChange={(e: any) => setField("dietary_restrictions", e.target.value)}
            placeholder="Grain-free, no chicken..."
            style={{ resize: "vertical" }}
          />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("food.appetiteNotes")}</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.appetite_notes || ""}
            onChange={(e: any) => setField("appetite_notes", e.target.value)}
            placeholder="Eats well, picky in mornings..."
            style={{ resize: "vertical" }}
          />
        </div>
      </div>
    );

  if (tab === 3)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <label style={labelStyle}>{t("form.temperament")}</label>
          <select
            className="input-field"
            value={form.temperament || ""}
            onChange={(e: any) => setField("temperament", e.target.value)}
          >
            <option value="">{t("form.notSpecified")}</option>
            <option value="friendly">{t("form.friendly")}</option>
            <option value="aggressive">{t("form.aggressive")}</option>
            <option value="shy">{t("form.shy")}</option>
            <option value="bites">{t("form.bites")}</option>
          </select>
        </div>
        <BoolSelect field="knows_commands" label={t("form.knowsCommands")} />
        <BoolSelect
          field="good_with_strangers"
          label={t("form.goodWithStrangers")}
        />
        <BoolSelect field="good_with_kids" label={t("form.goodWithKids")} />
        <BoolSelect field="good_with_pets" label={t("form.goodWithPets")} />
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>{t("form.specialNotes")}</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.special_notes}
            onChange={(e: any) => setField("special_notes", e.target.value)}
            placeholder="Loves belly rubs, scared of thunder..."
            style={{ resize: "vertical" }}
          />
        </div>
      </div>
    );

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────
const cardStyle = {
  background: "var(--glass)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "24px",
  WebkitBackdropFilter: "blur(18px)",
  backdropFilter: "blur(18px)",
  boxShadow: "var(--shadow-sm)",
};

const statusBadge: any = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  borderRadius: 20,
  padding: "3px 10px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const iconBtnStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const saveBtnStyle = (saving: any) => ({
  flex: 2,
  padding: "10px 0",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#0a0d12",
  cursor: saving ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: 14,
  opacity: saving ? 0.7 : 1,
});

const addBtnStyle = {
  padding: "5px 12px",
  borderRadius: 8,
  border: "1px solid var(--accent)",
  background: "rgba(0,230,118,0.08)",
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

const cancelBtnStyle = {
  flex: 1,
  padding: "10px 0",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const lostBtnStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(255,79,106,0.4)",
  background: "rgba(255,79,106,0.08)",
  color: "var(--danger)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const foundBtnStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(0,230,118,0.4)",
  background: "rgba(0,230,118,0.08)",
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const adoptionBtnStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(124,58,237,0.4)",
  background: "rgba(124,58,237,0.08)",
  color: "#7c3aed",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const adoptedBtnStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(0,229,160,0.4)",
  background: "rgba(0,229,160,0.08)",
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
