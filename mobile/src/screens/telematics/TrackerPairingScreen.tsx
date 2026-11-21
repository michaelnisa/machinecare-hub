import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
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
  ScanBarcode,
  Truck,
  CheckCircle2,
  Cpu,
  Zap,
  Activity,
} from "lucide-react-native";

interface TrackerPairingScreenProps {
  onBack: () => void;
  onNavigateDiagnostics?: (imei: string, plate: string) => void;
}

const POPULAR_TRACKERS = [
  { name: "Teltonika FMB920", proto: "Codec 8" },
  { name: "Concox GT06N / WeTrack", proto: "GT06" },
  { name: "Coban TK103 / TK303", proto: "Coban" },
  { name: "Jimi IoT VL02 (4G LTE)", proto: "Jimi" },
  { name: "Suntech ST310", proto: "Suntech" },
];

export const TrackerPairingScreen: React.FC<TrackerPairingScreenProps> = ({
  onBack,
  onNavigateDiagnostics,
}) => {
  const [imei, setImei] = useState("");
  const [plate, setPlate] = useState("");
  const [trackerModel, setTrackerModel] = useState("Teltonika FMB920");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [matchedVehicle, setMatchedVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const { data } = await supabase
          .from("machines")
          .select("id, name, plate_number, telematics_imei, make, model")
          .order("plate_number", { ascending: true })
          .limit(60);

        if (data) setVehicles(data);
      } catch (e) {
        console.warn("Failed to load vehicles:", e);
      }
    };
    fetchVehicles();
  }, []);

  const searchVehicle = (term: string) => {
    setPlate(term);
    const q = term.trim().toLowerCase();
    if (!q) {
      setMatchedVehicle(null);
      return;
    }
    const found = vehicles.find((v) =>
      (v.plate_number || v.name).toLowerCase().includes(q)
    );
    setMatchedVehicle(found || null);
  };

  const handlePairTracker = async () => {
    const cleanImei = imei.trim();
    if (!cleanImei || cleanImei.length < 10) {
      Alert.alert("Nambari ya IMEI", "Tafadhali ingiza IMEI sahihi ya kifaa cha GPS (tarakimu 15).");
      return;
    }
    if (!matchedVehicle) {
      Alert.alert("Chagua Gari", "Tafadhali chagua au andika namba ya gari inayohusika.");
      return;
    }

    try {
      setPairing(true);

      const { error } = await supabase
        .from("machines")
        .update({
          telematics_imei: cleanImei,
          telematics_last_at: new Date().toISOString(),
        })
        .eq("id", matchedVehicle.id);

      if (error) throw error;

      Alert.alert(
        "Tracker Imefungwa Kikamilifu!",
        `Kifaa cha GPS (IMEI: ${cleanImei}) kimeunganishwa na gari ${matchedVehicle.plate_number || matchedVehicle.name}. Unaweza kuangalia mawasiliano ya satelaiti sasa.`,
        [
          {
            text: "Fanya Diagnostics",
            onPress: () =>
              onNavigateDiagnostics?.(cleanImei, matchedVehicle.plate_number || matchedVehicle.name),
          },
          { text: "Sawa", style: "cancel" },
        ]
      );
    } catch (e: any) {
      Alert.alert("Hitilafu ya Kuunganisha", e.message || "Failed to pair tracker.");
    } finally {
      setPairing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GPS Tracker Field Pairing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Scan / Enter IMEI */}
        <Card style={styles.sectionCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Scan au Weka IMEI ya GPS Tracker</Text>
          </View>

          <View style={styles.inputRow}>
            <ScanBarcode size={20} color={colors.primary} />
            <TextInput
              style={styles.textInput}
              placeholder="Weka IMEI ya kifaa (mf. 864201048291039)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              maxLength={15}
              value={imei}
              onChangeText={setImei}
            />
          </View>

          {/* Quick preset IMEI for test / field demo */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Test Demo IMEI:</Text>
            {["864201048291039", "358249021948102"].map((testImei) => (
              <TouchableOpacity
                key={testImei}
                style={styles.presetChip}
                onPress={() => setImei(testImei)}
              >
                <Text style={styles.presetChipText}>{testImei.slice(-6)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Step 2: Tracker Model & Hardware Protocol */}
        <Card style={styles.sectionCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Aina ya Kifaa (Hardware Model)</Text>
          </View>

          <View style={styles.modelGrid}>
            {POPULAR_TRACKERS.map((t) => (
              <TouchableOpacity
                key={t.name}
                style={[
                  styles.modelPill,
                  trackerModel === t.name && styles.modelPillActive,
                ]}
                onPress={() => setTrackerModel(t.name)}
              >
                <Cpu size={14} color={trackerModel === t.name ? colors.primary : colors.textMuted} />
                <View>
                  <Text style={[styles.modelName, trackerModel === t.name && styles.modelNameActive]}>
                    {t.name}
                  </Text>
                  <Text style={styles.modelProto}>{t.proto}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Step 3: Match Truck Plate */}
        <Card style={styles.sectionCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Funga Kwenye Gari (Vehicle Plate)</Text>
          </View>

          <View style={styles.inputRow}>
            <Truck size={18} color={colors.blue} />
            <TextInput
              style={styles.textInput}
              placeholder="Andika namba ya gari (mf. T 428 DXY)..."
              placeholderTextColor={colors.textDim}
              value={plate}
              onChangeText={searchVehicle}
              autoCapitalize="characters"
            />
          </View>

          {/* Quick Select from recent vehicles */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plateScroll}>
            {vehicles.slice(0, 8).map((v) => {
              const p = v.plate_number || v.name;
              const isSelected = matchedVehicle?.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.plateChip, isSelected && styles.plateChipActive]}
                  onPress={() => {
                    setPlate(p);
                    setMatchedVehicle(v);
                  }}
                >
                  <Text style={[styles.plateChipText, isSelected && styles.plateChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {matchedVehicle && (
            <View style={styles.matchedCard}>
              <CheckCircle2 size={18} color={colors.emerald} />
              <View style={{ flex: 1 }}>
                <Text style={styles.matchedPlate}>
                  {matchedVehicle.plate_number || matchedVehicle.name}
                </Text>
                <Text style={styles.matchedSub}>
                  {[matchedVehicle.make, matchedVehicle.model].filter(Boolean).join(" ") || "Commercial Truck"}
                  {matchedVehicle.telematics_imei
                    ? ` • Currently bound: ${matchedVehicle.telematics_imei}`
                    : " • Ready for first binding"}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Pair Action Button */}
        <TouchableOpacity
          style={styles.pairBtn}
          onPress={handlePairTracker}
          disabled={pairing}
          activeOpacity={0.8}
        >
          {pairing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Radio size={18} color="#FFF" />
              <Text style={styles.pairBtnText}>Funga Tracker Kwenye Gari</Text>
            </>
          )}
        </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 9,
    fontFamily: "monospace",
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  presetLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  presetChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: "monospace",
  },
  modelGrid: {
    gap: spacing.xs,
  },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  modelPillActive: {
    backgroundColor: colors.primary + "18",
    borderColor: colors.primary,
  },
  modelName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  modelNameActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  modelProto: {
    fontSize: 10,
    color: colors.textDim,
  },
  plateScroll: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  plateChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    marginRight: 6,
  },
  plateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  plateChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "monospace",
  },
  plateChipTextActive: {
    color: "#FFF",
  },
  matchedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.emerald + "15",
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: 4,
  },
  matchedPlate: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.emerald,
    fontFamily: "monospace",
  },
  matchedSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  pairBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  pairBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
