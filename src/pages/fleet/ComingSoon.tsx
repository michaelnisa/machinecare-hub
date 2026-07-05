import { Construction } from "lucide-react";
import { EmptyState } from "@/components/PageLoader";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="animate-fade-in">
      <EmptyState
        icon={<Construction className="h-6 w-6" />}
        title={`${title} is coming soon`}
        description="This part of the Fleet & Logistics module is being built in an upcoming phase."
      />
    </div>
  );
}
