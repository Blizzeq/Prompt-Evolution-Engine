"use client";

import { useSyncExternalStore } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isLight = resolvedTheme !== "dark";

  function toggle() {
    setTheme(isLight ? "dark" : "light");
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className="rounded-2xl border border-white/12 bg-white/[0.05] text-foreground hover:bg-white/[0.09] dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
    >
      {!mounted ? (
        <SunMedium className="h-4 w-4" />
      ) : isLight ? (
        <MoonStar className="h-4 w-4" />
      ) : (
        <SunMedium className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
