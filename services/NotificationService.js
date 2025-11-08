import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.permissionGranted = false;
  }

  async init() {
    try {
      const {status: existingStatus} = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const {status} = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        this.permissionGranted = false;
        return false;
      }
      this.permissionGranted = true;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#5865F2',
          sound: 'default',
        });
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      this.isInitialized = false;
      this.permissionGranted = false;
      return false;
    }
  }
  
  async sendGeofenceNotification(geofenceName, eventType) {
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }
    try {
      const isEntry = eventType === 'entry';
      const title = isEntry ? 'Entrato nel geofence' : 'Uscito dal geofence';
      const body = `${geofenceName}`;
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'geofence', name: geofenceName, event: eventType },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (error) {
    }
  }

  async sendJourneyStartedNotification(tripName = 'viaggio') {
    if (!this.isInitialized || !this.permissionGranted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Viaggio Iniziato!',
        body: `Il tracciamento di "${tripName}" è iniziato.`,
        data: { type: 'journey_started', tripName },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  }

  async sendJourneyCompletedNotification(journeyData) {
    if (!this.isInitialized || !this.permissionGranted) return;
    const distance = journeyData.totalDistance
      ? `${(journeyData.totalDistance / 1000).toFixed(1)} km`
      : 'distanza sconosciuta';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Viaggio Completato!',
        body: `Hai percorso ${distance}`,
        data: { type: 'journey_completed', journeyId: journeyData.id },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  }

  async sendPhotoAddedNotification() {
    if (!this.isInitialized || !this.permissionGranted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Foto Salvata',
        body: 'La tua foto è stata aggiunta al viaggio',
        data: { type: 'photo_added' },
        sound: false,
      },
      trigger: null,
    });
  }

  async sendNoteAddedNotification() {
    if (!this.isInitialized || !this.permissionGranted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Nota Salvata',
        body: 'La tua nota è stata aggiunta al viaggio',
        data: { type: 'note_added' },
        sound: false,
      },
      trigger: null,
    });
  }

  async scheduleDailyReminder() {
    if (!this.isInitialized || !this.permissionGranted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
      title: 'Buongiorno!',
        body: 'Non dimenticare di registrare i tuoi spostamenti di oggi',
        data: { type: 'daily_reminder' },
        sound: true,
      },
      identifier: 'daily_reminder',
      trigger: { hour: 12, minute: 5, repeats: true },
    });
  }

  async ensureDailyReminderIsScheduled() {
    if (!this.isInitialized || !this.permissionGranted) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some(n => n.identifier === 'daily_reminder');
    if (!exists) {
      await this.scheduleDailyReminder();
    } else {
    }
  }
}

export default new NotificationService();