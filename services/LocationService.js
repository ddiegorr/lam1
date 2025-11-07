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
      // Se già in tracking, ferma prima
      if (this.isTracking) {
        console.log('⚠️ Tracking già attivo, fermo il precedente');
        await this.stopTracking();
      }
      
      // Reset COMPLETO dello stato
      this.isTracking = true;
      this.currentJourneyId = journeyId;
      this.lastLocation = null;
      this.totalDistance = 0;
      
      console.log(`🚀 Tracking INIZIATO per journey ${journeyId} - distanza azzerata a 0`);
      
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,  // Ogni 5 secondi
          distanceInterval: 10, // O ogni 10 metri
        },
        (location) => this.handleLocationUpdate(location)
      );
    } catch (error) {
      console.error('❌ Errore startTracking:', error);
      throw error;
    }
  }

  async stopTracking() {
    try {
      console.log(`🛑 STOP Tracking - Distanza finale: ${(this.totalDistance/1000).toFixed(2)}km`);
      
      this.isTracking = false;
      
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
      
      const finalDistance = this.totalDistance;
      
      // Reset completo dello stato
      this.currentJourneyId = null;
      this.lastLocation = null;
      this.totalDistance = 0;
      
      return finalDistance;
    } catch (error) {
      console.error('❌ Errore stopTracking:', error);
      throw error;
    }
  }

  async startGeofencingMonitoring() {
    try {
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
      console.log(`✅ Geofencing ATTIVO per ${geofences.length} aree`);
      
    } catch (error) {
      console.error('❌ Errore startGeofencingMonitoring:', error);
      // Non lanciare errore - il geofencing è opzionale
    }
  }

  async handleLocationUpdate(location) {
    try {
      if (!this.currentJourneyId || !this.isTracking) {
        console.log('⚠️ Location update ignorato - tracking non attivo');
        return;
      }
      
      const { latitude, longitude, accuracy } = location.coords;
      
      // Salva il punto GPS nel database
      await DatabaseService.addGPSPoint(
        this.currentJourneyId,
        latitude,
        longitude,
        accuracy
      );
      
      // Calcola distanza solo se abbiamo una posizione precedente valida
      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.latitude,
          this.lastLocation.longitude,
          latitude,
          longitude
        );
        
        // Filtro per distanze ragionevoli: 
        // - minimo 5m (evita rumore GPS)
        // - massimo 200m tra update (evita salti irrealistici con timeInterval=5s)
        if (distance >= 5 && distance <= 200) {
          this.totalDistance += distance;
          console.log(`📏 +${distance.toFixed(1)}m | Totale: ${(this.totalDistance/1000).toFixed(2)}km | Accuracy: ${accuracy?.toFixed(0)}m`);
        } else if (distance > 200) {
          console.warn(`⚠️ Distanza ignorata (troppo grande): ${distance.toFixed(1)}m - possibile salto GPS`);
        }
      } else {
        console.log(`📍 Primo punto GPS registrato: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
      
      // Aggiorna l'ultima posizione
      this.lastLocation = { latitude, longitude };
    } catch (error) {
      console.error('❌ Errore handleLocationUpdate:', error);
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
    
    return R * c; // Distanza in metri
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