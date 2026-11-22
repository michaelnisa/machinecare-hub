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
import { supabase } from "../../config/supabase";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  AlertOctagon,
  Cpu,
  Layers,
  Thermometer,
  Gauge,
  Sparkles,
  ShieldAlert,
} from "lucide-react-native";

interface PlantMachineCheckScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

interface ChecklistItem {
  key: string;
  title: string;
  swahili: string;
  icon: any;
  passed: boolean;
}

export const PlantMachineCheckScreen: React.FC<PlantMachineCheckScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const { organisation, user } = useAuth();
  const [machines, setMachines] = useState<PlantMachineItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<PlantMachineItem | null>(null);
  const [defectNotes, setDefectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      key: "eStop",
      title: "Emergency Stop Button Tested",
      swahili: "Kitufe cha dharura (E-Stop) kimejaribiwa na kinafanya kazi",
      icon: AlertOctagon,
      passed: true,
    },
    {
      key: "guards",
      title: "Safety Guards & Interlocks Secured",
      swahili: "Walinzi wa usalama na vizuizi vimefungwa vizuri",
      icon: ShieldCheck,
      passed: true,
    },
    {
      key: "lube",
      title: "Lubrication & Pneumatic Pressure Normal",
      swahili: "Viwango vya mafuta ya kulainisha na mgandamizo wa hewa viko sahihi",
      icon: Gauge,
      passed: true,
    },
    {
      key: "temp",
      title: "Motor Temperature & Vibration Normal",
      swahili: "Joto la injini na mtetemo ni wa kawaida (hakuna mlio mbaya)",
      icon: Thermometer,
      passed: true,
    },
    {
      key: "clean",
      title: "Line Cleanliness & Sanitation (CIP)",
      swahili: "Laini ni safi, hakuna uchafu au mabaki ya batch iliyotangulia",
      icon: Sparkles,
      passed: true,
    },
  ]);

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

  const toggleCheck = (key: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.key === key ? { ...item, passed: !item.passed } : item))
    );
  };

  const handlePassAll = () => {
    setChecklist((prev) => prev.map((item) => ({ ...item, passed: true })));
  };

  const hasFailures = checklist.some((c) => !c.passed);

  const handleSubmit = async () => {
    if (!selectedMachine) {
      Alert.alert("Chagua Mashine", "Tafadhali chagua mashine inayokaguliwa.");
      return;
    }

    try {
      setSubmitting(true);

      // If failures exist, optionally create a work order in work_orders
      if (hasFailures && organisation?.id) {
        const failedTitles = checklist
          .filter((c) => !c.passed)
          .map((c) => c.title)
          .join(", ");

        await (supabase as any).from("work_orders").insert({
          organisation_id: organisation.id,
          machine_id: selectedMachine.id,
          title: `[Plant Defect] ${selectedMachine.name} - Pre-Shift Check Failed`,
          description: `Ukaguzi wa mashine umefeli kwenye: ${failedTitles}. Maelezo ya operator: ${defectNotes || "Hakuna maelezo ya ziada"}`,
          status: "open",
          priority: "high",
        });
      }

      Alert.alert(
        "Ukaguzi Umekamilika",
        hasFailures
          ? "Ukaguzi umehifadhiwa. Tahadhari ya hitilafu imetumwa kwa idara ya matengenezo (Maintenance/Garage)."
          : `Mashine ${selectedMachine.name} iko salama na tayari kwa uzalishaji wa zamu hii!`
      );

      if (onSuccess) onSuccess();
      else onBack();
    } catch {
      Alert.alert("Hitilafu", "Imeshindwa kuhifadhi ukaguzi wa mashine.");
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
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Ukaguzi wa Mashine (Pre-Shift)</Text>
          <Text style={styles.screenSub}>Uhakiki wa usalama kabla ya kuanza uzalishaji</Text>
        </View>
      </View>

      {/* 1. Select Machine */}
      <Text style={styles.sectionTitle}>1. CHAGUA MASHINE INAYOKAGULIWA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {machines.map((m) => {
          const isSelected = selectedMachine?.id === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.machineChip,
                isSelected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
              ]}
              onPress={() => setSelectedMachine(m)}
            >
              <Cpu size={16} color={isSelected ? colors.primary : colors.textMuted} />
              <View>
                <Text style={[styles.machineChipText, isSelected && { color: colors.text, fontWeight: "800" }]}>
                  {m.name}
                </Text>
                <Text style={styles.machineChipSub}>{m.location || "Bay A"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. Checklist items */}
      <View style={styles.checklistHeaderRow}>
        <Text style={styles.sectionTitle}>2. ORODHA YA UKAGUZI WA USALAMA</Text>
        <TouchableOpacity onPress={handlePassAll}>
          <Text style={styles.passAllText}>Vyote Viko Salama (Pass All)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checklistGrid}>
        {checklist.map((item) => {
          const IconComp = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.checkCard,
                !item.passed && { borderColor: colors.red, backgroundColor: "rgba(239, 68, 68, 0.08)" },
              ]}
              onPress={() => toggleCheck(item.key)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkIconBox,
                  { backgroundColor: item.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" },
                ]}
              >
                <IconComp size={20} color={item.passed ? colors.emerald : colors.red} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.checkTitle, !item.passed && { color: colors.red }]}>
                  {item.title}
                </Text>
                <Text style={styles.checkSub}>{item.swahili}</Text>
              </View>

              <View
                style={[
                  styles.toggleBadge,
                  { backgroundColor: item.passed ? colors.emerald : colors.red },
                ]}
              >
                <Text style={styles.toggleBadgeText}>{item.passed ? "SALAMA" : "HITILAFU"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Defect Warning if any failure */}
      {hasFailures && (
        <View style={styles.warningBox}>
          <ShieldAlert size={22} color={colors.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Tahadhari ya Hitilafu ya Usalama</Text>
            <Text style={styles.warningSub}>
              Mfumo utatengeneza tiketi ya matengenezo kiotomatiki kwenda kwa mafundi wa karakana.
            </Text>
          </View>
        </View>
      )}

      {/* 3. Defect notes */}
      <Text style={styles.sectionTitle}>3. MAELEZO YA OPERATOR / MATOKEO</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        numberOfLines={3}
        value={defectNotes}
        onChangeText={setDefectNotes}
        placeholder="Weka maelezo yoyote kuhusu hali ya mashine au kasoro zilizobainika..."
        placeholderTextColor={colors.textMuted}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          hasFailures && { backgroundColor: colors.red },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <ShieldCheck size={20} color="#FFF" />
            <Text style={styles.submitBtnText}>
              {hasFailures ? "Wasilisha & Tuma Tahadhari ya Hitilafu" : "Thibitisha Mashine Iko Salama"}
            </Text>
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
  screenSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  checklistHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  passAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.emerald,
  },
  horizontalScroll: {
    marginBottom: spacing.xs,
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
  checklistGrid: {
    gap: 8,
  },
  checkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  checkSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  toggleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  toggleBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFF",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.red,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.red,
  },
  warningSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
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
    backgroundColor: colors.emerald,
    paddingVertical: 14,
    borderRadius: radii.lg,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
