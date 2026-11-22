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
  Recycle,
  CheckCircle,
  Tag,
  Scale,
  Sparkles,
  Box,
  FileWarning,
  DollarSign,
} from "lucide-react-native";

interface ScrapLogScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

const SCRAP_REASONS = [
  { code: "underweight_reject", label: "Uzito Pungufu / Underweight", icon: Scale },
  { code: "label_defect", label: "Lebo Mbovu / Label Defect", icon: Tag },
  { code: "giveaway_overfill", label: "Kufurika / Overfill Giveaway", icon: Sparkles },
  { code: "damaged_packaging", label: "Kifungashio Kilichoharibika", icon: Box },
  { code: "contamination", label: "Uchafuzi / Contamination", icon: FileWarning },
  { code: "changeover_waste", label: "Mabaki ya Kubadili Laini (Changeover)", icon: Recycle },
] as const;

export const ScrapLogScreen: React.FC<ScrapLogScreenProps> = ({ onBack, onSuccess }) => {
  const { organisation } = useAuth();
  const [machines, setMachines] = useState<PlantMachineItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<PlantMachineItem | null>(null);
  const [selectedReason, setSelectedReason] = useState<typeof SCRAP_REASONS[number]>(SCRAP_REASONS[0]);
  const [scrapQty, setScrapQty] = useState("25");
  const [selectedUnit, setSelectedUnit] = useState<"pcs" | "kg" | "litres" | "cartons">("pcs");
  const [costImpact, setCostImpact] = useState("37500");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await manufacturingService.getPlantMachines(organisation?.id);
        setMachines(list);
        if (list.length > 0) {
          setSelectedMachine(list[0]);
        }
      } catch (e) {
        console.warn("Failed to load plant machines:", e);
      }
    })();
  }, [organisation?.id]);

  // Auto-estimate cost based on units (e.g. TZS 1,500 per unit)
  const handleQtyChange = (val: string) => {
    setScrapQty(val);
    const q = parseInt(val, 10);
    if (!isNaN(q) && q > 0) {
      const estimated = q * 1500;
      setCostImpact(estimated.toString());
    }
  };

  const handleSubmit = async () => {
    const qty = parseInt(scrapQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Idadi ya Scrap", "Tafadhali ingiza idadi sahihi ya vipande au kiasi kilichopotea.");
      return;
    }

    const cost = parseInt(costImpact, 10) || 0;

    try {
      setSubmitting(true);
      const res = await manufacturingService.logScrap({
        organisationId: organisation?.id,
        machineId: selectedMachine?.id,
        machineName: selectedMachine?.name,
        productionLine: selectedMachine?.location || "Line 1",
        reason: selectedReason.code,
        scrapUnits: qty,
        unit: selectedUnit,
        costImpact: cost,
        notes: notes.trim(),
      });

      if (res.offline) {
        Alert.alert(
          "Imehifadhiwa Nje ya Mtandao",
          "Taarifa ya scrap imehifadhiwa kwenye simu yako. Itapakiwa mtandaoni ukipata mtandao."
        );
      } else {
        Alert.alert("Imefanikiwa", "Taarifa ya upotevu wa mali (scrap) imerekodiwa kikamilifu!");
      }

      if (onSuccess) onSuccess();
      else onBack();
    } catch {
      Alert.alert("Hitilafu", "Imeshindwa kurekodi scrap.");
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
        <Text style={styles.screenTitle}>Ripoti Upotevu / Scrap</Text>
      </View>

      {/* 1. Reason of defect */}
      <Text style={styles.sectionTitle}>1. SABABU YA UPOTEVU AU KUKATALIWA</Text>
      <View style={styles.reasonsGrid}>
        {SCRAP_REASONS.map((r) => {
          const isSelected = selectedReason.code === r.code;
          const IconComp = r.icon;

          return (
            <TouchableOpacity
              key={r.code}
              style={[
                styles.reasonCard,
                isSelected && { borderColor: colors.amber, backgroundColor: colors.cardSecondary },
              ]}
              onPress={() => setSelectedReason(r)}
              activeOpacity={0.8}
            >
              <View style={[styles.reasonIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <IconComp size={18} color={colors.amber} />
              </View>
              <Text style={[styles.reasonLabel, isSelected && { color: colors.text, fontWeight: "800" }]}>
                {r.label}
              </Text>
              {isSelected && <CheckCircle size={18} color={colors.amber} style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. Quantity & Unit */}
      <Text style={styles.sectionTitle}>2. KIASI CHA MABAKI / BIDHAA ZILIZOHARIBIKA</Text>
      <Card style={styles.qtyCard}>
        <View style={styles.qtyInputRow}>
          <Recycle size={20} color={colors.amber} />
          <TextInput
            style={styles.qtyInput}
            keyboardType="numeric"
            value={scrapQty}
            onChangeText={handleQtyChange}
            placeholder="25"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.unitsRow}>
          {(["pcs", "kg", "litres", "cartons"] as const).map((u) => (
            <TouchableOpacity
              key={u}
              style={[
                styles.unitBtn,
                selectedUnit === u && { borderColor: colors.amber, backgroundColor: "rgba(245, 158, 11, 0.2)" },
              ]}
              onPress={() => setSelectedUnit(u)}
            >
              <Text style={[styles.unitBtnText, selectedUnit === u && { color: colors.amber, fontWeight: "800" }]}>
                {u.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 3. Cost Impact */}
      <Text style={styles.sectionTitle}>3. GHARAMA YA HASARA (TZS)</Text>
      <Card style={styles.costCard}>
        <View style={styles.costRow}>
          <DollarSign size={20} color={colors.emerald} />
          <TextInput
            style={styles.costInput}
            keyboardType="numeric"
            value={costImpact}
            onChangeText={setCostImpact}
            placeholder="37500"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.costCurrency}>TZS</Text>
        </View>
        <Text style={styles.costHint}>
          Gharama hii huhesabiwa kulingana na bei ya malighafi zilizopotea.
        </Text>
      </Card>

      {/* 4. Notes */}
      <Text style={styles.sectionTitle}>4. MAELEZO YA ZIADA</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        placeholder="Andika sababu maalum au namba ya batch husika..."
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
            <Recycle size={20} color="#FFF" />
            <Text style={styles.submitBtnText}>Hifadhi Ripoti ya Scrap</Text>
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
    flex: 1,
  },
  qtyCard: {
    padding: spacing.md,
  },
  qtyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  qtyInput: {
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
  unitsRow: {
    flexDirection: "row",
    gap: 6,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
  },
  unitBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  costCard: {
    padding: spacing.md,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  costInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: colors.emerald,
    backgroundColor: colors.cardSecondary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costCurrency: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.emerald,
  },
  costHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.amber,
    paddingVertical: 14,
    borderRadius: radii.lg,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
