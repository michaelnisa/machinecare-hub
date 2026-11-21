import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import { Wrench, Plus, QrCode, Search, Clock, AlertTriangle, ChevronRight } from "lucide-react-native";

interface JobCardsListScreenProps {
  onOpenDetail: (woId: string) => void;
  onNavigate: (screen: string) => void;
}

export const JobCardsListScreen: React.FC<JobCardsListScreenProps> = ({ onOpenDetail, onNavigate }) => {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobCards = async () => {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id,
          wo_number,
          wo_year,
          title,
          status,
          priority,
          proposed_remedy,
          created_at,
          machine_id,
          machines:machine_id (id, name, plate_number, vehicle_code)
        `)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!error && data) {
        setWorkOrders(data);
      }
    } catch (e) {
      console.warn("Failed to load job cards:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobCards();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobCards();
  };

  const filtered = workOrders.filter((w) => {
    if (filter !== "all" && w.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const truck = w.machines?.plate_number || w.machines?.name || "";
    return (
      w.title?.toLowerCase().includes(q) ||
      truck.toLowerCase().includes(q) ||
      String(w.wo_number).includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Top Action Dock */}
      <View style={styles.topDock}>
        <TouchableOpacity
          style={styles.dockBtnPrimary}
          onPress={() => onNavigate("ReportDefect")}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.dockBtnPrimaryText}>New Defect Intake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtnOutline}
          onPress={() => onNavigate("VehicleQrLookup")}
          activeOpacity={0.8}
        >
          <QrCode size={16} color={colors.primary} />
          <Text style={styles.dockBtnOutlineText}>Scan Truck QR</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Status Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search WO#, truck plate, defect..."
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterRow}>
          {["all", "open", "in_progress", "waiting_parts", "completed"].map((st) => (
            <TouchableOpacity
              key={st}
              style={[
                styles.filterPill,
                filter === st && styles.filterPillActive,
              ]}
              onPress={() => setFilter(st)}
            >
              <Text style={[styles.filterPillText, filter === st && styles.filterPillTextActive]}>
                {st.replace("_", " ").toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Wrench size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Hakuna Job Cards</Text>
            <Text style={styles.emptySub}>Hakuna kazi zinazofanana na kigezo ulichochagua.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const truckLabel = item.machines?.plate_number || item.machines?.name || "Vehicle";
          const woCode = item.wo_number ? `WO-${item.wo_year || 2026}-${String(item.wo_number).padStart(3, "0")}` : "WO";

          return (
            <TouchableOpacity
              onPress={() => onOpenDetail(item.id)}
              activeOpacity={0.8}
            >
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.woBadge}>
                    <Text style={styles.woText}>{woCode}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardTruck}>Gari: {truckLabel}</Text>

                {item.proposed_remedy ? (
                  <Text style={styles.remedyText} numberOfLines={2}>
                    Matengenezo: {item.proposed_remedy}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.priorityBox}>
                    <AlertTriangle size={12} color={item.priority === "urgent" ? colors.rose : colors.amber} />
                    <Text style={[styles.priorityText, { color: item.priority === "urgent" ? colors.rose : colors.amber }]}>
                      {(item.priority || "standard").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardAction}>
                    <Text style={styles.cardActionText}>Fungua Job Card</Text>
                    <ChevronRight size={14} color={colors.blue} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
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
  topDock: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.cardSecondary,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  dockBtnPrimary: {
    flex: 1,
    backgroundColor: colors.blue,
    height: 42,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
  },
  dockBtnPrimaryText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
  dockBtnOutline: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    height: 42,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
  },
  dockBtnOutlineText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  filterSection: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: colors.blue,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  woBadge: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  woText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
    fontFamily: "monospace",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  cardTruck: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  remedyText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  priorityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  cardActionText: {
    fontSize: 11,
    color: colors.blue,
    fontWeight: "700",
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
