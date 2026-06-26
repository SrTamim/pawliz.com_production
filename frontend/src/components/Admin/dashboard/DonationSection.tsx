import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function DonationSection() {
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