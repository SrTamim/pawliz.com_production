import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Modal, Button, Input, Alert, Divider } from "../UI";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNavbar } from "../../context/NavbarContext";
import { useTranslation } from "react-i18next";
import PasswordStrengthChecker from "./PasswordStrengthChecker";
import OtpVerifyPopup from "./OtpVerifyPopup";
import { authAPI } from "../../lib/api";

export default function AuthModal({ open, onClose, defaultTab = "login" }: any) {
  const router = useRouter();
  const { openVetReg } = useNavbar();
  const [tab, setTab] = useState(defaultTab);
  const { t } = useTranslation("auth");

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  // Login state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Register state
  const [reg, setReg] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
    address: "",
  });

  // Register OTP state
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendKey, setResendKey] = useState(0);

  // Forgot password state
  const [forgotPhase, setForgotPhase] = useState<any>(null); // null | 'phone' | 'otp' | 'reset'
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotOtpKey, setForgotOtpKey] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPassConfirm, setShowNewPassConfirm] = useState(false);

  const handleLogin = async () => {
    if (!loginPhone || !loginPass) {
      setError(t("errors.fillAllFields"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await login(loginPhone, loginPass, rememberMe);
      toast(`Welcome back, ${user.name}! 🐾`);
      onClose();
      if (user.role === "vet") router.push("/vet-dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const validateRegForm = () => {
    if (!reg.name || !reg.phone || !reg.password || !reg.email || !reg.address) {
      setError(t("errors.allFieldsRequired"));
      return false;
    }
    if (!/^01[3-9]\d{8}$/.test(reg.phone)) {
      setError(t("errors.invalidPhoneFormat"));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) {
      setError(t("errors.invalidEmail", "Please enter a valid email address"));
      return false;
    }
    const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!PASSWORD_PATTERN.test(reg.password)) {
      setError(t("errors.passwordWeak", "Password must be at least 8 characters with letters and numbers"));
      return false;
    }
    if (reg.password !== reg.confirm_password) {
      setError(t("errors.passwordMismatch"));
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateRegForm()) return;
    if (!termsAccepted) {
      setError(t("errors.acceptTerms", "Please accept the Terms and Privacy Policy to continue."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await authAPI.sendOtp(reg.phone);
      if (result.skipped) {
        // SMS disabled — register directly
        const user = await register(reg);
        toast(`Welcome to Pawliz, ${user.name}! 🐾`);
        onClose();
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
      await authAPI.verifyOtp(reg.phone, otp);
      const user = await register(reg);
      toast(`Welcome to Pawliz, ${user.name}! 🐾`);
      onClose();
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpResend = async () => {
    try {
      await authAPI.sendOtp(reg.phone);
    } catch { /* ignore */ }
    setResendKey((k) => k + 1);
  };

  const handleForgotSendOtp = async () => {
    if (!/^01[3-9]\d{8}$/.test(forgotPhone)) {
      setForgotError("Enter a valid BD phone number (01XXXXXXXXX)");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const result = await authAPI.forgotPasswordSendOtp(forgotPhone);
      if (result.skipped) {
        setForgotPhase("reset");
      } else {
        setForgotPhase("otp");
        setForgotOtpKey((k) => k + 1);
      }
    } catch (e) {
      setForgotError(e.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (otp) => {
    setForgotLoading(true);
    setForgotError("");
    try {
      await authAPI.verifyOtp(forgotPhone, otp);
      setForgotOtp(otp);
      setForgotPhase("reset");
    } catch (e) {
      setForgotError(e.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotOtpResend = async () => {
    try {
      await authAPI.forgotPasswordSendOtp(forgotPhone);
    } catch { /* ignore */ }
    setForgotOtpKey((k) => k + 1);
  };

  const handlePasswordReset = async () => {
    const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!newPassword) { setForgotError("New password is required"); return; }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setForgotError("Password must be at least 8 characters with letters and numbers");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setForgotError("Passwords do not match");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      await authAPI.forgotPasswordReset(forgotPhone, forgotOtp, newPassword);
      toast("Password updated! Please login.");
      setForgotPhase(null);
      setForgotPhone("");
      setForgotOtp("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (e) {
      setForgotError(e.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setError("");
    setOtpPhase(false);
    setOtpError("");
    setForgotPhase(null);
    setForgotError("");
    setRememberMe(false);
    setTermsAccepted(true);
  };

  // Real-time password match check
  const passwordsMatch =
    reg.password &&
    reg.confirm_password &&
    reg.password === reg.confirm_password;
  const passwordsMismatch =
    reg.confirm_password && reg.password !== reg.confirm_password;
  const showPasswordFeedback = reg.confirm_password.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        otpPhase
          ? "Verify Phone"
          : forgotPhase === "phone"
          ? "Forgot Password"
          : forgotPhase === "otp"
          ? "Verify Phone"
          : forgotPhase === "reset"
          ? "Set New Password"
          : tab === "login"
          ? t("login.welcomeTitle")
          : t("register.createTitle")
      }
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--bg-elevated)",
          borderRadius: 10,
          padding: 4,
          marginBottom: 20,
        }}
      >
        {["login", "register"].map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => switchTab(tabKey)}
            style={{
              flex: 1,
              padding: "8px",
              textAlign: "center",
              fontSize: 14,
              fontWeight: tab === tabKey ? 600 : 400,
              borderRadius: 7,
              cursor: "pointer",
              background: tab === tabKey ? "var(--bg-card)" : "transparent",
              color:
                tab === tabKey ? "var(--text-primary)" : "var(--text-secondary)",
              border: "none",
              fontFamily: "DM Sans, sans-serif",
              boxShadow: tab === tabKey ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.2s",
            }}
          >
            {t(`${tabKey}.tabLabel`)}
          </button>
        ))}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {tab === "login" ? (
        <div>
          {forgotPhase === null ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <label className="label">{t("login.phone")}</label>
                <Input
                  id="login-phone"
                  name="phone"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder={t("login.phonePlaceholder")}
                  maxLength={11}
                  type="tel"
                  autoComplete="tel"
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label className="label">{t("login.password")}</label>
                <div style={{ position: "relative" }}>
                  <Input
                    id="login-password"
                    name="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    type={showLoginPass ? "text" : "password"}
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "18px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                    }}
                  >
                    {showLoginPass ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#00e5a0", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "DM Sans, sans-serif" }}>
                    {t("login.rememberMe")}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotPhase("phone"); setForgotError(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                    padding: 0,
                  }}
                >
                  {t("login.forgotPassword")}
                </button>
              </div>
              <Button
                variant="accent"
                style={{ width: "100%" }}
                loading={loading}
                onClick={handleLogin}
              >
                {t("login.submit")}
              </Button>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 14,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {t("login.noAccount")}{" "}
                <span
                  onClick={() => switchTab("register")}
                  style={{
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {t("login.registerLink")}
                </span>
              </div>
            </>
          ) : forgotPhase === "phone" ? (
            <div>
              {forgotError && <Alert type="error" style={{ marginBottom: 12 }}>{forgotError}</Alert>}
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
                Enter your registered phone number. We'll send an OTP to reset your password.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Phone Number</label>
                <Input
                  type="tel"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  maxLength={11}
                  autoComplete="tel"
                />
              </div>
              <Button
                variant="accent"
                style={{ width: "100%", marginBottom: 10 }}
                loading={forgotLoading}
                onClick={handleForgotSendOtp}
              >
                Send OTP
              </Button>
              <button
                type="button"
                onClick={() => { setForgotPhase(null); setForgotError(""); }}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
              >
                ← Back to Login
              </button>
            </div>
          ) : forgotPhase === "otp" ? (
            <OtpVerifyPopup
              key={forgotOtpKey}
              phone={forgotPhone}
              loading={forgotLoading}
              error={forgotError}
              onSubmit={handleForgotOtpSubmit}
              onBack={() => { setForgotPhase("phone"); setForgotError(""); }}
              onResend={handleForgotOtpResend}
              backLabel="← Back"
            />
          ) : (
            <div>
              {forgotError && <Alert type="error" style={{ marginBottom: 12 }}>{forgotError}</Alert>}
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
                Enter your new password.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label className="label">New Password</label>
                <div style={{ position: "relative" }}>
                  <Input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, letters + numbers"
                    autoComplete="new-password"
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                  >
                    {showNewPass ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <PasswordStrengthChecker password={newPassword} t={t} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="label">Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <Input
                    type={showNewPassConfirm ? "text" : "password"}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    style={{ paddingRight: "40px", borderColor: newPasswordConfirm && newPassword !== newPasswordConfirm ? "#ef4444" : undefined }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassConfirm(!showNewPassConfirm)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                  >
                    {showNewPassConfirm ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <Button
                variant="accent"
                style={{ width: "100%", marginBottom: 10 }}
                loading={forgotLoading}
                onClick={handlePasswordReset}
              >
                Update Password
              </Button>
              <button
                type="button"
                onClick={() => { setForgotPhase("phone"); setForgotError(""); setNewPassword(""); setNewPasswordConfirm(""); }}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      ) : otpPhase ? (
        <OtpVerifyPopup
          key={resendKey}
          phone={reg.phone}
          loading={otpLoading}
          error={otpError}
          onSubmit={handleOtpVerify}
          onBack={() => { setOtpPhase(false); setOtpError(""); }}
          onResend={handleOtpResend}
          backLabel="← Update Registration Form"
        />
      ) : (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <label className="label">{t("register.name")} *</label>
              <Input
                name="name"
                autoComplete="name"
                value={reg.name}
                onChange={(e) =>
                  setReg((r) => ({ ...r, name: e.target.value }))
                }
                placeholder={t("register.namePlaceholder")}
              />
            </div>
            <div>
              <label className="label">{t("register.phone")} *</label>
              <Input
                name="phone"
                autoComplete="tel"
                value={reg.phone}
                onChange={(e) =>
                  setReg((r) => ({ ...r, phone: e.target.value }))
                }
                placeholder={t("register.phonePlaceholder")}
                maxLength={11}
                type="tel"
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label">{t("register.email")} *</label>
            <Input
              name="email"
              autoComplete="email"
              value={reg.email}
              onChange={(e) => setReg((r) => ({ ...r, email: e.target.value }))}
              placeholder={t("register.emailPlaceholder")}
              type="email"
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label">{t("register.address")} *</label>
            <Input
              name="address"
              autoComplete="street-address"
              value={reg.address}
              onChange={(e) =>
                setReg((r) => ({ ...r, address: e.target.value }))
              }
              placeholder={t("register.addressPlaceholder")}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label">{t("register.password")} *</label>
            <div style={{ position: "relative" }}>
              <Input
                name="new-password"
                autoComplete="new-password"
                value={reg.password}
                onChange={(e) =>
                  setReg((r) => ({ ...r, password: e.target.value }))
                }
                placeholder={t("register.passwordPlaceholder")}
                type={showRegPass ? "text" : "password"}
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowRegPass(!showRegPass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
              >
                {showRegPass ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <PasswordStrengthChecker password={reg.password} t={t} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">{t("register.confirmPassword")} *</label>
            <div style={{ position: "relative" }}>
              <Input
                name="confirm-password"
                autoComplete="new-password"
                value={reg.confirm_password}
                onChange={(e) =>
                  setReg((r) => ({ ...r, confirm_password: e.target.value }))
                }
                placeholder={t("register.confirmPasswordPlaceholder")}
                type={showConfirmPass ? "text" : "password"}
                style={{
                  paddingRight: "40px",
                  borderColor: showPasswordFeedback
                    ? passwordsMatch
                      ? "var(--accent)"
                      : "#ef4444"
                    : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
              >
                {showConfirmPass ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {showPasswordFeedback && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: passwordsMatch ? "var(--accent)" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {passwordsMatch ? (
                  <>
                    <span>✓</span>
                    <span>{t("register.passwordMatch")}</span>
                  </>
                ) : (
                  <>
                    <span>✗</span>
                    <span>{t("register.passwordMismatch")}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", userSelect: "none", fontSize: 13, color: "var(--text-secondary)", fontFamily: "DM Sans, sans-serif" }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#00e5a0", cursor: "pointer", flexShrink: 0 }}
            />
            <span>
              {t("terms.agreePrefix", "I agree to Pawliz's")}{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{t("terms.termsLink", "Terms")}</a>
              {" "}{t("terms.and", "and")}{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{t("terms.privacyLink", "Privacy Policy")}</a>
            </span>
          </label>
          <Button
            variant="accent"
            style={{ width: "100%" }}
            loading={loading}
            onClick={handleRegister}
          >
            {t("register.submit")}
          </Button>
          <div
            style={{
              textAlign: "center",
              marginTop: 14,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            {t("register.hasAccount")}{" "}
            <span
              onClick={() => switchTab("login")}
              style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
            >
              {t("register.loginLink")}
            </span>
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
              {t("register.vetPrompt")}
            </p>
            <button
              onClick={() => { onClose(); openVetReg(); }}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1.5px solid var(--accent)",
                color: "var(--accent)", fontWeight: 600, fontSize: 14,
                fontFamily: "DM Sans, sans-serif", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.target as any).style.background = "var(--accent)"; (e.target as any).style.color = "#000"; }}
              onMouseLeave={(e) => { (e.target as any).style.background = "transparent"; (e.target as any).style.color = "var(--accent)"; }}
            >
              {t("register.vetBtn")}
            </button>
          </div>
        </div>
      )}

    </Modal>
  );
}
