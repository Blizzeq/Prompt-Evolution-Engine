"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function RunError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Run page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Failed to load run</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || "Could not load run data."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Retry</Button>
        <Link href="/history">
          <Button variant="outline">Back to History</Button>
        </Link>
      </div>
    </div>
  );
}
