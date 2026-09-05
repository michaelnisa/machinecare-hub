import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type BusinessHours } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import type { IndustryProfile } from "@/hooks/useIndustry";
import { useIndustry } from "@/hooks/useIndustry";
import { IndustryPicker, INDUSTRY_PROFILES } from "@/components/IndustryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/PageLoader";
import { formatDate, initials } from "@/lib/format";
import {
  Loader2,
  Tv,
  Copy,
  ExternalLink,
  Monitor,
  Bell,
  Send,
  Upload,
  X,
  Target,
  Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const DAYS: { key: keyof BusinessHours; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];
const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { open: "08:00", close: "18:00", closed: false },
  tue: { open: "08:00", close: "18:00", closed: false },
  wed: { open: "08:00", close: "18:00", closed: false },
  thu: { open: "08:00", close: "18:00", closed: false },
  fri: { open: "08:00", close: "18:00", closed: false },
  sat: { open: "08:00", close: "13:00", closed: false },
  sun: { open: "08:00", close: "13:00", closed: true },
};
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: "Cash", mobile_money: "Mobile money", bank: "Bank transfer", other: "Other" };
const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "Email", phone_call: "Phone call", in_person: "In person", other: "Other" };

export default function Settings() {
  const { user, profile, organisation, refresh } = useAuth();
  const { isGarage, isMixed } = useIndustry();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<IndustryProfile | null>(
    null,
  );
  const [savingIndustryProfile, setSavingIndustryProfile] = useState(false);
  const [taxRate, setTaxRate] = useState("0");
  const [savingTaxRate, setSavingTaxRate] = useState(false);
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [invoiceFooterNote, setInvoiceFooterNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cash", "mobile_money", "bank", "other"]);
  const [labourRate, setLabourRate] = useState("0");
  const [messageChannel, setMessageChannel] = useState("whatsapp");
  const [savingWorkshopSettings, setSavingWorkshopSettings] = useState(false);

  useEffect(() => {
    if (organisation) {
      setOrgName(organisation.name);
      setTaxRate(String(organisation.default_tax_rate_percent ?? 0));
      setOrgPhone(organisation.phone ?? "");
      setOrgAddress(organisation.address ?? "");
      setBusinessHours(organisation.business_hours ?? DEFAULT_BUSINESS_HOURS);
      setInvoiceFooterNote(organisation.invoice_footer_note ?? "");
      setPaymentMethods(organisation.accepted_payment_methods?.length ? organisation.accepted_payment_methods : ["cash", "mobile_money", "bank", "other"]);
      setLabourRate(String(organisation.default_labour_rate_per_hour ?? 0));
      setMessageChannel(organisation.default_message_channel ?? "whatsapp");
    }
    if (profile) {
      setFullName(profile.full_name ?? "");
      setDepartment(profile.department ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [organisation, profile]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("organisation_id", profile.organisation_id),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organisation_id", profile.organisation_id),
    ]).then(([{ data: ps }, { data: rs }]) => {
      const roleMap: Record<string, string> = {};
      (rs ?? []).forEach((r: any) => {
        roleMap[r.user_id] = r.role;
      });
      setMembers(
        (ps ?? []).map((p: any) => ({ ...p, role: roleMap[p.id] ?? "—" })),
      );
      setLoading(false);
    });
  }, [profile]);

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organisation || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    setLogoUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${organisation.id}/logo/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("org-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      toast.error(upErr.message);
      setLogoUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("org-logos").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("organisations")
      .update({ logo_url: pub.publicUrl } as any)
      .eq("id", organisation.id);
    if (dbErr) toast.error(dbErr.message);
    else {
      toast.success("Logo updated");
      refresh();
    }
    setLogoUploading(false);
    e.target.value = "";
  };

  const removeLogo = async () => {
    if (!organisation) return;
    const { error } = await supabase
      .from("organisations")
      .update({ logo_url: null } as any)
      .eq("id", organisation.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Logo removed");
      refresh();
    }
  };

  const switchPlan = async (plan: "lite" | "standard") => {
    if (!organisation) return;
    const { error } = await supabase
      .from("organisations")
      .update({ plan } as any)
      .eq("id", organisation.id);
    if (error) toast.error(error.message);
    else {
      toast.success(
        `Switched to ${plan === "lite" ? "Simple" : "Standard"} plan`,
      );
      refresh();
    }
  };

  const saveOrg = async () => {
    if (!organisation) return;
    setSavingOrg(true);
    const { error } = await supabase
      .from("organisations")
      .update({ name: orgName.trim() })
      .eq("id", organisation.id);
    setSavingOrg(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Organisation updated");
      refresh();
    }
  };

  const saveTaxRate = async () => {
    if (!organisation) return;
    const rate = Number(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error("Tax rate must be a number between 0 and 100");
      return;
    }
    setSavingTaxRate(true);
    const { error } = await supabase
      .from("organisations")
      .update({ default_tax_rate_percent: rate })
      .eq("id", organisation.id);
    setSavingTaxRate(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Default tax rate updated");
      refresh();
    }
  };

  const saveWorkshopSettings = async () => {
    if (!organisation) return;
    const rate = Number(labourRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Labour rate must be a positive number");
      return;
    }
    if (paymentMethods.length === 0) {
      toast.error("Accept at least one payment method");
      return;
    }
    setSavingWorkshopSettings(true);
    const { error } = await supabase
      .from("organisations")
      .update({
        phone: orgPhone.trim() || null,
        address: orgAddress.trim() || null,
        business_hours: businessHours,
        invoice_footer_note: invoiceFooterNote.trim() || null,
        accepted_payment_methods: paymentMethods,
        default_labour_rate_per_hour: rate,
        default_message_channel: messageChannel,
      })
      .eq("id", organisation.id);
    setSavingWorkshopSettings(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Workshop settings updated");
      refresh();
    }
  };

  const confirmIndustryProfileChange = async () => {
    if (!organisation || !pendingProfile) return;
    setSavingIndustryProfile(true);
    const { error } = await supabase
      .from("organisations")
      .update({ industry_profile: pendingProfile })
      .eq("id", organisation.id);
    setSavingIndustryProfile(false);
    setPendingProfile(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Industry profile updated");
      refresh();
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    // department column added by migration 20260629000100; cast until types are regenerated
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        department: department.trim() || null,
        phone: phone.trim() || null,
      } as any)
      .eq("id", profile.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      refresh();
    }
  };

  const changePassword = async () => {
    if (pwd.length < 6)
      return toast.error("Password must be at least 6 characters");
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPwd("");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organisation and account.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              ERP & Business Systems Integration
              <span className="rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 text-[10px] font-bold border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect MachineCare operational intelligence with Odoo, SAP Business One, Microsoft Dynamics 365, or custom ERPs.
            </p>
          </div>
        </div>
        <Link to="/integrations">
          <Button size="sm" className="whitespace-nowrap text-xs gap-1.5 font-semibold">
            Open Integration Hub →
          </Button>
        </Link>
      </div>

      <Section title="Organisation logo">
        <div className="flex items-center gap-5">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt="Logo"
              className="h-16 w-auto max-w-[160px] rounded border border-border object-contain"
            />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent ${logoUploading ? "pointer-events-none opacity-50" : ""}`}
            >
              {logoUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {logoUploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={uploadLogo}
                disabled={logoUploading}
              />
            </label>
            {organisation?.logo_url && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground hover:text-destructive"
                onClick={removeLogo}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Remove logo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              PNG, JPG or SVG · max 2 MB · appears on printed work orders.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Organisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveOrg} disabled={savingOrg}>
            {savingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </div>
      </Section>

      {isManager && (
        <Section title="Industry profile">
          <p className="mb-3 text-sm text-muted-foreground">
            This decides your sidebar, dashboard and vocabulary across the app.
          </p>
          <IndustryPicker
            value={organisation?.industry_profile ?? "manufacturing"}
            onChange={setPendingProfile}
          />

          <AlertDialog
            open={pendingProfile !== null}
            onOpenChange={(open) => !open && setPendingProfile(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change industry profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  This changes your sidebar and dashboard to{" "}
                  {
                    INDUSTRY_PROFILES.find((p) => p.value === pendingProfile)
                      ?.label
                  }
                  . Everyone in your organisation will see the new layout on
                  their next page load.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmIndustryProfileChange}
                  disabled={savingIndustryProfile}
                >
                  {savingIndustryProfile && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>
      )}

      {isManager && (isGarage || isMixed) && (
        <Section title="Tax settings">
          <p className="mb-3 text-sm text-muted-foreground">
            Default VAT/tax rate applied to new garage estimates — each estimate can still override it before sending.
          </p>
          <div className="max-w-xs space-y-1.5">
            <Label>Default tax rate (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveTaxRate} disabled={savingTaxRate}>
              {savingTaxRate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </div>
        </Section>
      )}

      {isManager && (isGarage || isMixed) && (
        <Section title="Workshop settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Workshop phone</Label>
              <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="+255 …" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} placeholder="Street, city" />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Shown on printed estimates/invoices and the customer status page.</p>

          <div className="mt-5">
            <Label>Business hours</Label>
            <div className="mt-2 space-y-1.5">
              {DAYS.map(({ key, label }) => {
                const day = businessHours[key];
                return (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    <span className="w-9 text-xs font-medium text-muted-foreground">{label}</span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={day.closed}
                        onChange={(e) => setBusinessHours({ ...businessHours, [key]: { ...day, closed: e.target.checked } })}
                      />
                      Closed
                    </label>
                    <Input
                      type="time"
                      value={day.open}
                      disabled={day.closed}
                      onChange={(e) => setBusinessHours({ ...businessHours, [key]: { ...day, open: e.target.value } })}
                      className="h-8 w-28 disabled:opacity-40"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={day.close}
                      disabled={day.closed}
                      onChange={(e) => setBusinessHours({ ...businessHours, [key]: { ...day, close: e.target.value } })}
                      className="h-8 w-28 disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <Label>Invoice footer note</Label>
            <Input value={invoiceFooterNote} onChange={(e) => setInvoiceFooterNote(e.target.value)} placeholder="e.g. Thank you for your business — 30-day part warranty applies." />
          </div>

          <div className="mt-5">
            <Label>Accepted payment methods</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, methodLabel]) => (
                <label key={value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={paymentMethods.includes(value)}
                    onChange={(e) => setPaymentMethods(e.target.checked ? [...paymentMethods, value] : paymentMethods.filter((m) => m !== value))}
                  />
                  {methodLabel}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default labour rate (per hour)</Label>
              <Input type="number" min={0} value={labourRate} onChange={(e) => setLabourRate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Used as a quick-fill helper when pricing labour on an estimate.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Default customer contact channel</Label>
              <select value={messageChannel} onChange={(e) => setMessageChannel(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {Object.entries(CHANNEL_LABEL).map(([value, chLabel]) => <option key={value} value={value}>{chLabel}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveWorkshopSettings} disabled={savingWorkshopSettings}>
              {savingWorkshopSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </div>
        </Section>
      )}

      <Section title="Your profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Phone{" "}
              <span className="text-xs text-muted-foreground">
                (used for SMS alerts, e.g. critical production breaches)
              </span>
            </Label>
            <Input
              type="tel"
              placeholder="+255 7XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Department{" "}
              <span className="text-xs text-muted-foreground">
                (scopes your machine view and Production access)
              </span>
            </Label>
            <Select
              value={department || "unassigned"}
              onValueChange={(v) => setDepartment(v === "unassigned" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned (see everything)</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </Section>

      <Section title="Change password">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={changePassword}
            disabled={savingPwd || pwd.length === 0}
          >
            {savingPwd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </Section>

      <Section title="Plan">
        <p className="mb-4 text-sm text-muted-foreground">
          Switch between full-featured and simplified mode. You can change this
          anytime.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "lite" as const,
              label: "Simple",
              badge: "Small fleet",
              desc: "Machines, work orders, inventory, fuel and documents. No manufacturing modules. Perfect for 1–10 machines.",
            },
            {
              value: "standard" as const,
              label: "Standard",
              badge: "All features",
              desc: "Full access: OEE, production, safety, induction, analytics, vendors and more.",
            },
          ].map((p) => {
            const active = (organisation?.plan ?? "standard") === p.value;
            return (
              <button
                key={p.value}
                onClick={() => {
                  if (!active) switchPlan(p.value);
                }}
                className={[
                  "rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {active ? "Current" : p.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </Section>

      <LiveTvSection />

      <NotificationsSection orgId={organisation?.id} />

      <ProductionSettingsSection orgId={organisation?.id} />

      <Section title="Team members">
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {initials(m.full_name)}
                      </div>
                      <span className="font-medium">{m.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{m.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function LiveTvSection() {
  const liveUrl = `${window.location.origin}/live`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      toast.success("Live TV link copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Tv className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Live TV & factory floor displays</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Broadcast real-time KPIs (production, OEE, safety, work orders) to TVs
        and large screens across the plant. The Live view auto-refreshes and is
        built for full-screen, always-on display.
      </p>

      <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Live TV URL
        </Label>
        <div className="mt-2 flex gap-2">
          <Input value={liveUrl} readOnly className="font-mono text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(liveUrl, "_blank")}
            aria-label="Open"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SetupCard
          icon={<Monitor className="h-5 w-5 text-primary" />}
          title="Option 1 — Smart TV browser"
          steps={[
            "Open the TV's built-in browser (Samsung Tizen, LG webOS, Android TV Chrome, etc.).",
            "Sign in to MachineCare with a viewer account.",
            "Go to the Live TV URL above and press the fullscreen key (or F11).",
            "Disable screen sleep / screensaver in the TV's settings.",
          ]}
        />
        <SetupCard
          icon={<Tv className="h-5 w-5 text-primary" />}
          title="Option 2 — Mini-PC / Raspberry Pi"
          steps={[
            "Plug a small PC, Raspberry Pi, or Intel NUC into the TV via HDMI.",
            "Install Chrome / Chromium and configure kiosk mode: chromium --kiosk <Live URL>.",
            "Set the device to auto-login and auto-launch the browser on boot.",
            "Best for 24/7 industrial displays — most stable option.",
          ]}
        />
        <SetupCard
          icon={<ExternalLink className="h-5 w-5 text-primary" />}
          title="Option 3 — Chromecast / Fire TV / Apple TV"
          steps={[
            "Cast a Chrome tab (with the Live page open) from a laptop to the TV.",
            "On Apple TV, use AirPlay screen mirroring from a Mac browser.",
            "Keep the source device awake for continuous broadcast.",
          ]}
        />
        <SetupCard
          icon={<Monitor className="h-5 w-5 text-primary" />}
          title="Option 4 — Multiple screens / video wall"
          steps={[
            "Open the Live URL on each display device — every screen stays in sync via realtime data.",
            "For different views per screen, open additional dashboards (Production, OEE, Safety) on each TV.",
            "Use an HDMI splitter to clone one source across many identical screens.",
            "For a tiled video wall, use a dedicated video-wall controller (e.g., Userful, Userful, BrightSign).",
          ]}
        />
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Tips:</strong> use a dedicated{" "}
        <em>viewer</em> account for shop-floor screens, keep TVs on the same
        Wi-Fi/LAN as the plant, and prefer wired Ethernet for reliability. The
        Live view is read-only and safe to display publicly.
      </div>
    </section>
  );
}

function SetupCard({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function NotificationsSection({ orgId }: { orgId?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [cfg, setCfg] = useState({
    notifications_enabled: true,
    notifications_system_inbox: "",
    notifications_lead_days: 8,
    notifications_notify_managers: true,
    notifications_notify_technicians: true,
    notifications_notify_engineers: true,
    maintenance_alerts_sms_enabled: false,
  });
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("organisations")
        .select(
          "notifications_enabled, notifications_system_inbox, notifications_lead_days, notifications_notify_managers, notifications_notify_technicians, notifications_notify_engineers, maintenance_alerts_sms_enabled",
        )
        .eq("id", orgId)
        .maybeSingle();
      if (data)
        setCfg((c) => ({
          ...c,
          ...data,
          notifications_system_inbox: data.notifications_system_inbox ?? "",
        }));
      const { data: r } = await supabase
        .from("maintenance_email_runs")
        .select(
          "ran_at, due_soon_count, overdue_count, emails_sent, status, error_message",
        )
        .eq("organisation_id", orgId)
        .order("ran_at", { ascending: false })
        .limit(5);
      setRuns(r ?? []);
      setLoading(false);
    })();
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const payload: any = { ...cfg };
    payload.notifications_system_inbox =
      cfg.notifications_system_inbox?.trim() || null;
    payload.notifications_lead_days = Math.max(
      1,
      Math.min(30, Number(cfg.notifications_lead_days) || 8),
    );
    const { error } = await supabase
      .from("organisations")
      .update(payload)
      .eq("id", orgId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notification settings saved");
  };

  const sendNow = async () => {
    if (!orgId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke(
      "daily-maintenance-emails",
      { body: { organisation_id: orgId } },
    );
    setSending(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Maintenance digest sent");
      const { data: r } = await supabase
        .from("maintenance_email_runs")
        .select(
          "ran_at, due_soon_count, overdue_count, emails_sent, status, error_message",
        )
        .eq("organisation_id", orgId)
        .order("ran_at", { ascending: false })
        .limit(5);
      setRuns(r ?? []);
    }
  };

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Maintenance email notifications</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Automatic daily emails at 06:00 (East Africa Time) for upcoming and
        overdue maintenance — sent to managers, engineers, assigned technicians,
        and the system inbox.
      </p>

      <div className="space-y-4">
        <ToggleRow
          label="Enable maintenance emails"
          desc="Master switch for all maintenance notifications."
          checked={cfg.notifications_enabled}
          onChange={(v) => setCfg({ ...cfg, notifications_enabled: v })}
        />
        <ToggleRow
          label="Notify owners & managers"
          desc="Daily digest of overdue and upcoming services."
          checked={cfg.notifications_notify_managers}
          onChange={(v) => setCfg({ ...cfg, notifications_notify_managers: v })}
        />
        <ToggleRow
          label="Notify engineers"
          desc="Daily digest including preventive/inspection items."
          checked={cfg.notifications_notify_engineers}
          onChange={(v) =>
            setCfg({ ...cfg, notifications_notify_engineers: v })
          }
        />
        <ToggleRow
          label="Notify assigned technicians"
          desc="Personal email for overdue work orders assigned to them."
          checked={cfg.notifications_notify_technicians}
          onChange={(v) =>
            setCfg({ ...cfg, notifications_notify_technicians: v })
          }
        />
        <ToggleRow
          label="SMS overdue PM to managers"
          desc="Texts owners/managers with a phone on file when there's at least one overdue preventive-maintenance schedule. Requires AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY to be set."
          checked={cfg.maintenance_alerts_sms_enabled}
          onChange={(v) =>
            setCfg({ ...cfg, maintenance_alerts_sms_enabled: v })
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>System inbox (MachineCare)</Label>
            <Input
              type="email"
              placeholder="ops@yourcompany.com"
              value={cfg.notifications_system_inbox}
              onChange={(e) =>
                setCfg({ ...cfg, notifications_system_inbox: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              A shared mailbox that receives a copy of every digest.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Alert lead time (days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={cfg.notifications_lead_days}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  notifications_lead_days: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Services due within this many days are flagged.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={sendNow} disabled={sending}>
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send test digest now
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          settings
        </Button>
      </div>

      {runs.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent runs
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Overdue</th>
                  <th className="px-3 py-2 font-medium">Due soon</th>
                  <th className="px-3 py-2 font-medium">Emails sent</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.ran_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{r.overdue_count}</td>
                    <td className="px-3 py-2">{r.due_soon_count}</td>
                    <td className="px-3 py-2">{r.emails_sent}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "success"
                            ? "text-primary"
                            : "text-destructive"
                        }
                      >
                        {r.status}
                      </span>
                      {r.error_message && (
                        <span className="ml-2 text-xs text-destructive">
                          {r.error_message}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductionSettingsSection({ orgId }: { orgId?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({
    production_cost_per_downtime_minute: "",
    production_cost_per_scrap_unit: "",
    production_alert_attainment_threshold: "",
    production_alert_downtime_minutes: "",
    production_alerts_sms_enabled: false,
  });

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("organisations")
        .select(
          "production_cost_per_downtime_minute, production_cost_per_scrap_unit, production_alert_attainment_threshold, production_alert_downtime_minutes, production_alerts_sms_enabled",
        )
        .eq("id", orgId)
        .maybeSingle();
      if (data) {
        setCfg({
          production_cost_per_downtime_minute: data.production_cost_per_downtime_minute ?? "",
          production_cost_per_scrap_unit: data.production_cost_per_scrap_unit ?? "",
          production_alert_attainment_threshold: data.production_alert_attainment_threshold ?? "",
          production_alert_downtime_minutes: data.production_alert_downtime_minutes ?? "",
          production_alerts_sms_enabled: data.production_alerts_sms_enabled ?? false,
        });
      }
      setLoading(false);
    })();
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const num = (v: string) => (v === "" ? null : Number(v));
    const { error } = await (supabase as any)
      .from("organisations")
      .update({
        production_cost_per_downtime_minute: num(cfg.production_cost_per_downtime_minute),
        production_cost_per_scrap_unit: num(cfg.production_cost_per_scrap_unit),
        production_alert_attainment_threshold: num(cfg.production_alert_attainment_threshold),
        production_alert_downtime_minutes: num(cfg.production_alert_downtime_minutes),
        production_alerts_sms_enabled: cfg.production_alerts_sms_enabled,
      })
      .eq("id", orgId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Production settings saved");
  };

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Production settings</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Turn downtime and scrap into a cost figure, and auto-alert when a shift falls below target.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cost per downtime minute (TZS)</Label>
          <Input
            type="number" min={0} placeholder="e.g. 5000"
            value={cfg.production_cost_per_downtime_minute}
            onChange={(e) => setCfg({ ...cfg, production_cost_per_downtime_minute: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Cost per scrap unit (TZS)</Label>
          <Input
            type="number" min={0} placeholder="e.g. 1200"
            value={cfg.production_cost_per_scrap_unit}
            onChange={(e) => setCfg({ ...cfg, production_cost_per_scrap_unit: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Alert if attainment falls below (%)</Label>
          <Input
            type="number" min={0} max={100} placeholder="e.g. 80"
            value={cfg.production_alert_attainment_threshold}
            onChange={(e) => setCfg({ ...cfg, production_alert_attainment_threshold: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Alert if downtime exceeds (minutes)</Label>
          <Input
            type="number" min={0} placeholder="e.g. 60"
            value={cfg.production_alert_downtime_minutes}
            onChange={(e) => setCfg({ ...cfg, production_alert_downtime_minutes: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      {(cfg.production_alert_attainment_threshold || cfg.production_alert_downtime_minutes) && (
        <p className="mt-4 text-xs text-muted-foreground">
          When a threshold above is crossed, MachineCare emails production-department staff and every owner/manager immediately — not just an in-app notification.
        </p>
      )}

      <div className="mt-4">
        <ToggleRow
          label="Also send SMS for critical breaches"
          desc="Sent via Africa's Talking to anyone with a phone number on file, only when a shift is well past the threshold (e.g. attainment under half the target). Requires AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY to be set as Supabase Edge Function secrets — until then, no SMS goes out (logged as a failure, doesn't affect email)."
          checked={cfg.production_alerts_sms_enabled}
          onChange={(v) => setCfg({ ...cfg, production_alerts_sms_enabled: v })}
        />
      </div>

      <Button className="mt-5" onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save production settings
      </Button>
    </section>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
