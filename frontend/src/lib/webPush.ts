import { pushAPI } from "./api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** True when running as an installed PWA (Android/desktop standalone or iOS). */
export function isPWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as any).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Ensure a push subscription exists in the browser and is saved to the server.
 * Assumes permission is already granted; performs NO prompt. Idempotent — the
 * server upserts on the UNIQUE endpoint, so calling it repeatedly is safe.
 */
async function ensureSubscribed(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await pushAPI.subscribe(subscription.toJSON());
}

/**
 * Ask for notification permission and register a Web Push subscription.
 * Returns the resulting permission state. Requires a user gesture (browsers
 * only show the prompt from a click handler).
 */
export async function requestAndSubscribe(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) {
    console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push disabled");
    return Notification.permission;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  await ensureSubscribed();
  return "granted";
}

/**
 * Silent, prompt-free subscription sync. If permission is already granted (e.g.
 * granted at PWA install time), register + save the subscription. No-op
 * otherwise. Safe to call on app load without a user gesture.
 */
export async function syncSubscription(): Promise<void> {
  try {
    if (!isPushSupported() || !VAPID_PUBLIC_KEY) return;
    if (Notification.permission !== "granted") return;
    await ensureSubscribed();
  } catch {
    // best-effort
  }
}

/**
 * Auto-prompt entry point for login/register and PWA launch.
 * - granted → sync silently (honors install-time grants).
 * - default → prompt (login click, or PWA launch which counts as app context).
 * - denied/unsupported → no-op.
 * Must be called from a user-gesture path when permission is 'default' in a
 * browser tab, or browsers mute the prompt. Fully self-catching.
 */
export async function maybeAutoSubscribe(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    if (Notification.permission === "granted") {
      await ensureSubscribed();
      return;
    }
    if (Notification.permission === "default") {
      await requestAndSubscribe();
    }
  } catch {
    // best-effort — auth must never break because of push
  }
}

/** Remove the current subscription (browser + server). */
export async function unsubscribe(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    await pushAPI.unsubscribe(endpoint);
  } catch {
    // server cleanup is best-effort (dead subs also pruned on send)
  }
}
