"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[80rem] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icon.svg"
              alt="Prompt Evolution Engine"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
              Prompt Evolution
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/new"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "rounded-lg"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              New Run
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[80rem] flex-1 flex-col px-4 pb-8 pt-6 sm:px-6">
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
