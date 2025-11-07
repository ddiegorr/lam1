import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';

export default function StatCard({ 
  icon, 
  value, 
  label, 
  iconColor = COLORS.primary,
  onPress 
}) {
  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent 
      style={[commonStyles.box, styles.card]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={24} color={iconColor} />
      <Text style={styles.value}>{value}</Text>
      <Text style={commonStyles.statLabel}>{label}</Text>
    </CardComponent>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  value: {
    fontSize: FONT_SIZES.huge,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginVertical: SPACING.sm,
  },
});