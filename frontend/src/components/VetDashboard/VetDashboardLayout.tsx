import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/router";

export default function VetDashboardLayout({ activeSection, onSectionChange, children, vet, claimedVet }: any) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation("vet");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isClaimPending = claimedVet?.status === "pending_claim";

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const NAV_ITEMS = [
    { key: "overview", label: t("dashboard.overview"), icon: "🏠" },
    { key: "profile", label: t("dashboard.profileDetails"), icon: "📋" },
    { key: "reviews", label: t("dashboard.reviews"), icon: "⭐" },
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const statusColor = ({
    pending: "#f0a500",
    approved: "#00e5a0",
    rejected: "#ff4f6a",
  } as any)[vet?.approval_status] || "#888";

  const statusLabel = ({
    pending: t("status.pending"),
    approved: t("status.approved"),
    rejected: t("status.rejected"),
  } as any)[vet?.approval_status] || t("status.unknown");

  const headerHeight = isMobile ? "56px" : "64px";
  const bottomNavHeight = "80px";

  return (
    <div style={{
      display: "flex",
      minHeight: `calc(100vh - ${headerHeight})`,
      background: "var(--bg-page)",
      flexDirection: isMobile ? "column" : "row",
      paddingTop: headerHeight,
      paddingBottom: bottomNavHeight,
    }}>
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            top: headerHeight,
            left: 0,
            right: 0,
            bottom: bottomNavHeight,
            background: "rgba(0,0,0,0.5)",
            zIndex: 35,
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile sidebar toggle button — always visible */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: "fixed",
            top: `calc(${headerHeight} + 12px)`,
            left: 12,
            zIndex: 60,
            width: 40, height: 40, borderRadius: 8,
            background: "var(--accent)", border: "none",
            cursor: "pointer", fontSize: 18, color: "#000",
            fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          height: isMobile ? `calc(100vh - ${headerHeight} - ${bottomNavHeight})` : `calc(100vh - ${headerHeight} - ${bottomNavHeight})`,
          overflowY: "auto",
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border)",
          display: sidebarOpen || !isMobile ? "flex" : "none",
          flexDirection: "column", flexShrink: 0,
          position: isMobile ? "fixed" : "sticky",
          top: isMobile ? headerHeight : headerHeight,
          left: 0,
          zIndex: isMobile ? 40 : "auto",
          maxHeight: isMobile ? `calc(100vh - ${headerHeight} - ${bottomNavHeight})` : `calc(100vh - ${headerHeight} - ${bottomNavHeight})`,
        }}
      >
        {/* Logo area */}
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div
            onClick={() => router.push("/")}
            style={{ cursor: "pointer", fontSize: 20, fontWeight: 700, color: "var(--accent)", fontFamily: "Syne, sans-serif", marginBottom: 12 }}
          >
            Pawliz
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("dashboard.clinicDashboard")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            {vet?.name || user?.name}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 20,
            background: `${statusColor}22`, color: statusColor, fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
            {statusLabel}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {NAV_ITEMS.map((item: any) => {
            const blocked = isClaimPending && (item.key === "profile" || item.key === "reviews");
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (blocked) return;
                  onSectionChange(item.key);
                  if (isMobile) setSidebarOpen(false);
                }}
                title={blocked ? "Available after claim is reviewed by admin" : undefined}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px", border: "none",
                  cursor: blocked ? "not-allowed" : "pointer",
                  background: activeSection === item.key ? "var(--accent)18" : "transparent",
                  color: blocked ? "var(--text-secondary)" : activeSection === item.key ? "var(--accent)" : "var(--text-secondary)",
                  opacity: blocked ? 0.4 : 1,
                  fontWeight: activeSection === item.key ? 600 : 400,
                  fontSize: 14, fontFamily: "DM Sans, sans-serif",
                  borderLeft: activeSection === item.key ? "3px solid var(--accent)" : "3px solid transparent",
                  transition: "all 0.15s", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, minWidth: 0,
        paddingTop: isMobile ? "64px" : "32px",
        paddingLeft: isMobile ? "12px" : "24px",
        paddingRight: isMobile ? "12px" : "24px",
        paddingBottom: isMobile ? "24px" : "32px",
      }}>
        {children}
      </main>
    </div>
  );
}
