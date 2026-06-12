import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Alert } from "../UI";
import { vetAuthAPI, authAPI, getImageUrl } from "../../lib/api";
import PasswordStrengthChecker from "./PasswordStrengthChecker";
import OtpVerifyPopup from "./OtpVerifyPopup";

export default function VetRegisterModal({ open, onClose }: any) {
  const { t } = useTranslation("vet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [skipMatch, setSkipMatch] = useState(false);

  // OTP state
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendKey, setResendKey] = useState(0);
  const [normalizedPhone, setNormalizedPhone] = useState("");

  // Clinic OTP state
  const [clinicOtpSent, setClinicOtpSent] = useState(false);
  const [clinicOtp, setClinicOtp] = useState("");
  const [clinicOtpLoading, setClinicOtpLoading] = useState(false);
  const [clinicOtpError, setClinicOtpError] = useState("");
  const [clinicOtpExpired, setClinicOtpExpired] = useState(false);
  const [clinicResendKey, setClinicResendKey] = useState(0);
  const [clinicOtpTimer, setClinicOtpTimer] = useState(120);

  const [form, setForm] = useState({
    clinic_name: "",
    account_owner_name: "",
    phone: "",
    email: "",
    address: "",
    password: "",
    confirm_password: "",
  });

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const passwordsMatch = form.password && form.confirm_password && form.password === form.confirm_password;

  const buildPayload = (np?: any) => ({
    vet_type: "clinic",
    phone: np || normalizedPhone,
    email: form.email,
    password: form.password,
    address: form.address,
    clinic_name: form.clinic_name,
    account_owner_name: form.account_owner_name,
    ...(skipMatch ? { skipMatch: true } : {}),
  });

  const doRegister = async (np) => {
    const data = await vetAuthAPI.register(buildPayload(np));
    if (data.matchFound) {
      setOtpPhase(false);
      setMatchResult(data.vet);
      return;
    }
    window.location.href = "/vet-dashboard";
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.phone || !form.password || !form.email || !form.address) {
      return setError("All fields are required");
    }
    if (!form.clinic_name || !form.account_owner_name) {
      return setError("Clinic name and owner name are required");
    }
    const np = /^88(01[3-9]\d{8})$/.test(form.phone) ? form.phone.slice(2) : form.phone;
    if (!/^01[3-9]\d{8}$/.test(np)) {
      return setError("Enter a valid Bangladeshi phone number (01XXXXXXXXX or 8801XXXXXXXXX)");
    }
    const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!PASSWORD_PATTERN.test(form.password)) return setError("Password must contain at least one letter and one number (min 8 characters)");
    if (form.password !== form.confirm_password) return setError("Passwords do not match");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError("Enter a valid email address");
    }
    if (!termsAccepted) {
      return setError("Please accept the Terms and Privacy Policy to continue.");
    }

    setNormalizedPhone(np);
    setLoading(true);
    try {
      const result = await authAPI.sendOtp(np);
      if (result.skipped) {
        await doRegister(np);
      } else {
        setOtpPhase(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (otp) => {
    setOtpLoading(true);
    setOtpError("");
    try {
      await authAPI.verifyOtp(normalizedPhone, otp);
      await doRegister(normalizedPhone);
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpResend = async () => {
    try { await authAPI.sendOtp(normalizedPhone); } catch { /* ignore */ }
    setResendKey((k) => k + 1);
  };

  const handleSendClinicOtp = async () => {
    setClinicOtpLoading(true);
    setClinicOtpError("");
    try {
      const rawContact = matchResult.contact || "";
      const normalizedContact = /^88(01[3-9]\d{8})$/.test(rawContact) ? rawContact.slice(2) : rawContact;
      await authAPI.sendOtp(normalizedContact);
      setClinicOtpSent(true);
      setClinicOtpExpired(false);
      setClinicResendKey((k) => k + 1);
    } catch {
      setClinicOtpError("Failed to send OTP to clinic phone. Try again.");
    } finally {
      setClinicOtpLoading(false);
    }
  };

  const handleClinicOtpResend = async () => {
    const rawContact = matchResult.contact || "";
    const normalizedContact = /^88(01[3-9]\d{8})$/.test(rawContact) ? rawContact.slice(2) : rawContact;
    try { await authAPI.sendOtp(normalizedContact); } catch { /* ignore */ }
    setClinicOtpExpired(false);
    setClinicResendKey((k) => k + 1);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!clinicOtpSent) return;
    setClinicOtpTimer(120);
    setClinicOtpExpired(false);
    const interval = setInterval(() => {
      setClinicOtpTimer((t) => {
        if (t <= 1) { clearInterval(interval); setClinicOtpExpired(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [clinicResendKey]);

  const doRegisterSkipped = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await vetAuthAPI.register({ ...buildPayload(normalizedPhone), skipMatch: true });
      if (data.matchFound) {
        setMatchResult(data.vet);
      } else {
        window.location.href = "/vet-dashboard";
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    setError("");
    try {
      await vetAuthAPI.claimVet(matchResult.id, { ...buildPayload(), clinic_otp: clinicOtp });
      window.location.href = "/vet-dashboard";
    } catch (e) {
      setError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={otpPhase ? "Verify Phone" : t("register.modalTitle")}>
      {otpPhase ? (
        <OtpVerifyPopup
          key={resendKey}
          phone={normalizedPhone}
          loading={otpLoading}
          error={otpError}
          onSubmit={handleOtpVerify}
          onBack={() => { setOtpPhase(false); setOtpError(""); }}
          onResend={handleOtpResend}
          backLabel="← Update Registration Form"
        />
      ) : matchResult ? (
        <div>
          <Alert type="info" style={{ marginBottom: 14 }}>
            A profile matching your details was found. Is this your profile?
          </Alert>
          <div style={{ padding: 14, background: "var(--bg-elevated)", borderRadius: 10, marginBottom: 16 }}>
            {matchResult.image && (
              <img
                src={getImageUrl(matchResult.image)}
                alt={matchResult.name || matchResult.clinic_name}
                style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", marginBottom: 10, display: "block" }}
              />
            )}
            <div style={{ fontWeight: 600, fontSize: 15 }}>{matchResult.name || matchResult.clinic_name}</div>
            {matchResult.contact && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{matchResult.contact}</div>}
            {matchResult.email && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{matchResult.email}</div>}
            {matchResult.address && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{matchResult.address}</div>}
          </div>

          {clinicOtpError && <Alert type="error" style={{ marginBottom: 12 }}>{clinicOtpError}</Alert>}

          {!clinicOtpSent ? (
            <Button variant="accent" style={{ width: "100%", marginBottom: 12 }} loading={clinicOtpLoading} onClick={handleSendClinicOtp}>
              Send Confirmation OTP
            </Button>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
                OTP sent to clinic phone{matchResult.contact ? ` ${matchResult.contact.slice(0, 2)}*****${matchResult.contact.slice(-2)}` : ""}
              </div>
              <Input
                value={clinicOtp}
                onChange={(e) => setClinicOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                type="text"
                inputMode="numeric"
                style={{ marginBottom: 8, letterSpacing: 4, fontSize: 18, textAlign: "center" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: clinicOtpExpired ? "#ef4444" : "var(--text-secondary)" }}>
                  {clinicOtpExpired ? "OTP expired" : `${Math.floor(clinicOtpTimer / 60)}:${String(clinicOtpTimer % 60).padStart(2, "0")}`}
                </span>
                <button
                  type="button"
                  onClick={handleClinicOtpResend}
                  disabled={clinicOtpTimer > 0 && !clinicOtpExpired}
                  style={{ background: "none", border: "none", color: clinicOtpTimer > 0 && !clinicOtpExpired ? "var(--text-secondary)" : "var(--accent)", fontSize: 13, cursor: clinicOtpTimer > 0 && !clinicOtpExpired ? "default" : "pointer", textDecoration: "underline", padding: 0 }}
                >
                  Resend OTP
                </button>
              </div>
              {error && <Alert type="error" style={{ marginBottom: 8 }}>{error}</Alert>}
              <Button
                variant="accent"
                style={{ width: "100%", marginBottom: 8 }}
                loading={claiming}
                disabled={clinicOtp.length < 6 || clinicOtpExpired}
                onClick={handleClaim}
              >
                Confirm Claim
              </Button>
            </div>
          )}

          <Button variant="ghost" style={{ width: "100%", marginBottom: 8 }} loading={loading} onClick={async () => { setClinicOtpSent(false); setClinicOtp(""); setClinicOtpError(""); setMatchResult(null); await doRegisterSkipped(); }}>
            Not Mine
          </Button>
          <div style={{ textAlign: "center", marginTop: 6 }}>
            <button
              type="button"
              onClick={() => { setMatchResult(null); setError(""); }}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Go back to registration
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="label">{t("register.clinicName")}</label>
              <Input value={form.clinic_name} onChange={(e) => set("clinic_name", e.target.value)} placeholder="Clinic name" />
            </div>
            <div>
              <label className="label">{t("register.accountOwnerName")}</label>
              <Input value={form.account_owner_name} onChange={(e) => set("account_owner_name", e.target.value)} placeholder="Owner / Manager name" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">{t("register.phone")}</label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" maxLength={13} type="tel" />
              </div>
              <div>
                <label className="label">{t("register.email")}</label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="your@email.com" type="email" />
              </div>
            </div>

            <div>
              <label className="label">{t("register.address")}</label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full address" />
            </div>

            <div>
              <label className="label">{t("register.password")}</label>
              <div style={{ position: "relative" }}>
                <Input
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Min 8 characters"
                  type={showPassword ? "text" : "password"}
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <PasswordStrengthChecker password={form.password} t={t} namespace="vet" />
            </div>

            <div>
              <label className="label">{t("register.confirmPassword")}</label>
              <div style={{ position: "relative" }}>
                <Input
                  value={form.confirm_password}
                  onChange={(e) => set("confirm_password", e.target.value)}
                  placeholder="Re-enter password"
                  type={showConfirmPassword ? "text" : "password"}
                  style={{ paddingRight: "40px", borderColor: form.confirm_password ? (passwordsMatch ? "var(--accent)" : "#ef4444") : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {form.confirm_password && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: passwordsMatch ? "var(--accent)" : "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                  {passwordsMatch
                    ? <><span>✓</span><span>{t("register.passwordMatch")}</span></>
                    : <><span>✗</span><span>{t("register.passwordMismatch")}</span></>
                  }
                </div>
              )}
            </div>

            <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {t("register.pendingNotice")}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#00e5a0", cursor: "pointer", flexShrink: 0 }}
              />
              <span>
                I agree to Pawliz's{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Terms</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Privacy Policy</a>
              </span>
            </label>

            <Button variant="accent" style={{ width: "100%" }} loading={loading} onClick={handleSubmit}>
              {t("register.submitBtn", { type: t("register.typeClinic") })}
            </Button>
          </div>
        </>
      )}
    </Modal>

  );
}
