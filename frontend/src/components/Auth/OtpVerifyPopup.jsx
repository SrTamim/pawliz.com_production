import { useState, useEffect } from "react";
import { Alert } from "../UI";

export default function OtpVerifyPopup({
  phone,
  onSubmit,
  onBack,
  onResend,
  loading,
  error,
  backLabel = "← Update Form",
}) {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const expired = timeLeft === 0;

  useEffect(() => {
    setOtp("");
    setTimeLeft(120);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
  };

  const handleResend = () => {
    if (onResend) onResend();
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
        An OTP has been sent to{" "}
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{phone}</span>.
        Please enter it below to verify.
      </p>

      {error && <Alert type="error" style={{ marginBottom: 12 }}>{error}</Alert>}

      <div style={{ marginBottom: 12 }}>
        <label className="label">OTP Code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={handleOtpChange}
          disabled={expired}
          placeholder="Enter 6-digit OTP"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            background: "var(--bg-input, var(--bg-elevated))",
            color: "var(--text-primary)",
            fontSize: 18,
            letterSpacing: 6,
            fontFamily: "DM Sans, monospace",
            outline: "none",
            opacity: expired ? 0.5 : 1,
            boxSizing: "border-box",
          }}
          autoComplete="one-time-code"
        />
      </div>

      <div style={{ marginBottom: 16, minHeight: 20 }}>
        {!expired ? (
          <p style={{ fontSize: 12, color: timeLeft < 30 ? "#ef4444" : "var(--text-secondary)", margin: 0 }}>
            OTP expires in{" "}
            <span style={{ fontWeight: 600 }}>{mm}:{ss}</span>
          </p>
        ) : (
          <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>
            OTP Expired. Click Resend to get a new OTP.
          </p>
        )}
      </div>

      {expired && (
        <button
          type="button"
          onClick={handleResend}
          style={{
            width: "100%",
            padding: "10px 0",
            marginBottom: 10,
            borderRadius: 8,
            cursor: "pointer",
            background: "transparent",
            border: "1.5px solid var(--accent)",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 14,
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Resend OTP
        </button>
      )}

      <button
        type="button"
        disabled={otp.length !== 6 || expired || loading}
        onClick={() => onSubmit(otp)}
        style={{
          width: "100%",
          padding: "11px 0",
          marginBottom: 10,
          borderRadius: 8,
          cursor: otp.length !== 6 || expired || loading ? "not-allowed" : "pointer",
          background: otp.length === 6 && !expired && !loading ? "var(--accent)" : "var(--bg-elevated)",
          border: "none",
          color: otp.length === 6 && !expired && !loading ? "#000" : "var(--text-secondary)",
          fontWeight: 700,
          fontSize: 15,
          fontFamily: "DM Sans, sans-serif",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Verifying..." : "Verify OTP"}
      </button>

      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent)",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
          padding: "4px 0",
          display: "block",
        }}
      >
        {backLabel}
      </button>
    </div>
  );
}
