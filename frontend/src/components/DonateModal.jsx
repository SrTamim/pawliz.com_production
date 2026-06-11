import { useEffect, useState } from "react";
import { Modal, Loading } from "./UI";
import { donationsAPI, API_SERVER } from "../lib/api";

export default function DonateModal({ open, onClose }) {
  const [donation, setDonation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    donationsAPI
      .get()
      .then((r) => setDonation(r.donation))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="">
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Roboto, sans-serif",
            fontWeight: 900,
            fontSize: 24,
            color: "var(--text-primary)",
            marginBottom: 10,
          }}
        >
          {donation?.title || "Help Us Save Lives"}
        </div>

        <div
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 12,
            padding: "0 8px",
          }}
        >
          Every day, animals across Bangladesh suffer — abandoned on streets,
          injured, sick, and alone. <strong style={{ color: "var(--text-primary)" }}>Your donation gives them a second chance.</strong>
        </div>

        <div
          style={{
            background: "var(--bg-elevated)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 16,
            textAlign: "left",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontFamily: "Roboto, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: 10,
            }}
          >
            Your donation helps us
          </div>
          {[
            { icon: "🚑", text: "Rescue injured & abandoned animals" },
            { icon: "💉", text: "Cover emergency vet expenses" },
            { icon: "🏠", text: "Provide shelter and food to strays" },
            { icon: "❤️", text: "Support long-term pet wellbeing programs" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
                fontSize: 13,
                color: "var(--text-primary)",
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <div
              style={{
                width: 200,
                height: 200,
                margin: "0 auto 16px",
                borderRadius: 12,
                overflow: "hidden",
                border: "2px solid var(--border-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
              }}
            >
              {donation?.qr_code_image_url ? (
                <img
                  src={`${API_SERVER}${donation.qr_code_image_url}`}
                  alt="bKash QR Code"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 48 }}>📱</span>
                  <span style={{ textAlign: "center", lineHeight: 1.5 }}>
                    Scan to donate via
                    <br />
                    <strong style={{ color: "#e2136e", fontSize: 15 }}>
                      bKash
                    </strong>
                  </span>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </Modal>
  );
}
