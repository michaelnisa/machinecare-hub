import { useFeatureFlags } from "@/platform/feature_flags/useFeatureFlags";
import ManufacturingFinanceOverview from "./manufacturing/ManufacturingFinanceOverview";
import FinanceOverview from "./FinanceOverview";

export default function FinanceRouter() {
  const { isManufacturing } = useFeatureFlags();

  if (isManufacturing) {
    return <ManufacturingFinanceOverview />;
  }

  return <FinanceOverview />;
}
