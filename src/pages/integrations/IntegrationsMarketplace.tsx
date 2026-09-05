import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink, Plug, CheckCircle2, Clock, Sparkles, Building2, Layers } from "lucide-react";
import { CONNECTOR_CATALOG, integrationsService } from "@/services/integrationsService";
import { ConnectionWizardModal } from "./ConnectionWizardModal";

const CATEGORIES = ["All", "ERP", "EAM"];

export function IntegrationsMarketplace() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("odoo");

  const connectedSystems = integrationsService.getConnectedSystems();

  const filtered = CONNECTOR_CATALOG.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleConnectClick = (slug: string) => {
    setSelectedSlug(slug);
    setWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Category Pills & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors (Odoo, SAP, Dynamics, Maximo)..."
            className="pl-9 text-xs h-9"
          />
        </div>
      </div>

      {/* Grid of Connectors */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const isConnected = connectedSystems.some((c) => c.connector_type === item.slug);

          return (
            <Card key={item.slug} className="border-border flex flex-col justify-between hover:border-border/80 transition-all shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm uppercase">
                      {item.name.substring(0, 2)}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                        {item.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                          {item.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {item.version}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isConnected ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> CONNECTED
                    </Badge>
                  ) : item.status === "coming_soon" ? (
                    <Badge variant="secondary" className="text-[10px] font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> COMING SOON
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                      READY
                    </Badge>
                  )}
                </div>

                <CardDescription className="text-xs text-muted-foreground mt-3 line-clamp-3">
                  {item.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pb-3">
                {/* Supported Capabilities */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-foreground">Capabilities:</div>
                  <div className="flex flex-wrap gap-1">
                    {item.capabilities.read.slice(0, 4).map((cap) => (
                      <span key={cap} className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                        ↓ {cap}
                      </span>
                    ))}
                    {item.capabilities.write.slice(0, 2).map((cap) => (
                      <span key={cap} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-medium">
                        ↑ {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-border flex items-center justify-between">
                <a
                  href={item.docs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Docs
                </a>

                {isConnected ? (
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleConnectClick(item.slug)}>
                    Manage Sync
                  </Button>
                ) : item.status === "available" ? (
                  <Button size="sm" className="text-xs gap-1.5" onClick={() => handleConnectClick(item.slug)}>
                    <Plug className="h-3.5 w-3.5" /> Connect
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled className="text-xs text-muted-foreground">
                    In Roadmap
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <ConnectionWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialConnectorSlug={selectedSlug}
      />
    </div>
  );
}
export default IntegrationsMarketplace;
