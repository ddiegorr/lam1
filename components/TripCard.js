import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';

export default function TripCard({ 
  trip, 
  onPressDetails, 
  onPressDelete 
}) {
  const getTripTypeLabel = (type) => {
    const labels = {
      'local': 'Local Trip',
      'day': 'Day Trip',
      'multi-day': 'Multi-day Trip'
    };
    return labels[type] || type;
  };

  const getTripTypeColor = (type) => {
    const colors = {
      'local': COLORS.secondary,
      'day': COLORS.tertiary,
      'multi-day': COLORS.primary
    };
    return colors[type] || COLORS.textSecondary;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <View style={[commonStyles.card]}>
      <View style={commonStyles.spaceBetween}>
        <View style={styles.header}>
          <Text style={styles.title}>{trip.name}</Text>
          <Text style={commonStyles.textSecondary}>
            {formatDate(trip.start_date)}
            {trip.end_date && trip.end_date !== trip.start_date && 
              ` - ${formatDate(trip.end_date)}`
            }
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: getTripTypeColor(trip.type) + '20' }]}>
          <Text style={[styles.typeText, { color: getTripTypeColor(trip.type) }]}>
            {getTripTypeLabel(trip.type)}
          </Text>
        </View>
      </View>
      <View style={styles.destinationRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
        <Text style={styles.destinationText}>{trip.destination}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onPressDetails(trip.id)}
        >
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Dettagli</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onPressDelete(trip.id, trip.name)}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Elimina</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  typeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  typeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    textTransform: 'uppercase',
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  destinationText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.sm,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});