// styles/theme.js - TEMA DISCORD DARK AGGIORNATO

export const COLORS = {
  // Primary Colors (Discord Blue)
  primary: '#5865F2',
  primaryDark: '#4752C4',
  primaryLight: '#7289DA',
  
  // Secondary Colors (Discord Green)
  secondary: '#57F287',
  secondaryDark: '#3BA55D',
  
  // Tertiary Colors (Discord Yellow)
  tertiary: '#FEE75C',
  tertiaryDark: '#F0B232',
  
  // Error (Discord Red)
  error: '#ED4245',
  errorDark: '#C73A3D',
  
  // Background Colors - INVERTITI
  background: '#202225',       // Più scuro
  surface: '#2F3136',          // Box più chiari del background
  surfaceVariant: '#40444B',
  surfaceDark: '#36393F',
  
  // Text Colors
  text: '#DCDDDE',
  textSecondary: '#B9BBBE',
  textTertiary: '#72767D',
  textDisabled: '#4F545C',
  
  // Borders & Lines
  border: '#202225',
  borderLight: '#40444B',
  
  // Status Colors
  success: '#57F287',
  warning: '#FEE75C',
  info: '#5865F2',
  
  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // White & Black
  white: '#FFFFFF',
  black: '#000000',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 999,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  huge: 28,
};

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

export const MAP_DARK_STYLE = [
  {
    "elementType": "geometry",
    "stylers": [{"color": "#212121"}]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{"visibility": "off"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#757575"}]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#212121"}]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{"color": "#757575"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#2c2c2c"}]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#8a8a8a"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#000000"}]
  }
];