import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { BlogNavbar } from "@/components/blog/BlogNavbar";
import { BlogPost, blogService } from "@/services/blogService";
import { renderSimpleMarkdown } from "@/components/blog/BlogEditorModal";
import { IndustrialCover } from "@/components/blog/IndustrialCover";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Heart,
  Share2,
  Copy,
  Check,
  Linkedin,
  MessageCircle,
  Eye,
  Tag,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Wrench,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getLikedPostIds } from "@/services/blogService";

export default function BlogPostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track scroll progress for reading bar
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, progress)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load post details
  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      setLoading(true);
      window.scrollTo(0, 0);

      try {
        const item = await blogService.getPostBySlug(slug);
        if (item) {
          setPost(item);
          setLikesCount(item.likes_count || 0);
          setLiked(getLikedPostIds().includes(item.id));
          blogService.recordView(item);

          // Load related posts in same category
          const all = await blogService.getPublishedPosts();
          const related = all.filter((p) => p.id !== item.id).slice(0, 3);
          setRelatedPosts(related);
        }
      } catch (e) {
        console.error("Error loading blog post:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  // Handle like toggle
  const handleLike = async () => {
    if (!post) return;
    try {
      const res = await blogService.toggleLike(post);
      setLiked(res.liked);
      setLikesCount(res.newCount);
      if (res.liked) {
        toast.success("Thank you for liking this daily maintenance insight!");
      }
    } catch {
      toast.error("Failed to update like");
    }
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Article link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Social share helpers
  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(post?.title || "MachineCare Daily Article");

  const openShare = (platform: "whatsapp" | "linkedin" | "twitter") => {
    let url = "";
    if (platform === "whatsapp") {
      url = `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`;
    } else if (platform === "linkedin") {
      url = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
    } else if (platform === "twitter") {
      url = `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <BlogNavbar />
        <div className="mx-auto max-w-4xl px-4 py-16 space-y-6 animate-pulse">
          <div className="h-6 w-32 bg-muted rounded-full" />
          <div className="h-12 w-full bg-muted rounded-lg" />
          <div className="h-4 w-2/3 bg-muted rounded" />
          <div className="h-96 w-full bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <BlogNavbar />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold">Article Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The article you are looking for may have been moved, unpublished, or does not exist.
          </p>
          <Button asChild className="mt-6 font-bold" style={{ background: "var(--gradient-primary)" }}>
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Daily Journal
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Scroll Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-primary z-50 transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Navbar */}
      <BlogNavbar />

      {/* Main Article Content */}
      <main className="flex-1">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-14">
          {/* Top Breadcrumb / Back Link */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" /> Back to Articles
            </Link>

            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs font-semibold">
              {post.category}
            </Badge>
          </div>

          {/* Article Header */}
          <header className="space-y-4 text-left">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              {post.title}
            </h1>

            {post.summary && (
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-normal">
                {post.summary}
              </p>
            )}

            {/* Author Byline & Metadata (Without face picture) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-y border-border/60 py-4 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 font-bold text-xs">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{post.author_name}</p>
                  <p className="text-[11px] text-muted-foreground">{post.author_role || "Reliability Specialist"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.published_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {post.read_time_minutes} min read
                </span>
                {post.views_count > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {post.views_count} views
                    </span>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Cover Hero Image with Error Fallback */}
          <div className="my-8 overflow-hidden rounded-2xl border border-border/80 shadow-md">
            <IndustrialCover
              src={post.cover_image}
              alt={post.title}
              category={post.category}
              aspectRatio="aspect-[16/9] sm:aspect-[21/9]"
              className="w-full max-h-[480px] object-cover"
            />
          </div>

          {/* Article Body */}
          <div className="prose prose-slate dark:prose-invert max-w-none text-foreground/90 font-sans text-sm sm:text-base leading-relaxed">
            <div
              dangerouslySetInnerHTML={{
                __html: renderSimpleMarkdown(post.content),
              }}
            />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Tags:
              </span>
              {post.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs font-medium bg-muted/60">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          {/* Interactive Likes & Social Share */}
          <div className="mt-8 p-6 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant={liked ? "default" : "outline"}
                size="sm"
                onClick={handleLike}
                className={`gap-2 font-bold transition-all ${
                  liked ? "bg-red-500 hover:bg-red-600 text-white shadow-md scale-105" : "hover:border-red-500/50"
                }`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-white" : "text-red-500"}`} />
                {liked ? "Liked!" : "Helpful Article"} ({likesCount})
              </Button>
              <span className="text-xs text-muted-foreground">
                Found this helpful? Give it a thumbs up!
              </span>
            </div>

            {/* Share Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Share:</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Copy Link"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                title="Share to WhatsApp"
                onClick={() => openShare("whatsapp")}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                title="Share to LinkedIn"
                onClick={() => openShare("linkedin")}
              >
                <Linkedin className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Verified Editorial Bio (Picture removed, sleek badge) */}
          <div className="mt-10 rounded-2xl border border-border/80 bg-muted/20 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-foreground text-base">{post.author_name}</h4>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 font-semibold">
                  Verified Technical Insight
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Contributing operational engineering guidelines, preventative checklists, and equipment diagnostics for industrial machine reliability.
              </p>
            </div>
          </div>

          {/* Related Articles Section */}
          {relatedPosts.length > 0 && (
            <div className="mt-16 pt-10 border-t border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  More Daily Articles
                </h3>
                <Link to="/blog" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {relatedPosts.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/blog/${rel.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 transition-all hover:-translate-y-1"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                      <IndustrialCover
                        src={rel.cover_image}
                        alt={rel.title}
                        category={rel.category}
                        aspectRatio="aspect-[16/9]"
                      />
                    </div>
                    <div className="p-4 flex flex-1 flex-col justify-between">
                      <div>
                        <Badge variant="outline" className="text-[10px] mb-2 border-primary/30 text-primary">
                          {rel.category}
                        </Badge>
                        <h5 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {rel.title}
                        </h5>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                        <span className="font-medium text-foreground">{rel.author_name}</span>
                        <span>{rel.read_time_minutes} min read</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-3 w-3" />
            </div>
            <span className="font-bold text-foreground">MachineCare Hub</span>
          </div>
          <p>© {new Date().getFullYear()} MachineCare Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
