import { requestNotificationPermission } from "./adeudos";

export type PushNotificationTestOutcome =
  | "shown"
  | "unsupported"
  | "permission-denied"
  | "failed";

const DEFAULT_TITLE = "Studia · Prueba push";
const DEFAULT_BODY = "Esta es una notificación push de prueba.";
const TEST_TAG = "dev-push-test";

export interface PushNotificationTestOptions {
  title?: string;
  body?: string;
}

export async function sendPushNotificationTest(
  options: PushNotificationTestOptions = {},
): Promise<PushNotificationTestOutcome> {
  if (typeof Notification === "undefined") return "unsupported";

  if (Notification.permission === "denied") return "permission-denied";
  if (Notification.permission !== "granted") {
    const granted = await requestNotificationPermission();
    if (!granted) return "permission-denied";
  }

  const title = options.title?.trim() || DEFAULT_TITLE;
  const body = options.body?.trim() || DEFAULT_BODY;
  const notificationOptions: NotificationOptions = {
    body,
    tag: TEST_TAG,
    icon: "/icon-192.png",
  };

  let activeRegistration: ServiceWorkerRegistration | undefined;
  if ("serviceWorker" in navigator) {
    try {
      activeRegistration = await navigator.serviceWorker.getRegistration();
    } catch {
      activeRegistration = undefined;
    }
  }
  if (activeRegistration !== undefined) {
    try {
      await activeRegistration.showNotification(title, notificationOptions);
      return "shown";
    } catch {
      activeRegistration = undefined;
    }
  }

  try {
    new Notification(title, notificationOptions);
    return "shown";
  } catch {
    return "failed";
  }
}