import { useState } from "react";
import { useTranslation } from "react-i18next";
import { petsAPI } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

export default function AdoptionModal({ pet, open, onClose, onMarkedForAdoption }: any) {
  const { t } = useTranslation("pets");
  const { toast } = useToast();
  const [form, setForm] = useState({
    reason: "",
    adoption_requirements: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open || !pet) return null;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await petsAPI.markForAdoption(pet.id, {
        reason: form.reason || undefined,
        adoption_requirements: form.adoption_requirements || undefined,
      });
      toast(t("adoptionModal.listSuccess", { name: pet.name }), "success");
      onMarkedForAdoption(pet.id);
      setForm({ reason: "", adoption_requirements: "" });
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to list for adoption", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,8,15,0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        className="glass-modal"
        style={{
          padding: 24,
          width: "100%",
          maxWidth: 480,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(124,58,237,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🏠
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
              {t("adoptionModal.title", { name: pet.name })}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("adoptionModal.subtitle")}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>{t("adoptionModal.reason")}</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={t("adoptionModal.reasonPlaceholder")}
              value={form.reason}
              maxLength={1000}
              onChange={(e: any) => setForm((f: any) => ({ ...f, reason: e.target.value }))}
              style={{ resize: "vertical", minHeight: 80 }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
              {(form.reason || "").length}/1000
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t("adoptionModal.requirements")}</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={t("adoptionModal.requirementsPlaceholder")}
              value={form.adoption_requirements}
              maxLength={1000}
              onChange={(e: any) => setForm((f: any) => ({ ...f, adoption_requirements: e.target.value }))}
              style={{ resize: "vertical", minHeight: 80 }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
              {(form.adoption_requirements || "").length}/1000
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {t("adoptionModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t("adoptionModal.listing") : t("adoptionModal.listBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
