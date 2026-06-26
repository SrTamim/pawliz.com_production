import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../lib/api";
import {
  Button,
  Loading,
  EmptyState,
  Alert,
  Badge,
  Pagination,
  Input,
  Spinner,
} from "../UI";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { PAGES, PAGE_CATEGORIES } from "./permissions";
import OverviewSection from "./dashboard/OverviewSection";
import VetsSection from "./dashboard/VetsSection";
import UsersSection from "./dashboard/UsersSection";
import ReviewsSection from "./dashboard/ReviewsSection";
import DonationSection from "./dashboard/DonationSection";
import SettingsSection from "./dashboard/SettingsSection";
import RolesSection from "./dashboard/RolesSection";
import PetsSection from "./dashboard/PetsSection";
import LostPetsSection from "./dashboard/LostPetsSection";
import AdoptablePetsSection from "./dashboard/AdoptablePetsSection";
import FoundPetsSection from "./dashboard/FoundPetsSection";
import RescuePetsSection from "./dashboard/RescuePetsSection";
import CommentsManagementSection from "./dashboard/CommentsManagementSection";
import CommunityPostsManagementSection from "./dashboard/CommunityPostsManagementSection";
import ClaimRequestsSection from "./dashboard/ClaimRequestsSection";
import SmsSettingsSection from "./dashboard/SmsSettingsSection";

export default function AdminDashboard() {
  const router = useRouter();
  const { can, user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Sidebar items the current user may see (admin sees all incl. Role Manager).
  // permissions registry is the single source of truth for nav + gating.
  const visiblePages = PAGES.filter((p: any) => can(p.key));
  const [section, setSection] = useState(
    () => visiblePages[0]?.key || "overview",
  );

  // If the active section is no longer permitted (perms changed mid-session),
  // fall back to the first allowed page so a manager never sees a blank/denied view.
  useEffect(() => {
    if (!visiblePages.find((p: any) => p.key === section)) {
      setSection(visiblePages[0]?.key || "overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.permissions]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        paddingTop: "var(--header-height)",
        height: "calc(100vh - 80px)",
        background: "var(--bg-primary)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sub-header */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          padding: isMobile ? "0 14px" : "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isMobile && (
            <button
              onClick={() => setNavOpen((v: any) => !v)}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ☰
            </button>
          )}
          <div
            style={{
              fontFamily: "Roboto, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            ⚙️ Admin Panel
            <span
              style={{
                padding: "3px 10px",
                background: "var(--accent-dim)",
                border: "1px solid var(--border-accent)",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              DASHBOARD
            </span>
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          ← Back
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Sidebar Nav - overlay on mobile */}
        {(isMobile ? navOpen : true) && (
          <>
            {isMobile && (
              <div
                onClick={() => setNavOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  zIndex: 10,
                }}
              />
            )}
            <nav
              style={{
                width: 220,
                minWidth: 220,
                background: "var(--bg-secondary)",
                borderRight: "1px solid var(--border)",
                padding: "16px 10px",
                overflowY: "auto",
                ...(isMobile
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      zIndex: 11,
                      boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
                    }
                  : {}),
              }}
            >
              {PAGE_CATEGORIES.map((cat: any, catIndex: number) => {
                // Pages in this category the current user is allowed to see.
                // Skip the whole category (heading included) when empty so a
                // limited-permission manager never sees a bare heading.
                const group = visiblePages.filter(
                  (p: any) => p.category === cat.id,
                );
                if (group.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        padding: "0 14px",
                        marginTop: catIndex === 0 ? 0 : 16,
                        marginBottom: 6,
                      }}
                    >
                      {cat.label}
                    </div>
                    {group.map((item: any) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setSection(item.key);
                          if (isMobile) setNavOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: section === item.key ? 600 : 500,
                          color:
                            section === item.key
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                          cursor: "pointer",
                          border: "none",
                          background:
                            section === item.key ? "var(--accent-dim)" : "transparent",
                          fontFamily: "DM Sans, sans-serif",
                          width: "100%",
                          textAlign: "left",
                          marginBottom: 3,
                          transition: "all 0.2s",
                        }}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
          </>
        )}

        {/* Content */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 28 }}
        >
          {section === "overview" && <OverviewSection onNavigate={setSection} />}
          {section === "vets" && <VetsSection />}
          {section === "claim-requests" && <ClaimRequestsSection />}
          {section === "users" && <UsersSection />}
          {section === "pets" && <PetsSection />}
          {section === "lost-pets-mgmt" && <LostPetsSection />}
          {section === "adoptable-pets" && <AdoptablePetsSection />}
          {section === "found-pets" && <FoundPetsSection />}
          {section === "rescue-pets" && <RescuePetsSection />}
          {section === "reviews" && <ReviewsSection />}
          {section === "donation" && <DonationSection />}
          {section === "comments" && <CommentsManagementSection />}
          {section === "community-posts" && <CommunityPostsManagementSection />}
          {section === "settings" && <SettingsSection />}
          {section === "sms-settings" && <SmsSettingsSection />}
          {section === "roles" && <RolesSection />}
        </div>
      </div>
    </div>
  );
}
