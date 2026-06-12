import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const PROFILE_FIELDS_CLINIC = [
  "cover_image", "name", "address", "email", "services", "location_name",
  "latitude", "longitude",
];

function completionPct(vet: any, documents: any, clinicVets: any, clinicContacts: any) {
  if (!vet) return 0;
  let filled = PROFILE_FIELDS_CLINIC.filter((f: any) => vet[f] && (Array.isArray(vet[f]) ? vet[f].length > 0 : true)).length;
  let total = PROFILE_FIELDS_CLINIC.length + 3;
  if (clinicContacts?.length) filled++;
  if (clinicVets?.length) filled++;
  if (documents?.length) filled++;
  return Math.round((filled / total) * 100);
}

export default function VetOverview({ vet, qualifications, documents, clinicVets, clinicContacts, reviews, claimedVet, onSectionChange, onRefresh }: any) {
  const { t } = useTranslation("vet");
  const [isMobile, setIsMobile] = useState(false);
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!vet) return;
    if (vet.approval_status === "approved") {
      const key = `pawliz_vet_approval_seen_${vet.id}`;
      if (!localStorage.getItem(key)) {
        setShowApprovedBanner(true);
      }
    }
  }, [vet]);

  const dismissApprovedBanner = () => {
    const key = `pawliz_vet_approval_seen_${vet.id}`;
    localStorage.setItem(key, "1");
    setShowApprovedBanner(false);
  };

  if (!vet) return null;

  const pct = completionPct(vet, documents, clinicVets, clinicContacts);
  const isApproved = vet.approval_status === "approved";
  const isPending = vet.approval_status === "pending";
  const isRejected = vet.approval_status === "rejected";

  const isClaimPending = claimedVet?.status === "pending_claim" ||
    (claimedVet?.status === "claimed" && claimedVet?.approval_status === "pending");
  const isClaimApproved = claimedVet?.status === "claimed" && claimedVet?.approval_status === "approved";

  const avgRating = reviews?.length
    ? (reviews.reduce((s: any, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  const cards = [
    { label: t("overview.profileCompletion"), value: `${pct}%`, color: pct >= 80 ? "#00e5a0" : pct >= 50 ? "#f0a500" : "#ff4f6a" },
    { label: t("overview.totalReviews"), value: reviews?.length ?? 0, color: "var(--accent)" },
    { label: t("overview.avgRating"), value: avgRating, color: "#f0a500" },
    { label: t("overview.clinicVetsCount"), value: clinicVets?.length ?? 0, color: "var(--accent)" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
        {t("overview.welcome", { name: vet.name })}
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        {t("overview.clinicType")} — {vet.name}
      </p>

      {/* 1. One-time vet account approval message */}
      {showApprovedBanner && (
        <div style={{ position: "relative", padding: "14px 42px 14px 18px", borderRadius: 10, background: "#00e5a018", border: "1px solid #00e5a0", color: "#00e5a0", marginBottom: 16, fontSize: 14 }}>
          <strong>Approved</strong> — Your profile is live on the Pawliz map.
          <button
            onClick={dismissApprovedBanner}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#00e5a0", fontSize: 18, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Claim clinic approval update message */}
      {isClaimApproved && !isApproved && (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "#00e5a018", border: "1px solid #00e5a0", color: "#00e5a0", marginBottom: 16, fontSize: 14 }}>
          <strong>Claim Approved</strong> — Your claim for <strong>{claimedVet.name}</strong> was approved. Your profile is now verified.
        </div>
      )}
      {!isClaimPending && !isClaimApproved && isPending && (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "#f0a50018", border: "1px solid #f0a500", color: "#f0a500", marginBottom: 16, fontSize: 14 }}>
          <strong>{t("status.pending")}</strong> — {t("overview.pendingMsg")}
        </div>
      )}
      {isRejected && (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "#ff4f6a18", border: "1px solid #ff4f6a", color: "#ff4f6a", marginBottom: 16, fontSize: 14 }}>
          <strong>{t("status.rejected")}</strong>{vet.rejection_reason ? `: ${vet.rejection_reason}` : "."} {t("overview.rejectedMsg")}
        </div>
      )}

      {/* 3. Claim pending banner */}
      {isClaimPending && (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(99,179,237,0.1)", border: "1px solid #63b3ed", color: "#63b3ed", marginBottom: 16, fontSize: 14 }}>
          <strong>Claim Pending Review</strong> — Your claim for <strong>{claimedVet.name}</strong> is awaiting admin approval.
        </div>
      )}

      {/* 4. Statistics */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))", gap: isMobile ? 12 : 16, marginBottom: 32 }}>
        {cards.map((c: any) => (
          <div key={c.label} style={{
            background: "var(--bg-card)", borderRadius: 12, padding: isMobile ? "16px 12px" : "20px 16px",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: c.color, fontFamily: "Syne, sans-serif" }}>{c.value}</div>
            <div style={{ fontSize: isMobile ? 12 : 13, color: "var(--text-secondary)", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* 5. Quick Actions */}
      <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>{t("overview.quickActions")}</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => onSectionChange("profile")}
          style={{
            padding: "10px 20px", borderRadius: 8, cursor: "pointer",
            background: "var(--accent)", border: "none", color: "#000",
            fontWeight: 600, fontSize: 14, fontFamily: "DM Sans, sans-serif",
          }}
        >
          {t("overview.updateProfile")}
        </button>
        <button
          onClick={() => onSectionChange("reviews")}
          style={{
            padding: "10px 20px", borderRadius: 8, cursor: "pointer",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontWeight: 500, fontSize: 14, fontFamily: "DM Sans, sans-serif",
          }}
        >
          {t("overview.viewReviews")}
        </button>
      </div>
    </div>
  );
}
