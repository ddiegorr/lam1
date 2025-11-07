// styles/commonStyles.js - STILI COMUNI AGGIORNATI

import { StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from './theme';

export const commonStyles = StyleSheet.create({
  // CONTAINERS
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: -10,
    paddingBottom: -33, // Spazio per la bottom bar
  },
  
  section: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // HEADERS - SENZA BORDI
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingTop: SPACING.md,
    marginBottom: -5,
    backgroundColor: 'transparent', // Nessuno sfondo
    alignItems: 'center',
    minHeight: 30,
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // BOXES & CARDS
  box: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  
  boxRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  
  // BUTTONS
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  
  // BOTTONE X ROSSA MINIMAL
  buttonClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonSecondary: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonSecondaryText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  buttonError: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // FAB CIRCOLARE (per bottone +)
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: SPACING.xxxl + 20, // Sopra la bottom bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.large,
  },
  
  // TEXT STYLES
  text: {
    color: COLORS.text,
    fontSize: FONT_SIZES.base,
  },
  
  textSecondary: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.base,
  },
  
  textSmall: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  
  textBold: {
    fontWeight: FONT_WEIGHTS.bold,
  },
  
  textCenter: {
    textAlign: 'center',
  },
  
  // BADGES
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.lg,
  },
  
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs + 2,
  },
  
  badgeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  
  // MODALS
  modal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.xl,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: 400, // Più compatto
    ...SHADOWS.large,
  },
  
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  
  modalOption: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  
  // MAP CONTAINER
  mapContainer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  
  map: {
    width: '100%',
    height: '100%',
  },
  
  // STATS & VALUES
  statValue: {
    fontSize: FONT_SIZES.huge,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  
  // DIVIDERS
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  
  // EMPTY STATES - SENZA TESTO/ICONA GENERICA
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  
  emptyText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});