import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Truck,
  Building2,
  Users,
} from "lucide-react-native";

interface LoginScreenProps {
  onSuccess: () => void;
  onSkipToField: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onSkipToField }) => {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Ingiza Taarifa", "Tafadhali ingiza barua pepe (email) na nenosiri (password).");
      return;
    }

    try {
      setLoading(true);
      const { error } = await signInWithEmail(email, password);

      if (error) {
        Alert.alert(
          "Hitilafu ya Kuingia",
          error.message || "Barua pepe au nenosiri sio sahihi. Tafadhali jaribu tena."
        );
      } else {
        onSuccess();
      }
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Imeshindwa kuingia kwenye akaunti.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Truck size={32} color="#FFF" />
          </View>
          <Text style={styles.brandTitle}>MachineCare Hub</Text>
          <Text style={styles.brandSubtitle}>Fleet, Garage & Telematics Field Portal</Text>
        </View>

        {/* Login Form */}
        <Card style={styles.card}>
          <Text style={styles.formTitle}>Ingia Kwenye Akaunti Yako</Text>
          <Text style={styles.formSub}>
            Tumia barua pepe na nenosiri lako la MachineCare webapp kuunganisha shughuli zako za uga.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Barua Pepe (Email)</Text>
            <View style={styles.inputRow}>
              <Mail size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="mf. dereva@kampuni.co.tz"
                placeholderTextColor={colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nenosiri (Password)</Text>
            <View style={styles.inputRow}>
              <Lock size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* Quick preset credentials for testing */}
          <View style={styles.quickFillRow}>
            <Text style={styles.quickFillLabel}>Demo Accounts:</Text>
            <TouchableOpacity
              onPress={() => {
                setEmail("manager@example.com");
                setPassword("");
              }}
              style={styles.fillChip}
            >
              <Text style={styles.fillChipText}>Logistixware</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Ingia (Sign In)</Text>
                <ArrowRight size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </Card>

        {/* Alternative: QR / Quick Field Mode */}
        <View style={styles.dividerBox}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>AU (OR)</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onSkipToField}
          activeOpacity={0.8}
        >
          <Users size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.skipBtnTitle}>Endelea Bila Login (Field QR Mode)</Text>
            <Text style={styles.skipBtnSub}>
              Kwa madereva na mafundi wanaotumia QR ya gari moja kwa moja
            </Text>
          </View>
          <ArrowRight size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Cloud Status Footer */}
        <View style={styles.footerInfo}>
          <ShieldCheck size={14} color={colors.emerald} />
          <Text style={styles.footerText}>
            Imeunganishwa na MachineCare Cloud Backend (Supabase)
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  brandHeader: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  formSub: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  quickFillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  quickFillLabel: {
    fontSize: 11,
    color: colors.textDim,
  },
  fillChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  fillChipText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700",
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
  dividerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textDim,
  },
  skipBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + "44",
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  skipBtnTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  skipBtnSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
