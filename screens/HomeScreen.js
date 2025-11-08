import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, TextInput, Image } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Circle, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, MAP_DARK_STYLE } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';
import DatabaseService from '../services/DatabaseService';
import LocationService from '../services/LocationService';

export default function HomeScreen({ navigation }) {
  const [activeJourney, setActiveJourney] = useState(null);
  const [totalTrips, setTotalTrips] = useState(0);
  const [currentDuration, setCurrentDuration] = useState('00:00:00');
  const [recentTrips, setRecentTrips] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [mapRegion, setMapRegion] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const activeJourneyRef = useRef(null);

  useEffect(() => { activeJourneyRef.current = activeJourney; }, [activeJourney]);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    const timer = setInterval(() => {
      const journey = activeJourneyRef.current;
      if (journey?.start_time) {
        try {
          const diff = new Date() - new Date(journey.start_time);
          if (!isNaN(diff) && diff >= 0) {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCurrentDuration(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          }
        } catch (error) {
        }
      }
      if (journey) {
        const status = LocationService.getTrackingStatus();
        if (status.isTracking) setCurrentDistance(status.totalDistance);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { initializeMap(); }, []);

  const initializeMap = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      setMapRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } catch (error) {
      setMapRegion({ latitude: 44.4949, longitude: 11.3426, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    }
  };

  const loadData = async () => {
    try {
      const [journey, trips, stats, allGeofences] = await Promise.all([
        DatabaseService.getActiveJourney(),
        DatabaseService.getTrips(),
        DatabaseService.getAdvancedDashboardStats(365),
        DatabaseService.getGeofences()
      ]);
      setActiveJourney(journey);
      setTotalTrips(trips.length);
      setRecentTrips(trips.slice(0, 3));
      setTotalDistance(Math.round(stats.total_distance / 1000));
      setGeofences(allGeofences);
      if (journey) {
        const [gpsPoints, journeyPhotos, journeyNotes] = await Promise.all([
          DatabaseService.getGPSPoints(journey.id),
          DatabaseService.getPhotos(journey.id),
          DatabaseService.getNotes(journey.id)
        ]);
        if (gpsPoints.length > 0) setRouteCoordinates(gpsPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude })));
        setPhotos(journeyPhotos);
        setNotes(journeyNotes);
      } else {
        setPhotos([]);
        setNotes([]);
      }
    } catch (error) {
    }
  };

  const handleStartRecording = async () => {
    try {
      const trips = await DatabaseService.getTrips();
      const plannedTrips = trips.filter(t => t.status === 'planned' || t.status === 'active');
      
      if (plannedTrips.length === 0) {
        Alert.alert('Nessun Viaggio', 'Crea prima un viaggio per iniziare la registrazione', [
          { text: 'OK', style: 'cancel' },
          { text: 'Crea Viaggio', onPress: () => navigation.navigate('Trips') }
        ]);
        return;
      }
      setAvailableTrips(plannedTrips);
      setShowTripSelector(true);
    } catch (error) {
    }
  };

  const handleSelectTrip = async (tripId) => {
    try {
      setShowTripSelector(false);
      const journeyId = await DatabaseService.startJourney(tripId);
      await LocationService.startTracking(journeyId);
      await DatabaseService.updateTripStatus(tripId, 'active');
      try {
        const NotificationService = (await import('../services/NotificationService')).default;
        const trips = await DatabaseService.getTrips();
        await NotificationService.sendJourneyStartedNotification(trips.find(t => t.id === tripId)?.name || 'viaggio');
      } catch (e) {
      }
      await loadData();
      Alert.alert('Successo', 'Registrazione avviata!');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile avviare la registrazione');
    }
  };

  const handleStopRecording = () => {
    Alert.alert('Termina Registrazione', 'Vuoi terminare la registrazione del viaggio?', [
      {text: 'No', style: 'cancel' },
      {text: 'Termina', style: 'destructive', onPress: async () => {
        try {
          const distance = await LocationService.stopTracking();
          await DatabaseService.endJourney(activeJourney.id, distance);
          await DatabaseService.updateTripStatus(activeJourney.trip_id, 'completed');
          try {
            const NotificationService = (await import('../services/NotificationService')).default;
            await NotificationService.sendJourneyCompletedNotification({ id: activeJourney.id, totalDistance: distance });
          } catch (e) {
          }
          setActiveJourney(null);
          setRouteCoordinates([]);
          setPhotos([]);
          setNotes([]);
          setCurrentDuration('00:00:00');
          await loadData();
          Alert.alert('Completato', `Viaggio terminato! Distanza: ${(distance / 1000).toFixed(1)}km`);
        } catch (error) {
          Alert.alert('Errore', 'Impossibile terminare la registrazione');
        }
      }}
    ]);
  };
  
  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permesso negato', 'Serve il permesso della camera'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled && result.assets[0]) await savePhoto(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const savePhoto = async (uri) => {
    try{
      const location = await LocationService.getCurrentLocation();
      await DatabaseService.addPhoto(activeJourney.id, uri, location.coords.latitude, location.coords.longitude, null);
      try {
        const NotificationService = (await import('../services/NotificationService')).default;
        await NotificationService.sendPhotoAddedNotification();
      }catch (e){
      }
      Alert.alert('Successo', 'Foto salvata!');
      await loadData();
    }catch (error){
      Alert.alert('Errore', 'Impossibile salvare la foto');
    }
  };

  const handleAddNote = () => {
    if (!activeJourney) { Alert.alert('Errore', 'Nessun viaggio attivo'); return; }
    setNoteText('');
    setShowAddNoteModal(true);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) { Alert.alert('Errore', 'Inserisci un testo per la nota'); return; }
    try {
      const location = await LocationService.getCurrentLocation();
      await DatabaseService.addNote(activeJourney.id, noteText.trim(), location.coords.latitude, location.coords.longitude);
      try {
        const NotificationService = (await import('../services/NotificationService')).default;
        await NotificationService.sendNoteAddedNotification();
      } catch (e) {
      }
      setShowAddNoteModal(false);
      Alert.alert('Successo', 'Nota salvata!');
      await loadData();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare la nota');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  const StatBox = ({ icon, value, label, color }) => (
    <View style={[commonStyles.box, styles.statBox]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={commonStyles.statLabel}>{label}</Text>
    </View>
  );
  if (!activeJourney) {
    return (
      <SafeAreaView style={commonStyles.safeArea}>
        <View style={commonStyles.header}>
          <Text style={commonStyles.headerTitle}>Travel Companion</Text>
        </View>

          <View style={commonStyles.section}>
            <Text style={styles.label}>Riepilogo</Text>
            <View style={styles.statsRow}>
              <StatBox icon="car-outline" value={totalTrips} label="Viaggi totali" color={COLORS.primary} />
              <StatBox icon="navigate-outline" value={`${totalDistance} km`} label="Distanza totale" color={COLORS.secondary} />
            </View>
          </View>

          <View style={commonStyles.section}>
            <TouchableOpacity style={commonStyles.button} onPress={handleStartRecording}>
              <Text style={commonStyles.buttonText}>Inizia registrazione</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.mapHeader}>
              {geofences.length > 0 && (
                <View style={styles.geoBadge}>
                  <Text style={styles.geoText}>Geofencing attivo</Text>
                </View>
              )}
            </View>
            <View style={styles.mapSmall}>
              {mapRegion && (
                <MapView style={commonStyles.map} region={mapRegion} customMapStyle={MAP_DARK_STYLE} showsUserLocation scrollEnabled zoomEnabled>
                  {geofences.map(g => (
                    <Circle key={g.id} center={{ latitude: g.latitude, longitude: g.longitude }} radius={g.radius}
                      fillColor="rgba(88,101,242,0.2)" strokeColor="rgba(88,101,242,0.8)" strokeWidth={2} />
                  ))}
                </MapView>
              )}
            </View>
          </View>

          <View style={commonStyles.section}>
            <View style={styles.tripsHeaderRow}>
              <TouchableOpacity style={styles.newTripBtnCompact} onPress={() => navigation.navigate('Trips')}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.newTripTextCompact}>Nuovo viaggio</Text>
              </TouchableOpacity>
              <Text style={styles.labelRight}>Viaggi recenti</Text>
            </View>
            <View style={styles.recentTripsContainer}>
            {recentTrips.length > 0 ? recentTrips.map(trip => (
              <View key={trip.id} style={[commonStyles.box, styles.tripCard]}>
                <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
                <Text style={styles.tripDest} numberOfLines={1}>📍 {trip.destination}</Text>
                <Text style={styles.tripDate}>{formatDate(trip.start_date)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Nessun viaggio recente</Text>}
            </View> 
          </View>

        <Portal>
          <Modal visible={showTripSelector} onDismiss={() => setShowTripSelector(false)} contentContainerStyle={commonStyles.modal}>
            <View style={styles.modalHeader}>
              <Text style={commonStyles.modalTitle}>Seleziona un viaggio</Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {availableTrips.map(trip => (
                <TouchableOpacity key={trip.id} style={commonStyles.modalOption} onPress={() => handleSelectTrip(trip.id)}>
                  <Text style={[commonStyles.text, commonStyles.textBold]}>{trip.name}</Text>
                  <Text style={commonStyles.textSmall}>{trip.destination} • {formatDate(trip.start_date)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Modal>
        </Portal>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={commonStyles.safeArea}>
        <View style={commonStyles.header}>
          <Text style={commonStyles.headerTitle}>Travel Companion</Text>
        </View>

        <View style={styles.mapLarge}>
          {mapRegion && (
            <MapView style={commonStyles.map} region={mapRegion} customMapStyle={MAP_DARK_STYLE} showsUserLocation showsMyLocationButton scrollEnabled zoomEnabled>
              {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor={COLORS.primary} strokeWidth={3} />}
              {geofences.map(g => (
                <Circle key={g.id} center={{ latitude: g.latitude, longitude: g.longitude }} radius={g.radius}
                  fillColor="rgba(88,101,242,0.2)" strokeColor="rgba(88,101,242,0.8)" strokeWidth={2} />
              ))}
              {photos.filter(p => p.latitude && p.longitude).map(photo => (
                <Marker key={`p${photo.id}`} coordinate={{ latitude: photo.latitude, longitude: photo.longitude }} onPress={() => setSelectedPhoto(photo)}>
                  <View style={styles.markerPhoto}>
                    <Ionicons name="camera" size={16} color={COLORS.white} />
                  </View>
                </Marker>
              ))}
              {notes.filter(n => n.latitude && n.longitude).map(note => (
                <Marker key={`n${note.id}`} coordinate={{ latitude: note.latitude, longitude: note.longitude }} title="Nota" description={note.content}>
                  <View style={styles.markerNote}>
                    <Ionicons name="document-text" size={16} color={COLORS.white} />
                  </View>
                </Marker>
              ))}
            </MapView>
          )}
        </View>

        <View style={[commonStyles.section, { marginTop: SPACING.lg }]}>
          <View style={commonStyles.boxRow}>
            <View style={[commonStyles.box, styles.activeBox]}>
              <Ionicons name="flag" size={20} color={COLORS.primary} />
              <Text style={styles.counterVal}>{(currentDistance / 1000).toFixed(1)} km</Text>
            </View>
            <View style={[commonStyles.box, styles.activeBox]}>
              <Ionicons name="time" size={20} color={COLORS.primary} />
              <Text style={styles.counterVal}>{currentDuration}</Text>
            </View>
          </View>
        </View>

        <View style={commonStyles.section}>
          <View style={styles.counterRow}>
            <View style={styles.counter}>
              <Ionicons name="camera" size={20} color={COLORS.primary} />
              <Text style={styles.counterVal}>{photos.length}</Text>
            </View>
            <View style={styles.counter}>
              <Ionicons name="document-text" size={20} color={COLORS.primary} />
              <Text style={styles.counterVal}>{notes.length}</Text>
            </View>
          </View>
        </View>

        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Azioni rapide</Text>
          <View style={commonStyles.boxRow}>
            <TouchableOpacity style={[commonStyles.box, styles.actionBox]} onPress={openCamera}>
              <Ionicons name="camera-outline" size={28} color={COLORS.text} />
              <Text style={[commonStyles.textSmall, { marginTop: SPACING.sm }]}>Scatta foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[commonStyles.box, styles.actionBox]} onPress={handleAddNote}>
              <Ionicons name="create-outline" size={28} color={COLORS.text} />
              <Text style={[commonStyles.textSmall, { marginTop: SPACING.sm }]}>Aggiungi nota</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[commonStyles.section, { marginTop: SPACING.lg, marginBottom: SPACING.xxxl }]}>
          <TouchableOpacity style={commonStyles.buttonError} onPress={handleStopRecording}>
            <Text style={commonStyles.buttonText}>Termina registrazione</Text>
          </TouchableOpacity>
        </View>


      <Portal>
        <Modal visible={showAddNoteModal} onDismiss={() => setShowAddNoteModal(false)} contentContainerStyle={commonStyles.modal}>
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Nuova Nota</Text>
          </View>
          <TextInput style={styles.noteInput} value={noteText} onChangeText={setNoteText} placeholder="Scrivi qui la tua nota..."
            placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />
          <TouchableOpacity style={commonStyles.button} onPress={handleSaveNote}>
            <Text style={commonStyles.buttonText}>Salva</Text>
          </TouchableOpacity>
        </Modal>

        <Modal visible={!!selectedPhoto} onDismiss={() => setSelectedPhoto(null)} contentContainerStyle={styles.photoModal}>
          {selectedPhoto && (
            <>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.fullPhoto} />
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
                <Ionicons name="close" size={30} color={COLORS.white} />
              </TouchableOpacity>
            </>
          )}
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  recentTripsContainer: {
    width: 165,
    marginLeft: 185,
    marginTop: -73,
  },
  label: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xl
  },
  statValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginVertical: SPACING.sm
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginTop: 0
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  geoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: 10,
    marginBottom: -5,
  },
  geoText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary
  },
  mapSmall: {
    height: 180,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  mapLarge: {
    height: 250,
    marginTop: SPACING.md,
    marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  tripCard: {
    padding: 6,
    marginBottom: SPACING.sm,
    minHeight: 30,
    maxHeight: 60
  },
  tripName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  tripDest: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  tripDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    marginBottom: SPACING.md
  },
  tripsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  newTripBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    width: 170,
    height: 60,
    marginTop: 15,
    marginLeft: 0,
  },
  newTripTextCompact: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.primary
  },
  labelRight: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -65,
    marginRight: 35,
  },
  markerPhoto: {
    backgroundColor: COLORS.tertiary,
    borderRadius: 20,
    padding: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white
  },
  markerNote: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white
  },
  activeBox: {
    flex: 1,
    alignItems: 'center'
  },
  counterRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    height: 60,
  },
  counter: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  counterVal: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginVertical: SPACING.xs
  },
  actionBox: {
    flex: 1,
    alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg
  },
  noteInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.base,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minHeight: 100,
    marginBottom: SPACING.lg
  },
  photoModal: {
    backgroundColor: COLORS.background,
    margin: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullPhoto: {
    width: '100%',
    height: 400,
    resizeMode: 'contain'
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: COLORS.overlay,
    borderRadius: 25,
    padding: SPACING.sm
  }
});