import * as SQLite from 'expo-sqlite';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync('travel_companion.db');
      await this.createTables();
      await this.migrateDatabase();
      console.log('Database inizializzato');
    } catch (error) {
      console.error('Errore inizializzazione database', error);
      throw error;
    }
  }

  async migrateDatabase() {
    console.log('🔄 Checking database migrations...');
    try {
      const tripsInfo = await this.db.getAllAsync('PRAGMA table_info(trips)');
      if (!tripsInfo.some(col => col.name === 'destination_lat')) {
        await this.db.execAsync('ALTER TABLE trips ADD COLUMN destination_lat REAL');
        console.log('✅ Migrated trips: Added destination_lat');
      }
      if (!tripsInfo.some(col => col.name === 'destination_lon')) {
        await this.db.execAsync('ALTER TABLE trips ADD COLUMN destination_lon REAL');
        console.log('✅ Migrated trips: Added destination_lon');
      }
      const journeysInfo = await this.db.getAllAsync('PRAGMA table_info(journeys)');
      if (!journeysInfo.some(col => col.name === 'trip_id')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN trip_id INTEGER');
        console.log('✅ Migrated journeys: Added trip_id');
      }
      if (!journeysInfo.some(col => col.name === 'total_distance')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN total_distance REAL DEFAULT 0');
        console.log('✅ Migrated journeys: Added total_distance');
      }
      if (!journeysInfo.some(col => col.name === 'status')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN status TEXT DEFAULT \'active\'');
        console.log('✅ Migrated journeys: Added status');
      }
      if (!journeysInfo.some(col => col.name === 'created_at')) {
        await this.db.execAsync('ALTER TABLE journeys ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('✅ Migrated journeys: Added created_at');
      }
      const geofencesInfo = await this.db.getAllAsync('PRAGMA table_info(geofences)');
      if (!geofencesInfo.some(col => col.name === 'created_at')) {
        await this.db.execAsync('ALTER TABLE geofences ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('✅ Migrated geofences: Added created_at');
      }
      console.log('✅ Database migration check complete');
    } catch (error) {
      console.error('❌ Migration error:', error);
      console.warn('⚠️ Migration failed - Database might be in inconsistent state');
      throw error;
    }
  }

  async createTables() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    try {
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

      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS geofence_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          geofence_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (geofence_id) REFERENCES geofences (id) ON DELETE CASCADE
        );
      `);
      console.log('Tabella creata');
    } catch (error) {
      console.error('Errore creazione tabella', error);
      throw error;
    }
  }

  // TRIPS
  async createTrip(trip) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO trips (name, type, destination, destination_lat, destination_lon, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          trip.name, 
          trip.type, 
          trip.destination, 
          trip.destinationLat || null, 
          trip.destinationLon || null, 
          trip.startDate, 
          trip.endDate, 
          trip.notes || null
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Errore creazione viaggio', error);
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
      console.error('Errore get viaggio', error);
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
      console.error('Errore aggiornamento status viaggio', error);
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      await this.db.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
    } catch (error) {
      console.error('Errore eliminazione viaggio', error);
      throw error;
    }
  }

  // VIAGGIO
  async startJourney(tripId) {
    try {
      const startTime = new Date().toISOString();
      console.log('Starting journey at:', startTime);
      const result = await this.db.runAsync(
        'INSERT INTO journeys (trip_id, start_time, status) VALUES (?, ?, ?)',
        [tripId, startTime, 'active']
      );
      console.log('Viaggio creato ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Errore inizio viaggio', error);
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
      console.error('Errore fine viaggio', error);
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
        console.log('Viaggio attivo trovato', {
          id: journey.id,
          start_time: journey.start_time,
          trip_name: journey.trip_name
        });
      } else {
        console.log('Nessun viaggio attivo trovato');
      }
      return journey;
    } catch (error) {
      console.error('Errore richiesta viaggi attivi', error);
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
    } catch (error) {
      console.error('Errore richiesta viaggi', error);
      return [];
    }
  }

  // GPS POINTS
  async addGPSPoint(journeyId, latitude, longitude, accuracy = null) {
    try {
      await this.db.runAsync(
        'INSERT INTO gps_points (journey_id, latitude, longitude, timestamp, accuracy) VALUES (?, ?, ?, ?, ?)',
        [journeyId, latitude, longitude, new Date().toISOString(), accuracy]
      );
    } catch (error) {
      console.error('Errore aggiunta punti GPS', error);
    }
  }

  async getGPSPoints(journeyId) {
    try {
      return await this.db.getAllAsync(
        'SELECT * FROM gps_points WHERE journey_id = ? ORDER BY timestamp ASC',
        [journeyId]
      );
    } catch (error) {
      console.error('Errore get GPS', error);
      return [];
    }
  }

  // FOTO E NOTE
  async addPhoto(journeyId, uri, latitude = null, longitude = null, note = null) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO photos (journey_id, uri, latitude, longitude, note) VALUES (?, ?, ?, ?, ?)',
        [journeyId, uri, latitude, longitude, note]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Errore aggiunta foto', error);
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
      console.error('Errore get foto', error);
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
      console.error('Errore aggiunta note', error);
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
      console.error('Errore get note', error);
      return [];
    }
  }

  // GEOFENCES
  async addGeofence(name, latitude, longitude, radius) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO geofences (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
        [name, latitude, longitude, radius]
      );
      console.log(`Geofence creato ${name} (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Errore creazione geofence', error);
      throw error;
    }
  }

  async getGeofences() {
    try {
      return await this.db.getAllAsync('SELECT * FROM geofences ORDER BY created_at DESC');
    } catch (error) {
      console.error('Errore get Geofence', error);
      return [];
    }
  }

  async deleteGeofence(id) {
    try {
      await this.db.runAsync('DELETE FROM geofences WHERE id = ?', [id]);
      console.log(`Geofence eliminato (ID: ${id})`);
    } catch (error) {
      console.error('Errore eliminazione geofence', error);
      throw error;
    }
  }

  async addGeofenceEvent(geofenceId, eventType) {
    try {
      await this.db.runAsync(
        'INSERT INTO geofence_events (geofence_id, event_type) VALUES (?, ?)',
        [geofenceId, eventType]
      );
      console.log(`Geofence registrato: ${eventType} per ${geofenceId}`);
    } catch (error) {
      console.error('Errore aggiunta Geofence', error);
      throw error;
    }
  }

  async getGeofenceStats(geofenceId) {
    try {
      const stats = await this.db.getFirstAsync(`
        SELECT 
          SUM(CASE WHEN event_type = 'enter' THEN 1 ELSE 0 END) as enter_count,
          SUM(CASE WHEN event_type = 'exit' THEN 1 ELSE 0 END) as exit_count,
        FROM geofence_events 
        WHERE geofence_id = ?
      `, [geofenceId]);
      return {
        enterCount: stats?.enter_count || 0,
        exitCount: stats?.exit_count || 0,
      };
    } catch (error) {
      console.error('Errore stats Geofence', error);
      return {
        enterCount: 0,
        exitCount: 0,
      };
    }
  }

  // STATISTICS
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
      console.error('Errore dashboard stats', error);
      return {};
    }
  }

  async getInsightsData() {
    try {
      const trips = await this.getTrips();
      const weeklyPattern = await this.getWeeklyPatternAnalysis();
      const topDestinations = await this.getTopDestinations(3);
      const activeJourney = await this.getActiveJourney();
      return {
        recentTrips: trips.slice(0, 10),
        topDestinations,
        weeklyPattern,
        hasActiveJourney: !!activeJourney,
      };
    } catch (error) {
      console.error('Errore insights', error);
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
      console.error('Errore caricamento pattern settimanale', error);
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
      console.error('Errore caricamento top destination', error);
      return [];
    }
  }

  async clearAllData() {
    try {
      await this.db.execAsync('DROP TABLE IF EXISTS geofence_events;');
      await this.db.execAsync('DROP TABLE IF EXISTS geofences;');
      await this.db.execAsync('DROP TABLE IF EXISTS notes;');
      await this.db.execAsync('DROP TABLE IF EXISTS photos;');
      await this.db.execAsync('DROP TABLE IF EXISTS gps_points;');
      await this.db.execAsync('DROP TABLE IF EXISTS journeys;');
      await this.db.execAsync('DROP TABLE IF EXISTS trips;');
      console.log('Tutte le tabelle eliminate');
      
      await this.createTables();
      console.log('Tabelle ricreate');
    } catch (error) {
      console.error('Errore pulizia dati', error);
      throw error;
    }
  }

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