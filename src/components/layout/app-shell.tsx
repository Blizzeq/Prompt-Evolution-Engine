"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Cpu,
  Dna,
  History,
  Plus,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const PRIMARY_NAV = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/new", label: "New Run", icon: Plus },
  { href: "/history", label: "History", icon: History },
] as const;

function getPageMeta(pathname: string) {
  if (pathname === "/") {
    return {
      eyebrow: "Overview",
      title: "Dashboard",
      description: "Monitor active runs, compare results, and reopen the strongest prompts.",
    };
  }

  if (pathname === "/new") {
    return {
      eyebrow: "New Run",
      title: "Run Setup",
      description: "Configure provider, inputs, tests, and search settings for a new optimization run.",
    };
  }

  if (pathname === "/history") {
    return {
      eyebrow: "Archive",
      title: "Run History",
      description: "Review completed runs, compare outcomes, and reopen the candidates worth keeping.",
    };
  }

  if (pathname.startsWith("/run/")) {
    const runId = pathname.split("/").filter(Boolean).at(-1)?.toUpperCase();

    return {
      eyebrow: "Run Monitor",
      title: "Run Details",
      description: runId
        ? `Track progress, results, and lineage for ${runId}.`
        : "Track progress, results, and lineage in one view.",
    };
  }

  return {
    eyebrow: "Workspace",
    title: "Prompt Evolution Engine",
    description: "Workspace for prompt optimization, evaluation, and run review.",
  };
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,137,63,0.12),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(124,98,74,0.11),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(102,119,93,0.08),transparent_35%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(191,137,63,0.14),transparent_35%),radial-gradient(circle_at_88%_12%,rgba(124,98,74,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(102,119,93,0.08),transparent_32%)]" />
        <motion.div
          aria-hidden
          className="absolute left-[-8rem] top-24 h-64 w-64 rounded-full bg-primary/12 blur-3xl"
          animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-[-9rem] right-[-7rem] h-80 w-80 rounded-full bg-chart-2/15 blur-3xl"
          animate={{ y: [0, 14, 0], x: [0, -12, 0] }}
          transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>

      <aside className="panel-strong fixed inset-y-4 left-4 z-40 hidden w-[17rem] flex-col overflow-hidden border lg:flex">
        <div className="border-b border-white/10 px-5 py-5 dark:border-white/6">
          <Link href="/" className="flex items-start gap-3 transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(191,137,63,0.5)]">
              <Dna className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-base font-semibold tracking-[-0.03em] text-foreground">
                Prompt Evolution Engine
              </p>
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">
                Local Prompt Workspace
              </p>
            </div>
          </Link>

          <div className="mt-5 rounded-[1.35rem] border border-white/12 bg-white/[0.06] px-4 py-3 dark:border-white/6 dark:bg-white/[0.045]">
            <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Workspace Status
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Runs, evaluation history, and lineage stay available in one local workspace.
            </p>
          </div>

          <Link
            href="/new"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-5 w-full justify-center rounded-2xl"
            )}
          >
            <Plus className="h-4 w-4" />
            New Run
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-5">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative block rounded-2xl px-3 py-3 text-sm"
              >
                {isActive ? (
                  <motion.span
                    layoutId="shell-nav-indicator"
                    className="absolute inset-0 rounded-2xl bg-primary/12 ring-1 ring-primary/20"
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  />
                ) : null}

                <span
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-2 py-0.5 transition-colors duration-300",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary" : "text-muted-foreground/90"
                    )}
                  />
                  <span className="font-medium tracking-[-0.01em]">{item.label}</span>
                  {isActive ? (
                    <ChevronRight className="ml-auto h-4 w-4 text-primary/80" />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-5 dark:border-white/6">
          <div className="panel-soft rounded-[1.35rem] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">
                  Runtime
                </p>
                <p className="mt-2 font-mono text-xl font-medium text-foreground">142ms</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-chart-2/14 text-chart-2">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Local runtime ready for prompt search, scoring, and review.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-[19rem]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/72 backdrop-blur-2xl dark:border-white/6">
          <div className="mx-auto flex h-[4.75rem] w-full max-w-[112rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(191,137,63,0.5)]">
                <Dna className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-semibold tracking-[-0.03em] text-foreground">
                  Prompt Evolution Engine
                </p>
                <p className="truncate text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
                  Local Prompt Workspace
                </p>
              </div>
            </Link>

            <div className="hidden min-w-0 lg:block">
              <p className="section-kicker">{pageMeta.eyebrow}</p>
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
                  {pageMeta.title}
                </h1>
                <Badge variant="outline" className="hidden xl:inline-flex border-primary/20 bg-primary/8 text-primary">
                  Ready
                </Badge>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="panel-soft hidden items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground md:flex">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Local workspace
              </div>

              <Link
                href="/new"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden rounded-2xl sm:inline-flex"
                )}
              >
                <Plus className="h-4 w-4" />
                New Run
              </Link>

              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[112rem] flex-1 flex-col px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mb-6 space-y-3 lg:hidden">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary">
                {pageMeta.eyebrow}
              </Badge>
              <Badge variant="outline" className="border-white/12 bg-white/[0.04] text-muted-foreground dark:border-white/8 dark:bg-white/[0.035]">
                Workspace
              </Badge>
            </div>
            <div>
              <h1 className="text-[1.7rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[2rem]">
                {pageMeta.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {pageMeta.description}
              </p>
            </div>
          </div>

          <div className="hidden items-center justify-between gap-4 pb-6 lg:flex">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {pageMeta.description}
            </p>
            <div className="flex items-center gap-3">
              <div className="panel-soft rounded-full px-4 py-2 text-right">
                <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">
                  Theme
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">Warm neutral</p>
              </div>
              <Link
                href="/history"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-2xl")}
              >
                History
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex-1">{children}</div>
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-50 lg:hidden">
        <div className="panel-strong mx-auto flex max-w-lg items-center justify-between rounded-[1.8rem] px-3 py-3 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.55)]">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[4.25rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[0.68rem] font-medium tracking-[-0.01em] transition-colors duration-300",
                  isActive
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}