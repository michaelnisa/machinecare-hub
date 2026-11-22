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
  Eye,
  EyeOff,
  HelpCircle,
  Factory,
  Wrench,
  Navigation,
  Radio,
  User,
  CheckCircle,
  Sparkles,
} from "lucide-react-native";

interface LoginScreenProps {
  onSuccess: () => void;
  onSkipToField: () => void;
  onRevisitOnboarding?: () => void;
}

type AuthMode = "login" | "register";
type IndustryModule = "manufacturing" | "fleet_logistics" | "garage" | "gps_tracking";

interface ModuleOption {
  id: IndustryModule;
  title: string;
  swahili: string;
  description: string;
  icon: any;
  color: string;
  roles: string[];
}

const MODULES: ModuleOption[] = [
  {
    id: "manufacturing",
    title: "Manufacturing & Plant Floor",
    swahili: "Viwanda, Uzalishaji & OEE",
    description: "Ufuatiliaji wa sakafu ya kiwanda, OEE, maagizo ya kazi, downtime & scrap.",
    icon: Factory,
    color: colors.emerald,
    roles: ["Plant Operator", "Shift Supervisor", "Production Engineer", "Quality Inspector"],
  },
  {
    id: "fleet_logistics",
    title: "Commercial Fleet & Logistics",
    swahili: "Usafirishaji & Safari za Malori",
    description: "Safari za masafa marefu, risiti za mafuta, wallet ya posho & ukaguzi wa lori.",
    icon: Truck,
    color: colors.primary,
    roles: ["Commercial Driver", "Highway Dispatcher", "Fleet Operations Manager"],
  },
  {
    id: "garage",
    title: "Garage & Workshop Repairs",
    swahili: "Karakana & Matengenezo",
    description: "Digital Job Cards, maombi ya vipuri, utambuzi wa QR na ripoti za kasoro.",
    icon: Wrench,
    color: colors.blue,
    roles: ["Workshop Mechanic", "Lead Technician", "Parts Storekeeper"],
  },
  {
    id: "gps_tracking",
    title: "GPS & Telematics Tracking",
    swahili: "Vifaa vya GPS & Satelaiti",
    description: "Kufunga na kuoanisha vifaa vya GPS, uchunguzi wa satelaiti na waya wa kuwasha.",
    icon: Radio,
    color: colors.amber,
    roles: ["Telematics Field Technician", "Sensor Installer"],
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  onSkipToField,
  onRevisitOnboarding,
}) => {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedModule, setSelectedModule] = useState<IndustryModule>("manufacturing");
  const [selectedRoleTitle, setSelectedRoleTitle] = useState("Plant Operator");
  const [loading, setLoading] = useState(false);

  const activeModuleMeta = MODULES.find((m) => m.id === selectedModule) || MODULES[0];

  const handleModuleSelect = (mod: IndustryModule) => {
    setSelectedModule(mod);
    const m = MODULES.find((x) => x.id === mod);
    if (m && m.roles.length > 0) {
      setSelectedRoleTitle(m.roles[0]);
    }
  };

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

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert("Jina Kamili Linahitajika", "Tafadhali ingiza jina lako kamili.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Barua Pepe Batili", "Tafadhali ingiza anwani sahihi ya barua pepe.");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert("Nenosiri Dhaifu", "Nenosiri linatakiwa kuwa na herufi zisizopungua sita (6).");
      return;
    }
    const finalCompanyName = companyName.trim() || `${fullName.trim()} Operations`;

    try {
      setLoading(true);
      const res = await signUpWithEmail({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        companyName: finalCompanyName,
        industryProfile: selectedModule,
        roleTitle: selectedRoleTitle,
      });

      if (res.error) {
        Alert.alert(
          "Hitilafu ya Usajili",
          res.error.message || "Imeshindwa kufungua akaunti. Tafadhali jaribu tena."
        );
      } else {
        if (res.data?.session) {
          Alert.alert(
            "Hongera! Karibu MachineCare",
            `Akaunti yako ya ${finalCompanyName} imesajiliwa kikamilifu chini ya moduli ya "${activeModuleMeta.swahili}". Vipengele vyote vya moduli yako vimefunguliwa kiotomatiki!`
          );
          onSuccess();
        } else {
          Alert.alert(
            "Akaunti Imefunguliwa! / Account Created",
            `Akaunti yako imesajiliwa kikamilifu chini ya moduli ya "${activeModuleMeta.swahili}". Barua pepe ya uthibitisho imetumwa kwa ${email.trim()}. Tafadhali thibitisha kisha uingie.\n\nA confirmation link has been sent to your email. Please verify and log in.`,
            [
              {
                text: "Ingia Sasa (Log In)",
                onPress: () => setAuthMode("login"),
              },
            ]
          );
        }
      }
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Hitilafu imetokea wakati wa kusajili.");
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
          <Text style={styles.brandSubtitle}>
            Modular Enterprise Companion: Manufacturing, Fleet, Garage & Telematics
          </Text>
        </View>

        {/* Mode Switcher Tabs */}
        <View style={styles.modeTabBar}>
          <TouchableOpacity
            style={[styles.modeTab, authMode === "login" && styles.modeTabActive]}
            onPress={() => setAuthMode("login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, authMode === "login" && styles.modeTabTextActive]}>
              Ingia (Sign In)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, authMode === "register" && styles.modeTabActive]}
            onPress={() => setAuthMode("register")}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, authMode === "register" && styles.modeTabTextActive]}>
              Jisajili (Register)
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================== */}
        {/* FORM: SIGN IN MODE */}
        {/* ============================================================== */}
        {authMode === "login" && (
          <Card style={styles.card}>
            <Text style={styles.formTitle}>Ingia Kwenye Akaunti Yako</Text>
            <Text style={styles.formSub}>
              Tumia barua pepe na nenosiri lako la MachineCare kuingia moja kwa moja kwenye moduli yako.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Barua Pepe (Email)</Text>
              <View style={styles.inputRow}>
                <Mail size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="mf. mfano@kampuni.co.tz"
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
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.quickFillRow}>
              <Text style={styles.quickFillLabel}>Demo Accounts:</Text>
              <TouchableOpacity
                onPress={() => {
                  setEmail("operator@example.com");
                  setPassword("");
                }}
                style={styles.fillChip}
              >
                <Text style={styles.fillChipText}>Kiwanda Demo</Text>
              </TouchableOpacity>
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
        )}

        {/* ============================================================== */}
        {/* FORM: REGISTER / SIGN UP MODE */}
        {/* ============================================================== */}
        {authMode === "register" && (
          <Card style={styles.card}>
            <View style={styles.registerBadgeRow}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={styles.registerBadgeText}>Usajili Mpya wa Moduli</Text>
            </View>
            <Text style={styles.formTitle}>Fungua Akaunti ya Moduli Yako</Text>
            <Text style={styles.formSub}>
              Chagua sekta au idara yako ili mfumo uweke vipengele na zana zinazohusika na kazi yako.
            </Text>

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Jina Kamili</Text>
              <View style={styles.inputRow}>
                <User size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="mf. Juma Hamisi"
                  placeholderTextColor={colors.textDim}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Company / Plant Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Jina la Kiwanda / Kampuni / Karakana</Text>
              <View style={styles.inputRow}>
                <Building2 size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="mf. Mega Beverage Factory Ltd"
                  placeholderTextColor={colors.textDim}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Barua Pepe (Email)</Text>
              <View style={styles.inputRow}>
                <Mail size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="mfano@kampuni.co.tz"
                  placeholderTextColor={colors.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nenosiri (Herufi 6+)</Text>
              <View style={styles.inputRow}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Operational Module Selection */}
            <Text style={[styles.inputLabel, { marginTop: spacing.xs }]}>
              CHAGUA MODULI YAKO YA KAZI (OPERATIONAL MODULE)
            </Text>
            <View style={styles.moduleSelectorGrid}>
              {MODULES.map((m) => {
                const isSelected = selectedModule === m.id;
                const IconComp = m.icon;

                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.moduleOptionCard,
                      isSelected && {
                        borderColor: m.color,
                        backgroundColor: colors.cardSecondary,
                      },
                    ]}
                    onPress={() => handleModuleSelect(m.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.moduleCardTop}>
                      <View style={[styles.moduleIconCircle, { backgroundColor: `${m.color}20` }]}>
                        <IconComp size={18} color={m.color} />
                      </View>
                      {isSelected && <CheckCircle size={18} color={m.color} />}
                    </View>
                    <Text
                      style={[
                        styles.moduleCardTitle,
                        isSelected && { color: colors.text, fontWeight: "800" },
                      ]}
                    >
                      {m.swahili}
                    </Text>
                    <Text style={styles.moduleCardSub}>{m.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Role title picker based on module */}
            <View style={styles.rolePickerBox}>
              <Text style={styles.inputLabel}>Wadhifa / Cheo Chako</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {activeModuleMeta.roles.map((r) => {
                  const isSel = selectedRoleTitle === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleChip,
                        isSel && {
                          borderColor: activeModuleMeta.color,
                          backgroundColor: `${activeModuleMeta.color}20`,
                        },
                      ]}
                      onPress={() => setSelectedRoleTitle(r)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          isSel && { color: activeModuleMeta.color, fontWeight: "800" },
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Register Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: activeModuleMeta.color }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Fungua Akaunti & Ingia Kwenye Moduli</Text>
                  <ArrowRight size={18} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </Card>
        )}

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
              Kwa madereva na mafundi wanaotumia QR ya gari/mashine mara moja
            </Text>
          </View>
          <ArrowRight size={16} color={colors.primary} />
        </TouchableOpacity>

        {onRevisitOnboarding && (
          <TouchableOpacity
            style={styles.onboardingBtn}
            onPress={onRevisitOnboarding}
            activeOpacity={0.7}
          >
            <HelpCircle size={15} color={colors.textMuted} />
            <Text style={styles.onboardingBtnText}>
              Tazama Mwongozo wa Awali (Onboarding Walkthrough)
            </Text>
          </TouchableOpacity>
        )}

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
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  brandHeader: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  modeTabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.md,
  },
  modeTabActive: {
    backgroundColor: colors.cardSecondary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.text,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  registerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
  registerBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },
  formTitle: {
    fontSize: 17,
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
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
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
  moduleSelectorGrid: {
    gap: 8,
  },
  moduleOptionCard: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  moduleCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  moduleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  moduleCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  moduleCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  rolePickerBox: {
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
    marginRight: 6,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
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
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  fillChipText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 13,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
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
    fontWeight: "700",
    color: colors.textDim,
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  skipBtnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  skipBtnSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  onboardingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.xs,
  },
  onboardingBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
