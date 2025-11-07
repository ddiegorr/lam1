// screens/TripDetailsScreen.js - CON STATISTICHE QUADRATE E POP-UP
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  FlatList,
} from 'react-native';
import { Text, ActivityIndicator, Portal, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, MAP_DARK_STYLE } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';
import EmptyState from '../components/EmptyState';

import DatabaseService from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function TripDetailsScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [journeys, setJourneys] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  
  // Modal states
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  useEffect(() => {
    loadTripDetails();
  }, [tripId]);

  const loadTripDetails = async () => {
    try {
      setLoading(true);

      const trips = await DatabaseService.getTrips();
      const tripData = trips.find(t => t.id === tripId);
      setTrip(tripData);

      const tripJourneys = await DatabaseService.getJourneys(tripId);
      setJourneys(tripJourneys);

      let allCoordinates = [];
      let allPhotos = [];
      let allNotes = [];

      for (const journey of tripJourneys) {
        const gpsPoints = await DatabaseService.getGPSPoints(journey.id);
        allCoordinates = [...allCoordinates, ...gpsPoints.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }))];

        const journeyPhotos = await DatabaseService.getPhotos(journey.id);
        const journeyNotes = await DatabaseService.getNotes(journey.id);
        
        allPhotos = [...allPhotos, ...journeyPhotos];
        allNotes = [...allNotes, ...journeyNotes];
      }

      setPhotos(allPhotos);
      setNotes(allNotes);
      setRouteCoordinates(allCoordinates);

      if (allCoordinates.length > 0) {
        const lats = allCoordinates.map(c => c.latitude);
        const lngs = allCoordinates.map(c => c.longitude);
        
        setMapRegion({
          latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
          longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
          latitudeDelta: Math.max(...lats) - Math.min(...lats) + 0.02,
          longitudeDelta: Math.max(...lngs) - Math.min(...lngs) + 0.02,
        });
      }

    } catch (error) {
      console.error('Error loading trip details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoPress = (photo) => {
    setSelectedPhoto(photo);
  };

  const handleNotePress = (note) => {
    setSelectedNote(note);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalDistance = () => {
    return journeys.reduce((sum, j) => sum + (j.total_distance || 0), 0);
  };

  const calculateTotalDuration = () => {
    let totalMs = 0;
    journeys.forEach(journey => {
      if (journey.start_time && journey.end_time) {
        const start = new Date(journey.start_time);
        const end = new Date(journey.end_time);
        totalMs += (end - start);
      }
    });

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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

  if (!trip) {
    return (
      <SafeAreaView style={commonStyles.safeArea}>
        <EmptyState 
          icon="alert-circle-outline"
          message="Viaggio non trovato"
          iconColor={COLORS.error}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.safeArea}>
    <View style={commonStyles.header}>
          <Text style={commonStyles.headerTitle}>Dettagli viaggio</Text>
        </View>
        <View style={commonStyles.section}>
          <Text style={styles.tripTitle}>{trip.name}</Text>
          <View style={styles.tripMetaRow}>
            <View style={styles.tripMeta}>
              <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
              <Text style={commonStyles.textSecondary}>{trip.destination}</Text>
            </View>
            <View style={styles.tripMeta}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
              <Text style={commonStyles.textSecondary}>
                {formatDate(trip.start_date)}
              </Text>
            </View>
          </View>
        </View>

        {/* Map con Foto e Note */}
        {mapRegion && routeCoordinates.length > 0 && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Percorso</Text>
            <View style={[commonStyles.mapContainer, styles.mapContainer]}>
              <MapView
                style={commonStyles.map}
                region={mapRegion}
                customMapStyle={MAP_DARK_STYLE}
              >
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={COLORS.primary}
                  strokeWidth={3}
                />
                
                {routeCoordinates.length > 0 && (
                  <Marker
                    coordinate={routeCoordinates[0]}
                    title="Partenza"
                  >
                    <View style={styles.markerStart}>
                      <Ionicons name="flag" size={16} color={COLORS.white} />
                    </View>
                  </Marker>
                )}
                
                {routeCoordinates.length > 0 && (
                  <Marker
                    coordinate={routeCoordinates[routeCoordinates.length - 1]}
                    title="Arrivo"
                  >
                    <View style={styles.markerEnd}>
                      <Ionicons name="flag-outline" size={16} color={COLORS.white} />
                    </View>
                  </Marker>
                )}

                {photos.filter(p => p.latitude && p.longitude).map((photo) => (
                  <Marker
                    key={`photo-${photo.id}`}
                    coordinate={{
                      latitude: photo.latitude,
                      longitude: photo.longitude,
                    }}
                    onPress={() => handlePhotoPress(photo)}
                  >
                    <View style={styles.markerPhoto}>
                      <Ionicons name="camera" size={16} color={COLORS.white} />
                    </View>
                  </Marker>
                ))}

                {notes.filter(n => n.latitude && n.longitude).map((note) => (
                  <Marker
                    key={`note-${note.id}`}
                    coordinate={{
                      latitude: note.latitude,
                      longitude: note.longitude,
                    }}
                    onPress={() => handleNotePress(note)}
                  >
                    <View style={styles.markerNote}>
                      <Ionicons name="document-text" size={16} color={COLORS.white} />
                    </View>
                  </Marker>
                ))}
              </MapView>
            </View>
          </View>
        )}

        {/* Stats QUADRATE */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Statistiche</Text>
          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={[commonStyles.box, styles.statBox]}
              onPress={() => {}}
            >
              <Ionicons name="navigate-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>
                {(calculateTotalDistance() / 1000).toFixed(1)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[commonStyles.box, styles.statBox]}
              onPress={() => {}}
            >
              <Ionicons name="time-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{calculateTotalDuration()}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[commonStyles.box, styles.statBox]}
              onPress={() => setShowPhotosModal(true)}
            >
              <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{photos.length}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[commonStyles.box, styles.statBox]}
              onPress={() => setShowNotesModal(true)}
            >
              <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{notes.length}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {trip.notes && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Descrizione</Text>
            <View style={commonStyles.box}>
              <Text style={commonStyles.text}>{trip.notes}</Text>
            </View>
          </View>
        )}

      <Portal>
        <Modal
          visible={showPhotosModal}
          onDismiss={() => setShowPhotosModal(false)}
          contentContainerStyle={styles.galleryModal}
        >
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Foto ({photos.length})</Text>
          </View>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={styles.photoRow}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.photoThumb}
                  onPress={() => {
                    setShowPhotosModal(false);
                    setSelectedPhoto(item);
                  }}
                >
                  <Image source={{ uri: item.uri }} style={styles.photoImage} />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyModalContent}>
              <Ionicons name="camera-outline" size={64} color={COLORS.textSecondary} />
              <Text style={commonStyles.emptyText}>Nessuna foto</Text>
            </View>
          )}
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={showNotesModal}
          onDismiss={() => setShowNotesModal(false)}
          contentContainerStyle={styles.galleryModal}
        >
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Note ({notes.length})</Text>
          </View>
          {notes.length > 0 ? (
            <FlatList
              data={notes}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.noteItem}
                  onPress={() => {
                    setShowNotesModal(false);
                    setSelectedNote(item);
                  }}
                >
                  <View style={styles.noteHeader}>
                    <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.noteDate}>{formatDateTime(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.noteContent} numberOfLines={3}>
                    {item.content}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ):(
            <View style={styles.emptyModalContent}>
              <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
              <Text style={commonStyles.emptyText}>Nessuna nota</Text>
            </View>
          )}
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tripTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  tripMetaRow: {
    gap: SPACING.lg,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  mapContainer: {
    height: 220,
  },
  markerStart: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  markerEnd: {
    backgroundColor: COLORS.error,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  markerPhoto: {
    backgroundColor: COLORS.tertiary,
    borderRadius: 20,
    padding: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  markerNote: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statBox: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginVertical: SPACING.sm,
    marginBottom: 35,
  },
  galleryModal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  photoRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  photoThumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  noteItem: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  noteDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  noteContent: {
    fontSize: FONT_SIZES.base,
    color: COLORS.text,
    lineHeight: 22,
  },
  emptyModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
});