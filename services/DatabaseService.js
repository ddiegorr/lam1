import * as SQLite from 'expo-sqlite';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync('travel_companion.db');
      await this.createTables();
    } catch (error) {
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
    } catch (error) {
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
    } catch (error){
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
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      await this.db.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
    } catch (error) {
      throw error;
    }
  }

  // VIAGGI
  async startJourney(tripId) {
    try {
      const startTime = new Date().toISOString();
      const result = await this.db.runAsync(
        'INSERT INTO journeys (trip_id, start_time, status) VALUES (?, ?, ?)',
        [tripId, startTime, 'active']
      );
      return result.lastInsertRowId;
    } catch (error) {
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
      return journey;
    }catch (error){
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
    }
  }

  async getGPSPoints(journeyId) {
    try {
      return await this.db.getAllAsync(
        'SELECT * FROM gps_points WHERE journey_id = ? ORDER BY timestamp ASC',
        [journeyId]
      );
    } catch (error) {
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
      return [];
    }
  }

  // GEOFENCE
  async addGeofence(name, latitude, longitude, radius) {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO geofences (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
        [name, latitude, longitude, radius]
      );
      return result.lastInsertRowId;
    } catch (error) {
      throw error;
    }
  }

  async getGeofences() {
    try {
      return await this.db.getAllAsync('SELECT * FROM geofences ORDER BY created_at DESC');
    } catch (error) {
      return [];
    }
  }

  async deleteGeofence(id) {
    try {
      await this.db.runAsync('DELETE FROM geofences WHERE id = ?', [id]);
    } catch (error) {
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
      throw error;
    }
  }

  async getGeofenceStats(geofenceId = null) {
    try {
      if (geofenceId) {
        const stats = await this.db.getFirstAsync(`
          SELECT 
            COUNT(CASE WHEN event_type = 'entry' THEN 1 END) as entries,
            COUNT(CASE WHEN event_type = 'exit' THEN 1 END) as exits,
            COUNT(*) as total_events
          FROM geofence_events
          WHERE geofence_id = ?
        `, [geofenceId]);
        return {
          enterCount: stats?.entries || 0,
          exitCount: stats?.exits || 0,
          totalEvents: stats?.total_events || 0
        };
      } else {
        const allStats = await this.db.getAllAsync(`
          SELECT 
            g.id,
            g.name,
            COUNT(CASE WHEN e.event_type = 'entry' THEN 1 END) as entries,
            COUNT(CASE WHEN e.event_type = 'exit' THEN 1 END) as exits
          FROM geofences g
          LEFT JOIN geofence_events e ON g.id = e.geofence_id
          GROUP BY g.id, g.name
          ORDER BY g.created_at DESC
        `);
        return allStats.map(stat => ({
          id: stat.id,
          name: stat.name,
          entries: stat.entries || 0,
          exits: stat.exits || 0
        }));
      }
    } catch (error) {
      return geofenceId ? { enterCount: 0, exitCount: 0, totalEvents: 0 } : [];
    }
  }

  // STATISTICHE
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
      return [];
    }
  }
}

export default new DatabaseService();