import * as Notifications from 'expo-notifications';
import { NotificationSettings } from '../types/nutrition';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleMealReminders(settings: NotificationSettings): Promise<void> {
  // Cancel existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.master_enabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Schedule Breakfast Reminder
  if (settings.breakfast_reminder && settings.breakfast_time) {
    const [hour, minute] = settings.breakfast_time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🍳 Good Morning! Ready for Breakfast?',
        body: 'Snap a photo of your breakfast to kickstart your daily streak!',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  // Schedule Lunch Reminder
  if (settings.lunch_reminder && settings.lunch_time) {
    const [hour, minute] = settings.lunch_time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🥗 Time for Lunch!',
        body: 'Snap your plate in 1 second with CalSnap AI.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  // Schedule Dinner Reminder
  if (settings.dinner_reminder && settings.dinner_time) {
    const [hour, minute] = settings.dinner_time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🍲 Dinner Time!',
        body: 'Log your evening meal and keep your streak growing 🔥',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  // Schedule Streak Protection Alert (8:00 PM)
  if (settings.streak_protection_alert) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Protect Your 5-Day Streak!',
        body: "Don't forget to log your dinner before the day ends!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  }
}

export async function sendInstantAsyncMealNotification(dishName: string, calories: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚡ Meal Logged: ${dishName}`,
      body: `Estimated ~${calories} kcal. Tap to tweak portion or oil sliders!`,
      sound: true,
    },
    trigger: null, // Send immediately
  });
}
