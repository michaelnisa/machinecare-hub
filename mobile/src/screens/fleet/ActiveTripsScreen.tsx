import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  ArrowLeft,
  Compass,
  Search,
  MapPin,
  Truck,
  Box,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react-native";

interface ActiveTripsScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string, params?: any) => void;
}

export const ActiveTripsScreen: React.FC<ActiveTripsScreenProps> = ({ onBack }) => {
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          origin,
          destination,
          start_at,
          end_at,
          status,
          cargo_description,
          client_name,
          client_order_no,
          start_odo,
          end_odo,
          cost,
          machine_id,
          machines:machine_id (
            id,
            name,
            plate_number,
            trailer_plate,
            current_odometer_km
          )
        `)
        .order("created_at", { ascending: false })
        .limit(25);

      if (!error && data) {
        setTrips(data);
      }
    } catch (e) {
      console.warn("Failed to load active trips:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const handleCompleteTrip = async (tripId: string) => {
    Alert.alert(
      "Kukamilisha Safari",
      "Je, una uhakika unataka kukamilisha safari hii na kufunga dispatch?",
      [
        { text: "Hapana", style: "cancel" },
        {
          text: "Ndio, Funga Safari",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("trips")
                .update({
                  status: "completed",
                  end_at: new Date().toISOString(),
                })
                .eq("id", tripId);

              if (error) throw error;
              Alert.alert("Hongera!", "Safari imekamilishwa na taarifa zimesasishwa.");
              loadTrips();
            } catch (err: any) {
              Alert.alert("Hitilafu", err.message || "Failed to complete trip.");
            }
          },
        },
      ]
    );
  };

  const filtered = trips.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const truck = t.machines?.plate_number || t.machines?.name || "";
    const route = `${t.origin || ""} ${t.destination || ""}`.toLowerCase();
    const client = (t.client_name || "").toLowerCase();
    return truck.toLowerCase().includes(q) || route.includes(q) || client.includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Highway Trips & Corridors</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trip corridor, truck plate, client..."
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Trip List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Compass size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Hakuna Safari Zinazoendelea</Text>
            <Text style={styles.emptySub}>
              Hakuna safari inayolingana na kigezo ulichotafuta.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const truck = item.machines;
          const plate = truck?.plate_number || truck?.name || "TRUCK";
          const isOngoing = item.status === "in_progress" || item.status === "active";

          return (
            <Card style={styles.tripCard}>
              {/* Corridor Route Header */}
              <View style={styles.corridorHeader}>
                <View style={styles.routeBox}>
                  <View style={styles.routePoint}>
                    <MapPin size={14} color={colors.primary} />
                    <Text style={styles.routeCity}>{item.origin || "Origin Yard"}</Text>
                  </View>
                  <Text style={styles.routeArrow}>➔</Text>
                  <View style={styles.routePoint}>
                    <MapPin size={14} color={colors.emerald} />
                    <Text style={styles.routeCity}>{item.destination || "Destination Depot"}</Text>
                  </View>
                </View>

                <StatusBadge status={item.status || "in_progress"} />
              </View>

              {/* Truck & Trailer Row */}
              <View style={styles.truckRow}>
                <View style={styles.truckIdentity}>
                  <Truck size={16} color={colors.blue} />
                  <Text style={styles.truckPlate}>{plate}</Text>
                  {truck?.trailer_plate ? (
                    <Text style={styles.trailerBadge}>Trailer: {truck.trailer_plate}</Text>
                  ) : null}
                </View>
              </View>

              {/* Cargo Details */}
              <View style={styles.cargoBox}>
                <Box size={14} color={colors.textMuted} />
                <Text style={styles.cargoText}>
                  {item.cargo_description || "Commercial Dry Cargo / Container"}
                </Text>
              </View>

              {item.client_name ? (
                <Text style={styles.clientText}>
                  Client: {item.client_name} {item.client_order_no ? `(#${item.client_order_no})` : ""}
                </Text>
              ) : null}

              {/* Stats Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.timeBox}>
                  <Calendar size={12} color={colors.textMuted} />
                  <Text style={styles.timeText}>
                    Started: {item.start_at ? new Date(item.start_at).toLocaleDateString() : "Today"}
                  </Text>
                </View>

                {isOngoing ? (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleCompleteTrip(item.id)}
                    activeOpacity={0.8}
                  >
                    <CheckCircle2 size={13} color="#FFF" />
                    <Text style={styles.completeBtnText}>Funga Safari</Text>
                  </TouchableOpacity>
                ) : null}
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
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  corridorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  routeArrow: {
    color: colors.textMuted,
    fontSize: 14,
  },
  truckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  truckIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  truckPlate: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    fontFamily: "monospace",
  },
  trailerBadge: {
    fontSize: 11,
    color: colors.amber,
    backgroundColor: colors.amber + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cargoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  cargoText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  clientText: {
    fontSize: 11,
    color: colors.blue,
    fontWeight: "600",
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
  timeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  completeBtn: {
    backgroundColor: colors.emerald,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  completeBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
