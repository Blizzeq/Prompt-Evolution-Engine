"use client";

import "./globals.css";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
          <Card className="w-full overflow-hidden rounded-[2rem] border-destructive/20">
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <CardContent className="space-y-5 p-0 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-7 w-7" />
                </div>

                <div>
                  <p className="section-kicker justify-center text-destructive/80">Global failure</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                    The application shell failed to render.
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {error.message || "An unexpected error occurred while rendering the root layout."}
                  </p>
                </div>

                {error.digest ? (
                  <p className="inline-block rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-[11px] text-muted-foreground dark:bg-white/[0.03]">
                    Error ID: {error.digest}
                  </p>
                ) : null}

                <Button onClick={reset} className="gap-1.5">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Reload shell
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      </body>
    </html>
  );
}