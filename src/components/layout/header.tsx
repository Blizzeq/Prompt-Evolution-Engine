"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-lg">PEE</span>
          <span className="text-muted-foreground text-sm font-normal hidden sm:inline">
            Prompt Evolution Engine
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/new"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            New Run
          </Link>
          <Link
            href="/history"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            History
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
