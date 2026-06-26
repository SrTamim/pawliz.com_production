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
}: any) {
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
      setTimeLeft((t: any) => {
        if (t <= 1) { clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const handleOtpChange = (e: any) => {
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
        <label className="label" style={{ textAlign: "center" }}>OTP Code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={handleOtpChange}
          disabled={expired}
          placeholder="••••••"
          className="keep-latin"
          style={{
            width: "100%",
            height: 60,
            padding: "0 14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-2)",
            background: "var(--field)",
            color: "var(--text-primary)",
            fontSize: 26,
            textAlign: "center",
            letterSpacing: 14,
            fontFamily: "var(--font-head)",
            fontWeight: 800,
            outline: "none",
            opacity: expired ? 0.5 : 1,
            boxSizing: "border-box",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e: any) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 4px var(--mint-soft)"; }}
          onBlur={(e: any) => { e.target.style.borderColor = "var(--border-2)"; e.target.style.boxShadow = "none"; }}
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
          className="btn btn-outline btn-block"
          style={{ marginBottom: 10 }}
        >
          Resend OTP
        </button>
      )}

      <button
        type="button"
        disabled={otp.length !== 6 || expired || loading}
        onClick={() => onSubmit(otp)}
        className="btn btn-primary btn-block"
        style={{ marginBottom: 10, opacity: otp.length !== 6 || expired || loading ? 0.6 : 1, cursor: otp.length !== 6 || expired || loading ? "not-allowed" : "pointer" }}
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
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
          padding: "4px 0",
          display: "block",
          margin: "0 auto",
        }}
      >
        {backLabel}
      </button>
    </div>
  );
}
