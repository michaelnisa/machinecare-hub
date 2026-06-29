import { format, parseISO, isValid } from "date-fns";

export const formatDate = (input?: string | Date | null) => {
  if (!input) return "—";
  const d = typeof input === "string" ? parseISO(input) : input;
  if (!isValid(d)) return "—";
  return format(d, "d LLL yyyy");
};

export const formatMoney = (
  amount?: number | string | null,
  currency: string = "TZS",
) => {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n === null || n === undefined || Number.isNaN(n)) return `${currency} 0`;
  return `${currency} ${n.toLocaleString("en-US")}`;
};

export const formatTZS = (amount?: number | string | null) => formatMoney(amount, "TZS");

// Normalize TZ phone numbers: leading 0 -> 255, strip spaces/dashes
export const normalizeTzPhone = (raw?: string | null) => {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return "255" + digits.slice(1);
  return digits;
};

export const formatNumber = (n?: number | string | null) => {
  const v = typeof n === "string" ? Number(n) : n;
  if (v === null || v === undefined || Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US");
};

export const initials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
};
