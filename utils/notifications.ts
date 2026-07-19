import notifee, {
  AndroidCategory,
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';

const CHANNEL_ID = 'pi-incubator';
const ALERT_CHANNEL_ID = 'layrate-alerts';
const NOTIFICATION_ID = 'pi-update';

export type AlertData = {
  id: number;
  alert_type: string;
  message: string;
  cage_name?: string;
  triggered_at: string;
};

export async function showPiNotification(
  temperature = '37.5°C',
  humidity = '55%',
  eggCount = 12
) {
  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
    throw new Error('Notification permission was not granted');
  }

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Pi Incubator',
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
  });

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: 'Layrate Live Monitoring',
    body: `Eggs ${eggCount} · Temperature ${temperature} · Humidity ${humidity}`,
    data: { temperature, humidity, eggCount: String(eggCount) },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.STATUS,
      color: '#0a7ea4',
      pressAction: { id: 'default' },
      showTimestamp: true,
      ongoing: true,
      autoCancel: false,
      vibrationPattern: [300, 500],
      // To add icons, place ic_notification.png in android/app/src/main/res/drawable-*
      // and uncomment the next lines:
      // smallIcon: 'ic_notification',
      // largeIcon: 'ic_launcher',
    },
  });
}

export async function cancelPiNotification() {
  await notifee.cancelNotification(NOTIFICATION_ID);
}

export async function showAlertNotification(alert: AlertData) {
  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
    return;
  }

  await notifee.createChannel({
    id: ALERT_CHANNEL_ID,
    name: 'Farm Alerts',
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
  });

  const location = alert.cage_name ? ` (${alert.cage_name})` : '';

  await notifee.displayNotification({
    id: `alert-${alert.id}`,
    title: `${alert.alert_type}${location}`,
    body: alert.message,
    data: { alert_id: String(alert.id), alert_type: alert.alert_type },
    android: {
      channelId: ALERT_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.ALARM,
      color: '#e74c3c',
      pressAction: { id: 'default' },
      showTimestamp: true,
      autoCancel: true,
      vibrationPattern: [500, 500],
    },
  });
}

export async function cancelAlertNotification(alertId: number) {
  await notifee.cancelNotification(`alert-${alertId}`);
}
