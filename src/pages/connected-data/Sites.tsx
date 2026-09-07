import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Building2, Search, Plus, Boxes, Radio, CheckCircle2, AlertTriangle, Navigation } from "lucide-react";
import { MOCK_CONNECTED_SITES, MOCK_CONNECTED_ASSETS, MOCK_CONNECTED_CUSTOMERS } from "@/lib/connected-data-mock";
import { ConnectedSite } from "@/types/connected-data";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectedSitesPage() {
  const { toast } = useToast();
  const [sites, setSites] = useState<ConnectedSite[]>(MOCK_CONNECTED_SITES);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [customerId, setCustomerId] = useState(MOCK_CONNECTED_CUSTOMERS[0]?.id || "");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState("");

  const filtered = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Site Name is required", variant: "destructive" });
      return;
    }

    const selectedCust = MOCK_CONNECTED_CUSTOMERS.find((c) => c.id === customerId) || MOCK_CONNECTED_CUSTOMERS[0];

    const newSite: ConnectedSite = {
      id: `site-${Date.now()}`,
      customer_id: selectedCust.id,
      customer_name: selectedCust.name,
      name: name.trim(),
      code: code.trim() || `SITE-${name.slice(0, 3).toUpperCase()}`,
      location: location.trim() || "Industrial Zone 4",
      coordinates: coordinates.trim() || "-22.3501, 118.4902",
      asset_count: 0,
      active_device_count: 0,
      status: "OPERATIONAL",
      created_at: new Date().toISOString(),
    };

    setSites([newSite, ...sites]);
    setIsAddOpen(false);
    setName("");
    setCode("");
    setLocation("");
    setCoordinates("");

    toast({
      title: "Site Added Successfully",
      description: `${newSite.name} registered under ${selectedCust.name}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Industrial Sites & Facilities
          </h1>
          <p className="text-sm text-muted-foreground">
            Geographic facilities, plants & remote site-level physical asset hierarchies
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-semibold"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Industrial Site
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search site by name, customer, location..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Sites List */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((site) => {
          const siteAssets = MOCK_CONNECTED_ASSETS.filter((a) => a.site_id === site.id);

          return (
            <Card key={site.id} className="border-border hover:border-primary/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {site.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span>{site.customer_name}</span>
                      <span>•</span>
                      <span>{site.code}</span>
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      site.status === "OPERATIONAL"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }
                  >
                    {site.status === "OPERATIONAL" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <AlertTriangle className="mr-1 h-3 w-3" />
                    )}
                    {site.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3 text-primary" />
                    {site.location}
                  </span>
                  <span className="font-mono">{site.coordinates}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-center text-xs">
                  <div>
                    <span className="text-muted-foreground">Assigned Assets:</span>
                    <strong className="ml-1 text-foreground">{site.asset_count || siteAssets.length}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active Gateways:</span>
                    <strong className="ml-1 text-primary">{site.active_device_count || siteAssets.length}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Site Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Industrial Site
            </DialogTitle>
            <DialogDescription>
              Create a new physical location, plant, or mining site to organize machinery and IoT gateways.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSite} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Site / Facility Name *</Label>
              <Input
                id="site-name"
                placeholder="e.g. Mine Site B - Underground"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="site-code">Site Code</Label>
                <Input
                  id="site-code"
                  placeholder="e.g. SITE-MSB"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="site-cust">Customer Organization</Label>
                <select
                  id="site-cust"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {MOCK_CONNECTED_CUSTOMERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-loc">Location / Region</Label>
              <Input
                id="site-loc"
                placeholder="e.g. Pilbara Region, WA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-coords">GPS Coordinates (Optional)</Label>
              <Input
                id="site-coords"
                placeholder="e.g. -22.3501, 118.4902"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                Create Site
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
