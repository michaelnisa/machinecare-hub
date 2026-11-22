import React, { useState, useEffect } from "react";
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
import { useOfflineSync } from "../../context/OfflineSyncContext";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  ArrowLeft,
  Fuel,
  Truck,
  Gauge,
  DollarSign,
  MapPin,
  CheckCircle2,
  FileText,
} from "lucide-react-native";

interface QuickFuelLogScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

const STATIONS = [
  "TotalEnergies",
  "Puma Energy",
  "Oryx Energies",
  "GBP Tanzania",
  "Lake Oil",
  "Internal Yard Dispenser",
];

export const QuickFuelLogScreen: React.FC<QuickFuelLogScreenProps> = ({ onBack, onSuccess }) => {
  const { queueReceipt } = useOfflineSync();
  const { user, organisation } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedPlate, setSelectedPlate] = useState("");
  const [fuelLitres, setFuelLitres] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [odometer, setOdometer] = useState("");
  const [station, setStation] = useState("TotalEnergies");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchPlate, setSearchPlate] = useState("");

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const { data } = await supabase
          .from("machines")
          .select("id, name, plate_number, current_odometer_km")
          .order("plate_number", { ascending: true })
          .limit(50);

        if (data && data.length > 0) {
          setVehicles(data);
          setSelectedVehicleId(data[0].id);
          setSelectedPlate(data[0].plate_number || data[0].name);
          if (data[0].current_odometer_km) {
            setOdometer(String(data[0].current_odometer_km));
          }
        }
      } catch (e) {
        console.warn("Failed to load machines:", e);
      }
    };
    fetchVehicles();
  }, []);

  const selectVehicle = (v: any) => {
    setSelectedVehicleId(v.id);
    setSelectedPlate(v.plate_number || v.name);
    if (v.current_odometer_km) {
      setOdometer(String(v.current_odometer_km));
    }
  };

  const handleSubmit = async () => {
    if (!selectedVehicleId) {
      Alert.alert("Chagua Gari", "Tafadhali chagua gari husika kwanza.");
      return;
    }
    if (!fuelLitres.trim() || Number(fuelLitres) <= 0) {
      Alert.alert("Ingiza Mafuta", "Tafadhali weka kiwango cha mafuta (Litres).");
      return;
    }
    if (!fuelCost.trim() || Number(fuelCost) <= 0) {
      Alert.alert("Gharama ya Mafuta", "Tafadhali weka jumla ya gharama (TZS).");
      return;
    }

    try {
      setSubmitting(true);
      const litresNum = parseFloat(fuelLitres);
      const costNum = parseFloat(fuelCost);
      const odoNum = odometer.trim() ? parseFloat(odometer) : null;

      const { error } = await supabase.from("fuel_logs").insert({
        machine_id: selectedVehicleId,
        fuel_litres: litresNum,
        fuel_cost: costNum,
        currency: "TZS",
        station: station,
        odometer: odoNum,
        notes: notes.trim() || `Fuel logged for ${selectedPlate}`,
        created_by: user?.id || null,
        recorded_at: new Date().toISOString(),
      });

      if (error) {
        await queueReceipt({
          id: `fuel-${Date.now()}`,
          tripId: "",
          vehicleId: selectedVehicleId,
          organisationId: organisation?.id,
          driverId: user?.id,
          title: `Fuel: ${station}`,
          category: "fuel",
          amount: costNum,
          currency: "TZS",
          notes: `${fuelLitres}L at ${station}. Odo: ${odometer || "N/A"}`,
          recordedAt: new Date().toISOString(),
        });
        Alert.alert("Imehifadhiwa Offline", "Taarifa za mafuta zimehifadhiwa na zitatumwa mtandao ukipatikana.");
      } else {
        // Also update machine odometer if greater
        if (odoNum) {
          await supabase
            .from("machines")
            .update({ current_odometer_km: odoNum })
            .eq("id", selectedVehicleId);
        }

        Alert.alert(
          "Mafuta Yamehifadhiwa!",
          `Lita ${litresNum} (TZS ${costNum.toLocaleString()}) zimesajiliwa kwa gari ${selectedPlate}.`
        );
      }

      onSuccess();
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to record fuel log.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchPlate.trim()) return true;
    const q = searchPlate.toLowerCase();
    return (v.plate_number || v.name).toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Fuel Log</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle Selection */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>CHAGUA GARI LILILOJAZWA</Text>
          <TextInput
            style={styles.plateFilterInput}
            placeholder="Search vehicle plate..."
            placeholderTextColor={colors.textDim}
            value={searchPlate}
            onChangeText={setSearchPlate}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
            {filteredVehicles.slice(0, 10).map((v) => {
              const p = v.plate_number || v.name;
              const isSelected = v.id === selectedVehicleId;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}
                  onPress={() => selectVehicle(v)}
                >
                  <Truck size={14} color={isSelected ? "#FFF" : colors.primary} />
                  <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* Litres and Cost */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>KIASI NA BEI YA MAFUTA (DIESEL)</Text>
          <View style={styles.inputRow}>
            <Fuel size={18} color={colors.amber} />
            <TextInput
              style={styles.textInput}
              placeholder="Kiasi cha Lita (mf. 350)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={fuelLitres}
              onChangeText={(text: string) => {
                setFuelLitres(text);
                // Estimate cost at approx 3,250 TZS/L if empty
                if (text && (!fuelCost || fuelCost === "0")) {
                  const est = Math.round(parseFloat(text) * 3250);
                  if (!isNaN(est)) setFuelCost(String(est));
                }
              }}
            />
            <Text style={styles.unitSuffix}>LITRES</Text>
          </View>

          <View style={styles.inputRow}>
            <DollarSign size={18} color={colors.emerald} />
            <TextInput
              style={styles.textInput}
              placeholder="Jumla ya Gharama (TZS)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={fuelCost}
              onChangeText={setFuelCost}
            />
            <Text style={styles.unitSuffix}>TZS</Text>
          </View>

          <View style={styles.inputRow}>
            <Gauge size={18} color={colors.blue} />
            <TextInput
              style={styles.textInput}
              placeholder="Odometer wakati wa kujaza (km)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={odometer}
              onChangeText={setOdometer}
            />
            <Text style={styles.unitSuffix}>KM</Text>
          </View>
        </Card>

        {/* Station Selection */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>KITUO CHA MAFUTA (STATION)</Text>
          <View style={styles.stationWrap}>
            {STATIONS.map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.stationPill, station === st && styles.stationPillActive]}
                onPress={() => setStation(st)}
              >
                <Text style={[styles.stationPillText, station === st && styles.stationPillTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>MAONI YA PUMP / RISITI</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Namba ya pampu, dereva aliyepokea, au kumbukumbu ya vocha..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </Card>

        {/* Submit */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <CheckCircle2 size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>Hifadhi Kumbukumbu ya Mafuta</Text>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  plateFilterInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 12,
  },
  vehicleScroll: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  vehicleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    marginRight: 6,
  },
  vehicleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  vehicleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "monospace",
  },
  vehicleChipTextActive: {
    color: "#FFF",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 9,
    fontWeight: "700",
  },
  unitSuffix: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
  },
  stationWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  stationPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stationPillActive: {
    backgroundColor: colors.primary + "22",
    borderColor: colors.primary,
  },
  stationPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  stationPillTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
