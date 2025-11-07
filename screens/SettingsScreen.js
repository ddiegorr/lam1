import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput,
} from 'react-native';
import { Text, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';
import GeofenceCard from '../components/GeofenceCard';
import DatabaseService from '../services/DatabaseService';
import NotificationService from '../services/NotificationService';
import LocationService from '../services/LocationService';

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [geofences, setGeofences] = useState([]);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geofenceName, setGeofenceName] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('100');

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      setLoading(true);
      try {
        const allGeofences = await DatabaseService.getGeofences();
        setGeofences(allGeofences || []);
      } catch (error) {
        console.error('Errore caricamento geofences:', error);
        setGeofences([]);
      }
      
      setNotificationsEnabled(true);
      
    } catch (error) {
      console.error('Errore caricamento settings:', error);
      Alert.alert('Errore', 'Impossibile caricare le impostazioni');
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = async (value) => {
    try {
      setNotificationsEnabled(value);
      if (value) {
        await NotificationService.init();
        Alert.alert('Notifiche', 'Notifiche abilitate');
      } else {
        Alert.alert('Notifiche', 'Notifiche disabilitate');
      }
    } catch (error) {
      console.error('Errore toggle notifiche:', error);
      Alert.alert('Errore', 'Impossibile modificare le notifiche');
    }
  };

  const handleCreateGeofence = () => {
    setGeofenceName('');
    setGeofenceRadius('100');
    setShowGeofenceModal(true);
  };

  const handleSaveGeofence = async () => {
    if (!geofenceName.trim()) {
      Alert.alert('Errore', 'Inserisci un nome per il geofence');
      return;
    }

    const radius = parseFloat(geofenceRadius);
    if (isNaN(radius) || radius < 50 || radius > 5000) {
      Alert.alert('Errore', 'Il raggio deve essere tra 50 e 5000 metri');
      return;
    }

    try {
      const location = await LocationService.getCurrentLocation();
      
      await DatabaseService.addGeofence(
        geofenceName.trim(),
        location.coords.latitude,
        location.coords.longitude,
        radius
      );
      
      setShowGeofenceModal(false);
      await loadSettings();
      
      // Riavvia il geofencing con i nuovi geofence
      await LocationService.startGeofencingMonitoring();
      
      Alert.alert('✅ Successo', 'Geofence creato nella tua posizione attuale');
    } catch (error) {
      console.error('Errore salvataggio geofence:', error);
      Alert.alert('Errore', 'Impossibile salvare il geofence. Assicurati che i permessi di localizzazione siano attivi.');
    }
  };

  const handleDeleteGeofence = (geofence) => {
    Alert.alert(
      'Elimina Geofence',
      `Vuoi eliminare "${geofence.name}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteGeofence(geofence.id);
              Alert.alert('Successo', 'Geofence eliminato');
              await loadSettings();
              
              // Riavvia il geofencing per aggiornare
              await LocationService.startGeofencingMonitoring();
            } catch (error) {
              console.error('Errore eliminazione geofence', error);
              Alert.alert('Errore', 'Impossibile eliminare il geofence');
            }
          }
        }
      ]
    );
  };

  const handleViewGeofenceStats = async (geofence) => {
    try {
      const stats = await DatabaseService.getGeofenceStats(geofence.id);
      Alert.alert(
        `📊 Statistiche: ${geofence.name}`,
        `✅ Entrate: ${stats.enterCount}\n` +
        `🚶 Uscite: ${stats.exitCount}`
      );
    } catch (error) {
      console.error('Errore statistiche geofence', error);
      Alert.alert('Errore', 'Impossibile recuperare le statistiche');
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
        <Text style={commonStyles.headerTitle}>Impostazioni</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Notifiche</Text>
          <View style={commonStyles.box}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Abilita Notifiche</Text>
                  <Text style={commonStyles.textSmall}>
                    Ricevi notifiche quando entri o esci da un'area geofence
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: COLORS.surfaceVariant, true: COLORS.primary + '80' }}
                thumbColor={notificationsEnabled ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
          </View>
        </View>
        
        <View style={commonStyles.section}>
          <View style={commonStyles.spaceBetween}>
            <Text style={[commonStyles.sectionTitle, styles.geoSpazio]}>Geofencing</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleCreateGeofence}
            >
              <Ionicons name="add" size={18} color={COLORS.white} marginLeft={11} />
            </TouchableOpacity>
          </View>

          {geofences.length === 0 ? (
            <View style={[commonStyles.box, styles.emptyGeofences]}>
              <Ionicons name="location-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[commonStyles.textSecondary, styles.emptyText]}>
                Nessun geofence configurato
              </Text>
              <Text style={commonStyles.textSmall}>
                Crea un geofence per ricevere notifiche quando entri o esci da aree specifiche
              </Text>
            </View>
          ) : (
            geofences.map((geofence) => (
              <GeofenceCard
                key={geofence.id}
                geofence={geofence}
                onPressStats={handleViewGeofenceStats}
                onPressDelete={handleDeleteGeofence}
              />
            ))
          )}
        </View>

        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Informazioni</Text>
          <View style={commonStyles.box}>
            <View style={styles.infoRow}>
              <Text style={commonStyles.textSecondary}>Versione App</Text>
              <Text style={commonStyles.text}>1.0.0</Text>
            </View>
            <View style={commonStyles.divider} />
            <View style={styles.infoRow}>
              <Text style={commonStyles.textSecondary}>SDK Expo</Text>
              <Text style={commonStyles.text}>54.0</Text>
            </View>
            <View style={commonStyles.divider} />
            <View style={styles.infoRow}>
              <Text style={commonStyles.textSecondary}>Progetto</Text>
              <Text style={commonStyles.text}>Travel Companion</Text>
            </View>
            <View style={commonStyles.divider} />
            <View style={styles.infoRow}>
              <Text style={commonStyles.textSecondary}>Autori</Text>
              <Text style={commonStyles.text}>Diego & Nabil</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={showGeofenceModal}
          onDismiss={() => setShowGeofenceModal(false)}
          contentContainerStyle={commonStyles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={commonStyles.modalTitle}>
              Nuovo Geofence
            </Text>
          </View>
          
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={geofenceName}
            onChangeText={setGeofenceName}
            placeholder="Es. Casa, Ufficio, Università"
            placeholderTextColor={COLORS.textTertiary}
          />
          
          <Text style={styles.label}>Raggio (metri) *</Text>
          <TextInput
            style={styles.input}
            value={geofenceRadius}
            onChangeText={setGeofenceRadius}
            placeholder="100"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="numeric"
          />
          
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Il geofence verrà creato nella tua posizione GPS attuale. 
              Riceverai notifiche quando entri o esci da quest'area.
            </Text>
          </View>
          
          <TouchableOpacity
            style={[commonStyles.button, { marginTop: SPACING.xl }]}
            onPress={handleSaveGeofence}
          >
            <Text style={commonStyles.buttonText}>Salva</Text>
          </TouchableOpacity>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  geoSpazio: {
    marginTop: 40,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  addButton: {
    width: 40, 
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: -35,
  },
  emptyGeofences: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.base,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 18,
  },
});