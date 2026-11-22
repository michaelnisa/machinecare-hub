import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  manufacturingService,
  ProductionKpiSummary,
} from "../../services/manufacturingService";
import {
  Factory,
  Zap,
  AlertTriangle,
  Recycle,
  ClipboardList,
  CheckCircle,
  Activity,
  ArrowRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  Plus,
  Layers,
} from "lucide-react-native";

interface ManufacturingHomeScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const ManufacturingHomeScreen: React.FC<ManufacturingHomeScreenProps> = ({
  onNavigate,
}) => {
  const { organisation, user } = useAuth();
  const [kpis, setKpis] = useState<ProductionKpiSummary | null>(null);
  const [lines, setLines] = useState<string[]>([
    "Line 1 - Bottling",
    "Line 2 - Canning",
    "Line 3 - Packaging",
  ]);
  const [selectedLine, setSelectedLine] = useState<string>("Line 1 - Bottling");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Output Modal
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputUnits, setOutputUnits] = useState("500");
  const [submittingOutput, setSubmittingOutput] = useState(false);

  const loadData = async (targetLine?: string) => {
    const lineToQuery = targetLine || selectedLine;
    try {
      const [kpiData, lineList] = await Promise.all([
        manufacturingService.getTodayShiftKpis(organisation?.id, lineToQuery),
        manufacturingService.getProductionLines(organisation?.id),
      ]);
      setKpis(kpiData);
      if (lineList.length > 0) {
        setLines(lineList);
      }
    } catch (e) {
      console.warn("Failed to load shift KPIs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(selectedLine);
  };

  const handleRecordOutput = async () => {
    const qty = parseInt(outputUnits, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Hitilafu", "Tafadhali ingiza idadi sahihi ya vipande/bidhaa zilizotengenezwa.");
      return;
    }

    try {
      setSubmittingOutput(true);
      await manufacturingService.recordOutput(
        organisation?.id,
        kpis?.productionLine || "Line 1",
        qty
      );
      Alert.alert("Imefanikiwa", `Uzalishaji wa vipande +${qty.toLocaleString()} umerekodiwa kikamilifu!`);
      setShowOutputModal(false);
      loadData();
    } catch {
      Alert.alert("Hitilafu", "Imeshindwa kurekodi uzalishaji.");
    } finally {
      setSubmittingOutput(false);
    }
  };

  const attainment = kpis?.attainmentPercent || 0;
  const attainmentColor =
    attainment >= 90 ? colors.emerald : attainment >= 70 ? colors.amber : colors.red;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Plant Line & Shift Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.factoryBadge}>
            <Factory size={16} color={colors.emerald} />
            <Text style={styles.factoryBadgeText}>
              {kpis?.productionLine || "Line 1 - Bottling & Packaging"}
            </Text>
          </View>
          <View style={styles.livePulse}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ZAMU YA LEO (LIVE)</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>
          {organisation?.name || "Kiwanda Kikuu cha Uzalishaji"}
        </Text>
        <Text style={styles.headerSub}>
          Dashibodi ya sakafu ya kiwanda: Ufuatiliaji wa OEE, uzalishaji, na kuzuia upotevu.
        </Text>

        {/* Production Lines Horizontal Selector */}
        <View style={styles.lineContainer}>
          <Text style={styles.lineLabel}>LAINI YA UZALISHAJI (ACTIVE LINE):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lineScroll}>
            {lines.map((l) => {
              const isSelected = selectedLine === l;
              return (
                <TouchableOpacity
                  key={l}
                  style={[styles.lineChip, isSelected && styles.lineChipActive]}
                  onPress={() => {
                    setSelectedLine(l);
                    loadData(l);
                  }}
                  activeOpacity={0.8}
                >
                  <Layers size={13} color={isSelected ? colors.emerald : colors.textMuted} />
                  <Text style={[styles.lineChipText, isSelected && styles.lineChipTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Main Shift Attainment Card */}
      <Card style={styles.mainAttainmentCard}>
        <View style={styles.attainmentHeader}>
          <View>
            <Text style={styles.statLabel}>LENGO VS HALISI YA SHIFT</Text>
            <Text style={styles.attainmentNumbers}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {kpis?.actualUnits.toLocaleString() || "0"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>
                {" "}
                / {kpis?.targetUnits.toLocaleString() || "0"} pcs
              </Text>
            </Text>
          </View>
          <View style={[styles.attainmentPill, { backgroundColor: `${attainmentColor}20` }]}>
            <TrendingUp size={16} color={attainmentColor} />
            <Text style={[styles.attainmentPillText, { color: attainmentColor }]}>
              {attainment}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.max(5, attainment))}%`, backgroundColor: attainmentColor },
            ]}
          />
        </View>

        {/* Sub-KPI Row */}
        <View style={styles.subKpiRow}>
          <View style={styles.subKpiItem}>
            <View style={styles.subKpiHeader}>
              <Activity size={14} color={colors.emerald} />
              <Text style={styles.subKpiLabel}>OEE YA KIWANDA</Text>
            </View>
            <Text style={[styles.subKpiValue, { color: colors.emerald }]}>
              {kpis?.overallOee || 80}%
            </Text>
            <Text style={styles.subKpiSub}>Avail {kpis?.oeeAvailability || 92}%</Text>
          </View>

          <View style={styles.subKpiDivider} />

          <TouchableOpacity
            style={styles.subKpiItem}
            onPress={() => onNavigate("DowntimeLog")}
            activeOpacity={0.7}
          >
            <View style={styles.subKpiHeader}>
              <Clock size={14} color={colors.red} />
              <Text style={styles.subKpiLabel}>DOWNTIME (KUKATIKA)</Text>
            </View>
            <Text style={[styles.subKpiValue, { color: colors.red }]}>
              {kpis?.downtimeMinutes || 0} min
            </Text>
            <Text style={styles.subKpiSub}>Dakika zilizopotea</Text>
          </TouchableOpacity>

          <View style={styles.subKpiDivider} />

          <TouchableOpacity
            style={styles.subKpiItem}
            onPress={() => onNavigate("ScrapLog")}
            activeOpacity={0.7}
          >
            <View style={styles.subKpiHeader}>
              <Recycle size={14} color={colors.amber} />
              <Text style={styles.subKpiLabel}>SCRAP / UPOTEVU</Text>
            </View>
            <Text style={[styles.subKpiValue, { color: colors.amber }]}>
              {kpis?.scrapUnits || 0} pcs
            </Text>
            <Text style={styles.subKpiSub}>Vipande vilivyoharibika</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Quick Action Matrix */}
      <Text style={styles.sectionHeading}>VITENDO VYA SAKAFU YA KIWANDA</Text>
      <View style={styles.actionGrid}>
        {/* 1. Log Output */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.emerald }]}
          onPress={() => setShowOutputModal(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <Zap size={22} color={colors.emerald} />
          </View>
          <Text style={styles.actionTitle}>Rekodi Uzalishaji</Text>
          <Text style={styles.actionSub}>Ongeza vipande vilivyozalishwa kwenye laini ya kazi.</Text>
          <View style={styles.actionBottom}>
            <Text style={[styles.actionLink, { color: colors.emerald }]}>Rekodi Sasa</Text>
            <Plus size={16} color={colors.emerald} />
          </View>
        </TouchableOpacity>

        {/* 2. Log Downtime */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.red }]}
          onPress={() => onNavigate("DowntimeLog")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
            <AlertTriangle size={22} color={colors.red} />
          </View>
          <Text style={styles.actionTitle}>Ripoti Stoppage</Text>
          <Text style={styles.actionSub}>Kukatika kwa mashine, ukosefu wa vifaa au umeme.</Text>
          <View style={styles.actionBottom}>
            <Text style={[styles.actionLink, { color: colors.red }]}>Ripoti Hitilafu</Text>
            <ArrowRight size={16} color={colors.red} />
          </View>
        </TouchableOpacity>

        {/* 3. Log Scrap */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.amber }]}
          onPress={() => onNavigate("ScrapLog")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <Recycle size={22} color={colors.amber} />
          </View>
          <Text style={styles.actionTitle}>Ripoti Scrap & Upotevu</Text>
          <Text style={styles.actionSub}>Vipande vilivyokataliwa, lebo mbovu na uzito pungufu.</Text>
          <View style={styles.actionBottom}>
            <Text style={[styles.actionLink, { color: colors.amber }]}>Rekodi Mabaki</Text>
            <ArrowRight size={16} color={colors.amber} />
          </View>
        </TouchableOpacity>

        {/* 4. Active Production Orders */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.blue }]}
          onPress={() => onNavigate("ProductionOrders")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
            <ClipboardList size={22} color={colors.blue} />
          </View>
          <Text style={styles.actionTitle}>Maagizo ya Kazi (POs)</Text>
          <Text style={styles.actionSub}>Tazama batches zilizopangwa na maendeleo ya utengenezaji.</Text>
          <View style={styles.actionBottom}>
            <Text style={[styles.actionLink, { color: colors.blue }]}>Fungua Orodha</Text>
            <ArrowRight size={16} color={colors.blue} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Machine Pre-Shift Safety Walkaround Banner */}
      <TouchableOpacity
        style={styles.safetyBanner}
        onPress={() => onNavigate("PlantMachineCheck")}
        activeOpacity={0.85}
      >
        <View style={styles.safetyIconBox}>
          <ShieldCheck size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.safetyTitle}>Ukaguzi wa Usalama wa Mashine (Pre-Shift)</Text>
          <Text style={styles.safetySub}>
            Kagua emergency stops, walinzi wa mashine, mafuta ya kulainisha na uvujaji kabla ya kuwasha.
          </Text>
        </View>
        <ArrowRight size={18} color={colors.primary} />
      </TouchableOpacity>

      {/* Modal: Quick Record Output */}
      <Modal visible={showOutputModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(16, 185, 129, 0.2)" }]}>
                <Zap size={22} color={colors.emerald} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Rekodi Uzalishaji wa Laini</Text>
                <Text style={styles.modalSub}>{kpis?.productionLine || "Line 1"}</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Idadi ya Vipande Vilivyotengenezwa (Pieces)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={outputUnits}
              onChangeText={setOutputUnits}
              placeholder="mf. 500"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.quickPresetRow}>
              {["100", "250", "500", "1000", "2500"].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBtn,
                    outputUnits === preset && { borderColor: colors.emerald, backgroundColor: "rgba(16, 185, 129, 0.2)" },
                  ]}
                  onPress={() => setOutputUnits(preset)}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      outputUnits === preset && { color: colors.emerald, fontWeight: "700" },
                    ]}
                  >
                    +{preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowOutputModal(false)}
                disabled={submittingOutput}
              >
                <Text style={styles.modalCancelBtnText}>Ghairi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleRecordOutput}
                disabled={submittingOutput}
              >
                {submittingOutput ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Hifadhi Uzalishaji</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  factoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  factoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.emerald,
  },
  livePulse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.emerald,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  lineContainer: {
    marginTop: spacing.sm,
  },
  lineLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  lineScroll: {
    flexDirection: "row",
  },
  lineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    marginRight: 6,
  },
  lineChipActive: {
    borderColor: colors.emerald,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  lineChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  lineChipTextActive: {
    color: colors.emerald,
    fontWeight: "800",
  },
  mainAttainmentCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: "rgba(16, 185, 129, 0.3)",
    backgroundColor: colors.card,
  },
  attainmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  attainmentNumbers: {
    fontSize: 24,
    marginTop: 4,
  },
  attainmentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  attainmentPillText: {
    fontSize: 14,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.cardSecondary,
    borderRadius: 4,
    marginVertical: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  subKpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
  },
  subKpiItem: {
    flex: 1,
    alignItems: "center",
  },
  subKpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  subKpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  subKpiValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  subKpiSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  subKpiDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  actionGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  actionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  actionBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionLink: {
    fontSize: 12,
    fontWeight: "700",
  },
  safetyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  safetyIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  safetySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalContent: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: colors.cardSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  quickPresetRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.lg,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
  },
  presetBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelBtnText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: colors.emerald,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
  },
  modalSubmitBtnText: {
    color: "#FFF",
    fontWeight: "800",
  },
});
