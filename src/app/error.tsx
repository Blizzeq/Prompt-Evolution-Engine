"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, ShieldAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[68vh] max-w-3xl items-center justify-center py-10">
      <Card className="w-full overflow-hidden rounded-[2rem] border-destructive/20">
        <div className="px-6 py-10 sm:px-10 sm:py-12">
          <CardContent className="space-y-5 p-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="section-kicker justify-center text-destructive/80">Runtime failure</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                The application hit an unexpected error.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                {error.message || "An unexpected error occurred."}
              </p>
            </div>

            {error.digest ? (
              <p className="inline-block rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-[11px] text-muted-foreground dark:bg-white/[0.03]">
                Error ID: {error.digest}
              </p>
            ) : null}

            <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground dark:border-white/6 dark:bg-white/[0.03]">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Retry this view or inspect the browser console for more detail.
            </div>

            <Button onClick={reset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
