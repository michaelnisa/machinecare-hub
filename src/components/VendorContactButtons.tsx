import { Phone, MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeTzPhone } from "@/lib/format";

export function VendorContactButtons({ phone, size = "sm" }: { phone?: string | null; size?: "sm" | "md" }) {
  if (!phone) return <span className="text-xs text-muted-foreground">—</span>;
  const wa = normalizeTzPhone(phone);
  const tel = phone.replace(/\s|-/g, "");
  const cls = size === "md" ? "h-9 w-9" : "h-8 w-8";
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`tel:${tel}`}
            className={`inline-flex ${cls} items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent`}
            aria-label="Call"
          >
            <Phone className="h-4 w-4" />
          </a>
        </TooltipTrigger>
        <TooltipContent>Call {phone}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex ${cls} items-center justify-center rounded-md border border-input bg-background text-emerald-600 hover:bg-accent`}
            aria-label="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        </TooltipTrigger>
        <TooltipContent>WhatsApp {phone}</TooltipContent>
      </Tooltip>
    </div>
  );
}
