import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useNavbar } from "../context/NavbarContext";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function BottomNavBar() {
  const router = useRouter();
  const { user } = useAuth();
  const { openAuth } = useNavbar();
  const { t } = useTranslation("common");

  const isActive = (path: any) => {
    return router.pathname === path;
  };

  const handleProfileClick = (e: any) => {
    if (!user) {
      e.preventDefault();
      openAuth("login");
    }
  };

  const iconProps = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const navItems = [
    {
      label: t("bottomNav.home"),
      icon: <svg {...iconProps}><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>,
      path: "/",
    },
    {
      label: t("bottomNav.helpBoard"),
      icon: <svg {...iconProps}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></svg>,
      path: "/help-board",
    },
    {
      label: t("bottomNav.community"),
      icon: <svg {...iconProps}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /></svg>,
      path: "/community",
    },
    {
      label: t("bottomNav.myProfile"),
      icon: <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>,
      path: "/profile",
      isProtected: true,
    },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--glass-nav)",
        WebkitBackdropFilter: "blur(18px)",
        backdropFilter: "blur(18px)",
        borderTop: "1px solid var(--border)",
        zIndex: 1000,
        transition: "background 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: 80,
          maxWidth: "100%",
          padding: "0 8px",
        }}
      >
        {navItems.map((item: any) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch={false}
            onClick={item.isProtected ? handleProfileClick : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 8,
              transition: "all 0.3s ease",
              textDecoration: "none",
              background: isActive(item.path)
                ? "var(--accent-dim)"
                : "transparent",
              color: isActive(item.path)
                ? "var(--accent)"
                : "var(--text-secondary)",
              gap: 4,
            }}
            onMouseEnter={(e: any) => {
              if (!isActive(item.path)) {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e: any) => {
              if (!isActive(item.path)) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <span style={{ display: "flex", lineHeight: 1 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
