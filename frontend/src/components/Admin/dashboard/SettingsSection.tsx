import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function SettingsSection() {
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