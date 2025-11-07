import DatabaseService from './DatabaseService';
import { subMonths } from 'date-fns';

class PredictionService {
  constructor() {
    this.analysisCache = null;
    this.lastAnalysisDate = null;
  }

  async getCachedOrGeneratePredictions() {
    if (this.analysisCache && !this.shouldRefreshAnalysis()) {
      return this.analysisCache;
    }
    
    return await this.generatePersonalizedPredictions();
  }

  async generatePersonalizedPredictions() {
    try {
      const historicalData = await this.getHistoricalTravelData();
      
      if (historicalData.trips.length < 3) {
        return this.getDefaultPredictions();
      }

      const patterns = await this.analyzePersonalTravelPatterns(historicalData);
      const forecasts = await this.generateTravelForecasts(patterns);
      const recommendations = await this.generatePersonalizedRecommendations(patterns, forecasts);
      
      const predictions = {
        patterns,
        forecasts,
        recommendations,
        analysisDate: new Date().toISOString(),
        confidence: this.calculateConfidence(historicalData)
      };

      this.analysisCache = predictions;
      this.lastAnalysisDate = new Date();
      
      return predictions;
    } catch (error) {
      console.error('Prediction error:', error);
      return this.getDefaultPredictions();
    }
  }

  async getHistoricalTravelData() {
    try {
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      
      const trips = await DatabaseService.db.getAllAsync(`
        SELECT t.*, 
               COUNT(j.id) as journey_count,
               SUM(j.total_distance) as total_distance
        FROM trips t 
        LEFT JOIN journeys j ON t.id = j.trip_id 
        WHERE t.start_date >= ?
        GROUP BY t.id
        ORDER BY t.start_date ASC
      `, [sixMonthsAgo]);

      const monthlyData = await DatabaseService.db.getAllAsync(`
        SELECT 
          strftime('%Y-%m', t.start_date) as month,
          COUNT(*) as trip_count,
          SUM(j.total_distance) as total_distance
        FROM trips t
        LEFT JOIN journeys j ON t.id = j.trip_id
        WHERE t.start_date >= ?
        GROUP BY month
        ORDER BY month ASC
      `, [sixMonthsAgo]);

      return { trips, monthlyData };
    } catch (error) {
      console.error('Get historical data error:', error);
      return { trips: [], monthlyData: [] };
    }
  }

  async analyzePersonalTravelPatterns(historicalData) {
    const { trips, monthlyData } = historicalData;
    
    const avgTripsPerMonth = monthlyData.length > 0 
      ? monthlyData.reduce((sum, m) => sum + m.trip_count, 0) / monthlyData.length 
      : 0;

    const typePreferences = trips.reduce((acc, trip) => {
      acc[trip.type] = (acc[trip.type] || 0) + 1;
      return acc;
    }, {});

    return {
      frequency: { avgTripsPerMonth, consistency: 'medium' },
      typePreferences: Object.entries(typePreferences).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / trips.length) * 100)
      })),
      distance: {
        avgDistance: trips.length > 0 
          ? trips.reduce((sum, t) => sum + (t.total_distance || 0), 0) / trips.length / 1000
          : 0
      }
    };
  }

  async generateTravelForecasts(patterns) {
    const predictedTripsNextMonth = Math.round(patterns.frequency.avgTripsPerMonth);
    const predictedDistance = patterns.distance.avgDistance * predictedTripsNextMonth;

    return {
      nextMonth: {
        predictedTrips: predictedTripsNextMonth,
        predictedDistance: Math.round(predictedDistance * 10) / 10,
        confidence: 0.7
      }
    };
  }

  async generatePersonalizedRecommendations(patterns, forecasts) {
    const recommendations = [];

    if (forecasts.nextMonth.predictedTrips < 2) {
      recommendations.push({
        type: 'activity',
        title: 'Aumenta i Viaggi',
        description: 'Considera di pianificare più viaggi questo mese per esplorare nuovi luoghi.',
        priority: 'medium'
      });
    }

    if (patterns.distance.avgDistance < 5) {
      recommendations.push({
        type: 'exploration',
        title: 'Esplora Più Lontano',
        description: 'I tuoi viaggi sono brevi. Prova a pianificare un\'escursione più lunga!',
        priority: 'low'
      });
    }

    return recommendations;
  }

  calculateConfidence(historicalData) {
    const dataPoints = historicalData.trips.length;
    if (dataPoints < 3) return 'low';
    if (dataPoints < 8) return 'medium';
    return 'high';
  }

  getDefaultPredictions() {
    return {
      patterns: {
        frequency: { avgTripsPerMonth: 0, consistency: 'low' },
        typePreferences: [],
        distance: { avgDistance: 0 }
      },
      forecasts: {
        nextMonth: {
          predictedTrips: 1,
          predictedDistance: 0,
          confidence: 0.3
        }
      },
      recommendations: [
        {
          type: 'getting_started',
          title: 'Inizia a Viaggiare',
          description: 'Crea il tuo primo viaggio per iniziare a raccogliere dati!',
          priority: 'high'
        }
      ],
      confidence: 'low'
    };
  }

  shouldRefreshAnalysis() {
    if (!this.lastAnalysisDate) return true;
    const daysSince = (new Date() - this.lastAnalysisDate) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  }
}

export default new PredictionService();