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
        return { foreground: false, background: false };
      }
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      return { 
        foreground: foregroundStatus === 'granted', 
        background: backgroundStatus === 'granted' 
      };
    } catch (error) {
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
    } catch (error) {
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
      return finalDistance;
    } catch (error) {
      throw error;
    }
  }

  async startGeofencingMonitoring() {
    try {
      // Verifica i permessi prima di procedere
      const { status } = await Location.getBackgroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('⚠️ Permesso background location non concesso - geofencing non attivo');
        return; // Esci silenziosamente senza errore
      }

      // Ferma il monitoraggio esistente se attivo
      const isTaskActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isTaskActive) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        console.log('🔄 Geofencing esistente fermato');
      }

      // Recupera i geofences dal database
      const geofences = await DatabaseService.getGeofences();
      
      if (geofences.length === 0) {
        console.log('ℹ️ Nessun geofence da monitorare');
        return;
      }

      // Prepara i geofences per il monitoraggio
      const geofencesToMonitor = geofences.map(g => ({
        identifier: g.id.toString(),
        latitude: g.latitude,
        longitude: g.longitude,
        radius: g.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      // Avvia il monitoraggio
      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, geofencesToMonitor);
      console.log(`✅ Geofencing avviato per ${geofences.length} aree`);
      
    } catch (error) {
      console.error('❌ Errore startGeofencingMonitoring:', error);
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
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raggio della terra in metri
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