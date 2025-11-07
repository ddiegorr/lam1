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
      console.log('🔔 Inizializzando le notifiche...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('📝 Richiedendo permessi notifiche');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Permesso notifiche negato');
        this.permissionGranted = false;
        return false;
      }

      this.permissionGranted = true;
      console.log('✅ Permesso notifiche concesso');
      
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
      console.log('✅ Notifiche inizializzate');

      // IMPORTANTE: NON chiamare scheduleDailyReminder qui!
      // Viene chiamato solo da ensureDailyReminderIsScheduled in App.js
      
      return true;
    } catch (error) {
      console.error('❌ Errore inizializzazione notifiche:', error);
      this.isInitialized = false;
      this.permissionGranted = false;
      return false;
    }
  }

  // Notifica IMMEDIATA quando entri/esci da geofence
  async sendGeofenceNotification(geofenceName, eventType) {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('⚠️ Notifiche non disponibili');
      return;
    }
    
    try {
      const title = eventType === 'enter' 
        ? '📍 Sei entrato in un\'area' 
        : '🚶 Hai lasciato un\'area';
      const body = `${geofenceName}`;
      
      console.log(`🔔 Invio notifica geofence: ${title} - ${body}`);
      
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
        trigger: null, // IMMEDIATA
      });
      
      console.log('✅ Notifica geofence inviata');
    } catch (error) {
      console.error('❌ Errore invio notifica geofence:', error);
    }
  }

  async sendJourneyStartedNotification(tripName = 'viaggio') {
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚀 Viaggio Iniziato!',
          body: `Il tracciamento di "${tripName}" è iniziato. Buon viaggio!`,
          data: { type: 'journey_started', tripName },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
      
      console.log('✅ Notifica inizio viaggio inviata');
    } catch (error) {
      console.error('❌ Errore notifica inizio viaggio:', error);
    }
  }

  async sendJourneyCompletedNotification(journeyData) {
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }

    try {
      const distance = journeyData.totalDistance 
        ? `${(journeyData.totalDistance / 1000).toFixed(1)} km`
        : 'distanza sconosciuta';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏁 Viaggio Completato!',
          body: `Hai percorso ${distance}`,
          data: { type: 'journey_completed', journeyId: journeyData.id },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
      
      console.log('✅ Notifica fine viaggio inviata');
    } catch (error) {
      console.error('❌ Errore notifica fine viaggio:', error);
    }
  }

  async sendPhotoAddedNotification() {
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📸 Foto Salvata',
          body: 'La tua foto è stata aggiunta al viaggio',
          data: { type: 'photo_added' },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Errore notifica foto:', error);
    }
  }

  async sendNoteAddedNotification() {
    if (!this.isInitialized || !this.permissionGranted) {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📝 Nota Salvata',
          body: 'La tua nota è stata aggiunta al viaggio',
          data: { type: 'note_added' },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Errore notifica nota:', error);
    }
  }

  // NOTIFICA PERIODICA GIORNALIERA - Chiamata SOLO da ensureDailyReminderIsScheduled
  async scheduleDailyReminder() {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('⚠️ Notifiche non disponibili per schedulare reminder');
      return;
    }
    
    try {
      console.log('📅 Schedulando promemoria giornaliero alle 10:00...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "☀️ Buongiorno Viaggiatore!",
          body: "Non dimenticare di registrare i tuoi spostamenti di oggi",
          data: { type: 'daily_reminder' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: {
          hour: 23,
          minute: 14,
          repeats: true,
        },
      });
      
      console.log('✅ Promemoria giornaliero schedulato (ore 10:00, ripetuto)');
    } catch (error) {
      console.error('❌ Errore schedulazione promemoria:', error);
    }
  }

  // Da chiamare SOLO all'avvio dell'app per verificare/creare il reminder
  async ensureDailyReminderIsScheduled() {
    if (!this.isInitialized || !this.permissionGranted) {
      console.log('⚠️ Notifiche non inizializzate, skip reminder check');
      return;
    }
    
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const hasReminder = scheduledNotifications.some(
        notif => notif.content.data?.type === 'daily_reminder'
      );
      
      if (!hasReminder) {
        console.log('⚠️ Promemoria giornaliero mancante, schedulando...');
        await this.scheduleDailyReminder();
      } else {
        console.log('✅ Promemoria giornaliero già attivo');
      }
    } catch (error) {
      console.error('❌ Errore verifica promemoria:', error);
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