import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { notificationsAPI } from "../../lib/api";
import NotificationSettings from "./NotificationSettings";
import { getSocket } from "../../lib/socket";

const API_SERVER_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(
    "/api",
    "",
  );

function getAvatarUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_SERVER_BASE}${path}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

const OFFLINE_POLL_INTERVAL_MS = 60 * 1000; // 1 minute

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: any = { limit: 20 };
      if (filterType) params.type = filterType;
      const res = await notificationsAPI.getAll(params);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch {}
    setLoading(false);
  }, [user, filterType]);

  // Fetch unread count on mount so the badge is correct immediately —
  // even if the notification arrived while the user was offline.
  useEffect(() => {
    if (!user) return;
    notificationsAPI
      .getUnreadCount()
      .then((res) => setUnreadCount(res.unread_count || 0))
      .catch(() => {});
  }, [user]);

  // Track whether the full list has been loaded yet.
  const initializedRef = useRef(false);

  // Socket connection with offline-poll fallback.
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    socketRef.current = socket;

    const onNotification = (notification) => {
      setUnreadCount((c) => c + 1);
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
    };

    socket.on("notification", onNotification);

    // When the socket is connected, clear the poll timer — push handles delivery.
    const onConnect = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    // When the socket disconnects, start polling every minute so the badge
    // stays accurate even without a live connection.
    const onDisconnect = () => {
      if (pollTimerRef.current) return; // already polling
      pollTimerRef.current = setInterval(() => {
        notificationsAPI
          .getUnreadCount()
          .then((res) => setUnreadCount(res.unread_count || 0))
          .catch(() => {});
      }, OFFLINE_POLL_INTERVAL_MS);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // If already disconnected when the effect runs, start polling immediately.
    if (!socket.connected) onDisconnect();

    return () => {
      socket.off("notification", onNotification);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [user]);

  // Fetch once on first open; subsequent opens use in-memory state + socket updates
  useEffect(() => {
    if (open && !initializedRef.current) {
      initializedRef.current = true;
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Re-fetch when filter changes while dropdown is open
  useEffect(() => {
    if (open && initializedRef.current) {
      fetchNotifications();
    }
  }, [filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = async (n) => {
    if (!n.is_read) {
      try {
        await notificationsAPI.markAsRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
    setOpen(false);
    // Only follow internal relative paths — ignore external/absolute URLs (open-redirect guard)
    if (n.action_url && n.action_url.startsWith("/") && !n.action_url.startsWith("//")) {
      router.push(n.action_url);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: open ? "rgba(0, 184, 122, 0.1)" : "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 18,
          transition: "all 0.25s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open
            ? "rgba(0, 184, 122, 0.1)"
            : "var(--bg-elevated)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--bg-secondary)",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            ...(isMobile
              ? {
                  position: "fixed",
                  top: "calc(var(--header-height) + 8px)",
                  left: 12,
                  right: 12,
                  maxHeight: "calc(100vh - var(--header-height) - 24px)",
                  zIndex: 10001,
                }
              : {
                  position: "absolute",
                  top: 48,
                  right: 0,
                  width: 340,
                  maxHeight: 440,
                  zIndex: 200,
                }),
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "var(--shadow-lg)",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              background: "var(--bg-card)",
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--text-primary)",
              }}
            >
              Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: 11,
                    color: "var(--accent)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  Mark all
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                title="Settings"
                style={{
                  fontSize: 16,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {settingsOpen && <NotificationSettings onClose={() => setSettingsOpen(false)} />}

          {/* Filter buttons */}
          {!settingsOpen && (
            <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
              {[
                { label: 'All', value: null },
                { label: 'Comments', value: 'comment_on_post' },
                { label: 'Contact', value: 'contact_request' },
                { label: 'Follows', value: 'follow' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterType(f.value)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: filterType === f.value ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: filterType === f.value ? '#0a0d12' : 'var(--text-secondary)',
                    fontWeight: filterType === f.value ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={() => handleClick(n)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onClick }: any) {
  const [hovered, setHovered] = useState(false);
  const avatarUrl = getAvatarUrl(n.actor_avatar);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        cursor: "pointer",
        borderBottom: "1px solid var(--border)",
        background: !n.is_read
          ? "rgba(0, 184, 122, 0.05)"
          : hovered
          ? "var(--bg-elevated)"
          : "transparent",
        transition: "background 0.15s",
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            background: "var(--bg-elevated)",
          }}
          onError={(e) => {
            (e.target as any).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), #00b87a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            flexShrink: 0,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {n.actor_name ? n.actor_name.charAt(0).toUpperCase() : "?"}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: n.is_read ? 400 : 600,
            color: "var(--text-primary)",
            lineHeight: 1.4,
            marginBottom: 3,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {n.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            ...(n.type === "contact_request"
              ? { wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }),
          }}
        >
          {n.message}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {timeAgo(n.created_at)}
        </div>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}
