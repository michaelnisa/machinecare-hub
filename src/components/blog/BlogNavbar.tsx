import { Link } from "react-router-dom";
import { Wrench, Sparkles, PenTool, ArrowRight, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface BlogNavbarProps {
  onSearchClick?: () => void;
}

export function BlogNavbar({ onSearchClick }: BlogNavbarProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/blog" className="flex items-center gap-2.5 group">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-md transition-transform group-hover:scale-105"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wrench className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight flex items-center gap-1.5">
                MachineCare <span className="text-primary font-semibold">Journal</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground -mt-1">
                Daily Reliability & Engineering
              </span>
            </div>
          </Link>
        </div>

        {/* Center Links */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/blog" className="hover:text-foreground transition-colors font-semibold text-foreground">
            Daily Articles
          </Link>
          <a href="#categories" className="hover:text-foreground transition-colors">
            Topics
          </a>
          <a href="#newsletter" className="hover:text-foreground transition-colors">
            Daily Digest
          </a>
          <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1 text-xs">
            <Home className="h-3.5 w-3.5" /> MachineCare Platform
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher compact />

          {user ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
                <Link to="/blog/manage">
                  <PenTool className="h-3.5 w-3.5" /> Post Daily Blog
                </Link>
              </Button>
              <Button asChild size="sm" style={{ background: "var(--gradient-primary)" }}>
                <Link to="/dashboard">
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Dashboard
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" style={{ background: "var(--gradient-primary)" }}>
                <Link to="/signup">
                  Request Access <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
