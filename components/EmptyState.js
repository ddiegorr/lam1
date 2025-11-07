import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';

export default function EmptyState({ 
  icon = "alert-circle-outline", 
  message = "Nessun dato disponibile",
  iconSize = 64,
  iconColor = COLORS.textSecondary
}) {
  return (
    <View style={commonStyles.emptyState}>
      <Ionicons name={icon} size={iconSize} color={iconColor} />
      <Text style={commonStyles.emptyText}>{message}</Text>
    </View>
  );
}