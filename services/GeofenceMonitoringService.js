import * as Location from 'expo-location';
import DatabaseService from './DatabaseService';
import NotificationService from './NotificationService';

class GeofenceMonitoringService {
  constructor() {
    this.isMonitoring = false;
    this.monitoringSubscription = null;
    this.geofences = [];
    this.geofenceStates = new Map();
    this.lastCheckTime = 0;
    this.minCheckInterval = 5000;
  }

  getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // raggio della Terra in metri
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async startMonitoring() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }
      await this.loadGeofences();
      if (this.geofences.length === 0) {
        return false;
      }
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      for (const geofence of this.geofences) {
        const distance = this.getDistanceFromLatLonInMeters(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          geofence.latitude,
          geofence.longitude
        );
        const isInside = distance <= geofence.radius;
        this.geofenceStates.set(geofence.id, {
          wasInside: isInside,
          lastDistance: distance,
        });
      }
      this.isMonitoring = true;
      this.monitoringSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (location) => this.handleLocationUpdate(location)
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadGeofences() {
    try {
      this.geofences = await DatabaseService.getGeofences();
    } catch (error) {
      this.geofences = [];
    }
  }

  async handleLocationUpdate(location) {
    try {
      const now = Date.now();
      if (now - this.lastCheckTime < this.minCheckInterval) {
        return;
      }
      this.lastCheckTime = now;
      const { latitude, longitude } = location.coords;
      for (const geofence of this.geofences) {
        await this.checkGeofenceTransition(geofence, latitude, longitude);
      }
    } catch (error) {
    }
  }

  async checkGeofenceTransition(geofence, userLat, userLon) {
    try {
      const distance = this.getDistanceFromLatLonInMeters(
        userLat,
        userLon,
        geofence.latitude,
        geofence.longitude
      );
      const isInside = distance <= geofence.radius;
      const state = this.geofenceStates.get(geofence.id);
      if (!state) {
        this.geofenceStates.set(geofence.id, {
          wasInside: isInside,
          lastDistance: distance,
        });
        return;
      }
      const wasInside = state.wasInside;
      if (wasInside && !isInside) {
        await this.handleGeofenceExit(geofence);
      } else if (!wasInside && isInside) {
        await this.handleGeofenceEntry(geofence);
      }
      this.geofenceStates.set(geofence.id, {
        wasInside: isInside,
        lastDistance: distance,
      });
    } catch (error) {
    }
  }

  async handleGeofenceEntry(geofence) {
    try {
      await DatabaseService.addGeofenceEvent(geofence.id, 'entry');
      await NotificationService.sendGeofenceNotification(geofence.name, 'entry');
    } catch (error) {
    }
  }

  async handleGeofenceExit(geofence) {
    try {
      await DatabaseService.addGeofenceEvent(geofence.id, 'exit');
      await NotificationService.sendGeofenceNotification(geofence.name, 'exit');
    } catch (error) {
    }
  }

  async reloadGeofences() {
    await this.loadGeofences();
    if (this.isMonitoring) {
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        for (const geofence of this.geofences) {
          if (!this.geofenceStates.has(geofence.id)) {
            const distance = this.getDistanceFromLatLonInMeters(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude,
              geofence.latitude,
              geofence.longitude
            );
            const isInside = distance <= geofence.radius;
            this.geofenceStates.set(geofence.id, {
              wasInside: isInside,
              lastDistance: distance,
            });
          }
        }
      } catch (error) {
      }
    }
  }
}

export default new GeofenceMonitoringService();