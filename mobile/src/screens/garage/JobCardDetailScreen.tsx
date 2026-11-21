import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  ArrowLeft,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Plus,
  Trash2,
  Save,
  Truck,
  Check,
} from "lucide-react-native";

interface JobCardDetailScreenProps {
  woId: string;
  onBack: () => void;
}

interface PartRequisition {
  id: string;
  partName: string;
  quantity: string;
  unitCost: string;
}

export const JobCardDetailScreen: React.FC<JobCardDetailScreenProps> = ({ woId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wo, setWo] = useState<any>(null);

  // Editable fields
  const [status, setStatus] = useState<string>("in_progress");
  const [actualWorkDone, setActualWorkDone] = useState("");
  const [technicianComment, setTechnicianComment] = useState("");
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([
    { id: "1", text: "Physical mechanical diagnostic & fault isolation", done: false },
    { id: "2", text: "Dismount worn assembly and inspect adjacent linkages", done: false },
    { id: "3", text: "Install replacement parts & torque to OEM spec", done: false },
    { id: "4", text: "Fluids check (Engine Oil / Coolant / Transmission)", done: false },
    { id: "5", text: "Yard static and road test run", done: false },
  ]);

  // Parts list
  const [parts, setParts] = useState<PartRequisition[]>([]);
  const [newPartName, setNewPartName] = useState("");
  const [newPartQty, setNewPartQty] = useState("1");
  const [newPartCost, setNewPartCost] = useState("");

  const loadDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id,
          wo_number,
          wo_year,
          title,
          status,
          priority,
          nature_of_problem,
          proposed_remedy,
          actual_work_done,
          technician_comment,
          created_at,
          started_at,
          completed_at,
          machine_id,
          machines:machine_id (
            id,
            name,
            plate_number,
            make,
            model,
            current_odometer_km,
            trailer_plate
          )
        `)
        .eq("id", woId)
        .single();

      if (!error && data) {
        setWo(data);
        setStatus(data.status || "in_progress");
        setActualWorkDone(data.actual_work_done || "");
        setTechnicianComment(data.technician_comment || "");
      }
    } catch (e) {
      console.warn("Failed to load work order detail:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [woId]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleAddPart = () => {
    if (!newPartName.trim()) {
      Alert.alert("Missing Part", "Ingiza jina la spare part kwanza.");
      return;
    }
    const newEntry: PartRequisition = {
      id: Date.now().toString(),
      partName: newPartName.trim(),
      quantity: newPartQty.trim() || "1",
      unitCost: newPartCost.trim() || "0",
    };
    setParts((prev) => [...prev, newEntry]);
    setNewPartName("");
    setNewPartQty("1");
    setNewPartCost("");
  };

  const removePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async (targetStatus?: string) => {
    try {
      setSaving(true);
      const nextStatus = targetStatus || status;

      const updatePayload: any = {
        status: nextStatus,
        actual_work_done: actualWorkDone,
        technician_comment: technicianComment,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "in_progress" && !wo?.started_at) {
        updatePayload.started_at = new Date().toISOString();
      }
      if (nextStatus === "completed") {
        updatePayload.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("work_orders")
        .update(updatePayload)
        .eq("id", woId);

      if (error) throw error;

      setStatus(nextStatus);
      Alert.alert(
        "Kazi Imehifadhiwa!",
        nextStatus === "completed"
          ? "Job card imekamilika na gari iko tayari kurudi barabarani."
          : "Mabadiliko ya kazi yamehifadhiwa vyema."
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update job card.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Inapakua taarifa za Job Card...</Text>
      </View>
    );
  }

  if (!wo) {
    return (
      <View style={styles.centerContainer}>
        <AlertTriangle size={48} color={colors.rose} />
        <Text style={styles.errorTitle}>Job Card Haikupatikana</Text>
        <TouchableOpacity style={styles.backBtnAlt} onPress={onBack}>
          <Text style={styles.backBtnText}>Rudi kwenye Orodha</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const truck = wo.machines;
  const woNumber = wo.wo_number
    ? `WO-${wo.wo_year || 2026}-${String(wo.wo_number).padStart(3, "0")}`
    : "JOB CARD";

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navTitleBox}>
          <Text style={styles.navCode}>{woNumber}</Text>
          <Text style={styles.navSub} numberOfLines={1}>{wo.title}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle Identity Card */}
        <Card style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleIconBox}>
              <Truck size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehiclePlate}>{truck?.plate_number || "NO PLATE"}</Text>
              <Text style={styles.vehicleSub}>
                {truck?.make || ""} {truck?.model || ""} • ODO: {truck?.current_odometer_km?.toLocaleString() || "0"} km
              </Text>
              {truck?.trailer_plate ? (
                <Text style={styles.trailerText}>Linked Trailer: {truck.trailer_plate}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Quick Status Action Bar */}
        <Text style={styles.sectionHeading}>HALI YA SASA YA KAZI</Text>
        <View style={styles.statusButtonsRow}>
          <TouchableOpacity
            style={[
              styles.statusOptionBtn,
              status === "in_progress" && styles.statusOptionActiveProgress,
            ]}
            onPress={() => handleSave("in_progress")}
          >
            <Clock size={16} color={status === "in_progress" ? "#FFF" : colors.blue} />
            <Text
              style={[
                styles.statusOptionText,
                status === "in_progress" && styles.statusOptionTextActive,
              ]}
            >
              In Progress
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusOptionBtn,
              status === "waiting_parts" && styles.statusOptionActiveWait,
            ]}
            onPress={() => handleSave("waiting_parts")}
          >
            <Package size={16} color={status === "waiting_parts" ? "#FFF" : colors.amber} />
            <Text
              style={[
                styles.statusOptionText,
                status === "waiting_parts" && styles.statusOptionTextActive,
              ]}
            >
              Waiting Parts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusOptionBtn,
              status === "completed" && styles.statusOptionActiveDone,
            ]}
            onPress={() => handleSave("completed")}
          >
            <CheckCircle2 size={16} color={status === "completed" ? "#FFF" : colors.emerald} />
            <Text
              style={[
                styles.statusOptionText,
                status === "completed" && styles.statusOptionTextActive,
              ]}
            >
              Complete
            </Text>
          </TouchableOpacity>
        </View>

        {/* Diagnostic & Defect Description */}
        <Card style={styles.cardSection}>
          <Text style={styles.cardHeaderTitle}>Tatizo Lililoripotiwa</Text>
          <Text style={styles.issueText}>
            {wo.nature_of_problem || wo.title || "No description logged"}
          </Text>

          {wo.proposed_remedy ? (
            <View style={styles.remedyCallout}>
              <Text style={styles.remedyLabel}>Mapendekezo ya Uhandisi:</Text>
              <Text style={styles.remedyBody}>{wo.proposed_remedy}</Text>
            </View>
          ) : null}
        </Card>

        {/* Mechanic Task Checklist */}
        <Card style={styles.cardSection}>
          <Text style={styles.cardHeaderTitle}>Orodha ya Hatua za Matengenezo</Text>
          <View style={styles.taskList}>
            {tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => toggleTask(task.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    task.done && styles.checkboxDone,
                  ]}
                >
                  {task.done && <Check size={14} color="#FFF" />}
                </View>
                <Text
                  style={[
                    styles.taskText,
                    task.done && styles.taskTextDone,
                  ]}
                >
                  {task.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Spare Parts Requisition */}
        <Card style={styles.cardSection}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardHeaderTitle}>Vipuri Vilivyotumika (Spare Parts)</Text>
            <Package size={18} color={colors.primary} />
          </View>

          {parts.map((p) => (
            <View key={p.id} style={styles.partItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.partName}>{p.partName}</Text>
                <Text style={styles.partQty}>
                  Qty: {p.quantity} • {p.unitCost ? `TZS ${Number(p.unitCost).toLocaleString()}` : "N/A"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removePart(p.id)}>
                <Trash2 size={16} color={colors.rose} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Quick Add Part */}
          <View style={styles.addPartForm}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Jina la pua / pisi (mf. Brake Pads)"
              placeholderTextColor={colors.textDim}
              value={newPartName}
              onChangeText={setNewPartName}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Qty"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={newPartQty}
              onChangeText={setNewPartQty}
            />
          </View>
          <View style={styles.addPartFormSecond}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Bei ya kipande (TZS - hiari)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={newPartCost}
              onChangeText={setNewPartCost}
            />
            <TouchableOpacity style={styles.addPartBtn} onPress={handleAddPart}>
              <Plus size={16} color="#FFF" />
              <Text style={styles.addPartBtnText}>Ongeza</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Work Done & Mechanic Comments */}
        <Card style={styles.cardSection}>
          <Text style={styles.cardHeaderTitle}>Maelezo ya Kazi Iliyofanyika</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Eleza matengenezo uliyofanya, vipuri ulivyobadili, au maoni..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={4}
            value={actualWorkDone}
            onChangeText={setActualWorkDone}
          />

          <Text style={[styles.cardHeaderTitle, { marginTop: spacing.md }]}>
            Maoni ya Fundi (Technician Notes)
          </Text>
          <TextInput
            style={[styles.textArea, { minHeight: 70 }]}
            placeholder="Mapendekezo ya safari ijayo au tahadhari kwa dereva..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            value={technicianComment}
            onChangeText={setTechnicianComment}
          />
        </Card>

        {/* Save Work Order Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => handleSave()}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Save size={18} color="#FFF" />
              <Text style={styles.saveBtnText}>Hifadhi Taarifa za Kazi</Text>
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
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  backBtnAlt: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  backBtnText: {
    color: "#FFF",
    fontWeight: "700",
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  navTitleBox: {
    flex: 1,
  },
  navCode: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    fontFamily: "monospace",
  },
  navSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  vehicleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    fontFamily: "monospace",
  },
  vehicleSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  trailerText: {
    fontSize: 12,
    color: colors.amber,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  statusButtonsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  statusOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  statusOptionActiveProgress: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  statusOptionActiveWait: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  statusOptionActiveDone: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  statusOptionTextActive: {
    color: "#FFF",
  },
  cardSection: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  issueText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  remedyCallout: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginTop: spacing.xs,
  },
  remedyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 2,
  },
  remedyBody: {
    fontSize: 13,
    color: colors.textMuted,
  },
  taskList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  checkboxDone: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  taskText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  taskTextDone: {
    color: colors.textDim,
    textDecorationLine: "line-through",
  },
  partItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  partName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  partQty: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addPartForm: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addPartFormSecond: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },
  addPartBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  addPartBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 13,
    minHeight: 85,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  saveBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
