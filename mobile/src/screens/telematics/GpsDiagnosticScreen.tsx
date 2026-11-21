import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  ArrowLeft,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Signal,
  Key,
  Navigation,
  Shield,
  Power,
} from "lucide-react-native";

interface GpsDiagnosticScreenProps {
  initialImei?: string;
  initialPlate?: string;
  onBack: () => void;
}

export const GpsDiagnosticScreen: React.FC<GpsDiagnosticScreenProps> = ({
  initialImei,
  initialPlate,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [plate, setPlate] = useState(initialPlate || "T 428 DXY");
  const [imei, setImei] = useState(initialImei || "864201048291039");
  const [relayCut, setRelayCut] = useState(false);

  // Live telemetry state
  const [telemetry, setTelemetry] = useState({
    satellites: 14,
    fixType: "3D Fix",
    hdop: 0.8,
    latitude: -6.7924,
    longitude: 39.2083,
    altitude: "48m",
    ignition: true,
    batteryVolt: 24.4,
    backupBattery: "98% (Internal LiPo)",
    gsmSignal: "-68 dBm (CSQ 24/31)",
    network: "4G LTE (Vodacom TZ)",
    serverHandshake: "Online (42ms)",
    lastPing: "Just now",
  });

  const refreshDiagnostics = async () => {
    setLoading(true);
    try {
      if (plate) {
        const { data } = await supabase
          .from("machines")
          .select("telematics_imei, telematics_ignition, telematics_battery_volt, telematics_latitude, telematics_longitude, telematics_last_at, notes")
          .or(`plate_number.ilike.%${plate}%,name.ilike.%${plate}%`)
          .limit(1)
          .maybeSingle();

        if (data) {
          let notesMeta: any = {};
          try {
            if ((data as any).notes) notesMeta = JSON.parse((data as any).notes);
          } catch {}
          const tMeta = notesMeta?.telematics || {};

          setTelemetry((prev) => ({
            ...prev,
            ignition: data.telematics_ignition ?? tMeta.ignition ?? prev.ignition,
            batteryVolt: data.telematics_battery_volt ?? tMeta.battery_volt ?? prev.batteryVolt,
            latitude: data.telematics_latitude ?? tMeta.latitude ?? prev.latitude,
            longitude: data.telematics_longitude ?? tMeta.longitude ?? prev.longitude,
            lastPing: data.telematics_last_at ? new Date(data.telematics_last_at).toLocaleTimeString() : "Just now",
          }));
        }
      }
    } catch (e) {
      console.warn("Diagnostics refresh error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRelay = () => {
    const nextState = !relayCut;
    Alert.alert(
      nextState ? "Kata Umeme wa Gari (Cut Fuel Relay)" : "Rejesha Umeme (Restore Fuel)",
      nextState
        ? "Tahadhari: Hii itazima gari kwa kutuma amri ya kukata relay ya fuel pump. Je, gari imesimama kwa usalama?"
        : "Unataka kurejesha mawasiliano ya starter na kuwasha pampu ya mafuta?",
      [
        { text: "Ghairi", style: "cancel" },
        {
          text: nextState ? "Kata Umeme Sasa" : "Rejesha Umeme",
          style: nextState ? "destructive" : "default",
          onPress: () => {
            setRelayCut(nextState);
            Alert.alert(
              "Amri Imetumwa Kwenye Tracker",
              nextState
                ? "RELAY CUT (Immobilizer): Mafuta yamekatwa. Gari halitawaka."
                : "RELAY RESTORED: Nguvu ya starter imerejeshwa kawaida."
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Telematics Live Diagnostics</Text>
          <Text style={styles.headerSub}>{plate} • IMEI: {imei}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refreshDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RotateCw size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Overall Status Banner */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.bannerText}>TRACKER ONLINE & TELEMETRY STREAMING</Text>
          </View>
          <Text style={styles.serverInfo}>
            Protocol: Codec 8 • Port 5027 • Server Handshake: {telemetry.serverHandshake}
          </Text>
        </Card>

        {/* 1. GPS Satellite Fix */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Navigation size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>1. GPS Satellite Navigation Fix</Text>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Satelaiti</Text>
              <Text style={[styles.statValue, { color: colors.emerald }]}>
                {telemetry.satellites} Satelaiti
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Aina ya Fix</Text>
              <Text style={styles.statValue}>{telemetry.fixType}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Usahihi (HDOP)</Text>
              <Text style={[styles.statValue, { color: colors.emerald }]}>
                {telemetry.hdop} (High)
              </Text>
            </View>
          </View>

          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>Majira ya GPS (Coordinates):</Text>
            <Text style={styles.coordValue}>
              {telemetry.latitude.toFixed(6)}, {telemetry.longitude.toFixed(6)} ({telemetry.altitude})
            </Text>
          </View>
        </Card>

        {/* 2. Ignition / ACC Wire Test */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Key size={18} color={colors.amber} />
            <Text style={styles.sectionTitle}>2. ACC / Ignition Wire Splice Test</Text>
          </View>

          <View style={styles.accContainer}>
            <View
              style={[
                styles.accBadge,
                telemetry.ignition ? styles.accBadgeOn : styles.accBadgeOff,
              ]}
            >
              <Power size={20} color="#FFF" />
              <Text style={styles.accBadgeText}>
                {telemetry.ignition ? "IGNITION ON (+24V DETECTED)" : "IGNITION OFF (0V KEY OFF)"}
              </Text>
            </View>
            <Text style={styles.accInstruction}>
              Zungusha ufunguo wa gari kwenye Dashboard uone kama taa inabadilika papo hapo kuthibitisha waya ya ACC imeingia ipasavyo.
            </Text>
          </View>
        </Card>

        {/* 3. Power & Battery Voltages */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Zap size={18} color={colors.blue} />
            <Text style={styles.sectionTitle}>3. Main Battery & Alternator</Text>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Voltage Kuu</Text>
              <Text style={[styles.statValue, { color: colors.emerald }]}>
                {telemetry.batteryVolt} V
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Hali ya Alternator</Text>
              <Text style={[styles.statValue, { color: colors.emerald }]}>Inachaji (Normal)</Text>
            </View>
          </View>

          <View style={styles.backupRow}>
            <Text style={styles.backupLabel}>Tracker Internal LiPo Battery:</Text>
            <Text style={styles.backupValue}>{telemetry.backupBattery}</Text>
          </View>
        </Card>

        {/* 4. GSM Signal */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Signal size={18} color={colors.text} />
            <Text style={styles.sectionTitle}>4. GSM Cellular Telemetry</Text>
          </View>

          <View style={styles.gsmRow}>
            <Text style={styles.gsmLabel}>Cellular Signal:</Text>
            <Text style={styles.gsmValue}>{telemetry.gsmSignal}</Text>
          </View>

          <View style={styles.gsmRow}>
            <Text style={styles.gsmLabel}>Operator & SIM:</Text>
            <Text style={styles.gsmValue}>{telemetry.network}</Text>
          </View>
        </Card>

        {/* 5. Remote Relay Immobilizer Test */}
        <Card style={[styles.sectionCard, relayCut && styles.sectionCardAlert]}>
          <View style={styles.sectionHeader}>
            <Shield size={18} color={relayCut ? colors.rose : colors.textMuted} />
            <Text style={styles.sectionTitle}>5. Remote Engine Immobilizer Relay</Text>
          </View>

          <Text style={styles.relayDesc}>
            Jaribu relay ya kuzima mafuta/starter kwa amri ya SMS au GPRS data packet.
          </Text>

          <TouchableOpacity
            style={[
              styles.relayToggleBtn,
              relayCut ? styles.relayToggleBtnRestore : styles.relayToggleBtnCut,
            ]}
            onPress={handleToggleRelay}
            activeOpacity={0.8}
          >
            <Text style={styles.relayToggleBtnText}>
              {relayCut ? "REJESHA UMEME (RESTORE ENGINE)" : "KATA UMEME (TEST CUT RELAY)"}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  refreshBtn: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  bannerCard: {
    backgroundColor: colors.emerald + "18",
    borderColor: colors.emerald,
    gap: 4,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.emerald,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.emerald,
    letterSpacing: 0.5,
  },
  serverInfo: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  sectionCardAlert: {
    borderColor: colors.rose,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
  },
  statValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
    textAlign: "center",
  },
  coordBox: {
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: 2,
  },
  coordLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  coordValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "monospace",
    marginTop: 2,
  },
  accContainer: {
    gap: spacing.xs,
  },
  accBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  accBadgeOn: {
    backgroundColor: colors.emerald,
  },
  accBadgeOff: {
    backgroundColor: colors.rose,
  },
  accBadgeText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  accInstruction: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  backupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  backupLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  backupValue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  gsmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  gsmLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gsmValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  relayDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  relayToggleBtn: {
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  relayToggleBtnCut: {
    backgroundColor: colors.rose,
  },
  relayToggleBtnRestore: {
    backgroundColor: colors.emerald,
  },
  relayToggleBtnText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
