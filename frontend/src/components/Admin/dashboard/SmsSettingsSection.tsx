import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function SmsSettingsSection() {
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