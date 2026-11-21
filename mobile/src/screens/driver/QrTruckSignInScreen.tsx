import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { QrCode, Truck, Check, ArrowLeft, Search } from "lucide-react-native";

import { parseVehicleQrOrInput } from "../../utils/qrParser";

interface QrTruckSignInScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const QrTruckSignInScreen: React.FC<QrTruckSignInScreenProps> = ({ onBack, onSuccess }) => {
  const { pairDriverVehicle } = useAuth();
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchedVehicle, setMatchedVehicle] = useState<any | null>(null);

  const searchVehicle = async (term: string) => {
    const parsed = parseVehicleQrOrInput(term);
    if (!parsed.value) return;

    setLoading(true);
    try {
      let query = supabase
        .from("machines")
        .select("id, name, plate_number, registration_number, serial_number, make, model, current_odometer_km, organisation_id, trailer_plate, notes");

      if (parsed.type === "uuid") {
        query = query.eq("id", parsed.value);
      } else {
        const q = parsed.value.toUpperCase();
        query = query.or(`plate_number.ilike.%${q}%,name.ilike.%${q}%,registration_number.ilike.%${q}%,serial_number.ilike.%${q}%`);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) throw error;
      if (data) {
        let meta: any = {};
        if (data.notes?.startsWith("{")) {
          try {
            meta = JSON.parse(data.notes);
          } catch {}
        }
        setMatchedVehicle({ ...data, meta });
      } else {
        Alert.alert("Gari Halikupatikana", `Hakuna gari linalolingana na "${parsed.value}". Tafadhali hakiki QR code au namba ya gari.`);
      }
    } catch (e: any) {
      Alert.alert("Search Error", e.message || "Failed to search vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPair = async () => {
    if (!matchedVehicle) return;

    const truckPlate = matchedVehicle.plate_number || matchedVehicle.registration_number || matchedVehicle.name;
    const truckCode = matchedVehicle.registration_number || matchedVehicle.serial_number || "TRK";

    await pairDriverVehicle({
      vehicleId: matchedVehicle.id,
      plateNumber: truckPlate,
      vehicleCode: truckCode,
      registrationNumber: matchedVehicle.registration_number,
      name: matchedVehicle.name,
      makeModel: [matchedVehicle.make, matchedVehicle.model].filter(Boolean).join(" "),
      linkedTrailerPlate: matchedVehicle.trailer_plate || matchedVehicle.meta?.linked_trailer_plate || null,
      odometerKm: matchedVehicle.current_odometer_km,
      organisationId: matchedVehicle.organisation_id,
      pairedAt: new Date().toISOString(),
    });

    Alert.alert("Coupled Successfully!", `Umeunganishwa na gari ${truckPlate}. Karibu kazini!`);
    onSuccess();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Couple Vehicle QR Code</Text>
      </View>

      <View style={styles.content}>
        {/* Visual Scanner Mockup / Input */}
        <View style={styles.scanBox}>
          <QrCode size={64} color={colors.primary} />
          <Text style={styles.scanPrompt}>Point Camera at Truck QR Sticker</Text>
          <Text style={styles.scanSub}>Au andika namba ya gari au ID ya gari hapa chini:</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. TRK-001 or T 412 DFG"
              placeholderTextColor={colors.textDim}
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="characters"
              onSubmitEditing={() => searchVehicle(inputCode)}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => searchVehicle(inputCode)}
              disabled={loading || !inputCode.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Search size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Matched Vehicle Card */}
        {matchedVehicle && (
          <Card variant="highlight" style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <View style={styles.truckIconBox}>
                <Truck size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.matchPlate}>
                  {matchedVehicle.plate_number || matchedVehicle.name}
                </Text>
                <Text style={styles.matchCode}>
                  ID: {matchedVehicle.registration_number || matchedVehicle.serial_number || "TRK"} · {[matchedVehicle.make, matchedVehicle.model].filter(Boolean).join(" ")}
                </Text>
              </View>
            </View>

            {matchedVehicle.meta?.linked_trailer_plate && (
              <View style={styles.trailerInfo}>
                <Text style={styles.trailerLabel}>Coupled Trailer:</Text>
                <Text style={styles.trailerPlate}>{matchedVehicle.meta.linked_trailer_plate}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirmPair}
              activeOpacity={0.8}
            >
              <Check size={20} color="#FFF" />
              <Text style={styles.confirmBtnText}>Confirm &amp; Start Operating</Text>
            </TouchableOpacity>
          </Card>
        )}
      </View>
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  scanBox: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  scanPrompt: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
  },
  scanSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    height: 46,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  searchBtn: {
    backgroundColor: colors.primary,
    width: 46,
    height: 46,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  matchCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  truckIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  matchPlate: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },
  matchCode: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  trailerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardSecondary,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  trailerLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  trailerPlate: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
