import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  manufacturingService,
  PlantMachineItem,
} from "../../services/manufacturingService";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle,
  Cpu,
  Layers,
  Wrench,
  ZapOff,
  PackageX,
  ShieldAlert,
} from "lucide-react-native";

interface DowntimeLogScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

const REASONS = [
  { code: "breakdown", label: "Breakdown / Mashine Kuharibika", category: "unplanned", icon: Wrench },
  { code: "material_shortage", label: "Material Shortage / Ukosefu wa Mali", category: "unplanned", icon: PackageX },
  { code: "utility_failure", label: "Utility / Umeme, Maji au Hewa Kukatika", category: "unplanned", icon: ZapOff },
  { code: "quality_hold", label: "Quality Hold / Sitisha kwa Ubora", category: "unplanned", icon: ShieldAlert },
  { code: "changeover", label: "Changeover / Kubadili Mfumo (Setup)", category: "planned", icon: Cpu },
  { code: "cleaning_cip", label: "Cleaning / Usafi wa Mashine (CIP)", category: "planned", icon: Layers },
] as const;

export const DowntimeLogScreen: React.FC<DowntimeLogScreenProps> = ({ onBack, onSuccess }) => {
  const { organisation } = useAuth();
  const [machines, setMachines] = useState<PlantMachineItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<PlantMachineItem | null>(null);
  const [selectedReason, setSelectedReason] = useState<typeof REASONS[number]>(REASONS[0]);
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMachines, setLoadingMachines] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await manufacturingService.getPlantMachines(organisation?.id);
        setMachines(list);
        if (list.length > 0) {
          setSelectedMachine(list[0]);
        }
      } catch (e) {
        console.warn("Failed to load machines:", e);
      } finally {
        setLoadingMachines(false);
      }
    })();
  }, [organisation?.id]);

  const handleSubmit = async () => {
    if (!selectedMachine) {
      Alert.alert("Chagua Mashine", "Tafadhali chagua mashine au sehemu ya uzalishaji.");
      return;
    }

    const mins = parseInt(durationMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert("Dakika Zilizopotea", "Tafadhali ingiza idadi sahihi ya dakika za kukatika.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await manufacturingService.logDowntime({
        organisationId: organisation?.id,
        machineId: selectedMachine.id,
        machineName: selectedMachine.name,
        productionLine: selectedMachine.location || "Line 1",
        reason: selectedReason.code,
        category: selectedReason.category,
        downtimeMinutes: mins,
        notes: notes.trim(),
      });

      if (res.offline) {
        Alert.alert(
          "Imehifadhiwa Nje ya Mtandao",
          "Kukatika kumehifadhiwa kwenye simu yako kwa sababu haupo mtandaoni. Kutatumwa mara tu mtandao utakapopatikana."
        );
      } else {
        Alert.alert("Imefanikiwa", "Ripoti ya kukatika kwa uzalishaji imerekodiwa kikamilifu!");
      }

      if (onSuccess) onSuccess();
      else onBack();
    } catch {
      Alert.alert("Hitilafu", "Imeshindwa kurekodi tukio la downtime.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Ripoti Downtime / Kukatika</Text>
      </View>

      {/* 1. Select Machine */}
      <Text style={styles.sectionTitle}>1. CHAGUA MASHINE ILIYOKATIKA</Text>
      {loadingMachines ? (
        <ActivityIndicator size="small" color={colors.red} style={{ marginVertical: 12 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {machines.map((m) => {
            const isSelected = selectedMachine?.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.machineChip,
                  isSelected && { borderColor: colors.red, backgroundColor: "rgba(239, 68, 68, 0.15)" },
                ]}
                onPress={() => setSelectedMachine(m)}
              >
                <Cpu size={16} color={isSelected ? colors.red : colors.textMuted} />
                <View>
                  <Text style={[styles.machineChipText, isSelected && { color: colors.text, fontWeight: "800" }]}>
                    {m.name}
                  </Text>
                  <Text style={styles.machineChipSub}>{m.location || "Plant Floor"}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 2. Stoppage Reason */}
      <Text style={styles.sectionTitle}>2. SABABU YA KUSIMAMA KWA UZALISHAJI</Text>
      <View style={styles.reasonsGrid}>
        {REASONS.map((r) => {
          const isSelected = selectedReason.code === r.code;
          const IconComp = r.icon;
          const isUnplanned = r.category === "unplanned";
          const tintColor = isUnplanned ? colors.red : colors.blue;

          return (
            <TouchableOpacity
              key={r.code}
              style={[
                styles.reasonCard,
                isSelected && { borderColor: tintColor, backgroundColor: colors.cardSecondary },
              ]}
              onPress={() => setSelectedReason(r)}
              activeOpacity={0.8}
            >
              <View style={[styles.reasonIconBox, { backgroundColor: `${tintColor}20` }]}>
                <IconComp size={18} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reasonLabel, isSelected && { color: colors.text, fontWeight: "800" }]}>
                  {r.label}
                </Text>
                <Text style={styles.reasonCategory}>
                  {isUnplanned ? "• Unplanned Stoppage" : "• Planned Maintenance/Setup"}
                </Text>
              </View>
              {isSelected && <CheckCircle size={18} color={tintColor} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Duration & Presets */}
      <Text style={styles.sectionTitle}>3. MUDA ULIOKAA (DAKIKA)</Text>
      <Card style={styles.durationCard}>
        <View style={styles.durationInputRow}>
          <Clock size={20} color={colors.red} />
          <TextInput
            style={styles.durationInput}
            keyboardType="numeric"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="15"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.durationUnitText}>Dakika</Text>
        </View>

        <View style={styles.presetsRow}>
          {["5", "15", "30", "45", "60", "120"].map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.presetPill,
                durationMinutes === mins && { borderColor: colors.red, backgroundColor: "rgba(239, 68, 68, 0.2)" },
              ]}
              onPress={() => setDurationMinutes(mins)}
            >
              <Text
                style={[
                  styles.presetPillText,
                  durationMinutes === mins && { color: colors.red, fontWeight: "800" },
                ]}
              >
                {mins} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 4. Notes & Corrective Action */}
      <Text style={styles.sectionTitle}>4. MAELEZO YA HITILAFU NA HATUA ZILIZOCHUKULIWA</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        placeholder="Eleza kilichotokea, mf. Sensor ya laini ilizimika, fundi amesafisha na kurekebisha."
        placeholderTextColor={colors.textMuted}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <AlertTriangle size={20} color="#FFF" />
            <Text style={styles.submitBtnText}>Hifadhi Ripoti ya Downtime</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  horizontalScroll: {
    marginBottom: spacing.sm,
  },
  machineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  machineChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  machineChipSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  reasonsGrid: {
    gap: 8,
  },
  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  reasonIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  reasonCategory: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  durationCard: {
    padding: spacing.md,
  },
  durationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  durationInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.cardSecondary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationUnitText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 6,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: radii.lg,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
