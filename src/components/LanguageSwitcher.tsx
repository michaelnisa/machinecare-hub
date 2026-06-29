import { useI18n } from "@/i18n/I18nProvider";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  align?: "start" | "end";
  variant?: "ghost" | "outline";
  compact?: boolean;
}

export function LanguageSwitcher({ align = "end", variant = "ghost", compact = false }: Props) {
  const { lang, setLang, t } = useI18n();
  const label = lang === "en" ? "EN" : "SW";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={compact ? "icon" : "sm"} className="gap-2" aria-label={t.common.language}>
          <Languages className="h-4 w-4" />
          {!compact && <span className="text-xs font-semibold">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        <DropdownMenuLabel>{t.common.language}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLang("en")} className={lang === "en" ? "font-semibold text-primary" : ""}>
          🇬🇧 English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang("sw")} className={lang === "sw" ? "font-semibold text-primary" : ""}>
          🇹🇿 Kiswahili
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
