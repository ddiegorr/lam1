import * as Location from 'expo-location';
import DatabaseService from './DatabaseService';

const GEOFENCE_TASK_NAME = 'geofence-task';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.currentJourneyId = null;
    this.lastLocation = null;
    this.totalDistance = 0;
    this.locationSubscription = null;
  }

  async requestPermissions() {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('Permission foreground error');
        return { foreground: false, background: false };
      }
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      return { 
        foreground: foregroundStatus === 'granted', 
        background: backgroundStatus === 'granted' 
      };

    } catch (error) {
      console.error('Permission error:', error);
      return { foreground: false, background: false };
    }
  }

  async getCurrentLocation() {
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });
    } catch (error) {
      console.error('Get location error:', error);
      throw error;
    }
  }

  async startTracking(journeyId) {
    try {
      if (this.isTracking) {
        await this.stopTracking();
      }

      this.isTracking = true;
      this.currentJourneyId = journeyId;
      this.lastLocation = null;
      this.totalDistance = 0;

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => this.handleLocationUpdate(location)
      );

      console.log('Tracking started');
    } catch (error) {
      console.error('Start tracking error:', error);
      throw error;
    }
  }

  async stopTracking() {
    try {
      this.isTracking = false;

      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      if (this.currentJourneyId && this.totalDistance > 0) {
        await DatabaseService.endJourney(this.currentJourneyId, this.totalDistance);
      }

      const finalDistance = this.totalDistance;
      this.currentJourneyId = null;
      this.lastLocation = null;
      this.totalDistance = 0;

      console.log('Tracking stopped. Distance:', finalDistance);
      return finalDistance;
    } catch (error) {
      console.error('Stop tracking error:', error);
      throw error;
    }
  }

  async startGeofencingMonitoring() {
    try {
      // Controlla se il monitoraggio è già attivo
      const isTaskActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isTaskActive) {
        // Se è attivo, fermalo prima di aggiornare l'elenco
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }

      // Prendi tutti i geofence dal DB
      const geofences = await DatabaseService.getGeofences();
      if (geofences.length === 0) {
        console.log('Nessun geofence da monitorare.');
        return;
      }

      // Formatta i geofence per l'API di Expo
      const geofencesToMonitor = geofences.map(g => ({
        identifier: g.id.toString(), // L'ID deve essere una stringa
        latitude: g.latitude,
        longitude: g.longitude,
        radius: g.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      // Avvia il monitoraggio in background
      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, geofencesToMonitor);

      console.log(`Geofencing avviato per ${geofencesToMonitor.length} aree.`);

    } catch (error) {
      console.error('Errore nell\'avviare il geofencing:', error);
    }
  }

  async handleLocationUpdate(location) {
    try {
      if (!this.currentJourneyId || !this.isTracking) return;

      const { latitude, longitude, accuracy } = location.coords;

      await DatabaseService.addGPSPoint(
        this.currentJourneyId,
        latitude,
        longitude,
        accuracy
      );

      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.latitude,
          this.lastLocation.longitude,
          latitude,
          longitude
        );
        this.totalDistance += distance;
      }

      this.lastLocation = { latitude, longitude };
    } catch (error) {
      console.error('Location update error:', error);
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      currentJourneyId: this.currentJourneyId,
      totalDistance: this.totalDistance,
    };
  }

  getLastLocation() {
    return this.lastLocation;
  }
}

export default new LocationService();