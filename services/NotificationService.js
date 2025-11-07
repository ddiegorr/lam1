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
      console.log('Inizializzando le notifiche...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      console.log('Permesso esistente:', existingStatus);
      if (existingStatus !== 'granted') {
        console.log('Richiedendo permessi per le notifiche');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('Nuovo permesso:', status);
      }
      if (finalStatus !== 'granted') {
        console.log('Permesso negato');
        this.permissionGranted = false;
        return false;
      }

      this.permissionGranted = true;
      console.log('Permesso concesso');
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
      console.log('Notifiche inizializzate con successo');

      await this.scheduleDailyReminder();
      
      return true;
    } catch (error) {
      console.error('Errore inizializzazione notifiche: ', error);
      this.isInitialized = false;
      this.permissionGranted = false;
      return false;
    }
  }

  async sendGeofenceNotification(geofenceName, eventType) {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('Notifiche non disponibili');
      return;
    }
    try {
      const title = eventType === 'enter' ? 'Area Raggiunta' : 'Area Lasciata';
      const body = `Hai ${eventType === 'enter' ? 'raggiunto' : 'lasciato'} ${geofenceName}`;
      console.log(`Inviando le notifiche di geofence: ${title} - ${body}`);
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'geofence', 
            name: geofenceName, 
            event: eventType 
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
      console.log('Notifiche geofence inviate');
    } catch (error) {
      console.error('Errore durante invio delle notifiche:', error);
    }
  }

  async sendJourneyStartedNotification(tripName = 'viaggio') {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('Notifiche non disponibili');
      return;
    }

    try {
      console.log('Inviando la notifica di inizio viaggio ');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Viaggio Iniziato!',
          body: `Il tracciamento di "${tripName}" è iniziato. Buon viaggio!`,
          data: { type: 'journey_started', tripName },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      console.log('Notifica di inzio viaggio inviata');
    } catch (error) {
      console.error('Errore durante invio della notifica di inizio viaggio :', error);
    }
  }

  async sendJourneyCompletedNotification(journeyData) {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('Notifiche non disponibili');
      return;
    }

    try {
      const distance = journeyData.totalDistance 
        ? `${(journeyData.totalDistance / 1000).toFixed(1)} km`
        : 'distanza sconosciuta';

      console.log('Notifica del termine del viaggio inviata');

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

      console.log('Notifica del termine viaggio inviata');
    } catch (error) {
      console.error('Errore invio notifica di viaggio terminato:', error);
    }
  }

  async scheduleDailyReminder() {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('Notifiche non disponibili, impossibile schedulare il reminder.');
      return;
    }
    try {
      // Verifica se esiste già una notifica daily_reminder schedulata
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const existingReminder = scheduledNotifications.find(
        notif => notif.content.data?.type === 'daily_reminder'
      );

      if (existingReminder) {
        console.log('Promemoria giornaliero già schedulato.');
        return;
      }

      console.log('Schedulando promemoria giornaliero (ore 10:00)...');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Buongiorno Viaggiatore!",
          body: "Non dimenticare di registrare i tuoi spostamenti di oggi",
          data: { type: 'daily_reminder' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          hour: 10,
          minute: 0,
          repeats: true,
        },
      });
      console.log('Promemoria giornaliero schedulato con successo.');

    } catch (error) {
      console.error('Errore durante la schedulazione del promemoria:', error);
    }
  }

  async ensureDailyReminderIsScheduled() {
    // Metodo helper per ri-schedulare se necessario (da chiamare all'avvio dell'app)
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }
    
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const hasReminder = scheduledNotifications.some(
        notif => notif.content.data?.type === 'daily_reminder'
      );
      
      if (!hasReminder) {
        console.log('Promemoria giornaliero mancante, ri-schedulando...');
        await this.scheduleDailyReminder();
      } else {
        console.log('Promemoria giornaliero già attivo.');
      }
    } catch (error) {
      console.error('Errore verifica promemoria:', error);
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      permissionGranted: this.permissionGranted,
    };
  }
}

export default new NotificationService();