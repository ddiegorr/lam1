// App.js - CORRETTO CON HEADER CUSTOM

import React, { useState, useEffect, useCallback } from 'react';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

// Import tema centralizzato
import { COLORS } from './styles/theme';

// Services
import DatabaseService from './services/DatabaseService';
import LocationService from './services/LocationService';
import NotificationService from './services/NotificationService';

// Screens
import HomeScreen from './screens/HomeScreen';
import TripsScreen from './screens/TripsScreen';
import ChartsScreen from './screens/ChartsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TripDetailsScreen from './screens/TripDetailsScreen';

const GEOFENCE_TASK_NAME = 'geofence-task';
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Errore TaskManager Geofence:', error);
    return;
  }

  if (data) {
    const { eventType, region } = data; // region contiene l'identifier che abbiamo dato
    
    // Assicurati che il DB sia inizializzato
    if (!DatabaseService.db) {
      await DatabaseService.init();
    }
    // Assicurati che le notifiche siano inizializzate
    if (!NotificationService.isInitialized) {
      await NotificationService.init();
    }

    const geofenceId = parseInt(region.identifier, 10);
    const event = (eventType === Location.GeofencingEventType.Enter) ? 'enter' : 'exit';

    try {
      // 1. Salva l'evento nel database
      await DatabaseService.addGeofenceEvent(geofenceId, event);
      
      // 2. Trova il nome del Geofence per la notifica
      const geofences = await DatabaseService.getGeofences();
      const geofence = geofences.find(g => g.id === geofenceId);
      const geofenceName = geofence ? geofence.name : 'un\'area';

      // 3. Invia la notifica
      await NotificationService.sendGeofenceNotification(geofenceName, event);

      console.log(`Geofence Event: ${event} ${geofenceName} (ID: ${geofenceId})`);
      
    } catch (dbError) {
      console.error('Errore nel salvare evento geofence:', dbError);
    }
  }
});

// Previeni auto-hide dello splash screen
SplashScreen.preventAutoHideAsync();

// ==========================================
// TEMA DISCORD DARK FISSO
// ==========================================
const discordDarkTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.primaryDark,
    secondary: COLORS.secondary,
    secondaryContainer: COLORS.secondaryDark,
    tertiary: COLORS.tertiary,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceVariant: COLORS.surfaceVariant,
    error: COLORS.error,
    onPrimary: COLORS.white,
    onSecondary: COLORS.black,
    onBackground: COLORS.text,
    onSurface: COLORS.text,
    onSurfaceVariant: COLORS.textSecondary,
    outline: COLORS.borderLight,
  },
};

// ==========================================
// TAB NAVIGATOR - SENZA BORDI
// ==========================================
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Trips') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Statistics') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0, // RIMOSSO BORDO
          height: 80, // AUMENTATO per iPhone
          paddingBottom: 20, // PIÙ SPAZIO per home indicator iPhone
          borderTopColor: COLORS.border,
          paddingTop: 8,
          paddingBottom: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 5,
        },
        headerStyle: {
          backgroundColor: COLORS.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
          height: 90,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 24,
          letterSpacing: 0.3,
        },
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ 
          title: 'Home',
          headerShown: false
        }}
      />
      <Tab.Screen 
        name="Trips" 
        component={TripsScreen}
        options={{ 
          title: 'Viaggi',
          headerShown: false
        }}
      />
      <Tab.Screen 
        name="Statistics" 
        component={ChartsScreen}
        options={{ 
          title: 'Statistiche',
          headerShown: false
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          title: 'Impostazioni',
          headerShown: false
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('Inizializzando il progetto');
        await DatabaseService.init();
        console.log('Database caricato');
        try {
          const permissions = await LocationService.requestPermissions();
          if (permissions.background) { // Controlla il permesso background
            console.log('Permessi di localizzazione (Background) concessi');
            // AVVIA IL GEOFENCING ALL'AVVIO
            await LocationService.startGeofencingMonitoring(); 
          } else if (permissions.foreground) {
            console.log('Permessi di localizzazione (Foreground) concessi');
          }
        } catch (error) {
          console.warn('Permessi di localizzazione negati', error);
        }
        try {
          await NotificationService.init();
          await NotificationService.ensureDailyReminderIsScheduled();
        } catch (error) {
          console.log('Notifiche negate', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Tutti i servizi inizializzati');
      } catch (error) {
        console.error('Errore di inizializzazione', error);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);
  if (!appIsReady) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <PaperProvider theme={discordDarkTheme}>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator 
              screenOptions={{ 
                headerShown: false,
                cardStyle: { backgroundColor: COLORS.background }
              }}
            >
              <Stack.Screen name="MainTabs" component={TabNavigator} />
              <Stack.Screen name="TripDetails" component={TripDetailsScreen}/>
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}