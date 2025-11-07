import {useFocusEffect} from '@react-navigation/native';
import React, {useState, useCallback} from 'react';
import {View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, RefreshControl, TextInput, Alert} from 'react-native';
import {Text, ActivityIndicator, Portal, Modal} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import MapView, {Circle, Marker} from 'react-native-maps';
import {Ionicons} from '@expo/vector-icons';
import {BarChart} from 'react-native-chart-kit';
import {COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, MAP_DARK_STYLE} from '../styles/theme';
import {commonStyles} from '../styles/commonStyles';
import DatabaseService from '../services/DatabaseService';
import PredictionService from '../services/PredictionService';

const {width} = Dimensions.get('window');

export default function ChartsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [insights, setInsights] = useState(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [periodStats, setPeriodStats] = useState(null);
  const [heatmapPeriod, setHeatmapPeriod] = useState('month');
  const [heatmapData, setHeatmapData] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);

  useFocusEffect(useCallback(() => { loadStatistics(); }, []));
  const onRefresh = useCallback(async () => { setRefreshing(true); await loadStatistics(); setRefreshing(false); }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const [basicStats, predictionData, insightsData] = await Promise.all([
        DatabaseService.getAdvancedDashboardStats(365),
        PredictionService.getCachedOrGeneratePredictions(),
        DatabaseService.getInsightsData()
      ]);
      setStats(basicStats);
      setPredictions(predictionData);
      setInsights(insightsData);
      await loadHeatmapData(heatmapPeriod);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };
  const processWeeklyData = (patternData) => {
    const weeklyCounts = Array(7).fill(0);
    if (patternData && patternData.length > 0) {
      patternData.forEach(day => {
        if (day.day_of_week >= 0 && day.day_of_week <= 6) {
          weeklyCounts[day.day_of_week] = day.journey_count || 0;
        }
      });
    }
    return weeklyCounts;
  };
  const loadHeatmapData = async (period) => {
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
      const startDate = new Date(Date.now() - days * 86400000).toISOString();
      const trips = await DatabaseService.db.getAllAsync(
        `SELECT t.id, t.destination, t.destination_lat, t.destination_lon, 
                COUNT(j.id) as journey_count
         FROM trips t 
         LEFT JOIN journeys j ON t.id = j.trip_id AND j.status = "completed"
         WHERE t.start_date >= ? AND t.destination_lat IS NOT NULL AND t.destination_lon IS NOT NULL
         GROUP BY t.id, t.destination, t.destination_lat, t.destination_lon`,
        [startDate]
      );
      const locationMap = new Map();
      for (const trip of trips) {
        if (trip.journey_count === 0){
          continue;
        }
        const key = `${trip.destination_lat.toFixed(3)},${trip.destination_lon.toFixed(3)}`;
        const loc = locationMap.get(key);
        if (loc){
          locationMap.set(key, { 
            ...loc, 
            visitCount: loc.visitCount + trip.journey_count 
          });
        }else{
          locationMap.set(key, {
            latitude: trip.destination_lat,
            longitude: trip.destination_lon,
            destination: trip.destination,
            visitCount: trip.journey_count
          });
        }
      }
      const locations = Array.from(locationMap.values());
      setHeatmapData(locations);
      if (locations.length > 0) {
        const lats = locations.map(l => l.latitude);
        const lngs = locations.map(l => l.longitude);
        setMapRegion({
          latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
          longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
          latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats) + 0.5, 0.5),
          longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + 0.5, 0.5)
        });
      } else {
        setMapRegion({ latitude: 42.5, longitude: 12.5, latitudeDelta: 8, longitudeDelta: 8 });
      }
    } catch (error) {
      setHeatmapData([]);
    }
  };

  const handlePeriodAnalysis = async () => {
    const year = parseInt(selectedYear), month = parseInt(selectedMonth);
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() || isNaN(month) || month < 1 || month > 12) {
      Alert.alert('Errore', 'Anno o mese non valido');
      return;
    }
    if (new Date(year, month - 1, 1) > new Date()) {
      Alert.alert('Errore', 'Non puoi selezionare un periodo futuro');
      return;
    }
    try {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59).toISOString();
      const trips = await DatabaseService.db.getAllAsync(
        'SELECT t.*, COUNT(j.id) as journey_count, SUM(j.total_distance) as total_distance, COUNT(DISTINCT p.id) as photo_count, COUNT(DISTINCT n.id) as note_count FROM trips t LEFT JOIN journeys j ON t.id = j.trip_id AND j.status = "completed" LEFT JOIN photos p ON j.id = p.journey_id LEFT JOIN notes n ON j.id = n.journey_id WHERE t.start_date >= ? AND t.start_date <= ? GROUP BY t.id',
        [start, end]
      );
      const destinations = await DatabaseService.db.getAllAsync(
        'SELECT destination, COUNT(*) as visit_count FROM trips WHERE start_date >= ? AND start_date <= ? GROUP BY destination ORDER BY visit_count DESC LIMIT 5',
        [start, end]
      );
      setPeriodStats({
        year, month,
        tripCount: trips.length,
        totalDistance: Math.round(trips.reduce((s, t) => s + (t.total_distance || 0), 0) / 1000),
        totalPhotos: trips.reduce((s, t) => s + (t.photo_count || 0), 0),
        totalNotes: trips.reduce((s, t) => s + (t.note_count || 0), 0),
        destinations
      });
      setShowPeriodModal(false);
      Alert.alert('Analisi Completata', `Trovati ${trips.length} viaggi`);
    } catch (error) {
      console.error('Error analyzing period:', error);
      Alert.alert('Errore', 'Impossibile analizzare il periodo');
    }
  };

  const getMonthName = (m) => ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][m-1];
  const getHeatColor = (v) => v >= 5 ? COLORS.error : v >= 3 ? COLORS.tertiary : v >= 2 ? COLORS.secondary : COLORS.primary;
  const getHeatRadius = (v) => Math.min(3000 + v * 1000, 10000);

  const chartConfig = {
    backgroundColor: COLORS.surface,
    backgroundGradientFrom: COLORS.surface,
    backgroundGradientTo: COLORS.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(88, 101, 242, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(220, 221, 222, ${opacity})`,
    style: { borderRadius: BORDER_RADIUS.lg },
    propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.primary },
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.safeArea}>
        <View style={commonStyles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const StatCard = ({ icon, value, label, color }) => (
    <View style={[commonStyles.box, styles.statCard]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={commonStyles.statLabel}>{label}</Text>
    </View>
  );

  const PeriodButton = ({ label, active, onPress }) => (
    <TouchableOpacity style={[styles.periodBtn, active && styles.periodBtnActive]} onPress={onPress}>
      <Text style={[styles.periodBtnText, active && styles.periodBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={commonStyles.safeArea}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>Statistiche</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Panoramica</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="map-outline" value={stats?.total_trips || 0} label="Viaggi Totali" color={COLORS.primary} />
            <StatCard icon="navigate-outline" value={`${Math.round((stats?.total_distance || 0) / 1000)} km`} label="Distanza Totale" color={COLORS.secondary} />
            <StatCard icon="camera-outline" value={stats?.total_photos || 0} label="Foto Scattate" color={COLORS.tertiary} />
            <StatCard icon="location-outline" value={stats?.unique_destinations || 0} label="Destinazioni" color={COLORS.primary} />
          </View>
        </View>
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Heatmap Località</Text>
          <View style={styles.periodSelector}>
            <PeriodButton label="Settimana" active={heatmapPeriod === 'week'} onPress={() => { setHeatmapPeriod('week'); loadHeatmapData('week'); }} />
            <PeriodButton label="Mese" active={heatmapPeriod === 'month'} onPress={() => { setHeatmapPeriod('month'); loadHeatmapData('month'); }} />
            <PeriodButton label="Anno" active={heatmapPeriod === 'year'} onPress={() => { setHeatmapPeriod('year'); loadHeatmapData('year'); }} />
          </View>

          <View style={[commonStyles.mapContainer, styles.heatmapMap]}>
            {mapRegion && (
              <MapView style={commonStyles.map} region={mapRegion} customMapStyle={MAP_DARK_STYLE} showsUserLocation scrollEnabled zoomEnabled>
                {heatmapData.map((loc, i) => (
                  <React.Fragment key={i}>
                    <Circle center={{ latitude: loc.latitude, longitude: loc.longitude }} radius={getHeatRadius(loc.visitCount)}
                      fillColor={getHeatColor(loc.visitCount) + '40'} strokeColor={getHeatColor(loc.visitCount)} strokeWidth={2} />
                    <Marker coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                      title={loc.destination} description={`${loc.visitCount} ${loc.visitCount === 1 ? 'visita' : 'visite'}`}>
                      <View style={[styles.heatMarker, { backgroundColor: getHeatColor(loc.visitCount) }]}>
                        <Text style={styles.heatMarkerText}>{loc.visitCount}</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                ))}
              </MapView>
            )}
          </View>

          <View style={[commonStyles.box, styles.legend]}>
            <Text style={styles.legendTitle}>Legenda</Text>
            <View style={styles.legendRow}>
              {[
                { color: COLORS.primary, text: '1 visita' },
                { color: COLORS.secondary, text: '2 visite' },
                { color: COLORS.tertiary, text: '3-4 visite' },
                { color: COLORS.error, text: '5+ visite' }
              ].map((item, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={commonStyles.section}>
          <View style={commonStyles.spaceBetween}>
            <Text style={commonStyles.sectionTitle}>Analisi Periodo</Text>
            <TouchableOpacity style={styles.analyzeBtn} onPress={() => setShowPeriodModal(true)}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.white} />
              <Text style={styles.analyzeBtnText}>Seleziona</Text>
            </TouchableOpacity>
          </View>
          
          {periodStats ? (
            <View style={commonStyles.box}>
              <Text style={styles.periodTitle}>{getMonthName(periodStats.month)} {periodStats.year}</Text>
              <View style={styles.periodStatsRow}>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatValue}>{periodStats.tripCount}</Text>
                  <Text style={styles.periodStatLabel}>Viaggi</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatValue}>{periodStats.totalDistance} km</Text>
                  <Text style={styles.periodStatLabel}>Distanza</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatValue}>{periodStats.totalPhotos}</Text>
                  <Text style={styles.periodStatLabel}>Foto</Text>
                </View>
              </View>
              {periodStats.destinations?.length > 0 && (
                <>
                  <View style={commonStyles.divider} />
                  <Text style={styles.periodSubtitle}>Località Visitate</Text>
                  {periodStats.destinations.map((d, i) => (
                    <View key={i} style={styles.destItem}>
                      <Text style={styles.destName}>{d.destination}</Text>
                      <Text style={styles.destCount}>{d.visit_count} {d.visit_count === 1 ? 'visita' : 'visite'}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : (
            <View style={[commonStyles.box, styles.noPeriod]}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.noPeriodText}>Seleziona un periodo per visualizzare le statistiche</Text>
            </View>
          )}
        </View>

        {predictions?.forecasts && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Previsioni Personalizzate</Text>
            <View style={commonStyles.box}>
              <View style={styles.predHeader}>
                <Ionicons name="trending-up-outline" size={24} color={COLORS.primary} />
                <Text style={styles.predTitle}>Prossimo Mese</Text>
              </View>
              <View style={styles.predRow}>
                <Text style={commonStyles.text}>Viaggi Previsti:</Text>
                <Text style={styles.predValue}>{predictions.forecasts.nextMonth.predictedTrips}</Text>
              </View>
              <View style={styles.predRow}>
                <Text style={commonStyles.text}>Distanza Prevista:</Text>
                <Text style={styles.predValue}>{predictions.forecasts.nextMonth.predictedDistance} km</Text>
              </View>
              <View style={styles.confidence}>
                <Text style={styles.confidenceText}>Confidenza: {Math.round(predictions.forecasts.nextMonth.confidence * 100)}%</Text>
              </View>
            </View>
            {predictions.recommendations?.length > 0 && (
              <View style={[commonStyles.box, { marginTop: SPACING.md }]}>
                <Text style={styles.recTitle}>Suggerimenti</Text>
                {predictions.recommendations.slice(0, 2).map((r, i) => (
                  <View key={i} style={styles.rec}>
                    <Text style={styles.recItemTitle}>{r.title}</Text>
                    <Text style={styles.recDesc}>{r.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {insights?.weeklyPattern?.length > 0 && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Pattern Settimanale</Text>
            <View style={commonStyles.box}>
              <BarChart
                data={{ labels: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'], datasets: [{ data: processWeeklyData(insights.weeklyPattern) }] }}
                width={width - SPACING.lg * 2 - SPACING.lg * 2}
                height={220} 
                chartConfig={chartConfig} 
                style={styles.chart} 
                showValuesOnTopOfBars
                withHorizontalLabels={false}
                yLabelsOffset={0}
              />
            </View>
          </View>
        )}

        {insights?.topDestinations?.length > 0 && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Destinazioni Preferite</Text>
            {insights.topDestinations.map((d, i) => (
              <View key={i} style={[commonStyles.box, styles.destCard]}>
                <View style={styles.destRank}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.destName}>{d.destination}</Text>
                  <Text style={commonStyles.textSecondary}>{d.visit_count} {d.visit_count === 1 ? 'visita' : 'visite'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Modal visible={showPeriodModal} onDismiss={() => setShowPeriodModal(false)} contentContainerStyle={commonStyles.modal}>
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Seleziona Periodo</Text>
            <TouchableOpacity style={commonStyles.buttonClose} onPress={() => setShowPeriodModal(false)}>
              <Ionicons name="close" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Anno</Text>
          <TextInput style={styles.input} value={selectedYear} onChangeText={setSelectedYear} placeholder="2024" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
          <Text style={styles.label}>Mese (1-12)</Text>
          <TextInput style={styles.input} value={selectedMonth} onChangeText={setSelectedMonth} placeholder="1" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
          <TouchableOpacity style={[commonStyles.button, { marginTop: SPACING.xl }]} onPress={handlePeriodAnalysis}>
            <Text style={commonStyles.buttonText}>Analizza</Text>
          </TouchableOpacity>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statCard: { width: (width - SPACING.xl * 2 - SPACING.md) / 2, alignItems: 'center', paddingVertical: SPACING.lg },
  statValue: { fontSize: FONT_SIZES.xxxl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginVertical: SPACING.sm },
  periodSelector: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  periodBtn: { flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 2, borderColor: COLORS.borderLight, alignItems: 'center' },
  periodBtnActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  periodBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textSecondary },
  periodBtnTextActive: { color: COLORS.primary },
  heatmapMap: { height: 350, marginBottom: SPACING.lg },
  heatMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  heatMarkerText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.white },
  legend: { marginBottom: SPACING.lg },
  legendTitle: { fontSize: FONT_SIZES.base, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.text, marginBottom: SPACING.md },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md },
  analyzeBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.white },
  periodTitle: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginBottom: SPACING.lg },
  periodStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md },
  periodStat: { alignItems: 'center' },
  periodStatValue: { fontSize: FONT_SIZES.xxl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary, marginBottom: SPACING.xs },
  periodStatLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  periodSubtitle: { fontSize: FONT_SIZES.base, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.text, marginBottom: SPACING.md },
  destItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  destName: { fontSize: FONT_SIZES.base, color: COLORS.text },
  destCount: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  noPeriod: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  noPeriodText: { fontSize: FONT_SIZES.base, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md },
  streak: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg },
  streakValue: { fontSize: FONT_SIZES.xxl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.tertiary, marginBottom: SPACING.xs },
  predHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  predTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  predValue: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  confidence: { marginTop: SPACING.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, alignSelf: 'flex-start' },
  confidenceText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.semibold },
  recTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  rec: { paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  recItemTitle: { fontSize: FONT_SIZES.base, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.text, marginBottom: SPACING.xs },
  recDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
  chart: { marginVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, marginLeft: -8,},
  destCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md },
  destRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  rankNum: { fontSize: FONT_SIZES.base, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZES.base, color: COLORS.text, borderWidth: 1, borderColor: COLORS.borderLight }
});