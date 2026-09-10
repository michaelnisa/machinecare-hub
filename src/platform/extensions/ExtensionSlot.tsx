/**
 * MachineCare Platform - Extension Slot Component
 * Renders registered extension components only when enabled for the current organization.
 */

import React, { type ReactNode } from "react";
import { useFeatureFlags } from "@/platform/feature_flags/useFeatureFlags";

interface ExtensionSlotProps {
  extensionKey: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const ExtensionSlot: React.FC<ExtensionSlotProps> = ({
  extensionKey,
  fallback = null,
  children,
}) => {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(extensionKey)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
