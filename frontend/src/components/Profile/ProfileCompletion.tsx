import { useState, useEffect } from "react";

const BADGE_CONFIG = {
  bronze: {
    label: "Bronze",
    emoji: "🥉",
    color: "#cd7f32",
    darkColor: "#8b5a2b",
    bg: "rgba(205,127,50,0.12)",
    darkBg: "rgba(205,127,50,0.15)",
    desc: "Keep going!",
  },
  gold: {
    label: "Gold",
    emoji: "🥇",
    color: "#ffd700",
    darkColor: "#b89d00",
    bg: "rgba(255,215,0,0.12)",
    darkBg: "rgba(255,215,0,0.18)",
    desc: "Great progress!",
  },
  diamond: {
    label: "Diamond",
    emoji: "💎",
    color: "#b9f2ff",
    darkColor: "#0099cc",
    bg: "rgba(185,242,255,0.12)",
    darkBg: "rgba(0,153,204,0.15)",
    desc: "Profile complete!",
  },
};

export function BadgePill({ badge, small = false, theme = "dark" }: any) {
  const cfg = (BADGE_CONFIG as any)[badge] || BADGE_CONFIG.bronze;
  const isLight =
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("light")
      : theme === "light";
  const textColor = isLight ? cfg.darkColor : cfg.color;
  const bgColor = isLight ? cfg.darkBg : cfg.bg;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 4 : 6,
        padding: small ? "3px 8px" : "5px 12px",
        borderRadius: 20,
        background: bgColor,
        border: `1px solid ${textColor}40`,
        fontSize: small ? 11 : 13,
        fontWeight: 700,
        color: textColor,
      }}
    >
      <span style={{ fontSize: small ? 13 : 16 }}>{cfg.emoji}</span>
      {cfg.label}
    </div>
  );
}

export default function ProfileCompletion({
  percentage,
  badge,
  motivate = false,
}: any) {
  const cfg = (BADGE_CONFIG as any)[badge] || BADGE_CONFIG.bronze;
  const barColor = "#22c55e"; // Green color for progress bar
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: isMobile ? 16 : 20 }}>{cfg.emoji}</span>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              Profile Completion
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {cfg.desc}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BadgePill badge={badge} small={isMobile} />
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: barColor }}>
            {percentage}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 8,
          background: "var(--bg-elevated)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
            borderRadius: 6,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {/* Milestone markers */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 6,
        }}
      >
        <span>🥉 Bronze</span>
        <span style={{ color: percentage >= 50 ? "#22c55e" : undefined }}>
          🥇 Gold (50%)
        </span>
        <span style={{ color: percentage >= 100 ? "#22c55e" : undefined }}>
          💎 Diamond (100%)
        </span>
      </div>

      {motivate && percentage < 100 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--bg-elevated)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          {percentage < 50
            ? "🚀 Complete your profile to unlock the Gold badge and more features!"
            : "🌟 Almost there! Complete all fields to unlock the Diamond badge!"}
        </div>
      )}
    </div>
  );
}
