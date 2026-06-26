import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { profileAPI, getImageUrl } from "../lib/api";
import { Button } from "./UI";
import { BadgePill } from "./Profile/ProfileCompletion";
import NotificationBell from "./Notifications/NotificationBell";


function LangToggle() {
  const { lang, setLang } = useLang();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const next = lang === "en" ? "bn" : "en";
  const label = lang === "en" ? "EN" : "বাং";

  return (
    <button
      onClick={() => setLang(next)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title={lang === "en" ? "Switch to বাংলা" : "Switch to English"}
      style={{
        minWidth: 40,
        height: 40,
        padding: "0 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "var(--bg-hover)" : "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: lang === "bn" ? 13 : 12,
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily:
          lang === "bn"
            ? "'Hind Siliguri', 'DM Sans', sans-serif"
            : "inherit",
        letterSpacing: lang === "bn" ? 0 : "0.5px",
        transition: "all 0.25s ease",
        transform: pressed ? "scale(0.95)" : hovered ? "scale(1.08)" : "scale(1)",
        boxShadow: hovered ? "0 4px 12px var(--shadow-lg)" : "none",
        backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

export default function Navbar({
  onOpenAuth,
  onOpenDonate,
  theme,
  onToggleTheme,
}: any) {
  const { t } = useTranslation("common");
  const { user, logout, isAdmin, isStaff, isVet } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [completion, setCompletion] = useState<any>(null);
  const menuRef = useRef<any>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchCompletion = () => {
    if (user) {
      profileAPI
        .completion()
        .then((res: any) => setCompletion(res))
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (user) {
      fetchCompletion();
    } else {
      setCompletion(null);
    }
  }, [user]);

  useEffect(() => {
    router.events.on("routeChangeComplete", fetchCompletion);
    return () => router.events.off("routeChangeComplete", fetchCompletion);
  }, [user]);

  return (
    <header
      className="site-header"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--header-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 32px",
        zIndex: 10000,
        transition: "background 0.3s ease",
      }}
    >
      {/* Logo */}
      <div
        onClick={() => router.push("/")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          cursor: "pointer",
          transition: "transform 0.3s ease, opacity 0.2s ease",
          padding: "8px 4px",
        }}
        onMouseEnter={(e: any) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e: any) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.opacity = "1";
        }}
      >
        <img
          src="/logo.svg"
          alt="Pawliz"
          width={isMobile ? 36 : 42}
          height={isMobile ? 36 : 42}
          style={{
            width: isMobile ? 36 : 42,
            height: isMobile ? 36 : 42,
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0, 184, 122, 0.3)",
            transition: "all 0.3s ease",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontFamily: "Roboto, sans-serif",
            fontWeight: 800,
            fontSize: isMobile ? 16 : 22,
            color: "var(--text-primary)",
            letterSpacing: "-0.5px",
          }}
        >
          Paw<span style={{ color: "var(--accent)" }}>liz</span>
        </div>
      </div>

      {/* Right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 6 : 10,
          justifyContent: "flex-end",
        }}
      >
        {!isMobile && (
          <Button
            variant="donate"
            onClick={onOpenDonate}
            style={{
              borderRadius: "10px",
              padding: "7px 14px",
              fontWeight: 700,
              fontSize: 14,
              transition: "all 0.25s ease",
            }}
          >
            {t("nav.donate")}
          </Button>
        )}

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: "pointer",
            color: "var(--text-secondary)",
            transition: "color 0.25s ease, border-color 0.25s ease, transform 0.15s ease",
          }}
          aria-label="Toggle theme"
          onMouseEnter={(e: any) => {
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--mint-ring)";
          }}
          onMouseLeave={(e: any) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseDown={(e: any) => {
            e.currentTarget.style.transform = "scale(0.95)";
          }}
          onMouseUp={(e: any) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {theme === "dark" ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          )}
        </button>

        {/* Language toggle */}
        <LangToggle />

        {user && <NotificationBell />}

        {user ? (
          <div ref={menuRef} style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v: any) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
                padding: "6px 8px",
                borderRadius: 10,
                transition: "all 0.25s ease",
                background: menuOpen ? "rgba(0, 184, 122, 0.1)" : "transparent",
              }}
              onMouseEnter={(e: any) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = "rgba(0, 184, 122, 0.08)";
                }
              }}
              onMouseLeave={(e: any) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {!isMobile && completion && (
                <BadgePill badge={completion.badge} small />
              )}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "42% 58% 56% 44% / 50% 44% 56% 50%",
                  backgroundImage: user?.profile_picture
                    ? `url('${getImageUrl(user.profile_picture)}')`
                    : "var(--grad-cool)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: "var(--font-head)",
                  color: "var(--on-accent)",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                  boxShadow: "var(--shadow-glow)",
                }}
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.transform = "scale(1.08)";
                  e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "var(--shadow-glow)";
                }}
              >
                {!user?.profile_picture && user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: 52,
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 12,
                  minWidth: 240,
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 100,
                  animation: "fadeIn 0.2s ease",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--text-primary)",
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    padding: "0 12px 8px",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    fontWeight: 500,
                  }}
                >
                  {user.role}
                </div>
                {/* Completion mini bar */}
                {completion && (
                  <div style={{ padding: "10px 12px 12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {t("profile.label")}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--accent)",
                        }}
                      >
                        {completion.percentage}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: "var(--bg-elevated)",
                        borderRadius: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${completion.percentage}%`,
                          background:
                            "linear-gradient(90deg, var(--accent), #00b87a)",
                          borderRadius: 6,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    {completion.percentage < 95 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 6,
                        }}
                      >
                        {t("profile.completePrompt")}
                      </div>
                    )}
                  </div>
                )}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    margin: "8px 0",
                  }}
                />
                {isStaff && (
                  <MenuRow
                    icon="⚙️"
                    label={t("nav.adminPanel")}
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/admin");
                    }}
                  />
                )}
                {isVet && (
                  <MenuRow
                    icon="🏥"
                    label={t("nav.vetDashboard")}
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/vet-dashboard");
                    }}
                  />
                )}
                {isMobile && (
                  <MenuRow
                    icon="♥"
                    label={t("nav.donate").replace("♥ ", "")}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDonate();
                    }}
                  />
                )}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    margin: "8px 0",
                  }}
                />
                <MenuRow
                  icon="ℹ️"
                  label="About Pawliz"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/about");
                  }}
                />
                <MenuRow
                  icon="🔒"
                  label="Privacy Policy"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/privacy");
                  }}
                />
                <MenuRow
                  icon="📋"
                  label="Terms & Conditions"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/terms");
                  }}
                />
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    margin: "8px 0",
                  }}
                />
                <MenuRow
                  icon="🚪"
                  label={t("nav.logout")}
                  danger
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {!isMobile && (
              <button
                onClick={() => router.push("/about")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  padding: "8px 10px",
                  borderRadius: 8,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                About
              </button>
            )}
            {!isMobile && (
              <Button
                variant="ghost"
                onClick={() => onOpenAuth("login")}
                style={{
                  borderRadius: "10px",
                  padding: "10px 18px",
                  fontWeight: 700,
                  fontSize: 14,
                  transition: "all 0.25s ease",
                }}
              >
                {t("nav.login")}
              </Button>
            )}
            <Button
              variant="accent"
              onClick={() => onOpenAuth(isMobile ? "login" : "register")}
              style={{
                borderRadius: "10px",
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: 14,
                transition: "all 0.25s ease",
              }}
            >
              {isMobile ? t("nav.login") : t("nav.register")}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

function MenuRow({ icon, label, danger, onClick }: any) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        color: danger ? "var(--danger)" : "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "all 0.2s ease",
        background: isHovered
          ? danger
            ? "rgba(255,79,106,0.12)"
            : "rgba(0, 184, 122, 0.08)"
          : "transparent",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e: any) => {
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e: any) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
