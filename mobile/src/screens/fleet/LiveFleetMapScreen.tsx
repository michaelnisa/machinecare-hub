import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  Truck,
  Search,
  Radio,
  Zap,
  Navigation,
  Fuel,
  Compass,
  MapPin,
  Clock,
  RotateCw,
} from "lucide-react-native";

interface LiveFleetMapScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const LiveFleetMapScreen: React.FC<LiveFleetMapScreenProps> = ({ onNavigate }) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "moving" | "idle" | "stopped">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFleet = async () => {
    try {
      const { data, error } = await supabase
        .from("machines")
        .select(`
          id,
          name,
          plate_number,
          make,
          model,
          category,
          status,
          current_odometer_km,
          trailer_plate,
          telematics_imei,
          telematics_ignition,
          telematics_speed,
          telematics_battery_volt,
          telematics_latitude,
          telematics_longitude,
          telematics_last_at
        `)
        .order("plate_number", { ascending: true });

      if (!error && data) {
        setVehicles(data);
      }
    } catch (e) {
      console.warn("Failed to load live fleet:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFleet();
    // Auto refresh fleet every 30s
    const interval = setInterval(loadFleet, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadFleet();
  };

  const computeTelemetryState = (v: any): "moving" | "idle" | "stopped" => {
    const speed = v.telematics_speed || 0;
    const ignition = v.telematics_ignition;
    if (speed > 3) return "moving";
    if (ignition) return "idle";
    return "stopped";
  };

  // Metrics
  const totalCount = vehicles.length;
  const movingCount = vehicles.filter((v) => computeTelemetryState(v) === "moving").length;
  const idleCount = vehicles.filter((v) => computeTelemetryState(v) === "idle").length;
  const stoppedCount = vehicles.filter((v) => computeTelemetryState(v) === "stopped").length;

  const filtered = vehicles.filter((v) => {
    const state = computeTelemetryState(v);
    if (filter !== "all" && state !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const plate = v.plate_number || v.name || "";
    return plate.toLowerCase().includes(q) || v.telematics_imei?.includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Top Quick Action Dock */}
      <View style={styles.topActionDock}>
        <TouchableOpacity
          style={styles.dockBtnPrimary}
          onPress={() => onNavigate("ActiveTrips")}
          activeOpacity={0.8}
        >
          <Compass size={16} color="#FFF" />
          <Text style={styles.dockBtnPrimaryText}>Active Highway Trips</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtnOutline}
          onPress={() => onNavigate("QuickFuelLog")}
          activeOpacity={0.8}
        >
          <Fuel size={16} color={colors.amber} />
          <Text style={styles.dockBtnOutlineText}>Quick Fuel Log</Text>
        </TouchableOpacity>
      </View>

      {/* Fleet KPI Telemetry Counters */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiValue}>{totalCount}</Text>
          <Text style={styles.kpiLabel}>Fleet Trucks</Text>
        </View>

        <View style={styles.kpiBox}>
          <Text style={[styles.kpiValue, { color: colors.emerald }]}>{movingCount}</Text>
          <Text style={styles.kpiLabel}>Moving</Text>
        </View>

        <View style={styles.kpiBox}>
          <Text style={[styles.kpiValue, { color: colors.amber }]}>{idleCount}</Text>
          <Text style={styles.kpiLabel}>Idle / Yard</Text>
        </View>

        <View style={styles.kpiBox}>
          <Text style={[styles.kpiValue, { color: colors.rose }]}>{stoppedCount}</Text>
          <Text style={styles.kpiLabel}>Stopped</Text>
        </View>
      </View>

      {/* Search & Status Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search truck plate, IMEI..."
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
            <RotateCw size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <View style={styles.chipRow}>
          {[
            { id: "all", label: `ALL (${totalCount})` },
            { id: "moving", label: `MOVING (${movingCount})` },
            { id: "idle", label: `IDLE (${idleCount})` },
            { id: "stopped", label: `STOPPED (${stoppedCount})` },
          ].map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, filter === c.id && styles.chipActive]}
              onPress={() => setFilter(c.id as any)}
            >
              <Text style={[styles.chipText, filter === c.id && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Vehicle List */}
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => {
          const state = computeTelemetryState(item);
          const speed = item.telematics_speed || 0;
          const plate = item.plate_number || item.name;

          return (
            <Card style={styles.vehicleCard}>
              <View style={styles.cardHeader}>
                <View style={styles.plateRow}>
                  <Truck size={18} color={colors.primary} />
                  <Text style={styles.plateText}>{plate}</Text>
                </View>
                <StatusBadge status={state === "moving" ? "running" : state === "idle" ? "idle" : "stopped"} />
              </View>

              <Text style={styles.modelSub}>
                {[item.make, item.model].filter(Boolean).join(" ")}
                {item.trailer_plate ? ` • Trailer: ${item.trailer_plate}` : ""}
              </Text>

              {/* Telemetry Metrics Row */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Speed</Text>
                  <Text style={[styles.metricValue, { color: speed > 0 ? colors.emerald : colors.text }]}>
                    {speed} km/h
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Ignition</Text>
                  <Text style={[styles.metricValue, { color: item.telematics_ignition ? colors.emerald : colors.rose }]}>
                    {item.telematics_ignition ? "ON" : "OFF"}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Odometer</Text>
                  <Text style={styles.metricValue}>
                    {item.current_odometer_km ? `${item.current_odometer_km.toLocaleString()} km` : "N/A"}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Battery</Text>
                  <Text style={styles.metricValue}>
                    {item.telematics_battery_volt ? `${item.telematics_battery_volt} V` : "24 V"}
                  </Text>
                </View>
              </View>

              {/* GPS Coordinates & Last ping */}
              <View style={styles.cardFooter}>
                <View style={styles.gpsRow}>
                  <MapPin size={12} color={colors.textMuted} />
                  <Text style={styles.gpsText}>
                    {item.telematics_latitude && item.telematics_longitude
                      ? `${item.telematics_latitude.toFixed(4)}, ${item.telematics_longitude.toFixed(4)}`
                      : "GPS Lock Acquired"}
                  </Text>
                </View>

                <View style={styles.gpsRow}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={styles.gpsText}>
                    {item.telematics_last_at
                      ? new Date(item.telematics_last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Just now"}
                  </Text>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topActionDock: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  dockBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  dockBtnPrimaryText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 12,
  },
  dockBtnOutline: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.amber,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  dockBtnOutlineText: {
    color: colors.amber,
    fontWeight: "800",
    fontSize: 12,
  },
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },
  kpiLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 1,
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
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary + "22",
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  plateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  plateText: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
    fontFamily: "monospace",
  },
  modelSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gpsText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
