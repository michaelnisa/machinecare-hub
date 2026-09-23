import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BlogNavbar } from "@/components/blog/BlogNavbar";
import {
  BlogPost,
  BLOG_CATEGORIES,
  BlogCategory,
  blogService,
} from "@/services/blogService";
import { IndustrialCover } from "@/components/blog/IndustrialCover";
import {
  Search,
  Calendar,
  Clock,
  ArrowRight,
  Heart,
  Sparkles,
  TrendingUp,
  Tag,
  BookOpen,
  CheckCircle2,
  Mail,
  Send,
  PenTool,
  Wrench,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function BlogList() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [emailSubscribed, setEmailSubscribed] = useState(false);
  const [subscriberEmail, setSubscriberEmail] = useState("");

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await blogService.getPublishedPosts(selectedCategory, searchQuery);
      setPosts(data);
    } catch (e) {
      console.error("Failed to load blog posts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [selectedCategory, searchQuery]);

  const featuredPost = posts.find((p) => p.featured) || posts[0];
  const regularPosts = posts.filter((p) => p.id !== featuredPost?.id);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail || !subscriberEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setEmailSubscribed(true);
    toast.success("Subscribed! You will receive our daily engineering digest.");
    setSubscriberEmail("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Public Navbar */}
      <BlogNavbar />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/5 via-background to-background py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <Badge
              variant="outline"
              className="mb-4 gap-1.5 border-primary/30 bg-primary/10 text-primary px-3 py-1 font-semibold text-xs rounded-full shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              MachineCare Journal • Updated Daily
            </Badge>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
              Industrial Reliability & Plant Maintenance Insights
            </h1>

            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Actionable daily engineering articles, predictive vibration standards, fluid cleanliness protocols, fleet maintenance guides, and zero-incident safety practices.
            </p>

            {/* Quick in-app post button for authors */}
            {user && (
              <div className="mt-6 flex items-center gap-3">
                <Button asChild size="sm" className="font-bold shadow-md" style={{ background: "var(--gradient-primary)" }}>
                  <Link to="/blog/manage">
                    <PenTool className="h-3.5 w-3.5 mr-1.5" /> Manage & Write Posts
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-10 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-md rounded-xl overflow-hidden border border-border bg-card">
              <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search maintenance tips, vibration, hydraulics, safety..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-24 h-12 border-0 bg-transparent text-sm focus-visible:ring-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded bg-muted"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories Pill Navigation */}
          <div id="categories" className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-12">
        {loading ? (
          <div className="space-y-6">
            <div className="h-96 rounded-2xl bg-muted/40 animate-pulse" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-72 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* FEATURED POST HERO (if exists and no search query) */}
            {featuredPost && !searchQuery && selectedCategory === "All" && (
              <div className="mb-14">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Featured Daily Editorial
                  </span>
                </div>

                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="group block relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg transition-all hover:border-primary/50 hover:shadow-xl"
                >
                  <div className="grid md:grid-cols-12 gap-0">
                    <div className="md:col-span-7 relative overflow-hidden bg-muted">
                      <IndustrialCover
                        src={featuredPost.cover_image}
                        alt={featuredPost.title}
                        category={featuredPost.category}
                        aspectRatio="aspect-[16/10] md:h-full"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-4 left-4 z-10">
                        <Badge className="bg-primary text-primary-foreground font-bold shadow-md">
                          {featuredPost.category}
                        </Badge>
                      </div>
                    </div>

                    <div className="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between">
                      <div>
                        <div className="hidden md:flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-[11px]">
                            {featuredPost.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {featuredPost.read_time_minutes} min read
                          </span>
                        </div>

                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-3">
                          {featuredPost.title}
                        </h2>

                        <p className="mt-3 text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {featuredPost.summary}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {featuredPost.tags?.slice(0, 3).map((t) => (
                            <span key={t} className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-primary" /> {featuredPost.author_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-4.5">
                            {new Date(featuredPost.published_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                          Read Article <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* RECENT POSTS GRID */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {selectedCategory === "All" ? "Latest Daily Publications" : `${selectedCategory} Articles`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Showing {posts.length} {posts.length === 1 ? "article" : "articles"}
                  </p>
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
                  <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <h4 className="text-base font-bold">No articles found</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Try adjusting your search query or selecting a different category from above.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(selectedCategory === "All" && !searchQuery ? regularPosts : posts).map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1"
                    >
                      {/* Cover thumbnail with fallback */}
                      <div className="relative">
                        <IndustrialCover
                          src={post.cover_image}
                          alt={post.title}
                          category={post.category}
                          aspectRatio="aspect-[16/9]"
                        />
                        <Badge
                          variant="secondary"
                          className="absolute top-3 left-3 bg-background/90 backdrop-blur-md text-[10px] font-bold z-10"
                        >
                          {post.category}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(post.published_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
                            </span>
                          </div>

                          <h4 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h4>

                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {post.summary}
                          </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground truncate max-w-[140px]">
                            {post.author_name}
                          </span>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Heart className="h-3 w-3 text-red-500 fill-red-500/20" /> {post.likes_count}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-primary group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* NEWSLETTER BANNER */}
        <section id="newsletter" className="mt-20 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-card to-primary/5 p-8 sm:p-12 shadow-sm">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-md">
              <Mail className="h-5 w-5" />
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Get the Daily Reliability Digest
            </h3>

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Every morning at 06:00 AM, our senior maintenance engineers share one verified tip on machinery uptime, vibration analysis, or safety compliance. Zero spam.
            </p>

            {emailSubscribed ? (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-3 px-4 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4" /> You are subscribed! Check your inbox tomorrow morning.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={subscriberEmail}
                  onChange={(e) => setSubscriberEmail(e.target.value)}
                  className="h-11 bg-background text-xs"
                />
                <Button type="submit" className="h-11 font-bold shrink-0 px-5 shadow-md" style={{ background: "var(--gradient-primary)" }}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Subscribe Free
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-3 w-3" />
            </div>
            <span className="font-bold text-foreground">MachineCare Hub</span>
            <span>• Daily Engineering Publications</span>
          </div>
          <p>© {new Date().getFullYear()} MachineCare Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
