import React, { useState } from "react";
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
import { useOfflineSync } from "../../context/OfflineSyncContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  ArrowLeft,
  AlertTriangle,
  Truck,
  User,
  Phone,
  FileText,
  Gauge,
  CheckCircle2,
} from "lucide-react-native";

interface ReportDefectScreenProps {
  initialVehicleId?: string;
  initialPlate?: string;
  onBack: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  "Braking System",
  "Engine & Cooling",
  "Transmission & Clutch",
  "Suspension & Tyres",
  "Electrical & Battery",
  "Chassis & Trailer Pin",
  "Fuel Leak / Injector",
  "Other / Bodywork",
];

export const ReportDefectScreen: React.FC<ReportDefectScreenProps> = ({
  initialVehicleId,
  initialPlate,
  onBack,
  onSuccess,
}) => {
  const { queueInspection } = useOfflineSync();
  const [plate, setPlate] = useState(initialPlate || "");
  const [vehicleId, setVehicleId] = useState(initialVehicleId || "");
  const [reporterName, setReporterName] = useState("Karakana Mechanic");
  const [reporterPhone, setReporterPhone] = useState("");
  const [odometer, setOdometer] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [category, setCategory] = useState("Braking System");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!plate.trim()) {
      Alert.alert("Nambari ya Gari", "Tafadhali weka namba ya usajili ya gari (Plate number).");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Maelezo ya Hitilafu", "Tafadhali eleza tatizo la gari kwa ufupi.");
      return;
    }

    try {
      setSubmitting(true);

      // Check if machine exists by plate
      let targetMachineId = vehicleId;
      let targetOrgId = "00000000-0000-0000-0000-000000000000";

      const { data: mData } = await supabase
        .from("machines")
        .select("id, organisation_id")
        .or(`plate_number.ilike.%${plate.trim()}%,name.ilike.%${plate.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (mData) {
        targetMachineId = mData.id;
        targetOrgId = mData.organisation_id || targetOrgId;
      }

      if (!targetMachineId) {
        // Fallback dummy machine ID if not found so offline queue doesn't fail
        targetMachineId = "00000000-0000-0000-0000-000000000000";
      }

      const faultPayload = {
        machine_id: targetMachineId,
        organisation_id: targetOrgId,
        reporter_name: reporterName.trim() || "Workshop Mechanic",
        reporter_phone: reporterPhone.trim() || "0700000000",
        severity: severity,
        description: `[${category}] ${description.trim()} (ODO: ${odometer || "N/A"})`,
        status: "open",
        created_at: new Date().toISOString(),
      };

      const { error: faultError } = await supabase
        .from("fault_reports")
        .insert(faultPayload);

      if (faultError) {
        console.warn("Fault report direct insert error, queueing offline:", faultError);
        // Queue offline
        await queueInspection({
          vehicleId: targetMachineId,
          vehiclePlate: plate.trim(),
          items: [{ key: category, pass: false, defectNote: description.trim() }],
          completedAt: new Date().toISOString(),
          allPassed: false,
          poshoConfirmed: false,
        });

        Alert.alert(
          "Imehifadhiwa Offline",
          "Hitilafu imehifadhiwa kwenye simu na itapakiwa mara mtandao ukipatikana."
        );
      } else {
        Alert.alert(
          "Hitilafu Imesajiliwa!",
          `Taarifa ya hitilafu kwa gari ${plate.trim().toUpperCase()} imetumwa kwenye mfumo wa karakana na dispatch.`
        );
      }

      onSuccess();
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to record defect.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Defect Intake</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Machine & Plate Input */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>GARI LINALOHUSU</Text>
          <View style={styles.inputRow}>
            <Truck size={18} color={colors.primary} />
            <TextInput
              style={styles.textInput}
              placeholder="Namba ya Gari (mf. T 428 DXY)"
              placeholderTextColor={colors.textDim}
              value={plate}
              onChangeText={setPlate}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputRow}>
            <Gauge size={18} color={colors.blue} />
            <TextInput
              style={styles.textInput}
              placeholder="Odometer wakati wa kuingia (km)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={odometer}
              onChangeText={setOdometer}
            />
          </View>
        </Card>

        {/* Severity Selector */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>KIWANGO CHA UZITO (SEVERITY)</Text>
          <View style={styles.severityGrid}>
            {[
              { id: "low", label: "Low", color: colors.blue },
              { id: "medium", label: "Medium", color: colors.amber },
              { id: "high", label: "High", color: colors.rose },
              { id: "critical", label: "Breakdown / SOS", color: "#DC2626" },
            ].map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.severityPill,
                  severity === s.id && {
                    backgroundColor: s.color,
                    borderColor: s.color,
                  },
                ]}
                onPress={() => setSeverity(s.id as any)}
              >
                <Text
                  style={[
                    styles.severityPillText,
                    severity === s.id && styles.severityPillTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* System Category */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>MFUMO UNAOHITAJI MATENGENEZO</Text>
          <View style={styles.categoryWrap}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  category === cat && styles.categoryPillActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    category === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Defect Description */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>MAELEZO YA HITILAFU (SYMPTOMS)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Eleza kilichoharibika au ripoti ya dereva (mf. Breki za nyuma zinavuja upepo wakati wa kupakia mzigo)..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />
        </Card>

        {/* Contact Info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>TAARIFA ZA MRIPOTI</Text>
          <View style={styles.inputRow}>
            <User size={18} color={colors.textMuted} />
            <TextInput
              style={styles.textInput}
              placeholder="Jina la Mfundi / Mpokeaji"
              placeholderTextColor={colors.textDim}
              value={reporterName}
              onChangeText={setReporterName}
            />
          </View>

          <View style={styles.inputRow}>
            <Phone size={18} color={colors.textMuted} />
            <TextInput
              style={styles.textInput}
              placeholder="Simu ya Mfundi (07XX XXX XXX)"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
              value={reporterPhone}
              onChangeText={setReporterPhone}
            />
          </View>
        </Card>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <CheckCircle2 size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>Sajili Hitilafu Kwenye Mfumo</Text>
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
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.6,
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
    fontSize: 13,
    paddingVertical: 9,
  },
  severityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  severityPill: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  severityPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  severityPillTextActive: {
    color: "#FFF",
    fontWeight: "900",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  categoryPillActive: {
    backgroundColor: colors.primary + "22",
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  categoryPillTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
