import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const STARS = [5, 4, 3, 2, 1];

function StarDisplay({ rating }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? "#f0a500" : "var(--border)", fontSize: 15 }}>★</span>
      ))}
    </span>
  );
}

export default function VetReviews({ reviews }) {
  const { t } = useTranslation("vet");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!reviews) return null;

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const dist = STARS.reduce((acc, s) => {
    acc[s] = reviews.filter((r) => r.rating === s).length;
    return acc;
  }, {});

  return (
    <div>
      <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne, sans-serif", marginBottom: 24 }}>
        {t("vetReviews.title")}
      </h2>

      {reviews.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          {t("vetReviews.noReviews")}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: isMobile ? 16 : 24, marginBottom: 28, background: "var(--bg-card)", padding: isMobile ? "16px 12px" : "20px 24px", borderRadius: 12, border: "1px solid var(--border)", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", minWidth: isMobile ? "100%" : "auto" }}>
              <div style={{ fontSize: isMobile ? 36 : 48, fontWeight: 700, color: "#f0a500", lineHeight: 1 }}>{avg}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{t("vetReviews.outOf5")}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{t("detail.reviewsCount", { count: reviews.length })}</div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              {STARS.map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 10 }}>{s}</span>
                  <span style={{ color: "#f0a500", fontSize: 12 }}>★</span>
                  <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", background: "#f0a500", borderRadius: 3,
                      width: reviews.length ? `${(dist[s] / reviews.length) * 100}%` : "0%",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 16, textAlign: "right" }}>{dist[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{
                background: "var(--bg-card)", borderRadius: 10, padding: "16px 18px",
                border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{r.user_name}</span>
                    <span style={{ marginLeft: 10 }}><StarDisplay rating={r.rating} /></span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(r.created_at).toLocaleDateString("en-BD")}
                  </span>
                </div>
                {r.comment && <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
