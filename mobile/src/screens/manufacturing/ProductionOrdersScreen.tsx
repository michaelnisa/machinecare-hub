import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  manufacturingService,
  ProductionOrderSummary,
} from "../../services/manufacturingService";
import {
  ArrowLeft,
  ClipboardList,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  Zap,
  TrendingUp,
} from "lucide-react-native";

interface ProductionOrdersScreenProps {
  onBack: () => void;
  onOpenOutput?: (poId: string) => void;
}

export const ProductionOrdersScreen: React.FC<ProductionOrdersScreenProps> = ({ onBack, onOpenOutput }) => {
  const { organisation } = useAuth();
  const [orders, setOrders] = useState<ProductionOrderSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "in_progress" | "released">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await manufacturingService.getActiveProductionOrders(organisation?.id);
      setOrders(data);
    } catch (e) {
      console.warn("Failed to load production orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [organisation?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    return o.status === filter;
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Maagizo ya Uzalishaji (POs)</Text>
          <Text style={styles.screenSub}>Batches na mipango ya viwandani</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "in_progress", "released"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === "all" ? "ZOTE (ALL)" : tab === "in_progress" ? "IN TRANSIT / PROGRESS" : "RELEASED"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 30 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ClipboardList size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Hakuna Maagizo</Text>
            <Text style={styles.emptySub}>Hakuna batches zilizopangwa kwa hali hii sasa hivi.</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const pct =
              item.quantityOrdered > 0
                ? Math.min(100, Math.round((item.quantityProduced / item.quantityOrdered) * 100))
                : 0;
            const isComplete = pct >= 100;

            return (
              <Card key={item.id} style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.poNumberPill}>
                    <Text style={styles.poNumberText}>{item.poNumber}</Text>
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      item.priority === "urgent" || item.priority === "high"
                        ? { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: colors.red }
                        : { backgroundColor: "rgba(59, 130, 246, 0.15)", borderColor: colors.blue },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: item.priority === "urgent" || item.priority === "high" ? colors.red : colors.blue },
                      ]}
                    >
                      {item.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.productName}>{item.product}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Layers size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{item.batchNumber || "BATCH-01"}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{item.productionLine || "Main Line"}</Text>
                  </View>
                  {item.dueDate && (
                    <View style={styles.metaItem}>
                      <Calendar size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>{item.dueDate}</Text>
                    </View>
                  )}
                </View>

                {/* Production Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressQty}>
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        {item.quantityProduced.toLocaleString()}
                      </Text>
                      <Text style={{ color: colors.textMuted }}> / {item.quantityOrdered.toLocaleString()} pcs</Text>
                    </Text>
                    <Text
                      style={[
                        styles.progressPercent,
                        { color: isComplete ? colors.emerald : colors.primary },
                      ]}
                    >
                      {pct}%
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: isComplete ? colors.emerald : colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Bottom Status / Action */}
                <View style={styles.cardFooter}>
                  <View style={styles.statusPill}>
                    {isComplete ? (
                      <CheckCircle2 size={14} color={colors.emerald} />
                    ) : (
                      <TrendingUp size={14} color={colors.blue} />
                    )}
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isComplete ? colors.emerald : colors.blue },
                      ]}
                    >
                      {isComplete ? "Tayari Imekamilika" : "Inaendelea Kuzalishwa"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      Alert.alert(
                        "Rekodi Uzalishaji",
                        `Ungependa kurekodi vipande vilivyozalishwa kwa ${item.product}?`
                      );
                    }}
                  >
                    <Zap size={13} color={colors.primary} />
                    <Text style={styles.actionBtnText}>Rekodi Output</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
  },
  filterTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.primary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  orderCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  poNumberPill: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  poNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    fontFamily: "monospace",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "800",
  },
  productName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  progressSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  progressQty: {
    fontSize: 13,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "800",
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.cardSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
