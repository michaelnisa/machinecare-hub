import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import { OfflineSyncProvider } from "./src/context/OfflineSyncContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineSyncProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </OfflineSyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
