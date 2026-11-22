import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { colors, radii, spacing } from "../../theme";
import {
  Truck,
  Wrench,
  Radio,
  ShieldCheck,
  ArrowRight,
  Check,
  Smartphone,
  ChevronRight,
  QrCode,
} from "lucide-react-native";

interface OnboardingScreenProps {
  onComplete: () => void;
  onFieldMode: () => void;
}

const SLIDES = [
  {
    id: "driver",
    badge: "MADEREVA WA UGA & MALORI",
    title: "Safari za Barabarani & Safari Float",
    subtitle: "Commercial Haulage & Posho Wallet",
    description:
      "Changanua QR ya gari kwa sekunde moja, fanya ukaguzi wa gari wa sekunde 60 kabla ya kuondoka, na piga picha za risiti za mizani, tozo na mafuta.",
    icon: Truck,
    iconColor: colors.primary,
    highlight: "Hesabu ya Posho (Float Wallet) inajisasisha moja kwa moja.",
  },
  {
    id: "garage",
    badge: "KARAKANA & MAFUNDI (WORKSHOP)",
    title: "Job Cards za Karakana & Vipuri",
    subtitle: "Digital Job Cards & Defect Intake",
    description:
      "Tazama kazi zote za matengenezo zilizopangwa, rekodi maelezo ya fundi, hifadhi vipuri vilivyotumika, na kamilisha matengenezo kwa haraka.",
    icon: Wrench,
    iconColor: colors.blue,
    highlight: "Inasawazishwa na stoo kuu ya vipuri (Inventory Items).",
  },
  {
    id: "fleet",
    badge: "WASIMAMIZI & GPS TELEMATICS",
    title: "Ramani ya Moja kwa Moja ya Malori",
    subtitle: "Live Fleet Tracking & Dispatch",
    description:
      "Angalia malori yote yaliyo safarini, kasi, hali ya injini (ignition), na unganisha vifaa vipya vya GPS (IMEI tracker pairing) ukiwa ugani.",
    icon: Radio,
    iconColor: colors.amber,
    highlight: "Amri za satelaiti na immobilizer relay kutoka kwenye simu.",
  },
  {
    id: "offline",
    badge: "TEKNOLOJIA YA UGA (OFFLINE-FIRST)",
    title: "Inafanya Kazi Popote Bila Mtandao",
    subtitle: "Zero Network Coverage? Hakuna Shaka",
    description:
      "Endelea kurekodi safari, risiti na hitilafu hata kwenye maeneo ya mbali yasiyo na mnara. Taarifa zitajipaki (auto-sync) punde mtandao ukipatikana.",
    icon: ShieldCheck,
    iconColor: colors.purple,
    highlight: "Usalama wa data 100% ukiwa njiani au karakana.",
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
  onFieldMode,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      onComplete();
    }
  };

  const current = SLIDES[activeIndex];
  const IconComp = current.icon;
  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Skip */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Smartphone size={18} color={colors.primary} />
          <Text style={styles.brandName}>MachineCare Hub</Text>
        </View>
        <TouchableOpacity onPress={onComplete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipText}>Ruka (Skip)</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Content */}
      <View style={styles.slideContainer}>
        {/* Animated Icon Circle */}
        <View style={[styles.iconHalo, { borderColor: current.iconColor + "33" }]}>
          <View style={[styles.iconBox, { backgroundColor: current.iconColor + "18" }]}>
            <IconComp size={48} color={current.iconColor} />
          </View>
        </View>

        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: current.iconColor + "15", borderColor: current.iconColor + "44" }]}>
          <Text style={[styles.badgeText, { color: current.iconColor }]}>
            {current.badge}
          </Text>
        </View>

        {/* Title & Subtitle */}
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* Description */}
        <Text style={styles.description}>{current.description}</Text>

        {/* Highlight Banner */}
        <View style={styles.highlightBox}>
          <Check size={14} color={current.iconColor} />
          <Text style={styles.highlightText}>{current.highlight}</Text>
        </View>
      </View>

      {/* Slide Dots Indicator */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => setActiveIndex(idx)}
            style={[
              styles.dot,
              idx === activeIndex && [styles.dotActive, { backgroundColor: current.iconColor }],
            ]}
          />
        ))}
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        {isLastSlide ? (
          <View style={styles.lastSlideActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={onComplete}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Ingia Kwenye Akaunti (Sign In)</Text>
              <ArrowRight size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fieldModeBtn}
              onPress={onFieldMode}
              activeOpacity={0.8}
            >
              <QrCode size={16} color={colors.primary} />
              <Text style={styles.fieldModeBtnText}>
                Endelea Bila Akaunti (Field QR Mode)
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navRow}>
            {activeIndex > 0 ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setActiveIndex(activeIndex - 1)}
              >
                <Text style={styles.backBtnText}>Nyuma</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: current.iconColor }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>Endelea</Text>
              <ChevronRight size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  brandName: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 0.5,
  },
  skipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "700",
  },
  slideContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconHalo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginBottom: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textDim,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  highlightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  backBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
  },
  nextBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  lastSlideActions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radii.lg,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
  },
  fieldModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldModeBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
});
