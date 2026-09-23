import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BlogPost,
  BLOG_CATEGORIES,
  CURATED_COVER_PRESETS,
  DAILY_POST_TEMPLATES,
  blogService,
} from "@/services/blogService";
import {
  PenTool,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Heading,
  Bold,
  Italic,
  Quote,
  List,
  CheckSquare,
  Code,
  Calendar,
  Save,
  Send,
  Loader2,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface BlogEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: BlogPost | null;
  onSaved: (savedPost: BlogPost) => void;
}

export function BlogEditorModal({
  open,
  onOpenChange,
  post,
  onSaved,
}: BlogEditorModalProps) {
  const { user, profile, organisation } = useAuth();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("Maintenance & Reliability");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState<string>(CURATED_COVER_PRESETS[0].url);
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("published");
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [featured, setFeatured] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  // Populate form when modal opens or post changes
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setSlug(post.slug);
      setSummary(post.summary);
      setContent(post.content);
      setCategory(post.category);
      setTags(post.tags || []);
      setCoverImage(post.cover_image || CURATED_COVER_PRESETS[0].url);
      setStatus(post.status === "archived" ? "draft" : post.status);
      setPublishedAt(
        post.published_at ? new Date(post.published_at).toISOString().slice(0, 16) : ""
      );
      setFeatured(post.featured || false);
    } else {
      // New post defaults
      setTitle("");
      setSlug("");
      setSummary("");
      setContent(DAILY_POST_TEMPLATES[0].content);
      setCategory("Maintenance & Reliability");
      setTags(["Daily Maintenance", "Reliability"]);
      setCoverImage(CURATED_COVER_PRESETS[0].url);
      setStatus("published");
      setPublishedAt(new Date().toISOString().slice(0, 16));
      setFeatured(false);
    }
  }, [post, open]);

  // Auto-slug generator from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!post) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setSlug(generated);
    }
  };

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^,|,$/g, "");
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Load a daily template
  const applyTemplate = (index: number) => {
    const tpl = DAILY_POST_TEMPLATES[index];
    if (!tpl) return;
    setTitle(tpl.title);
    handleTitleChange(tpl.title);
    setCategory(tpl.category);
    setSummary(tpl.summary);
    setContent(tpl.content);
    toast.success(`Loaded template: ${tpl.title.slice(0, 30)}...`);
  };

  // Markdown formatting helper
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("blog-content-area") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 50);
  };

  // Calculate words and read time
  const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeEst = Math.max(1, Math.round(wordCount / 200));

  // Save handler
  const handleSave = async (targetStatus?: "draft" | "published" | "scheduled") => {
    if (!title.trim()) {
      toast.error("Please enter a title for your blog post");
      return;
    }
    if (!content.trim()) {
      toast.error("Please add content to your blog post");
      return;
    }

    setSaving(true);
    try {
      const finalStatus = targetStatus || status;
      const finalPublishedAt =
        finalStatus === "published"
          ? publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()
          : publishedAt ? new Date(publishedAt).toISOString() : null;

      const saved = await blogService.savePost(
        {
          id: post?.id,
          title: title.trim(),
          slug: slug.trim() || undefined,
          summary: summary.trim() || content.slice(0, 160).replace(/[#*`_]/g, "") + "...",
          content,
          category,
          tags,
          cover_image: coverImage,
          status: finalStatus,
          published_at: finalPublishedAt as any,
          featured,
        },
        {
          name: profile?.full_name || user?.email?.split("@")[0] || "MachineCare Engineer",
          role: profile?.department ? `${profile.department.toUpperCase()} Specialist` : "Reliability Specialist",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
          id: user?.id,
          orgId: organisation?.id,
        }
      );

      toast.success(
        finalStatus === "published"
          ? "🎉 Blog post published successfully!"
          : "Draft saved successfully!"
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground shadow-sm"
                style={{ background: "var(--gradient-primary)" }}
              >
                <PenTool className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold">
                {post ? "Edit Blog Post" : "Write Daily Blog Post"}
              </DialogTitle>
            </div>

            {/* Quick Templates Dropdown */}
            <Select onValueChange={(val) => applyTemplate(Number(val))}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <SelectValue placeholder="Daily Templates" />
              </SelectTrigger>
              <SelectContent>
                {DAILY_POST_TEMPLATES.map((t, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">
                    {t.title.replace(": [Machine/Subsystem]", "").replace(": [Operational Hazard]", "").replace(": [Fault / Stoppage Analysis]", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title and Slug */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Post Title *</Label>
              <Input
                placeholder="e.g. Daily Vibration Analysis: 4 Rules for Pillow Block Bearings"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="font-semibold text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">URL Slug</Label>
              <Input
                placeholder="slug-url"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="font-mono text-xs h-9 text-muted-foreground"
              />
            </div>
          </div>

          {/* Category, Status, Schedule Date */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_CATEGORIES.filter((c) => c !== "All").map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Publication Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published" className="text-xs">
                    🟢 Published Immediately
                  </SelectItem>
                  <SelectItem value="draft" className="text-xs">
                    🟡 Draft (Private)
                  </SelectItem>
                  <SelectItem value="scheduled" className="text-xs">
                    🔵 Scheduled For Later
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Date & Time</span>
                <span className="text-[10px] text-muted-foreground">Today's Edition</span>
              </Label>
              <Input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Excerpt / Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Summary / Subtitle</Label>
            <Input
              placeholder="Brief summary that appears in article cards and search previews..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          {/* Cover Image Preset Picker */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-primary" /> Curated Cover Photo Presets
              </Label>
              <span className="text-[10px] text-muted-foreground">Click to select high-res image</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CURATED_COVER_PRESETS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setCoverImage(preset.url)}
                  className={`group relative aspect-video overflow-hidden rounded-md border-2 transition-all ${
                    coverImage === preset.url
                      ? "border-primary ring-2 ring-primary/20 scale-102"
                      : "border-border hover:border-primary/50 opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 p-1 flex items-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white font-medium leading-tight line-clamp-1">
                      {preset.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-1">
              <Input
                placeholder="Or paste custom image URL..."
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Tag className="h-3 w-3 text-muted-foreground" /> Tags
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md border border-input bg-background min-h-[38px]">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="gap-1 text-xs py-0.5 px-2 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                placeholder={tags.length === 0 ? "Type tag and press Enter..." : "Add more..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="flex-1 min-w-[120px] bg-transparent text-xs outline-none"
              />
            </div>
          </div>

          {/* Content Tabs (Write vs Live Preview) */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <TabsList className="h-8">
                <TabsTrigger value="write" className="text-xs gap-1.5 px-3">
                  <PenTool className="h-3 w-3" /> Write Markdown
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs gap-1.5 px-3">
                  <Eye className="h-3 w-3" /> Live Preview
                </TabsTrigger>
              </TabsList>

              {/* Formatting Toolbar */}
              {activeTab === "write" && (
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Heading 2"
                    onClick={() => insertFormatting("## ", "\n")}
                  >
                    <Heading className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Bold"
                    onClick={() => insertFormatting("**", "**")}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Italic"
                    onClick={() => insertFormatting("*", "*")}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Maintenance Tip Box"
                    onClick={() => insertFormatting("> **💡 Maintenance Tip:**\n> ")}
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Checklist"
                    onClick={() => insertFormatting("- [ ] ")}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Bullet List"
                    onClick={() => insertFormatting("- ")}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Code / Specs"
                    onClick={() => insertFormatting("```\n", "\n```")}
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Stats */}
              <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                <span>{wordCount} words</span>
                <span>~{readTimeEst} min read</span>
              </div>
            </div>

            <TabsContent value="write" className="mt-2">
              <Textarea
                id="blog-content-area"
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your daily post in Markdown format... (supports headings, lists, quotes, checklists)"
                className="font-mono text-xs leading-relaxed resize-y min-h-[280px]"
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-2">
              <div className="rounded-lg border border-border/80 bg-card p-6 min-h-[280px] max-h-[420px] overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h1>{title || "Untitled Daily Post"}</h1>
                  {summary && <p className="lead text-muted-foreground italic">{summary}</p>}
                  {coverImage && (
                    <img
                      src={coverImage}
                      alt="Cover"
                      className="rounded-lg w-full max-h-60 object-cover my-4"
                    />
                  )}
                  {/* Clean preview rendering */}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderSimpleMarkdown(content),
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save as Draft
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(status)}
            disabled={saving}
            className="text-xs font-bold shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {status === "published" ? "Publish Daily Post" : "Save Changes"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lightweight Markdown to HTML converter for instant previews
export function renderSimpleMarkdown(md: string): string {
  if (!md) return "";

  let html = md
    // Headings
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-5 mb-2 text-foreground border-b border-border/40 pb-1">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold mt-6 mb-3 text-foreground">$1</h1>')
    // Blockquotes & Callouts
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 py-1 italic my-3 bg-primary/5 rounded-r text-sm text-foreground/90">$1</blockquote>')
    // Code blocks
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-muted p-3 rounded-lg text-xs font-mono my-3 overflow-x-auto text-foreground"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary font-semibold">$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
    // Checklists
    .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 text-xs py-0.5"><span class="text-primary font-bold">☑</span> <span>$1</span></div>')
    .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 text-xs py-0.5"><span class="text-muted-foreground">☐</span> <span>$1</span></div>')
    // Unordered lists
    .replace(/^- (.*$)/gim, '<li class="text-xs text-foreground/90 ml-4 list-disc">$1</li>')
    // Paragraphs
    .replace(/\n\n+/g, '</p><p class="my-2.5 text-xs sm:text-sm leading-relaxed text-foreground/80">');

  return `<p class="my-2.5 text-xs sm:text-sm leading-relaxed text-foreground/80">${html}</p>`;
}
