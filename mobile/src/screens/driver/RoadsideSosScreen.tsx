import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { ArrowLeft, Radio, AlertTriangle, MapPin, Send, Check } from "lucide-react-native";

interface RoadsideSosScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const RoadsideSosScreen: React.FC<RoadsideSosScreenProps> = ({ onBack, onSuccess }) => {
  const { driverVehicle, user } = useAuth();

  const [issueType, setIssueType] = useState("tyre_blowout");
  const [description, setDescription] = useState("");
  const [currentLocation, setCurrentLocation] = useState("Morogoro - Iringa Highway (Kitonga Escarpment)");
  const [submitting, setSubmitting] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  const issueTypes = [
    { id: "tyre_blowout", label: "Tyre Blowout", swahili: "Tairi Kupasuka / Puncture", color: colors.rose },
    { id: "engine_overheat", label: "Engine Overheating", swahili: "Injini Kupandisha Joto / Maji Kuchemka", color: colors.rose },
    { id: "air_brake_failure", label: "Air Brake Failure", swahili: "Upepo Kukata / Breki Kufeli", color: colors.rose },
    { id: "transmission_clutch", label: "Clutch / Gear Failure", swahili: "Clutch Kuteleza / Gia Kutokuingia", color: colors.amber },
    { id: "road_accident", label: "Accident / Collision", swahili: "Ajali / Kugongana", color: colors.rose },
    { id: "fuel_system", label: "Fuel Starvation", swahili: "Gari Kuzimika / Pampu ya Mafuta", color: colors.amber },
  ];

  const handleBroadcastSos = async () => {
    if (!driverVehicle) {
      Alert.alert("Gari Halijatambuliwa", "Tafadhali unganisha namba ya gari kwanza kabla ya kutuma SOS.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedIssue = issueTypes.find((x) => x.id === issueType);
      const sosTitle = `🚨 EMERGENCY ROADSIDE BREAKDOWN: ${driverVehicle.plateNumber} · ${selectedIssue?.label}`;
      const sosDesc = `[ROADSIDE SOS BEACON]: Location: ${currentLocation}. Issue: ${selectedIssue?.label} (${selectedIssue?.swahili}). Details: ${description || "Immediate mechanical recovery requested."}. Driver: ${user?.user_metadata?.full_name || "Driver"}.`;

      const { error } = await supabase.from("fault_reports").insert({
        machine_id: driverVehicle.vehicleId,
        reporter_name: user?.user_metadata?.full_name || "Emergency Driver SOS",
        description: sosDesc,
        status: "open",
      });

      if (error) throw error;

      setSosSent(true);
      Alert.alert(
        "Msaada Umetumwa! (SOS Sent)",
        "Ujumbe wa dharura umefika kwa Mkuu wa Karakana na Meneja wa Usafirishaji. Simama eneo salama, weka pembetatu za dharura (triangles).",
        [{ text: "Sawa (OK)", onPress: onSuccess }]
      );
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to broadcast SOS.");
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
        <Text style={styles.headerTitle}>Roadside Emergency SOS</Text>
      </View>

      {/* Emergency Alert Banner */}
      <View style={styles.sosBanner}>
        <Radio size={32} color="#FFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.sosBannerTitle}>HUDUMA YA HARAKA BARABARANI</Text>
          <Text style={styles.sosBannerSub}>
            Tuma taarifa ya dharura mara moja kwa karakana na uongozi wa kampuni.
          </Text>
        </View>
      </View>

      {/* Vehicle Info */}
      <Card style={styles.vehicleCard}>
        <Text style={styles.vehicleLabel}>Gari Lililopata Hitilafu:</Text>
        <Text style={styles.vehiclePlate}>{driverVehicle?.plateNumber || "Gari Halijatambuliwa"}</Text>
        <Text style={styles.vehicleSub}>{driverVehicle?.makeModel || "Commercial Prime Mover"}</Text>
      </Card>

      {/* Location Bar */}
      <View style={styles.locationBox}>
        <MapPin size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Eneo Ulilopo Sasa (GPS Location):</Text>
          <TextInput
            style={styles.locationInput}
            value={currentLocation}
            onChangeText={setCurrentLocation}
            placeholder="Weka jina la kituo au kilometa..."
            placeholderTextColor={colors.textDim}
          />
        </View>
      </View>

      {/* Issue Type Selector */}
      <View>
        <Text style={styles.sectionTitle}>Aina ya Hitilafu (Breakdown Nature): *</Text>
        <View style={styles.issueGrid}>
          {issueTypes.map((item) => {
            const isSelected = issueType === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.issueCard,
                  isSelected && { borderColor: colors.rose, backgroundColor: colors.roseSoft },
                ]}
                onPress={() => setIssueType(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.issueCardHeader}>
                  <AlertTriangle size={16} color={isSelected ? colors.rose : colors.textMuted} />
                  <Text style={[styles.issueLabel, isSelected && { color: colors.rose, fontWeight: "900" }]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={styles.issueSwahili}>{item.swahili}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Description */}
      <View>
        <Text style={styles.sectionTitle}>Eleza Hali Halisi (Driver Remarks):</Text>
        <TextInput
          style={styles.descInput}
          placeholder="Mfano: Tairi ya mbele imepasuka baada ya kuingia kwenye shimo, ninahitaji spare tyre au gari la ufundi..."
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Broadcast Button */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={handleBroadcastSos}
        disabled={submitting || sosSent}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <Radio size={22} color="#FFF" />
            <Text style={styles.sosButtonText}>TUMA TAARIFA YA DHARURA (BROADCAST SOS)</Text>
          </>
        )}
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
  sosBanner: {
    backgroundColor: colors.rose,
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sosBannerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  sosBannerSub: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
    lineHeight: 16,
  },
  vehicleCard: {
    backgroundColor: colors.cardSecondary,
  },
  vehicleLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  vehiclePlate: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    marginTop: 2,
  },
  vehicleSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  locationInput: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  issueGrid: {
    gap: spacing.sm,
  },
  issueCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  issueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  issueLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  issueSwahili: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  descInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 80,
  },
  sosButton: {
    backgroundColor: colors.rose,
    height: 54,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sosButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
