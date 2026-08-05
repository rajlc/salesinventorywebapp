import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { initDatabase } from './src/db/database';
import { useSyncStore } from './src/store/useSyncStore';
import * as Network from 'expo-network';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox } from 'react-native';
import { supabase } from './src/lib/supabase';

// Suppress warnings related to Expo Go limitations with notifications (SDK 53+)
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'functionality is not fully supported in Expo Go',
  'ERROR  expo-notifications',
  'Push notifications functionality',
  'remote notifications',
]);

export default function App() {
  const [isReady, setIsReady] = React.useState(false);
  const { setOnline, checkConnection } = useSyncStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize DB
        await initDatabase();

        // Initial connection check
        await checkConnection();

        // Initialize Realtime Subscriptions
        const { useDataStore } = await import('./src/store/useDataStore');
        const unsubscribe = useDataStore.getState().subscribeToChanges();

        setIsReady(true);

        return () => {
          if (unsubscribe) unsubscribe();
        };
      } catch (e) {
        console.warn(e);
      }
    }

    prepare();

    // Subscribe to network changes
    const networkSubscription = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    // Handle Auth Session Refresh failures (to fix "Invalid Refresh Token" errors)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event as any) === 'TOKEN_REFRESH_FAILED') {
        console.warn('[App] 🔑 Token refresh failed. Logging out to clear invalid session.');
        await supabase.auth.signOut();
      }
    });

    return () => {
      networkSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
