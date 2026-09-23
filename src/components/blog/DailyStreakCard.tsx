import { Flame, CheckCircle2, Clock, Sparkles, BookOpen, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DailyStreakCardProps {
  currentStreak: number;
  bestStreak: number;
  postedToday: boolean;
  totalPosts: number;
  totalWords: number;
  onWritePost: () => void;
  onSelectTemplate?: (templateIndex: number) => void;
}

export function DailyStreakCard({
  currentStreak,
  bestStreak,
  postedToday,
  totalPosts,
  totalWords,
  onWritePost,
  onSelectTemplate,
}: DailyStreakCardProps) {
  // Generate days of the current week for visual dots
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

  return (
    <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/5 shadow-sm">
      <div className="absolute right-0 top-0 -mt-6 -mr-6 h-36 w-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Streak Counter & Status */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-inner">
              <Flame className="h-8 w-8 animate-pulse text-amber-500 fill-amber-500/20" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-foreground">
                  {currentStreak} Day{currentStreak === 1 ? "" : "s"}
                </span>
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold bg-amber-500/5 text-xs">
                  Daily Publishing Streak
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                {postedToday ? (
                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    You've published today's blog post! Streak secured.
                  </span>
                ) : (
                  <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Today's blog post is pending. Publish before midnight to keep your streak!
                  </span>
                )}
              </p>

              {/* Day tracker dots */}
              <div className="mt-3 flex items-center gap-1.5">
                {dayNames.map((name, i) => {
                  const isCurrent = i === todayIndex;
                  const isCompleted = i < todayIndex || (i === todayIndex && postedToday);

                  return (
                    <div
                      key={name}
                      className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        isCompleted
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isCurrent
                          ? "border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                          : "bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <span>{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats & Call-to-action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex items-center justify-around sm:justify-end gap-6 sm:pr-4 sm:border-r border-border text-center">
              <div>
                <p className="text-xl font-bold text-foreground">{totalPosts}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Posts</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">
                  {totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Words Shared</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{bestStreak}d</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Best Streak</p>
              </div>
            </div>

            <Button
              onClick={onWritePost}
              size="lg"
              className="h-11 px-6 font-bold shadow-md hover:shadow-lg transition-all"
              style={{ background: "var(--gradient-primary)" }}
            >
              <PenTool className="mr-2 h-4 w-4" />
              Write Today's Blog
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
