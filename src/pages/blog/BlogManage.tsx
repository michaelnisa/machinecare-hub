import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BlogPost, blogService } from "@/services/blogService";
import { DailyStreakCard } from "@/components/blog/DailyStreakCard";
import { BlogEditorModal } from "@/components/blog/BlogEditorModal";
import { IndustrialCover } from "@/components/blog/IndustrialCover";
import {
  PenTool,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Heart,
  FileText,
  Star,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAuth } from "@/contexts/AuthContext";

export default function BlogManage() {
  const { user } = useAuth();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  // Delete dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await blogService.getAllPosts();
      setPosts(data);
    } catch (e) {
      console.error("Failed to load blog posts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const streakStats = blogService.computeDailyStreak(posts);

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    const matchesStatus =
      statusFilter === "all" ? true : p.status === statusFilter;
    const matchesSearch =
      searchTerm.trim() === ""
        ? true
        : p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleCreateNew = () => {
    setEditingPost(null);
    setEditorOpen(true);
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setEditorOpen(true);
  };

  const handleDeleteClick = (post: BlogPost) => {
    setPostToDelete(post);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    try {
      await blogService.deletePost(postToDelete.id);
      toast.success("Blog post deleted successfully");
      loadPosts();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete post");
    } finally {
      setDeleteConfirmOpen(false);
      setPostToDelete(null);
    }
  };

  const handleToggleFeatured = async (post: BlogPost) => {
    try {
      const updated = await blogService.savePost({
        ...post,
        featured: !post.featured,
      });
      toast.success(
        updated.featured
          ? "Marked as Featured Daily Post"
          : "Removed from Featured"
      );
      loadPosts();
    } catch (e: any) {
      toast.error(e.message || "Failed to update post");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <PenTool className="h-6 w-6 text-primary" />
            Daily Blog Studio
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Publish daily equipment reliability tips, safety alerts, and engineering insights for your organization and the public.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link to="/blog" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> View Public Journal
            </Link>
          </Button>

          <Button
            onClick={handleCreateNew}
            size="sm"
            className="font-bold gap-1.5 shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Plus className="h-4 w-4" /> Write Today's Post
          </Button>
        </div>
      </div>

      {/* Daily Writing Streak Tracker */}
      <DailyStreakCard
        currentStreak={streakStats.currentStreak}
        bestStreak={streakStats.bestStreak}
        postedToday={streakStats.postedToday}
        totalPosts={posts.length}
        totalWords={streakStats.totalWords}
        onWritePost={handleCreateNew}
      />

      {/* Filter and Search Bar */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles by title, category, or tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: "All Posts", value: "all", count: posts.length },
                {
                  label: "Published",
                  value: "published",
                  count: posts.filter((p) => p.status === "published").length,
                },
                {
                  label: "Drafts",
                  value: "draft",
                  count: posts.filter((p) => p.status === "draft").length,
                },
                {
                  label: "Scheduled",
                  value: "scheduled",
                  count: posts.filter((p) => p.status === "scheduled").length,
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    statusFilter === tab.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={loadPosts}
                title="Refresh posts"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[45%] text-xs">Article</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Published</TableHead>
                  <TableHead className="text-xs text-center">Engagement</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-16">
                        <div className="h-6 w-full bg-muted/50 animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-44 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm font-semibold">No posts found</p>
                        <p className="text-xs mt-0.5">
                          {searchTerm || statusFilter !== "all"
                            ? "Try resetting your search or filter criteria."
                            : "Start your daily streak by creating your first post!"}
                        </p>
                        <Button
                          onClick={handleCreateNew}
                          size="sm"
                          className="mt-3 text-xs"
                          style={{ background: "var(--gradient-primary)" }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Create First Post
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPosts.map((post) => (
                    <TableRow key={post.id} className="hover:bg-muted/30 transition-colors">
                      {/* Post Title & Thumbnail */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted border border-border">
                            <IndustrialCover
                              src={post.cover_image}
                              alt={post.title}
                              category={post.category}
                              aspectRatio="aspect-[16/10]"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                                {post.title}
                              </h4>
                              {post.featured && (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] py-0 px-1.5 h-4 gap-1">
                                  <Star className="h-2.5 w-2.5 fill-amber-500" /> Featured
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {post.summary}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-semibold text-muted-foreground">
                          {post.category}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {post.status === "published" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px]">
                            Published
                          </Badge>
                        ) : post.status === "scheduled" ? (
                          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px]">
                            Scheduled
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px]">
                            Draft
                          </Badge>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {post.published_at
                              ? new Date(post.published_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Unpublished"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            By {post.author_name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Engagement */}
                      <TableCell className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1" title="Likes">
                            <Heart className="h-3 w-3 text-red-500" /> {post.likes_count}
                          </span>
                          <span className="flex items-center gap-1" title="Views">
                            <Eye className="h-3 w-3 text-muted-foreground" /> {post.views_count}
                          </span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                            title={post.featured ? "Unfeature" : "Feature on Hero"}
                            onClick={() => handleToggleFeatured(post)}
                          >
                            <Star className={`h-3.5 w-3.5 ${post.featured ? "fill-amber-500 text-amber-500" : ""}`} />
                          </Button>

                          {post.status === "published" && (
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="View Public Post">
                              <Link to={`/blog/${post.slug}`} target="_blank">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit Post"
                            onClick={() => handleEdit(post)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete Post"
                            onClick={() => handleDeleteClick(post)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Editor Modal */}
      <BlogEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        post={editingPost}
        onSaved={(saved) => {
          loadPosts();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{postToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
