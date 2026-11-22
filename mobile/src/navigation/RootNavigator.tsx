import React, { useState, useEffect } from "react";
import { View, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { Header } from "../components/Header";
import { OfflineBanner } from "../components/OfflineBanner";

// Common
import { RoleSelectScreen } from "../screens/common/RoleSelectScreen";
import { LoginScreen } from "../screens/common/LoginScreen";
import { OnboardingScreen } from "../screens/common/OnboardingScreen";
import { ActivityIndicator, Text } from "react-native";
import { Truck } from "lucide-react-native";

// Driver Screens
import { DriverHomeScreen } from "../screens/driver/DriverHomeScreen";
import { QrTruckSignInScreen } from "../screens/driver/QrTruckSignInScreen";
import { PreStartInspectionScreen } from "../screens/driver/PreStartInspectionScreen";
import { ReceiptSnapperScreen } from "../screens/driver/ReceiptSnapperScreen";
import { RoadsideSosScreen } from "../screens/driver/RoadsideSosScreen";

// Garage Screens
import { JobCardsListScreen } from "../screens/garage/JobCardsListScreen";
import { JobCardDetailScreen } from "../screens/garage/JobCardDetailScreen";
import { VehicleQrLookupScreen } from "../screens/garage/VehicleQrLookupScreen";
import { ReportDefectScreen } from "../screens/garage/ReportDefectScreen";

// Dispatch Screens
import { LiveFleetMapScreen } from "../screens/fleet/LiveFleetMapScreen";
import { ActiveTripsScreen } from "../screens/fleet/ActiveTripsScreen";
import { QuickFuelLogScreen } from "../screens/fleet/QuickFuelLogScreen";

// Telematics Screens
import { TrackerPairingScreen } from "../screens/telematics/TrackerPairingScreen";
import { GpsDiagnosticScreen } from "../screens/telematics/GpsDiagnosticScreen";

// Manufacturing Screens
import { ManufacturingHomeScreen } from "../screens/manufacturing/ManufacturingHomeScreen";
import { DowntimeLogScreen } from "../screens/manufacturing/DowntimeLogScreen";
import { ScrapLogScreen } from "../screens/manufacturing/ScrapLogScreen";
import { ProductionOrdersScreen } from "../screens/manufacturing/ProductionOrdersScreen";
import { PlantMachineCheckScreen } from "../screens/manufacturing/PlantMachineCheckScreen";

export const RootNavigator: React.FC = () => {
  const {
    user,
    role,
    isLoading,
    hasCompletedOnboarding,
    isFieldMode,
    completeOnboarding,
    enterFieldMode,
  } = useAuth();

  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<string>("home");
  const [screenParams, setScreenParams] = useState<any>({});

  // Reset to home screen whenever persona changes
  useEffect(() => {
    setCurrentScreen("home");
    setScreenParams({});
  }, [role]);

  const navigateTo = (screen: string, params: any = {}) => {
    setScreenParams(params);
    setCurrentScreen(screen);
  };

  const goBack = () => {
    setCurrentScreen("home");
    setScreenParams({});
  };

  // 1. Loading Splash
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashIconCircle}>
          <Truck size={42} color="#FFF" />
        </View>
        <Text style={styles.splashTitle}>MachineCare Hub</Text>
        <Text style={styles.splashSub}>Manufacturing, Fleet, Garage & Telematics Companion</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  // 2. Onboarding Gate (First Launch or User Revisit)
  if (!hasCompletedOnboarding || showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          setShowOnboarding(false);
          await completeOnboarding();
        }}
        onFieldMode={async () => {
          setShowOnboarding(false);
          await completeOnboarding();
          await enterFieldMode();
        }}
      />
    );
  }

  // 3. Authentication Gate: If not signed in and not explicitly in Field Mode
  if (!user && !isFieldMode) {
    return (
      <LoginScreen
        onSuccess={() => {}}
        onSkipToField={enterFieldMode}
        onRevisitOnboarding={() => setShowOnboarding(true)}
      />
    );
  }

  const renderActiveScreen = () => {
    // A. Explicit Login Modal (e.g. from Field Mode Header button)
    if (showLogin) {
      return (
        <LoginScreen
          onSuccess={() => setShowLogin(false)}
          onSkipToField={() => setShowLogin(false)}
          onRevisitOnboarding={() => setShowOnboarding(true)}
        />
      );
    }

    // B. Role Picker Modal / Screen
    if (showRolePicker) {
      return (
        <RoleSelectScreen
          onRoleSelected={() => {
            setShowRolePicker(false);
            setCurrentScreen("home");
          }}
        />
      );
    }

    // 2. Manufacturing & Plant Floor Persona
    if (role === "manufacturing") {
      switch (currentScreen) {
        case "DowntimeLog":
          return <DowntimeLogScreen onBack={goBack} onSuccess={goBack} />;
        case "ScrapLog":
          return <ScrapLogScreen onBack={goBack} onSuccess={goBack} />;
        case "ProductionOrders":
          return (
            <ProductionOrdersScreen
              onBack={goBack}
              onOpenOutput={() => navigateTo("home")}
            />
          );
        case "PlantMachineCheck":
          return <PlantMachineCheckScreen onBack={goBack} onSuccess={goBack} />;
        default:
          return (
            <ManufacturingHomeScreen
              onNavigate={(sc, p) => navigateTo(sc, p)}
            />
          );
      }
    }

    // 3. Driver Persona
    if (role === "driver") {
      switch (currentScreen) {
        case "QrTruckSignIn":
          return (
            <QrTruckSignInScreen
              onBack={goBack}
              onSuccess={goBack}
            />
          );
        case "PreStartInspection":
          return (
            <PreStartInspectionScreen
              onBack={goBack}
              onSuccess={goBack}
            />
          );
        case "ReceiptSnapper":
          return (
            <ReceiptSnapperScreen
              onBack={goBack}
              onSuccess={goBack}
            />
          );
        case "RoadsideSos":
          return (
            <RoadsideSosScreen
              onBack={goBack}
              onSuccess={goBack}
            />
          );
        default:
          return (
            <DriverHomeScreen
              onNavigate={(sc) => navigateTo(sc)}
            />
          );
      }
    }

    // 4. Garage & Workshop Persona
    if (role === "mechanic") {
      switch (currentScreen) {
        case "JobCardDetail":
          return (
            <JobCardDetailScreen
              woId={screenParams.woId}
              onBack={goBack}
            />
          );
        case "VehicleQrLookup":
          return (
            <VehicleQrLookupScreen
              onBack={goBack}
              onOpenJobCard={(woId) => navigateTo("JobCardDetail", { woId })}
              onReportDefect={(vehicleId, plate) =>
                navigateTo("ReportDefect", { vehicleId, plate })
              }
            />
          );
        case "ReportDefect":
          return (
            <ReportDefectScreen
              initialVehicleId={screenParams.vehicleId}
              initialPlate={screenParams.plate}
              onBack={goBack}
              onSuccess={goBack}
            />
          );
        default:
          return (
            <JobCardsListScreen
              onOpenDetail={(woId) => navigateTo("JobCardDetail", { woId })}
              onNavigate={(sc) => navigateTo(sc)}
            />
          );
      }
    }

    // 5. Fleet & Logistics Dispatcher Persona
    if (role === "dispatcher") {
      switch (currentScreen) {
        case "ActiveTrips":
          return <ActiveTripsScreen onBack={goBack} />;
        case "QuickFuelLog":
          return <QuickFuelLogScreen onBack={goBack} onSuccess={goBack} />;
        default:
          return (
            <LiveFleetMapScreen
              onNavigate={(sc, p) => navigateTo(sc, p)}
            />
          );
      }
    }

    // 6. GPS & Telematics Technician Persona
    if (role === "telematics") {
      switch (currentScreen) {
        case "GpsDiagnostic":
          return (
            <GpsDiagnosticScreen
              initialImei={screenParams.imei}
              initialPlate={screenParams.plate}
              onBack={goBack}
            />
          );
        default:
          return (
            <TrackerPairingScreen
              onBack={goBack}
              onNavigateDiagnostics={(imei, plate) =>
                navigateTo("GpsDiagnostic", { imei, plate })
              }
            />
          );
      }
    }

    return (
      <RoleSelectScreen
        onRoleSelected={() => setShowRolePicker(false)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Header
        onSwitchRolePress={() => setShowRolePicker((prev) => !prev)}
        onOpenLogin={() => setShowLogin(true)}
      />
      <OfflineBanner />
      <View style={styles.content}>{renderActiveScreen()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  splashIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
  },
  splashSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
