import * as SQLite from 'expo-sqlite';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync('travel_companion.db');
      await this.createTables();
      await this.migrateDatabase(); // Spostato dopo createTables
      console.log('Database initialized');
    } catch (error) {
      console.error('Database init error:', error);
    }
  }

  async migrateDatabase() {
    console.log('Checking database migrations...');
    try {
      // Migrazione 1: trips (destination_lat, destination_lon)
      const tripsInfo = await this.db.getAllAsync('PRAGMA table_info(trips)');
      if (!tripsInfo.some(col => col.name === 'destination_lat')) {
        await this.db.execAsync('ALTER TABLE trips ADD COLUMN destination_lat REAL');
        console.log('Migrated trips: Added destination_lat');
      }
      if (!tripsInfo.some(col => col.name === 'destination_lon')) {
        await this.db.execAsync('ALTER TABLE trips ADD COLUMN destination_lon REAL');
        console.log('Migrated trips: Added destination_lon');
      }

      // Migrazione 2: journeys (trip_id, status, total_distance, created_at)
      const journeysInfo = await this.db.getAllAsync('PRAGMA table_info(journeys)');
      if (!journeysInfo.some(col => col.name === 'trip_id')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN trip_id INTEGER');
        console.log('Migrated journeys: Added trip_id');
      }
      if (!journeysInfo.some(col => col.name === 'total_distance')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN total_distance REAL DEFAULT 0');
        console.log('Migrated journeys: Added total_distance');
      }
      if (!journeysInfo.some(col => col.name === 'status')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN status TEXT DEFAULT \'active\'');
        console.log('Migrated journeys: Added status');
      }
      if (!journeysInfo.some(col => col.name === 'created_at')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('Migrated journeys: Added created_at');
      }

      // Migrazione 3: geofences (created_at)
      const geofencesInfo = await this.db.getAllAsync('PRAGMA table_info(geofences)');
      if (!geofencesInfo.some(col => col.name === 'created_at')) {
        await this.db.execAsync('ALTER TABLE geofences ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('Migrated geofences: Added created_at');
      }
      
      console.log('Database migration check complete.');

    } catch (error) {
      console.error('Migration error:', error);
      console.warn('Migration failed, attempting to clear and recreate tables...');
      try {
        // Approccio drastico se la migrazione fallisce (solo in sviluppo)
        await this.clearAllData(); 
        await this.createTables(); 
        console.log('Tables cleared and recreated after migration failure.');
      } catch (e) {
        console.error('CRITICAL: Failed to recreate tables.', e);
      }
    }
  }

  async createTables() {
    if (!this.db) return;

    try {
      // Trips
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          destination TEXT NOT NULL,
          destination_lat REAL,
          destination_lon REAL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          notes TEXT,
          status TEXT DEFAULT 'planned',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Journeys
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS journeys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          total_distance REAL DEFAULT 0,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
        );
      `);

      // GPS Points
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS gps_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          journey_id INTEGER NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp DATETIME NOT NULL,
          accuracy REAL,
          FOREIGN KEY (journey_id) REFERENCES journeys (id) ON DELETE CASCADE
        );
      `);

      // Photos
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          journey_id INTEGER NOT NULL,
          uri TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          note TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (journey_id) REFERENCES journeys (id) ON DELETE CASCADE
        );
      `);

      // Notes
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          journey_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (journey_id) REFERENCES journeys (id) ON DELETE CASCADE
        );
      `);

      // Geofences
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS geofences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          radius REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Geofence Events
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS geofence_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          geofence_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (geofence_id) REFERENCES geofences (id) ON DELETE CASCADE
        );
      `);

      console.log('Tables checked/created');
    } catch (error) {
      console.error('Create tables error:', error);
    }
  }

  // ============================================
  // TRIPS
  // ============================================

  async createTrip(trip) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO trips (name, type, destination, destination_lat, destination_lon, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [trip.name, trip.type, trip.destination, trip.destinationLat || null, trip.destinationLon || null, trip.startDate, trip.endDate, trip.notes || null]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Create trip error:', error);
      throw error;
    }
  }

  async getTrips(filter = {}) {
    try {
      let query = 'SELECT * FROM trips';
      const params = [];

      if (filter.type) {
        query += ' WHERE type = ?';
        params.push(filter.type);
      }

      query += ' ORDER BY created_at DESC';

      return await this.db.getAllAsync(query, params);
    } catch (error) {
      console.error('Get trips error:', error);
      return [];
    }
  }

  async updateTripStatus(tripId, status) {
    try {
      await this.db.runAsync(
        'UPDATE trips SET status = ? WHERE id = ?',
        [status, tripId]
      );
    } catch (error) {
      console.error('Update trip status error:', error);
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      // Con ON DELETE CASCADE, gli elementi figli dovrebbero essere eliminati
      await this.db.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
    } catch (error) {
      console.error('Delete trip error:', error);
      throw error;
    }
  }

  // ============================================
  // JOURNEYS
  // ============================================

  async startJourney(tripId) {
    try {
      const startTime = new Date().toISOString();
      console.log('Starting journey at:', startTime);
      const result = await this.db.runAsync(
        'INSERT INTO journeys (trip_id, start_time, status) VALUES (?, ?, ?)',
        [tripId, startTime, 'active']
      );
      console.log('Journey created with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Start journey error:', error);
      throw error;
    }
  }

  async endJourney(journeyId, totalDistance = 0) {
    try {
      await this.db.runAsync(
        'UPDATE journeys SET end_time = ?, total_distance = ?, status = ? WHERE id = ?',
        [new Date().toISOString(), totalDistance, 'completed', journeyId]
      );
    } catch (error) {
      console.error('End journey error:', error);
      throw error;
    }
  }

  async getActiveJourney() {
    try {
      const journey = await this.db.getFirstAsync(
        `SELECT j.*, t.name as trip_name, t.type as trip_type 
        FROM journeys j 
        JOIN trips t ON j.trip_id = t.id 
        WHERE j.status = 'active'`
      );
      
      if (journey) {
        console.log('Active journey found:', {
          id: journey.id,
          start_time: journey.start_time,
          trip_name: journey.trip_name
        });
      } else {
        console.log('No active journey');
      }
      
      return journey;
    } catch (error) {
      console.error('Get active journey error:', error);
      return null;
    }
  }

  async getJourneys(tripId = null) {
    try {
      let query = `
        SELECT j.*, t.name as trip_name, t.type as trip_type, t.destination
        FROM journeys j 
        JOIN trips t ON j.trip_id = t.id
      `;
      const params = [];

      if (tripId) {
        query += ' WHERE j.trip_id = ?';
        params.push(tripId);
      }

      query += ' ORDER BY j.start_time DESC';

      return await this.db.getAllAsync(query, params);
    } catch (error){
      console.error('Get journeys error:', error);
      return [];
      }
    }

  // ============================================
  // GPS POINTS
  // ============================================

  async addGPSPoint(journeyId, latitude, longitude, accuracy = null) {
    try {
      await this.db.runAsync(
        'INSERT INTO gps_points (journey_id, latitude, longitude, timestamp, accuracy) VALUES (?, ?, ?, ?, ?)',
        [journeyId, latitude, longitude, new Date().toISOString(), accuracy]
      );
    } catch (error) {
      console.error('Add GPS point error:', error);
    }
  }

  async getGPSPoints(journeyId) {
    try {
      return await this.db.getAllAsync(
        'SELECT * FROM gps_points WHERE journey_id = ? ORDER BY timestamp ASC',
        [journeyId]
      );
    } catch (error) {
      console.error('Get GPS points error:', error);
      return [];
    }
  }

  // ============================================
  // PHOTOS & NOTES
  // ============================================

  async addPhoto(journeyId, uri, latitude = null, longitude = null, note = null) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO photos (journey_id, uri, latitude, longitude, note) VALUES (?, ?, ?, ?, ?)',
        [journeyId, uri, latitude, longitude, note]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Add photo error:', error);
      throw error;
    }
  }

  async getPhotos(journeyId) {
    try {
      return await this.db.getAllAsync(
        'SELECT * FROM photos WHERE journey_id = ? ORDER BY timestamp DESC',
        [journeyId]
      );
    } catch (error) {
      console.error('Get photos error:', error);
      return [];
    }
  }

  async addNote(journeyId, content, latitude = null, longitude = null) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO notes (journey_id, content, latitude, longitude) VALUES (?, ?, ?, ?)',
        [journeyId, content, latitude, longitude]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Add note error:', error);
      throw error;
    }
  }

  async getNotes(journeyId) {
    try {
      return await this.db.getAllAsync(
        'SELECT * FROM notes WHERE journey_id = ? ORDER BY timestamp DESC',
        [journeyId]
      );
    } catch (error) {
      console.error('Get notes error:', error);
      return [];
    }
  }

  // ============================================
  // GEOFENCES
  // ============================================

  async addGeofence(name, latitude, longitude, radius) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO geofences (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
        [name, latitude, longitude, radius]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Add geofence error:', error);
      throw error;
    }
  }

  async getGeofences() {
    try {
      return await this.db.getAllAsync('SELECT * FROM geofences ORDER BY created_at DESC');
    } catch (error) {
      console.error('Get geofences error:', error);
      return [];
    }
  }

  async updateGeofence(id, name, latitude, longitude, radius) {
    try {
      await this.db.runAsync(
        'UPDATE geofences SET name = ?, latitude = ?, longitude = ?, radius = ? WHERE id = ?',
        [name, latitude, longitude, radius, id]
      );
    } catch (error) {
      console.error('Update geofence error:', error);
      throw error;
    }
  }

  async deleteGeofence(id) {
    try {
      // ON DELETE CASCADE si occupa degli eventi
      await this.db.runAsync('DELETE FROM geofences WHERE id = ?', [id]);
    } catch (error) {
      console.error('Delete geofence error:', error);
      throw error;
    }
  }

  async addGeofenceEvent(geofenceId, eventType) {
    try {
      await this.db.runAsync(
        'INSERT INTO geofence_events (geofence_id, event_type) VALUES (?, ?)',
        [geofenceId, eventType]
      );
    } catch (error) {
      console.error('Add geofence event error:', error);
    }
  }

  async getGeofenceStats(geofenceId) {
    try {
      const events = await this.db.getAllAsync(
        'SELECT COUNT(*) as total FROM geofence_events WHERE geofence_id = ?',
        [geofenceId]
      );

      const enters = await this.db.getAllAsync(
        'SELECT COUNT(*) as count FROM geofence_events WHERE geofence_id = ? AND event_type = ?',
        [geofenceId, 'enter']
      );

      const exits = await this.db.getAllAsync(
        'SELECT COUNT(*) as count FROM geofence_events WHERE geofence_id = ? AND event_type = ?',
        [geofenceId, 'exit']
      );

      const lastVisit = await this.db.getFirstAsync(
        'SELECT * FROM geofence_events WHERE geofence_id = ? ORDER BY timestamp DESC LIMIT 1',
        [geofenceId]
      );

      return {
        totalEvents: events[0]?.total || 0,
        enterCount: enters[0]?.count || 0,
        exitCount: exits[0]?.count || 0,
        lastVisit: lastVisit?.timestamp || null,
        avgTimeSpentMinutes: 0,
      };
    } catch (error) {
      console.error('Get geofence stats error:', error);
      return {
        totalEvents: 0,
        enterCount: 0,
        exitCount: 0,
        lastVisit: null,
        avgTimeSpentMinutes: 0,
      };
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getAdvancedDashboardStats(daysBack = 365) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      const stats = await this.db.getFirstAsync(`
        SELECT 
          COUNT(DISTINCT t.id) as total_trips,
          COUNT(DISTINCT j.id) as total_journeys,
          COALESCE(SUM(j.total_distance), 0) as total_distance,
          COALESCE(AVG(j.total_distance), 0) as avg_distance,
          COUNT(DISTINCT p.id) as total_photos,
          COUNT(DISTINCT n.id) as total_notes,
          COUNT(DISTINCT t.destination) as unique_destinations
        FROM trips t
        LEFT JOIN journeys j ON t.id = j.trip_id AND j.status = 'completed'
        LEFT JOIN photos p ON j.id = p.journey_id
        LEFT JOIN notes n ON j.id = n.journey_id
        WHERE t.start_date >= ?
      `, [startDate.toISOString()]);
      
      return stats || {};
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return {};
    }
  }

  async getInsightsData() {
    try {
      const trips = await this.getTrips();
      const weeklyPattern = await this.getWeeklyPatternAnalysis();
      const topDestinations = await this.getTopDestinations(3);
      const travelStreak = await this.calculateTravelStreak();
      const activeJourney = await this.getActiveJourney();
      
      return {
        recentTrips: trips.slice(0, 10),
        topDestinations,
        weeklyPattern,
        travelStreak,
        hasActiveJourney: !!activeJourney,
      };
    } catch (error) {
      console.error('Get insights error:', error);
      return {};
    }
  }

  async getWeeklyPatternAnalysis() {
    try {
      const results = await this.db.getAllAsync(`
        SELECT 
          CAST(strftime('%w', start_time) AS INTEGER) as day_of_week,
          COUNT(*) as journey_count,
          COALESCE(AVG(total_distance), 0) as avg_distance
        FROM journeys
        WHERE status = 'completed'
        GROUP BY day_of_week
        ORDER BY day_of_week ASC
      `);
      
      return results;
    } catch (error) {
      console.error('Get weekly pattern error:', error);
      return [];
    }
  }

  async getTopDestinations(limit = 10) {
    try {
      return await this.db.getAllAsync(`
        SELECT 
          destination,
          COUNT(*) as visit_count,
          MAX(start_date) as last_visit
        FROM trips
        WHERE destination IS NOT NULL AND destination != ''
        GROUP BY destination
        ORDER BY visit_count DESC
        LIMIT ?
      `, [limit]);
    } catch (error) {
      console.error('Get top destinations error:', error);
      return [];
    }
  }

  async calculateTravelStreak() {
    try {
      const journeys = await this.db.getAllAsync(`
        SELECT DISTINCT DATE(start_time) as journey_date
        FROM journeys
        WHERE status = 'completed'
        ORDER BY journey_date DESC
      `);
      
      if (journeys.length === 0) return 0;
      
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < journeys.length; i++) {
        const journeyDate = new Date(journeys[i].journey_date);
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        
        if (journeyDate.toDateString() === expectedDate.toDateString()) {
          streak++;
        } else {
          // Permetti un "gap" di un giorno
          const expectedDateYesterday = new Date(today);
          expectedDateYesterday.setDate(expectedDateYesterday.getDate() - (i + 1));
          if (journeyDate.toDateString() === expectedDateYesterday.toDateString()) {
             // Non incrementare lo streak, ma continua a cercare
             continue;
          }
          break;
        }
      }
      
      return streak;
    } catch (error) {
      console.error('Calculate streak error:', error);
      return 0;
    }
  }

  // ============================================
  // DEBUG
  // ============================================

  async generateTestData() {
    try {
      const destinations = [
        { name: 'Roma', lat: 41.9028, lon: 12.4964 },
        { name: 'Milano', lat: 45.4642, lon: 9.1900 },
        { name: 'Firenze', lat: 43.7696, lon: 11.2558 },
        { name: 'Venezia', lat: 45.4408, lon: 12.3155 },
        { name: 'Napoli', lat: 40.8518, lon: 14.2681 }
      ];
      const types = ['local', 'day', 'multi-day'];
      
      for (let i = 0; i < 10; i++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        const dest = destinations[Math.floor(Math.random() * destinations.length)];

        const tripId = await this.createTrip({
          name: `Test ${dest.name} ${i + 1}`,
          type: types[Math.floor(Math.random() * types.length)],
          destination: dest.name,
          destinationLat: dest.lat,
          destinationLon: dest.lon,
          startDate: startDate.toISOString(),
          endDate: startDate.toISOString(),
          notes: 'Test data'
        });

        await this.updateTripStatus(tripId, 'completed');

        const journeyId = await this.startJourney(tripId);
        // Simula punti GPS
        await this.addGPSPoint(journeyId, dest.lat + (Math.random() - 0.5) * 0.01, dest.lon + (Math.random() - 0.5) * 0.01);
        await this.addGPSPoint(journeyId, dest.lat, dest.lon);
        
        await this.endJourney(journeyId, Math.random() * 50000 + 5000);
      }

      console.log('Test data generated');
    } catch (error) {
      console.error('Generate test data error:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      // Drop in reverse order of creation (dependencies first)
      await this.db.execAsync('DROP TABLE IF EXISTS geofence_events;');
      await this.db.execAsync('DROP TABLE IF EXISTS geofences;');
      await this.db.execAsync('DROP TABLE IF EXISTS notes;');
      await this.db.execAsync('DROP TABLE IF EXISTS photos;');
      await this.db.execAsync('DROP TABLE IF EXISTS gps_points;');
      await this.db.execAsync('DROP TABLE IF EXISTS journeys;');
      await this.db.execAsync('DROP TABLE IF EXISTS trips;');
      console.log('All tables dropped');
      // Ricrea le tabelle
      await this.createTables();
    } catch (error) {
      console.error('Clear data error (dropping tables):', error);
      throw error;
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  calculateDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
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
}
export default new DatabaseService();