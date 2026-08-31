import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Send,
  Plus,
  Search,
  ShieldCheck,
  Factory,
  Truck,
  Wrench,
  Layers,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

interface OnboardingRequest {
  id: string;
  name: string;
  contact: string;
  company: string;
  industry: string;
  status: "pending" | "contacted" | "completed" | "rejected";
  created_at: string;
}

interface Organisation {
  id: string;
  name: string;
  industry_profile: string | null;
  plan: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  organisation_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { isOwner } = useUserRole();
  const { t, currentLang } = useI18n();
  const isSwahili = currentLang === "sw";

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [smsText, setSmsText] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

  // New Org state
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgIndustry, setNewOrgIndustry] = useState("manufacturing");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Onboarding Requests
      const { data: reqData, error: reqErr } = await (supabase as any)
        .from("onboarding_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (reqErr) console.warn("Could not fetch onboarding requests", reqErr);
      else setRequests((reqData as OnboardingRequest[]) || []);

      // 2. Fetch Organisations
      const { data: orgData, error: orgErr } = await supabase
        .from("organisations")
        .select("*")
        .order("created_at", { ascending: false });

      if (orgErr) console.warn("Could not fetch organisations", orgErr);
      else setOrganisations((orgData as Organisation[]) || []);

      // 3. Fetch Profiles
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("id, organisation_id, full_name, email, created_at");

      if (profErr) console.warn("Could not fetch profiles", profErr);
      else setProfiles((profData as Profile[]) || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute metrics
  const stats = useMemo(() => {
    const pendingReqs = requests.filter((r) => r.status === "pending").length;
    const contactedReqs = requests.filter((r) => r.status === "contacted").length;
    const completedReqs = requests.filter((r) => r.status === "completed").length;
    const totalOrgs = organisations.length;
    const totalUsers = profiles.length;

    const industryCounts = {
      manufacturing: organisations.filter((o) => o.industry_profile === "manufacturing").length,
      fleet_logistics: organisations.filter((o) => o.industry_profile === "fleet_logistics").length,
      garage: organisations.filter((o) => o.industry_profile === "garage").length,
      mixed: organisations.filter((o) => o.industry_profile === "mixed").length,
    };

    return {
      pendingReqs,
      contactedReqs,
      completedReqs,
      totalOrgs,
      totalUsers,
      industryCounts,
    };
  }, [requests, organisations, profiles]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.contact.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  // Filtered organisations
  const filteredOrgs = useMemo(() => {
    return organisations.filter((org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [organisations, searchQuery]);

  // Handle Request Status Update
  const updateRequestStatus = async (
    id: string,
    newStatus: "pending" | "contacted" | "completed" | "rejected"
  ) => {
    try {
      const { error } = await (supabase as any)
        .from("onboarding_requests")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      toast.success(
        isSwahili
          ? `Status imesasishwa kuwa ${newStatus}`
          : `Status updated to ${newStatus}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Handle Approve & Copy Invite Link
  const handleApproveAndCopy = async (req: OnboardingRequest) => {
    await updateRequestStatus(req.id, "completed");
    const inviteUrl = `${window.location.origin}/signup?company=${encodeURIComponent(
      req.company
    )}&industry=${req.industry}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success(
      isSwahili
        ? "Kiungo cha kujiunga kimenakiliwa kwenye clipboard!"
        : "Signup link copied to clipboard!"
    );
  };

  // Handle Direct SMS Dispatch
  const handleSendSms = async () => {
    if (!targetPhone || !smsText) {
      toast.error(isSwahili ? "Jaza namba na ujumbe" : "Enter phone and message");
      return;
    }
    setSendingSms(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to: targetPhone, message: smsText },
      });

      if (error) throw error;

      toast.success(
        isSwahili
          ? "Ujumbe wa SMS umetunwa kikamilifu!"
          : "SMS message sent successfully!"
      );
      setSmsModalOpen(false);
      setSmsText("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const getIndustryIcon = (ind: string | null) => {
    switch (ind) {
      case "manufacturing":
        return <Factory className="h-4 w-4 text-blue-500" />;
      case "fleet_logistics":
        return <Truck className="h-4 w-4 text-emerald-500" />;
      case "garage":
        return <Wrench className="h-4 w-4 text-orange-500" />;
      default:
        return <Layers className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isSwahili ? "Usimamizi wa Jukwaa & Onboarding" : "Platform Admin & Onboarding"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSwahili
              ? "Fuatilia maombi ya kujiunga, simamia makampuni na wateja wa MachineCare Hub."
              : "Monitor access requests, manage onboarded companies, and track system metrics."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {isSwahili ? "Hifadhi Upya" : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={() => setSmsModalOpen(true)}
            style={{ background: "var(--gradient-primary)" }}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {isSwahili ? "Tuma SMS" : "Send SMS"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isSwahili ? "Maombi Yanayosubiri" : "Pending Requests"}
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReqs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.contactedReqs} {isSwahili ? "wamepigiwa simu" : "contacted"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isSwahili ? "Makampuni Yaliyojiunga" : "Registered Companies"}
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrgs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isSwahili ? "Makampuni amilifu" : "Active organisations"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isSwahili ? "Watumiaji Wote" : "Total Platform Users"}
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isSwahili ? "Wafanyakazi waliosajiliwa" : "Registered profiles"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isSwahili ? "Maombi Yaliyokubaliwa" : "Approved Onboardings"}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedReqs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isSwahili ? "Wamekamilisha onboarding" : "Access granted"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="requests" className="relative">
            {isSwahili ? "Maombi ya Kujiunga" : "Access Requests"}
            {stats.pendingReqs > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {stats.pendingReqs}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="companies">
            {isSwahili ? "Makampuni & Wateja" : "Companies & Clients"} ({stats.totalOrgs})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ACCESS REQUESTS */}
        <TabsContent value="requests" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isSwahili ? "Tafuta jina, kampuni au simu..." : "Search name, company or contact..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none"
              >
                <option value="all">{isSwahili ? "Zote" : "All Statuses"}</option>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isSwahili ? "Mwombaji" : "Requester"}</TableHead>
                  <TableHead>{isSwahili ? "Kampuni & Sekta" : "Company & Industry"}</TableHead>
                  <TableHead>{isSwahili ? "Mawasiliano" : "Contact Details"}</TableHead>
                  <TableHead>{isSwahili ? "Tarehe" : "Submitted Date"}</TableHead>
                  <TableHead>{isSwahili ? "Hali" : "Status"}</TableHead>
                  <TableHead className="text-right">{isSwahili ? "Kitendo" : "Action"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {isSwahili ? "Hakuna maombi yaliyopatikana." : "No access requests found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-semibold">{req.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getIndustryIcon(req.industry)}
                          <div>
                            <p className="font-medium text-sm">{req.company}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {req.industry.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <span className="inline-flex items-center gap-1 text-foreground font-mono">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {req.contact}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {req.status === "pending" && (
                          <Badge variant="outline" className="border-amber-500 bg-amber-50 text-amber-700">
                            Pending
                          </Badge>
                        )}
                        {req.status === "contacted" && (
                          <Badge variant="outline" className="border-blue-500 bg-blue-50 text-blue-700">
                            Contacted
                          </Badge>
                        )}
                        {req.status === "completed" && (
                          <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
                            Completed
                          </Badge>
                        )}
                        {req.status === "rejected" && (
                          <Badge variant="outline" className="border-red-500 bg-red-50 text-red-700">
                            Rejected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApproveAndCopy(req)}
                            title="Approve & Copy Signup Link"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-600" />
                            {isSwahili ? "Kukubali & Nakili" : "Approve & Copy"}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTargetPhone(req.contact);
                              setSmsText(
                                `Jambo ${req.name}, ombi lako la kujiunga na MachineCare kwa ajili ya ${req.company} limekubaliwa. Jiunge hapa: ${window.location.origin}/signup`
                              );
                              setSmsModalOpen(true);
                            }}
                            title="Send SMS notification"
                          >
                            <Send className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: COMPANIES & CUSTOMERS */}
        <TabsContent value="companies" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isSwahili ? "Tafuta kampuni..." : "Search company name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs.map((org) => {
              const memberCount = profiles.filter((p) => p.organisation_id === org.id).length;
              return (
                <Card key={org.id} className="border-border shadow-sm hover:border-primary/40 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold">
                          {org.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{org.name}</CardTitle>
                          <CardDescription className="text-xs capitalize">
                            {org.industry_profile?.replace("_", " ") || "Manufacturing"}
                          </CardDescription>
                        </div>
                      </div>
                      {getIndustryIcon(org.industry_profile)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground border-t border-border pt-3">
                      <span>{isSwahili ? "Wafanyakazi:" : "Registered Members:"}</span>
                      <span className="font-semibold text-foreground">{memberCount} users</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{isSwahili ? "Ilifunguliwa:" : "Created:"}</span>
                      <span className="font-medium text-foreground">
                        {new Date(org.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        const link = `${window.location.origin}/signup?org_id=${org.id}`;
                        navigator.clipboard.writeText(link);
                        toast.success(
                          isSwahili
                            ? "Kiungo cha kualika mfanyakazi kimenakiliwa!"
                            : "Member invite link copied!"
                        );
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {isSwahili ? "Nakili Kiungo cha Kualika" : "Copy Team Invite Link"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* SMS MODAL */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isSwahili ? "Tuma Ujumbe wa SMS" : "Send SMS Notification"}</DialogTitle>
            <DialogDescription>
              {isSwahili
                ? "Tuma SMS moja kwa moja kupitia Africa's Talking kwenda kwa mteja."
                : "Send an SMS directly via Africa's Talking to the customer phone number."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">{isSwahili ? "Namba ya Simu" : "Recipient Phone Number"}</Label>
              <Input
                id="phone"
                placeholder="+255 7XX XXX XXX"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-msg">{isSwahili ? "Ujumbe wa SMS" : "SMS Text Message"}</Label>
              <textarea
                id="sms-msg"
                rows={4}
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={isSwahili ? "Andika ujumbe hapa..." : "Type SMS message here..."}
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsModalOpen(false)}>
              {isSwahili ? "Ghairi" : "Cancel"}
            </Button>
            <Button
              onClick={handleSendSms}
              disabled={sendingSms}
              style={{ background: "var(--gradient-primary)" }}
            >
              {sendingSms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSwahili ? "Tuma SMS Sasa" : "Send SMS Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
