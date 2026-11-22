import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useOfflineSync } from "../../context/OfflineSyncContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { ArrowLeft, Check, X, ShieldCheck, AlertTriangle } from "lucide-react-native";

interface PreStartInspectionScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const PreStartInspectionScreen: React.FC<PreStartInspectionScreenProps> = ({ onBack, onSuccess }) => {
  const { driverVehicle, user, organisation } = useAuth();
  const { queueInspection } = useOfflineSync();

  const [tyresOk, setTyresOk] = useState(true);
  const [oilCoolantOk, setOilCoolantOk] = useState(true);
  const [brakesOk, setBrakesOk] = useState(true);
  const [lightsOk, setLightsOk] = useState(true);
  const [trailerLockOk, setTrailerLockOk] = useState(true);
  const [odometerKm, setOdometerKm] = useState(driverVehicle?.odometerKm ? String(driverVehicle.odometerKm) : "");
  const [defectNotes, setDefectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allPassed = tyresOk && oilCoolantOk && brakesOk && lightsOk && trailerLockOk;

  const handleSubmit = async () => {
    if (!driverVehicle) {
      Alert.alert("No Vehicle Coupled", "Please scan or couple a truck before submitting an inspection.");
      return;
    }

    setSubmitting(true);
    try {
      await queueInspection({
        id: "ins-" + Date.now(),
        vehicleId: driverVehicle.vehicleId,
        organisationId: driverVehicle.organisationId || organisation?.id || undefined,
        driverId: user?.id,
        inspectorName: user?.user_metadata?.full_name || "Commercial Driver",
        inspectorPhone: user?.phone || "0700000000",
        tyresOk,
        oilCoolantOk,
        brakesOk,
        lightsOk,
        trailerLockOk,
        defectNotes: defectNotes.trim() || undefined,
        odometerKm: Number(odometerKm) || 0,
        recordedAt: new Date().toISOString(),
      });

      if (allPassed) {
        Alert.alert(
          "Ukaguzi Umekamilika (Pass)",
          "Gari liko salama kwa safari. Safari njema!",
          [{ text: "OK", onPress: onSuccess }]
        );
      } else {
        Alert.alert(
          "Hitilafu Imeripotiwa (Defect Logged)",
          "Hitilafu imetumwa kwa karakana (workshop). Wasiliana na mkuu wa karakana kabla ya kuondoka.",
          [{ text: "OK", onPress: onSuccess }]
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  const checklistItems = [
    {
      id: "tyres",
      title: "1. Matairi & Upepo (Tyres & Pressure)",
      sub: "Kina cha tairi (≥3mm), upepo (110-120 PSI), na nati za gurudumu.",
      status: tyresOk,
      toggle: () => setTyresOk(!tyresOk),
    },
    {
      id: "oil",
      title: "2. Oil ya Injini & Maji (Engine Oil & Coolant)",
      sub: "Kiwango cha oil kiko kati ya MIN na MAX, hakuna kuvuja kwa maji.",
      status: oilCoolantOk,
      toggle: () => setOilCoolantOk(!oilCoolantOk),
    },
    {
      id: "brakes",
      title: "3. Breki za Upepo (Air Brake System)",
      sub: "Shinikizo la upepo (Air tanks 8+ Bar), hakuna uvujaji wa mirija.",
      status: brakesOk,
      toggle: () => setBrakesOk(!brakesOk),
    },
    {
      id: "lights",
      title: "4. Taa & Viakisi (Lights & Reflectors)",
      sub: "Taa zote za mbele, taa za breki, indicator, na stika za LATRA.",
      status: lightsOk,
      toggle: () => setLightsOk(!lightsOk),
    },
    {
      id: "trailer",
      title: "5. Pini ya Trela (Fifth Wheel & Locking Pin)",
      sub: "Trela limefungwa salama na pini ya usalama imekaa sawasawa.",
      status: trailerLockOk,
      toggle: () => setTrailerLockOk(!trailerLockOk),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pre-Trip Walkaround (60s)</Text>
      </View>

      {/* Target Vehicle Tag */}
      <View style={styles.vehicleStrip}>
        <ShieldCheck size={16} color={colors.primary} />
        <Text style={styles.vehicleStripText}>
          Ukaguzi wa: <Text style={{ fontWeight: "900", color: colors.text }}>{driverVehicle?.plateNumber || "Truck"}</Text>
        </Text>
      </View>

      {/* Checklist Cards */}
      <View style={styles.checklist}>
        {checklistItems.map((item) => (
          <Card key={item.id} style={styles.checkCard}>
            <View style={styles.checkCardLeft}>
              <Text style={styles.checkTitle}>{item.title}</Text>
              <Text style={styles.checkSub}>{item.sub}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                item.status
                  ? { backgroundColor: colors.primarySoft, borderColor: colors.primary }
                  : { backgroundColor: colors.roseSoft, borderColor: colors.rose },
              ]}
              onPress={item.toggle}
              activeOpacity={0.8}
            >
              {item.status ? (
                <>
                  <Check size={16} color={colors.primary} />
                  <Text style={[styles.toggleText, { color: colors.primary }]}>PASS</Text>
                </>
              ) : (
                <>
                  <X size={16} color={colors.rose} />
                  <Text style={[styles.toggleText, { color: colors.rose }]}>DEFECT</Text>
                </>
              )}
            </TouchableOpacity>
          </Card>
        ))}
      </View>

      {/* Defect Notes Box */}
      {!allPassed && (
        <Card variant="highlight" style={styles.defectBox}>
          <View style={styles.defectHeader}>
            <AlertTriangle size={18} color={colors.rose} />
            <Text style={styles.defectTitle}>Eleza Hitilafu Iliyopo (Defect Description):</Text>
          </View>
          <TextInput
            style={styles.defectInput}
            placeholder="Mfano: Tairi ya nyuma kulia haina upepo au taa ya kulia imezimika..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            value={defectNotes}
            onChangeText={setDefectNotes}
          />
        </Card>
      )}

      {/* Odometer Input */}
      <View style={styles.odoContainer}>
        <Text style={styles.odoLabel}>Odometer ya Sasa (Kilometers):</Text>
        <TextInput
          style={styles.odoInput}
          placeholder="e.g. 184500"
          placeholderTextColor={colors.textDim}
          keyboardType="numeric"
          value={odometerKm}
          onChangeText={setOdometerKm}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          allPassed ? { backgroundColor: colors.primary } : { backgroundColor: colors.amber },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Check size={20} color="#FFF" />
        <Text style={styles.submitBtnText}>
          {allPassed ? "Thibitisha Ukaguzi (All Systems Pass)" : "Wasilisha Ripoti ya Hitilafu"}
        </Text>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  vehicleStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  vehicleStripText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  checklist: {
    gap: spacing.sm,
  },
  checkCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  checkCardLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  checkTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  checkSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "900",
  },
  defectBox: {
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
  },
  defectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  defectTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.rose,
  },
  defectInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 70,
  },
  odoContainer: {
    marginTop: spacing.xs,
  },
  odoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 6,
  },
  odoInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  submitBtn: {
    height: 50,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
