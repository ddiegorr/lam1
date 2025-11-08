import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from './styles/theme';
import DatabaseService from './services/DatabaseService';
import LocationService from './services/LocationService';
import NotificationService from './services/NotificationService';
import GeofenceMonitoringService from './services/GeofenceMonitoringService';
import HomeScreen from './screens/HomeScreen';
import TripsScreen from './screens/TripsScreen';
import ChartsScreen from './screens/ChartsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TripDetailsScreen from './screens/TripDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
SplashScreen.preventAutoHideAsync();

const DarkTheme = {
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
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 20,
          borderTopColor: COLORS.border,
          paddingTop: 8,
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
        await DatabaseService.init();
        try {
          const permissions = await LocationService.requestPermissions();
        }catch (error){
        }
        try {
          await NotificationService.init();
          await NotificationService.ensureDailyReminderIsScheduled();
        } catch (error) {
        }
        try {
          await GeofenceMonitoringService.startMonitoring();
        } catch (error) {
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
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
      <PaperProvider theme={DarkTheme}>
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