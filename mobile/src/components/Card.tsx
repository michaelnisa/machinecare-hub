import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "secondary" | "highlight";
}

export const Card: React.FC<CardProps> = ({ children, style, variant = "default" }) => {
  return (
    <View
      style={[
        styles.card,
        variant === "secondary" && styles.secondary,
        variant === "highlight" && styles.highlight,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondary: {
    backgroundColor: colors.cardSecondary,
    borderColor: colors.borderLight,
  },
  highlight: {
    backgroundColor: colors.cardSecondary,
    borderColor: colors.primary,
  },
});
