import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Search, Plus, MapPin, Boxes, Radio, Eye, CheckCircle2, ShieldCheck, Mail, Phone, User } from "lucide-react";
import { MOCK_CONNECTED_CUSTOMERS, MOCK_CONNECTED_SITES, MOCK_CONNECTED_ASSETS } from "@/lib/connected-data-mock";
import { ConnectedCustomer } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectedCustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<ConnectedCustomer[]>(MOCK_CONNECTED_CUSTOMERS);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<ConnectedCustomer | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [industry, setIndustry] = useState("Mining & Heavy Equipment");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    const newCust: ConnectedCustomer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      code: code.trim() || `CUST-${name.slice(0, 3).toUpperCase()}`,
      industry,
      contact_person: contactPerson.trim() || "Operations Lead",
      email: email.trim() || "contact@client.com",
      phone: phone.trim() || "+1 555-0199",
      status: "ACTIVE",
      site_count: 1,
      asset_count: 0,
      device_count: 0,
      created_at: new Date().toISOString(),
    };

    setCustomers([newCust, ...customers]);
    setIsAddOpen(false);
    // Reset form
    setName("");
    setCode("");
    setContactPerson("");
    setEmail("");
    setPhone("");

    toast({
      title: "Customer Added Successfully",
      description: `${newCust.name} has been registered to your analytics workspace.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Customer Organizations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your client accounts, remote industrial sites & data sharing workspaces
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-semibold"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Customer Organization
        </Button>
      </div>

      {/* Analytics Company Remote Workspace Notice */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Multi-Tenant Analytics Workspace</div>
              <div className="text-xs text-muted-foreground">
                View authorized customer assets & data feeds seamlessly across all client organizations.
              </div>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {customers.length} Active Organizations
          </Badge>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer by name, code, industry..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {filtered.map((customer) => {
          const customerSites = MOCK_CONNECTED_SITES.filter((s) => s.customer_id === customer.id);
          const customerAssets = MOCK_CONNECTED_ASSETS.filter((a) => a.customer_id === customer.id);

          return (
            <Card key={customer.id} className="border-border transition-all hover:border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {customer.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {customer.code} • {customer.industry}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold"
                  >
                    {customer.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Sites</div>
                    <div className="mt-1 text-base font-bold text-foreground">
                      {customer.site_count || customerSites.length || 1}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Assets</div>
                    <div className="mt-1 text-base font-bold text-primary">
                      {customer.asset_count || customerAssets.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Devices</div>
                    <div className="mt-1 text-base font-bold text-foreground">
                      {customer.device_count || customerAssets.length}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Contact: <strong className="text-foreground">{customer.contact_person}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{customer.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedCustomer?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.code} • {selectedCustomer?.industry}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Primary Contact</span>
                <div className="font-medium">{selectedCustomer?.contact_person}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                    {selectedCustomer?.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Email</span>
                <div className="font-medium">{selectedCustomer?.email}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Phone</span>
                <div className="font-medium">{selectedCustomer?.phone}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Customer Organization
            </DialogTitle>
            <DialogDescription>
              Register a new client company to begin connecting sites, physical machines, and telemetry gateways.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCustomer} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Company / Organization Name *</Label>
              <Input
                id="cust-name"
                placeholder="e.g. Rio Tinto Mining Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-code">Client Code</Label>
                <Input
                  id="cust-code"
                  placeholder="e.g. CUST-RIO"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-ind">Industry</Label>
                <select
                  id="cust-ind"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="Mining & Heavy Equipment">Mining & Heavy Equipment</option>
                  <option value="Power Generation & Utilities">Power Generation</option>
                  <option value="Logistics & Fleet">Logistics & Fleet</option>
                  <option value="Manufacturing & Industrial">Manufacturing</option>
                  <option value="Oil, Gas & Chemicals">Oil & Gas</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-contact">Contact Person</Label>
              <Input
                id="cust-contact"
                placeholder="e.g. Johnathan Vance"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-email">Email Address</Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="contact@client.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone Number</Label>
                <Input
                  id="cust-phone"
                  placeholder="+1 555-0145"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                Create Organization
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
