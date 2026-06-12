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

  const navItems = [
    {
      label: t("bottomNav.home"),
      icon: "🏠",
      path: "/",
    },
    {
      label: t("bottomNav.helpBoard"),
      icon: "📋",
      path: "/help-board",
    },
    {
      label: t("bottomNav.community"),
      icon: "👥",
      path: "/community",
    },
    {
      label: t("bottomNav.myProfile"),
      icon: "👤",
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
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        zIndex: 1000,
        transition: "all 0.3s ease",
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
            <span style={{ fontSize: 24, lineHeight: 1 }}>{item.icon}</span>
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
