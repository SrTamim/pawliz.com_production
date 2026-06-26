import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { contactPostAPI } from "../lib/api";

const BD_PHONE_RE = /^(?:\+8801|01)[3-9]\d{8}$/;

export default function ContactFormModal({ open, onClose, postId, postType, ownerName }: any) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handlePhoneChange = (val: any) => {
    setPhone(val);
    if (val && !BD_PHONE_RE.test(val.trim())) {
      setPhoneError("Enter valid BD number (e.g. 01712345678)");
    } else {
      setPhoneError("");
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!BD_PHONE_RE.test(phone.trim())) {
      setPhoneError("Enter valid BD number (e.g. 01712345678)");
      return;
    }
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await contactPostAPI.send(postId, postType, phone.trim(), message.trim());
      toast("Contact request sent!", "success");
      setPhone("");
      setMessage("");
      setPhoneError("");
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to send contact request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{
        background: "rgba(5,8,15,0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "16px 12px",
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        className="glass-modal p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            Contact {ownerName || "Owner"}
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">
              Your Contact Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e: any) => handlePhoneChange(e.target.value)}
              placeholder="e.g. 01712345678"
              maxLength={14}
              required
              className="input-field w-full"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${phoneError ? "var(--danger)" : "var(--border)"}`,
              }}
            />
            {phoneError && (
              <p className="text-xs text-[var(--danger)] mt-1">{phoneError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e: any) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Write your message to the owner..."
              maxLength={500}
              required
              rows={4}
              className="input-field w-full resize-none"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{message.length}/500</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!phoneError || !phone.trim() || !message.trim()}
              className="px-5 py-2 text-sm font-semibold bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
