import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Platform, Modal } from 'react-native';
import { Text, Portal, Modal as PaperModal, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';
import DatabaseService from '../services/DatabaseService';
import LocationAutocompleteService from '../services/LocationAutocompleteService';

const TRIP_TYPES = {
  local: { label: 'Local', color: COLORS.secondary },
  day: { label: 'Day', color: COLORS.tertiary },
  'multi-day': { label: 'Multi-day', color: COLORS.primary }
};

export default function TripsScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState(null);

  const [form, setForm] = useState({
    name: '', 
    type: 'local', 
    destination: '', 
    destinationLat: null, 
    destinationLon: null,
    startDate: new Date(), 
    endDate: new Date(), 
    notes: ''
  });

  const [errors, setErrors] = useState({ startDate: null, endDate: null });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useFocusEffect(useCallback(() => { loadTrips(); }, [filterType]));

  const loadTrips = async () => {
    try {
      setLoading(true);
      let allTrips = await DatabaseService.getTrips();
      if (filterType) allTrips = allTrips.filter(t => t.type === filterType);
      setTrips(allTrips);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare i viaggi');
    } finally {
      setLoading(false);
    }
  };

  const validateDates = (startDate, endDate) => {
    const newErrors = { startDate: null, endDate: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (start < today) {
      newErrors.startDate = 'La data di inizio non può essere nel passato';
    }

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end < start) {
      newErrors.endDate = 'La data di fine deve essere dopo la data di inizio';
    }
    setErrors(newErrors);
    return !newErrors.startDate && !newErrors.endDate;
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.destination.trim()) {
      Alert.alert('Errore', 'Nome e destinazione sono obbligatori');
      return;
    }

    if (!validateDates(form.startDate, form.endDate)) {
      Alert.alert('Errore Date', 'Controlla le date inserite');
      return;
    }
    
    try {
      await DatabaseService.createTrip({
        name: form.name.trim(),
        type: form.type,
        destination: form.destination.trim(),
        destinationLat: form.destinationLat,
        destinationLon: form.destinationLon,
        startDate: form.startDate.toISOString().split('T')[0],
        endDate: form.endDate.toISOString().split('T')[0],
        notes: form.notes.trim()
      });

      setForm({ 
        name: '', 
        type: 'local', 
        destination: '', 
        destinationLat: null, 
        destinationLon: null, 
        startDate: new Date(), 
        endDate: new Date(), 
        notes: '' 
      });
      setErrors({ startDate: null, endDate: null });
      setShowCreateModal(false);
      await loadTrips();
      Alert.alert('Successo', 'Viaggio creato con successo!');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile creare il viaggio');
    }
  };

  const renderIOSModalPicker = (value, onChange, onConfirm, minimumDate) => (
    <Modal
      transparent={true}
      animationType="slide"
      visible={true}
      onRequestClose={onConfirm}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            onChange={onChange}
            minimumDate={minimumDate}
            locale="it-IT"
            textColor="white"
          />

          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmBtnText}>Conferma Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const handleDelete = (id, name) => {
    Alert.alert('Elimina Viaggio', `Sicuro di eliminare "${name}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          try {
            await DatabaseService.deleteTrip(id);
            await loadTrips();
            Alert.alert('Successo', 'Viaggio eliminato');
          } catch (error) {
            Alert.alert('Errore', 'Impossibile eliminare');
          }
        }
      }
    ]);
  };

  const searchDestination = async (text) => {
    setForm({ ...form, destination: text });
    if (text.length > 2) {
      try {
        const results = await LocationAutocompleteService.searchLocations(text);
        setSuggestions(results.slice(0, 5));
        setShowSuggestions(true);
      } catch (error) {
        console.error(error);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const formatDateShort = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatDatePicker = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onStartDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (event.type === 'dismissed') {
      if (Platform.OS === 'android') setShowStartPicker(false);
      return;
    }
    if (selectedDate) {
      const newStartDate = new Date(selectedDate);
      newStartDate.setHours(12, 0, 0, 0);
      setForm({
        ...form,
        startDate: newStartDate,
        endDate: newStartDate > form.endDate ? newStartDate : form.endDate
      });
      if (Platform.OS === 'android') {
        validateDates(newStartDate, newStartDate > form.endDate ? newStartDate : form.endDate);
      }
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (event.type === 'dismissed') {
      if (Platform.OS === 'android') setShowEndPicker(false);
      return;
    }
    if (selectedDate) {
      const newEndDate = new Date(selectedDate);
      newEndDate.setHours(12, 0, 0, 0);
      setForm({ ...form, endDate: newEndDate });
      if (Platform.OS === 'android') {
        validateDates(form.startDate, newEndDate);
      }
    }
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

  return (
    <SafeAreaView style={commonStyles.safeArea}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>Viaggi</Text>
      </View>
      
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === null && styles.filterButtonActive]}
          onPress={() => setFilterType(null)}
        >
          <Text style={[styles.filterText, filterType === null && styles.filterTextActive]}>
            Tutti
          </Text>
        </TouchableOpacity>

        {Object.keys(TRIP_TYPES).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, filterType === type && styles.filterButtonActive]}
            onPress={() => setFilterType(type)}
          >
            <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
              {TRIP_TYPES[type].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {trips.length === 0 ? (
        <View style={commonStyles.emptyState}>
          <Ionicons name="map-outline" size={64} color={COLORS.textSecondary} />
          <Text style={commonStyles.emptyText}>
            Nessun viaggio trovato.{'\n'}Crea il tuo primo viaggio!
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {trips.map((trip) => (
            <View key={trip.id} style={commonStyles.card}>
              <View style={commonStyles.spaceBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripTitle}>{trip.name}</Text>
                  <Text style={commonStyles.textSecondary}>
                    {formatDateShort(trip.start_date)}
                    {trip.end_date !== trip.start_date && ` - ${formatDateShort(trip.end_date)}`}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: TRIP_TYPES[trip.type].color + '20' }]}>
                  <Text style={[styles.badgeText, { color: TRIP_TYPES[trip.type].color }]}>
                    {TRIP_TYPES[trip.type].label}
                  </Text>
                </View>
              </View>
              <View style={styles.destination}>
                <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                <Text style={commonStyles.textSecondary}>{trip.destination}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}
                >
                  <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={[styles.actionText, { color: COLORS.primary }]}>Dettagli</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => handleDelete(trip.id, trip.name)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={[styles.actionText, { color: COLORS.error }]}>Elimina</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity 
        style={commonStyles.fab} 
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      <Portal>
        <PaperModal 
          visible={showCreateModal} 
          onDismiss={() => { 
            setShowCreateModal(false); 
            setErrors({ startDate: null, endDate: null }); 
          }} 
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Crea Viaggio</Text>
          </View>
          
          <Text style={styles.label}>Nome *</Text>
          <TextInput 
            style={styles.input} 
            value={form.name} 
            onChangeText={(v) => setForm({ ...form, name: v })}
            placeholder="Es. Weekend a Roma" 
            placeholderTextColor={COLORS.textTertiary} 
          />
          
          <Text style={styles.label}>Tipo *</Text>
          <View style={styles.typeSelector}>
            {Object.keys(TRIP_TYPES).map((type) => (
              <TouchableOpacity 
                key={type} 
                style={[styles.typeBtn, form.type === type && styles.typeBtnActive]}
                onPress={() => setForm({ ...form, type })}
              >
                <Text style={[styles.typeText, form.type === type && styles.typeTextActive]}>
                  {TRIP_TYPES[type].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Destinazione *</Text>
          <TextInput 
            style={styles.input} 
            value={form.destination} 
            onChangeText={searchDestination}
            placeholder="Cerca città..." 
            placeholderTextColor={COLORS.textTertiary} 
          />

          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <TouchableOpacity 
                  key={s.id} 
                  style={styles.suggestionItem}
                  onPress={() => { 
                    setForm({ 
                      ...form, 
                      destination: s.name, 
                      destinationLat: s.lat,
                      destinationLon: s.lon
                    }); 
                    setShowSuggestions(false); 
                  }}
                >
                  <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.suggestionText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Data Inizio *</Text>
          <TouchableOpacity
            style={[
              styles.dateBtn, 
              showStartPicker && styles.dateBtnActive, 
              errors.startDate && styles.dateBtnError
            ]}
            onPress={() => setShowStartPicker(true)}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20}
              color={errors.startDate ? COLORS.error : showStartPicker ? COLORS.primary : COLORS.text} 
            />
            <Text style={[
              styles.dateText, 
              showStartPicker && styles.dateTextActive, 
              errors.startDate && styles.dateTextError
            ]}>
              {formatDatePicker(form.startDate)}
            </Text>
          </TouchableOpacity>

          {errors.startDate && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.errorText}>{errors.startDate}</Text>
            </View>
          )}

          <Text style={styles.label}>Data Fine *</Text>
          <TouchableOpacity
            style={[
              styles.dateBtn, 
              showEndPicker && styles.dateBtnActive, 
              errors.endDate && styles.dateBtnError
            ]}
            onPress={() => setShowEndPicker(true)}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20}
              color={errors.endDate ? COLORS.error : showEndPicker ? COLORS.primary : COLORS.text} 
            />
            <Text style={[
              styles.dateText, 
              showEndPicker && styles.dateTextActive, 
              errors.endDate && styles.dateTextError
            ]}>
              {formatDatePicker(form.endDate)}
            </Text>
          </TouchableOpacity>

          {errors.endDate && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.errorText}>{errors.endDate}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={[commonStyles.button, { marginTop: SPACING.xl }]} 
            onPress={handleCreate}
          >
            <Text style={commonStyles.buttonText}>Crea Viaggio</Text>
          </TouchableOpacity>
        </PaperModal>
      </Portal>

      {showStartPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={form.startDate}
          mode="date"
          display="default"
          onChange={onStartDateChange}
          minimumDate={new Date()}
          locale="it-IT"
        />
      )}

      {showStartPicker && Platform.OS === 'ios' && renderIOSModalPicker(
        form.startDate,
        onStartDateChange,
        () => {
          setShowStartPicker(false);
          validateDates(form.startDate, form.endDate);
        },
        new Date()
      )}

      {showEndPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={form.endDate}
          mode="date"
          display="default"
          onChange={onEndDateChange}
          minimumDate={form.startDate}
          locale="it-IT"
        />
      )}

      {showEndPicker && Platform.OS === 'ios' && renderIOSModalPicker(
        form.endDate,
        onEndDateChange,
        () => {
          setShowEndPicker(false);
          validateDates(form.startDate, form.endDate);
        },
        form.startDate
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    marginLeft: 55,
  },
  filterButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  filterTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  content: { 
    paddingHorizontal: SPACING.xl, 
    paddingBottom: 100 
  },
  tripTitle: { 
    fontSize: FONT_SIZES.lg, 
    fontWeight: FONT_WEIGHTS.bold, 
    color: COLORS.text, 
    marginBottom: SPACING.xs 
  },
  badge: { 
    paddingHorizontal: SPACING.sm, 
    paddingVertical: SPACING.xs, 
    borderRadius: BORDER_RADIUS.md 
  },
  badgeText: { 
    fontSize: FONT_SIZES.xs, 
    fontWeight: FONT_WEIGHTS.semibold, 
    textTransform: 'uppercase' 
  },
  destination: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: SPACING.md, 
    gap: SPACING.xs 
  },
  actions: { 
    flexDirection: 'row', 
    marginTop: SPACING.lg, 
    gap: SPACING.md 
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.xs, 
    paddingVertical: SPACING.sm, 
    paddingHorizontal: SPACING.md, 
    backgroundColor: COLORS.surfaceVariant, 
    borderRadius: BORDER_RADIUS.sm 
  },
  actionText: { 
    fontSize: FONT_SIZES.sm, 
    fontWeight: FONT_WEIGHTS.semibold 
  },
  modal: { 
    backgroundColor: COLORS.surface, 
    margin: SPACING.xl, 
    padding: SPACING.lg, 
    borderRadius: BORDER_RADIUS.lg, 
    maxHeight: 500 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: SPACING.md 
  },
  label: { 
    fontSize: FONT_SIZES.sm, 
    fontWeight: FONT_WEIGHTS.semibold, 
    color: COLORS.text, 
    marginTop: SPACING.md, 
    marginBottom: SPACING.xs 
  },
  input: { 
    backgroundColor: COLORS.surfaceVariant, 
    borderRadius: BORDER_RADIUS.md, 
    padding: SPACING.md, 
    fontSize: FONT_SIZES.base, 
    color: COLORS.text, 
    borderWidth: 1, 
    borderColor: COLORS.borderLight 
  },
  dateBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.sm, 
    backgroundColor: COLORS.surfaceVariant, 
    borderRadius: BORDER_RADIUS.md, 
    padding: SPACING.md, 
    borderWidth: 1, 
    borderColor: COLORS.borderLight 
  },
  dateBtnActive: { 
    borderColor: COLORS.primary, 
    borderWidth: 2, 
    backgroundColor: COLORS.primary + '10' 
  },
  dateBtnError: { 
    borderColor: COLORS.error, 
    borderWidth: 2, 
    backgroundColor: COLORS.error + '10' 
  },
  dateText: { 
    fontSize: FONT_SIZES.base, 
    color: COLORS.text, 
    flex: 1 
  },
  dateTextActive: { 
    color: COLORS.primary, 
    fontWeight: FONT_WEIGHTS.semibold 
  },
  dateTextError: { 
    color: COLORS.error 
  },
  confirmBtn: { 
    backgroundColor: COLORS.primary, 
    borderRadius: BORDER_RADIUS.md, 
    padding: SPACING.md, 
    marginTop: SPACING.sm, 
    alignItems: 'center' 
  },
  confirmBtnText: { 
    color: COLORS.white, 
    fontSize: FONT_SIZES.base, 
    fontWeight: FONT_WEIGHTS.semibold 
  },
  errorContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: SPACING.xs, 
    gap: SPACING.xs 
  },
  errorText: { 
    fontSize: FONT_SIZES.sm, 
    color: COLORS.error, 
    flex: 1 
  },
  typeSelector: { 
    flexDirection: 'row', 
    gap: SPACING.xs 
  },
  typeBtn: { 
    flex: 1, 
    paddingVertical: SPACING.sm, 
    backgroundColor: COLORS.surfaceVariant, 
    borderRadius: BORDER_RADIUS.sm, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: COLORS.borderLight 
  },
  typeBtnActive: { 
    backgroundColor: COLORS.primary + '20', 
    borderColor: COLORS.primary 
  },
  typeText: { 
    fontSize: FONT_SIZES.xs, 
    color: COLORS.textSecondary, 
    fontWeight: FONT_WEIGHTS.semibold 
  },
  typeTextActive: { 
    color: COLORS.primary 
  },
  suggestions: { 
    backgroundColor: COLORS.surfaceVariant, 
    borderRadius: BORDER_RADIUS.md, 
    marginTop: SPACING.xs, 
    borderWidth: 1, 
    borderColor: COLORS.borderLight, 
    maxHeight: 150 
  },
  suggestionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.sm, 
    gap: SPACING.xs, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  suggestionText: { 
    fontSize: FONT_SIZES.sm, 
    color: COLORS.text 
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 20,
    width: '90%',
    alignItems: 'stretch',
  },
});