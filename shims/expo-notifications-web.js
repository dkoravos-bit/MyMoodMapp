// shims/expo-notifications-web.js
// Safe no-op shim for expo-notifications on web.
// All methods return safe defaults so code that doesn't check Platform.OS
// won't throw during the web build or at runtime.

const noop = () => {};
const noopAsync = async () => {};
const noopAsyncNull = async () => null;
const noopAsyncFalse = async () => ({ status: 'denied', granted: false });

const SchedulableTriggerInputTypes = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  TIME_INTERVAL: 'timeInterval',
  DATE: 'date',
  WEEKLY: 'weekly',
};

module.exports = {
  SchedulableTriggerInputTypes,
  setNotificationHandler: noop,
  setNotificationCategoryAsync: noopAsync,
  deleteNotificationCategoryAsync: noopAsync,
  scheduleNotificationAsync: noopAsyncNull,
  cancelScheduledNotificationAsync: noopAsync,
  cancelAllScheduledNotificationsAsync: noopAsync,
  getPermissionsAsync: noopAsyncFalse,
  requestPermissionsAsync: noopAsyncFalse,
  getExpoPushTokenAsync: async () => ({ data: null }),
  addNotificationResponseReceivedListener: () => ({ remove: noop }),
  addNotificationReceivedListener: () => ({ remove: noop }),
  removeNotificationSubscription: noop,
  getBadgeCountAsync: async () => 0,
  setBadgeCountAsync: noopAsync,
  default: {},
};
