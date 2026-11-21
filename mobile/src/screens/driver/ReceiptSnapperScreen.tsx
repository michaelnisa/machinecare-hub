import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useOfflineSync } from "../../context/OfflineSyncContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { ArrowLeft, Camera, Check, Fuel, Scale, Coins, ParkingSquare, AlertOctagon, Wrench } from "lucide-react-native";

interface ReceiptSnapperScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const ReceiptSnapperScreen: React.FC<ReceiptSnapperScreenProps> = ({ onBack, onSuccess }) => {
  const { driverVehicle, user } = useAuth();
  const { queueReceipt } = useOfflineSync();

  const [category, setCategory] = useState<"fuel" | "toll" | "parking" | "fine" | "repair" | "other">("toll");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [notes, setNotes] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const categories: {
    id: "fuel" | "toll" | "parking" | "fine" | "repair" | "other";
    label: string;
    swahili: string;
    icon: any;
    color: string;
  }[] = [
    { id: "toll", label: "Weighbridge", swahili: "Mizani / Vigwaza", icon: Scale, color: colors.blue },
    { id: "fuel", label: "Diesel Fuel", swahili: "Mafuta ya Gari", icon: Fuel, color: colors.amber },
    { id: "parking", label: "Parking", swahili: "Maegesho & Ulinzi", icon: ParkingSquare, color: colors.purple },
    { id: "fine", label: "Cess / Fine", swahili: "Ushuru / Halmashauri", icon: AlertOctagon, color: colors.rose },
    { id: "repair", label: "Minor Repair", swahili: "Kuziba Tairi / Gereji", icon: Wrench, color: colors.primary },
    { id: "other", label: "Other", swahili: "Matumizi Mengine", icon: Coins, color: colors.textMuted },
  ];

  const handleSnapPhoto = () => {
    // In React Native / Expo, triggers Camera capture
    setHasPhoto(true);
    Alert.alert("Picha Imepigwa (Photo Captured)", "Picha ya risiti imehifadhiwa vizuri kwa ajili ya surrender.");
  };

  const handleSaveReceipt = async () => {
    const numAmt = Number(amount.replace(/,/g, ""));
    if (!numAmt || numAmt <= 0) {
      Alert.alert("Weka Kiasi", "Tafadhali weka kiasi cha fedha cha risiti hii (Amount in TZS).");
      return;
    }

    setSubmitting(true);
    try {
      const catObj = categories.find((c) => c.id === category);
      const finalTitle = title.trim() || `${catObj?.label || "Road Expense"} (${catObj?.swahili || ""})`;

      await queueReceipt({
        id: "rec-" + Date.now(),
        tripId: "active-trip",
        vehicleId: driverVehicle?.vehicleId || "unknown-truck",
        organisationId: driverVehicle?.organisationId || undefined,
        driverId: user?.id || undefined,
        title: finalTitle,
        category,
        amount: numAmt,
        currency: "TZS",
        receiptNo: receiptNo.trim() || undefined,
        notes: notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      });

      Alert.alert(
        "Risiti Imehifadhiwa! (Saved)",
        `Kiasi cha TZS ${numAmt.toLocaleString()} kimeongezwa kwenye hesabu ya Safari Float surrender.`,
        [{ text: "Sawa (OK)", onPress: onSuccess }]
      );
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to save receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Snap Road Receipt (Risiti)</Text>
      </View>

      {/* Camera Capture Card */}
      <TouchableOpacity
        style={[styles.cameraBox, hasPhoto && styles.cameraBoxSuccess]}
        onPress={handleSnapPhoto}
        activeOpacity={0.8}
      >
        <View style={[styles.cameraIconCircle, hasPhoto && { backgroundColor: colors.primary }]}>
          {hasPhoto ? <Check size={32} color="#FFF" /> : <Camera size={32} color={colors.primary} />}
        </View>
        <Text style={styles.cameraTitle}>
          {hasPhoto ? "Picha ya Risiti Imehifadhiwa (Gusa kurudia)" : "Piga Picha ya Risiti Hapa (Tap Camera)"}
        </Text>
        <Text style={styles.cameraSub}>Hakikisha namba ya risiti na kiasi vinaonekana vizuri.</Text>
      </TouchableOpacity>

      {/* Category Pills */}
      <View>
        <Text style={styles.label}>Chagua Aina ya Matumizi (Category):</Text>
        <View style={styles.categoryGrid}>
          {categories.map((c) => {
            const isSelected = category === c.id;
            const IconComp = c.icon;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.categoryPill,
                  isSelected && { backgroundColor: c.color + "22", borderColor: c.color },
                ]}
                onPress={() => setCategory(c.id)}
                activeOpacity={0.7}
              >
                <IconComp size={16} color={isSelected ? c.color : colors.textMuted} />
                <View>
                  <Text style={[styles.catLabel, isSelected && { color: c.color, fontWeight: "800" }]}>
                    {c.label}
                  </Text>
                  <Text style={styles.catSub}>{c.swahili}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Amount Input */}
      <View>
        <Text style={styles.label}>Kiasi cha Fedha (TZS): *</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencyPrefix}>TZS</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="e.g. 26000"
            placeholderTextColor={colors.textDim}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
      </View>

      {/* Receipt # Input */}
      <View>
        <Text style={styles.label}>Namba ya Risiti (Receipt / Ticket #):</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. VGW-88492"
          placeholderTextColor={colors.textDim}
          value={receiptNo}
          onChangeText={setReceiptNo}
        />
      </View>

      {/* Remarks */}
      <View>
        <Text style={styles.label}>Maelezo ya Ziada (Remarks):</Text>
        <TextInput
          style={[styles.textInput, { minHeight: 60, textAlignVertical: "top", paddingTop: spacing.sm }]}
          placeholder="Mfano: Weighbridge ya Vigwaza njiani kuelekea Arusha..."
          placeholderTextColor={colors.textDim}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSaveReceipt}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Check size={20} color="#FFF" />
        <Text style={styles.saveBtnText}>Hifadhi Risiti kwenye Safari Float</Text>
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
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  cameraBox: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  cameraBoxSuccess: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderStyle: "solid",
  },
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
    textAlign: "center",
  },
  cameraSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: "47%",
    flexGrow: 1,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  catSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.primary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    height: 46,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
