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
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  ArrowLeft,
  Search,
  QrCode,
  Truck,
  Wrench,
  AlertTriangle,
  Radio,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react-native";

import { parseVehicleQrOrInput } from "../../utils/qrParser";

interface VehicleQrLookupScreenProps {
  onBack: () => void;
  onOpenJobCard?: (woId: string) => void;
  onReportDefect?: (vehicleId: string, plate: string) => void;
}

export const VehicleQrLookupScreen: React.FC<VehicleQrLookupScreenProps> = ({
  onBack,
  onOpenJobCard,
  onReportDefect,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [faults, setFaults] = useState<any[]>([]);

  const handleSearch = async (termToSearch?: string) => {
    const raw = termToSearch || searchTerm;
    const parsed = parseVehicleQrOrInput(raw);
    if (!parsed.value) {
      Alert.alert("Ingiza Nambari", "Tafadhali ingiza namba ya gari, QR code au chassis number.");
      return;
    }

    try {
      setLoading(true);
      setVehicle(null);
      setWorkOrders([]);
      setFaults([]);

      // 1. Fetch Machine
      let query = supabase
        .from("machines")
        .select(`
          id,
          organisation_id,
          name,
          plate_number,
          registration_number,
          serial_number,
          vin,
          make,
          model,
          year,
          category,
          status,
          current_odometer_km,
          trailer_plate,
          trailer_make_model,
          telematics_imei,
          telematics_ignition,
          telematics_battery_volt,
          telematics_last_at,
          telematics_speed
        `);

      if (parsed.type === "uuid") {
        query = query.eq("id", parsed.value);
      } else {
        const q = parsed.value.toUpperCase();
        query = query.or(`plate_number.ilike.%${q}%,name.ilike.%${q}%,registration_number.ilike.%${q}%,serial_number.ilike.%${q}%,vin.ilike.%${q}%`);
      }

      const { data: machineData, error: machineErr } = await query
        .limit(1)
        .maybeSingle();

      if (machineErr) throw machineErr;

      if (!machineData) {
        Alert.alert("Gari Halikupatikana", `Hakuna gari linalolingana na "${q}". Jaribu plate nyingine.`);
        return;
      }

      setVehicle(machineData);

      // 2. Fetch Recent Work Orders
      const { data: woData } = await supabase
        .from("work_orders")
        .select("id, wo_number, wo_year, title, status, priority, created_at")
        .eq("machine_id", machineData.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (woData) setWorkOrders(woData);

      // 3. Fetch Recent Fault Reports
      const { data: faultData } = await supabase
        .from("fault_reports")
        .select("id, description, severity, status, reporter_name, created_at")
        .eq("machine_id", machineData.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (faultData) setFaults(faultData);
    } catch (err: any) {
      Alert.alert("Hitilafu", err.message || "Failed to search vehicle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle QR & Service Lookup</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Scan QR or enter Plate (e.g. T 428 DXY)..."
            placeholderTextColor={colors.textDim}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="characters"
            onSubmitEditing={() => handleSearch()}
          />
          <TouchableOpacity
            style={styles.searchActionBtn}
            onPress={() => handleSearch()}
            activeOpacity={0.8}
          >
            <Text style={styles.searchActionText}>Tafuta</Text>
          </TouchableOpacity>
        </View>

        {/* Quick plate presets */}
        <View style={styles.presetRow}>
          <Text style={styles.presetLabel}>Quick Scan:</Text>
          {["T 428 DXY", "T 192 ERT", "T 884 EBA"].map((p) => (
            <TouchableOpacity
              key={p}
              style={styles.presetChip}
              onPress={() => {
                setSearchTerm(p);
                handleSearch(p);
              }}
            >
              <Text style={styles.presetChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Inachakata kumbukumbu za gari na karakana...</Text>
        </View>
      ) : !vehicle ? (
        <View style={styles.idleBox}>
          <QrCode size={56} color={colors.textMuted} />
          <Text style={styles.idleTitle}>Changanua QR au Andika Namba</Text>
          <Text style={styles.idleSub}>
            Weka namba ya gari au scan QR iliyopo kwenye kioo cha mbele au mlango wa dereva kuona historia kamili ya matengenezo.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Machine Profile Card */}
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.truckIconWrapper}>
                <Truck size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.plateHeading}>{vehicle.plate_number || vehicle.name}</Text>
                <Text style={styles.makeModel}>
                  {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")}
                </Text>
              </View>
              <StatusBadge status={vehicle.status || "available"} />
            </View>

            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Odometer</Text>
                <Text style={styles.specValue}>
                  {vehicle.current_odometer_km ? `${vehicle.current_odometer_km.toLocaleString()} km` : "N/A"}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Chassis / VIN</Text>
                <Text style={styles.specValue} numberOfLines={1}>
                  {vehicle.vin || vehicle.serial_number || "N/A"}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Aina ya Gari</Text>
                <Text style={styles.specValue}>{vehicle.category || "Heavy Commercial"}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Linked Trailer</Text>
                <Text style={[styles.specValue, { color: vehicle.trailer_plate ? colors.amber : colors.textMuted }]}>
                  {vehicle.trailer_plate || "Hakuna Trailer"}
                </Text>
              </View>
            </View>
          </Card>

          {/* Telematics / GPS Strip */}
          <Card style={styles.telematicsCard}>
            <View style={styles.telematicsHeader}>
              <View style={styles.telematicsTitleRow}>
                <Radio size={16} color={colors.emerald} />
                <Text style={styles.telematicsTitle}>GPS Telematics Live Telemetry</Text>
              </View>
              <Text style={styles.imeiText}>IMEI: {vehicle.telematics_imei || "Not Paired"}</Text>
            </View>

            <View style={styles.telematicsStatsRow}>
              <View style={styles.telematicsStat}>
                <Text style={styles.statLabel}>Ignition</Text>
                <Text style={[styles.statValue, { color: vehicle.telematics_ignition ? colors.emerald : colors.rose }]}>
                  {vehicle.telematics_ignition ? "ON (Mawasiliano)" : "OFF (Kimezimwa)"}
                </Text>
              </View>

              <View style={styles.telematicsStat}>
                <Text style={styles.statLabel}>Battery Volt</Text>
                <Text style={styles.statValue}>
                  {vehicle.telematics_battery_volt ? `${vehicle.telematics_battery_volt} V` : "24.2 V"}
                </Text>
              </View>

              <View style={styles.telematicsStat}>
                <Text style={styles.statLabel}>Kasi</Text>
                <Text style={styles.statValue}>
                  {vehicle.telematics_speed ? `${vehicle.telematics_speed} km/h` : "0 km/h"}
                </Text>
              </View>
            </View>
          </Card>

          {/* Action Dock: Defect intake */}
          <TouchableOpacity
            style={styles.intakeBtn}
            onPress={() => onReportDefect?.(vehicle.id, vehicle.plate_number || vehicle.name)}
            activeOpacity={0.8}
          >
            <ShieldAlert size={18} color="#FFF" />
            <Text style={styles.intakeBtnText}>Sajili Hitilafu Mpya kwa Gari Hili</Text>
          </TouchableOpacity>

          {/* Active Job Cards */}
          <View style={styles.sectionTitleRow}>
            <Wrench size={16} color={colors.blue} />
            <Text style={styles.sectionTitle}>Historia ya Job Cards ({workOrders.length})</Text>
          </View>

          {workOrders.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Hakuna Job Card yoyote iliyofunguliwa kwa sasa.</Text>
            </Card>
          ) : (
            workOrders.map((wo) => (
              <TouchableOpacity
                key={wo.id}
                onPress={() => onOpenJobCard?.(wo.id)}
                activeOpacity={0.8}
              >
                <Card style={styles.woRowCard}>
                  <View style={styles.woRowHeader}>
                    <Text style={styles.woRowNumber}>
                      {wo.wo_number ? `WO-${wo.wo_year || 2026}-${String(wo.wo_number).padStart(3, "0")}` : "WO"}
                    </Text>
                    <StatusBadge status={wo.status} />
                  </View>
                  <Text style={styles.woRowTitle}>{wo.title}</Text>
                  <View style={styles.woRowFooter}>
                    <View style={styles.woRowTime}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={styles.woRowDate}>
                        {new Date(wo.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}

          {/* Fault Reports */}
          <View style={[styles.sectionTitleRow, { marginTop: spacing.md }]}>
            <AlertTriangle size={16} color={colors.amber} />
            <Text style={styles.sectionTitle}>Hitilafu Zilizoripotiwa na Dereva ({faults.length})</Text>
          </View>

          {faults.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Hakuna hitilafu iliyoripotiwa barabarani.</Text>
            </Card>
          ) : (
            faults.map((f) => (
              <Card key={f.id} style={styles.faultCard}>
                <View style={styles.faultCardHeader}>
                  <Text style={styles.faultSeverity}>
                    {f.severity ? f.severity.toUpperCase() : "STANDARD"}
                  </Text>
                  <Text style={styles.faultStatus}>{f.status || "NEW"}</Text>
                </View>
                <Text style={styles.faultDesc}>{f.description}</Text>
                <Text style={styles.faultReporter}>
                  Mripoti: {f.reporter_name || "Dereva"} • {new Date(f.created_at).toLocaleDateString()}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}
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
  searchSection: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    paddingVertical: 9,
  },
  searchActionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  searchActionText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 12,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  presetLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  presetChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  idleBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  idleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  idleSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  truckIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  plateHeading: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    fontFamily: "monospace",
  },
  makeModel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  specItem: {
    width: "48%",
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  specLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  specValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  telematicsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  telematicsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  telematicsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  telematicsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  imeiText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: "monospace",
  },
  telematicsStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  telematicsStat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  intakeBtn: {
    backgroundColor: colors.rose,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  intakeBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  emptyCardText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  woRowCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: 4,
  },
  woRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  woRowNumber: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: "monospace",
  },
  woRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  woRowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  woRowTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  woRowDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  faultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: 4,
  },
  faultCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faultSeverity: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.amber,
  },
  faultStatus: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  faultDesc: {
    fontSize: 13,
    color: colors.text,
  },
  faultReporter: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
