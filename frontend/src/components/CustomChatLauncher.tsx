import { useEffect, useState } from "react";

/**
 * Custom Tawk.to chat launcher.
 *
 * The default Tawk bubble is hidden through the Tawk_API (hideWidget) because
 * it is too large on mobile. This renders a compact button that opens the Tawk
 * chat window. When the chat is minimized, the default bubble is hidden again
 * so only this custom button remains.
 */
export default function CustomChatLauncher() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Tawk_API is created in _app.jsx before the embed loads, but the embed
    // script loads asynchronously. Poll until the API is available, then hide
    // the default widget and wire up minimize handling.
    let cancelled = false;

    const hide = () => {
      if ((window as any).Tawk_API && typeof (window as any).Tawk_API.hideWidget === "function") {
        (window as any).Tawk_API.hideWidget();
      }
    };

    // Re-hide on every Tawk event that fires when the chat window closes.
    // maximize() can re-show the default widget, and the exact close event
    // varies, so hook all of them and defer slightly to win the race.
    const hideSoon = () => setTimeout(hide, 50);

    const check = () => {
      if (cancelled) return;
      const api = (window as any).Tawk_API;
      if (api && typeof api.maximize === "function") {
        hide();
        api.onChatMinimized = hideSoon;
        api.onChatEnded = hideSoon;
        api.onChatHidden = hideSoon;
        setReady(true);
      } else {
        setTimeout(check, 300);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = () => {
    const api = (window as any).Tawk_API;
    if (!api) return;
    // Open the chat window directly. maximize() shows the window even while
    // the default bubble is hidden, so we never call showWidget().
    if (typeof api.maximize === "function") {
      api.maximize();
    } else if (typeof api.toggle === "function") {
      api.toggle();
    }
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Open live chat"
      style={{
        position: "fixed",
        right: 16,
        // Clear the 80px fixed BottomNavBar plus a small gap.
        bottom: 96,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        background: "var(--accent)",
        color: "#fff",
        fontSize: 22,
        lineHeight: 1,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        transition: "transform 0.2s ease",
      }}
      onMouseEnter={(e: any) => {
        e.currentTarget.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      💬
    </button>
  );
}
