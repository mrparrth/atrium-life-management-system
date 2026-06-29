export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  localStorage.setItem('atrium.notifications.enabled', permission === 'granted' ? 'true' : 'false');
  return permission;
}

export function areNotificationsEnabled() {
  return isNotificationSupported() && 
    Notification.permission === 'granted' && 
    localStorage.getItem('atrium.notifications.enabled') === 'true';
}

export async function sendDesktopNotification(title, options = {}) {
  if (!areNotificationsEnabled()) {
    console.warn("Desktop notifications are disabled or permission is not granted.");
    return null;
  }
  
  const icon = '/atrium-icon.png';
  const notificationOptions = {
    icon,
    ...options
  };

  // Try service worker first (standard for PWAs/modern browsers)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    } catch (e) {
      console.warn('Service Worker notification failed, falling back:', e);
    }
  }

  // Fallback to standard window Notification constructor
  try {
    return new Notification(title, notificationOptions);
  } catch (e) {
    console.error('Window Notification constructor failed:', e);
  }
  return null;
}

export async function initNotificationsOnLoad() {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    localStorage.setItem('atrium.notifications.enabled', permission === 'granted' ? 'true' : 'false');
  }
}

