import { useEffect, useState } from "react";

/**
 * PWA install prompt.
 *
 * Mirrors OfflineIndicator / CustomChatLauncher: self-contained, inline styles,
 * brand var(--accent), fixed position, returns null when not applicable.
 *
 * - Chromium/Android: captures `beforeinstallprompt`, shows an "Install App"
 *   button that triggers the native prompt (single-use).
 * - iOS Safari: never fires beforeinstallprompt, so we detect it and show brief
 *   "Add to Home Screen" instructions instead.
 * - Hidden entirely when already installed (standalone) or previously dismissed.
 *
 * Positioned as a bottom banner ABOVE the 80px BottomNavBar (bottom:80) and
 * BELOW the floating chat button (zIndex 999) — zIndex 98. The right gutter is
 * kept clear so the round chat bubble at right:16/bottom:96 doesn't overlap.
 */

const DISMISS_KEY = "pawliz_install_dismissed";
// Re-show the banner this long after a dismiss/install so we don't permanently
// suppress it (a user may uninstall later). 1 hour.
const SNOOZE_MS = 60 * 60 * 1000;

function isStandalone() {
  return (
    (typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && navigator.standalone === true)
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  // Exclude Chrome/Firefox/Edge on iOS (CriOS/FxiOS/EdgiOS) — they can't A2HS
  // the same way and don't show the Share -> Add to Home Screen flow reliably.
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

function readDismissed() {
  // Snoozed only while within SNOOZE_MS of the stored dismiss timestamp.
  // Missing / NaN / expired → not snoozed (banner may show again).
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    if (!ts) return false;
    return Date.now() - ts < SNOOZE_MS;
  } catch (e) {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch (e) {
    /* storage unavailable — fall through, banner just reappears next load */
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [hidden, setHidden] = useState(true); // hidden until effect decides

  useEffect(() => {
    // Already installed or user dismissed before — never show.
    if (isStandalone() || readDismissed()) {
      setHidden(true);
      return;
    }

    // iOS Safari can't fire beforeinstallprompt; offer manual instructions.
    if (isIosSafari()) {
      setShowIos(true);
      setHidden(false);
    }

    const handleBeforeInstall = (e) => {
      // Stop Chrome's default mini-infobar; stash the event for our button.
      e.preventDefault();
      setDeferredPrompt(e);
      setShowIos(false); // native path wins over the iOS fallback
      setHidden(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIos(false);
      setHidden(true);
      writeDismissed(); // snooze after install (not permanent — re-shows if uninstalled)
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch (e) {
      /* user closed prompt — ignore */
    }
    // Single-use: the event can't be reused once prompt() is called.
    setDeferredPrompt(null);
    setHidden(true);
  };

  const handleIosClick = () => {
    setIosHintOpen((open) => !open);
  };

  const handleDismiss = () => {
    writeDismissed();
    setHidden(true);
  };

  // Render nothing unless we have something actionable.
  if (hidden) return null;
  if (!deferredPrompt && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Pawliz app"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // Sit directly above the 80px BottomNavBar.
        bottom: 80,
        // Below the floating chat button (999) and toasts (9999),
        // above page content; top OfflineIndicator banner is unaffected.
        zIndex: 98,
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.12)",
        padding: "10px 14px",
        // Keep the far-right clear of the round chat bubble (right:16, 48 wide).
        paddingRight: 76,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">
          🐾
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Install Pawliz
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            Add to your home screen for quick access.
          </div>
        </div>

        {deferredPrompt ? (
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              flexShrink: 0,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: 999,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
            }}
          >
            Install App
          </button>
        ) : (
          <button
            type="button"
            onClick={handleIosClick}
            aria-expanded={iosHintOpen}
            style={{
              flexShrink: 0,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: 999,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
            }}
          >
            How to install
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            flexShrink: 0,
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {showIos && iosHintOpen ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-primary)",
            background: "var(--bg-hover)",
            borderRadius: 8,
            padding: "8px 10px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          Tap the Share icon{" "}
          <span aria-hidden="true" style={{ fontWeight: 700 }}>
            ⎙
          </span>{" "}
          in Safari, then choose <strong>“Add to Home Screen.”</strong>
        </div>
      ) : null}
    </div>
  );
}
