import { isTauriEnv } from "@/services/offlineSync";

export async function isNotificationSupported() {
  if (isTauriEnv()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (isTauriEnv()) {
    try {
      const { requestPermission, isPermissionGranted } = await import(
        "@tauri-apps/plugin-notification"
      );
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      localStorage.setItem("atrium.notifications.enabled", granted ? "true" : "false");
      return granted ? "granted" : "denied";
    } catch (e) {
      console.warn("Tauri notification permission request failed:", e);
      return "denied";
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission();
  localStorage.setItem("atrium.notifications.enabled", permission === "granted" ? "true" : "false");
  return permission;
}

export async function areNotificationsEnabled() {
  if (localStorage.getItem("atrium.notifications.enabled") !== "true") return false;

  if (isTauriEnv()) {
    try {
      const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
      return await isPermissionGranted();
    } catch (e) {
      return false;
    }
  }

  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

export async function sendDesktopNotification(title, options = {}) {
  const enabled = await areNotificationsEnabled();
  if (!enabled) {
    console.warn("Desktop notifications are disabled or permission is not granted.");
    return null;
  }

  if (isTauriEnv()) {
    try {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification({
        title,
        body: options.body || "",
      });
      return true;
    } catch (e) {
      console.error("Tauri native notification failed:", e);
      return null;
    }
  }

  const icon = "/atrium-icon.png";
  const notificationOptions = {
    icon,
    ...options,
  };

  // Try service worker first (standard for PWAs/modern browsers)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    } catch (e) {
      console.warn("Service Worker notification failed, falling back:", e);
    }
  }

  // Fallback to standard window Notification constructor
  try {
    return new Notification(title, notificationOptions);
  } catch (e) {
    console.error("Window Notification constructor failed:", e);
  }
  return null;
}

export async function initNotificationsOnLoad() {
  if (isTauriEnv()) return; // Desktop app requests notifications only via user action or settings
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    localStorage.setItem("atrium.notifications.enabled", permission === "granted" ? "true" : "false");
  }
}
