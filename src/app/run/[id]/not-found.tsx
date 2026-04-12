import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function RunNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Run not found</h2>
      <p className="text-sm text-muted-foreground">
        This run does not exist or has already been removed.
      </p>
      <div className="flex gap-2">
        <Link href="/new">
          <Button>New Run</Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">View History</Button>
        </Link>
      </div>
    </div>
  );
}
