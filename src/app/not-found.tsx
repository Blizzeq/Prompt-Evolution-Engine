import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Compass, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[68vh] max-w-3xl items-center justify-center py-10">
      <Card className="w-full rounded-[2rem] overflow-hidden">
        <div className="hero-gradient px-6 py-10 sm:px-10 sm:py-12">
          <CardContent className="space-y-5 p-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-primary/10 text-primary shadow-glow">
              <FileQuestion className="h-7 w-7" />
            </div>
            <div>
              <p className="section-kicker justify-center">Not found</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                This route fell outside the map.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                The destination does not exist, was renamed, or the run reference is no longer available in the archive.
              </p>
            </div>

            <div className="mx-auto flex max-w-md flex-col gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 text-left text-sm text-muted-foreground dark:border-white/6 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <Compass className="h-4 w-4 text-primary" />
                Suggested recovery path
              </div>
              <span>Return to the dashboard or archive</span>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row">
              <Link href="/">
                <Button className="gap-1.5">Go to Dashboard</Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Open Archive
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
