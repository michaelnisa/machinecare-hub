import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { Sidebar } from "@/components/Sidebar";
import { Menu, X, ShieldCheck, Search, QrCode, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isPlatformAdmin } from "@/lib/admin";
import { CommandPalette } from "@/components/CommandPalette";
import { TechnicianQrModal } from "@/components/TechnicianQrModal";

export default function AppLayout() {
  const { user, loading, organisation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const isAdmin = isPlatformAdmin(user?.email);
  const companyDisplayName =
    (organisation?.name && organisation.name !== "MachineCare" && organisation.name !== "My Company")
      ? organisation.name
      : user?.user_metadata?.company_name ||
        user?.user_metadata?.organisation_name ||
        organisation?.name ||
        "Company";

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  if (loading || !user) return <PageLoader />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Global Modals */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <TechnicianQrModal open={qrOpen} onOpenChange={setQrOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            {organisation?.logo_url ? (
              <img
                src={organisation.logo_url}
                alt={companyDisplayName}
                className="h-6 w-6 rounded object-contain border border-border bg-background p-0.5 shrink-0"
              />
            ) : null}
            <span className="font-semibold text-sm truncate">{companyDisplayName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCommandOpen(true)} title="Search">
              <Search className="h-4 w-4 text-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setQrOpen(true)} title="Technician QR">
              <QrCode className="h-4 w-4 text-primary" />
            </Button>
            <LanguageSwitcher compact />
            <NotificationsBell />
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden h-14 items-center justify-between border-b border-border bg-background px-6 md:flex">
          {/* Spotlight search trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-3 text-muted-foreground w-72 justify-between h-9 bg-muted/30 hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-xs">
              <Search className="h-3.5 w-3.5 text-primary" />
              Search or type command...
            </span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <div className="flex items-center gap-2.5">
            {organisation && (
              <div className="hidden lg:flex items-center gap-2 pr-2.5 border-r border-border">
                {organisation.logo_url ? (
                  <img
                    src={organisation.logo_url}
                    alt={companyDisplayName}
                    className="h-7 w-7 rounded-md object-contain border border-border bg-background p-0.5 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {companyDisplayName ? companyDisplayName.trim().charAt(0).toUpperCase() : "C"}
                  </div>
                )}
                <span className="text-xs font-semibold text-foreground truncate max-w-[160px]" title={companyDisplayName}>
                  {companyDisplayName}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-1.5 text-xs h-9"
              title="Quick QR scanning for shop floor equipment"
            >
              <QrCode className="h-3.5 w-3.5 text-primary" />
              <span>Tech QR Scan</span>
            </Button>

            <LanguageSwitcher />
            <NotificationsBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <ErrorBoundary fullScreen={false} resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
