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

export function sendDesktopNotification(title, options = {}) {
  if (!areNotificationsEnabled()) return null;
  
  return new Notification(title, {
    icon: '/atrium-icon.png',
    ...options
  });
}

export async function initNotificationsOnLoad() {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    localStorage.setItem('atrium.notifications.enabled', permission === 'granted' ? 'true' : 'false');
  }
}

