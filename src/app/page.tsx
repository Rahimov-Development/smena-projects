import { Suspense } from "react";
import { BriefFlow } from "@/components/brief-flow";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="px-8 py-16 text-sm text-muted-foreground">Loading the brief…</div>}>
      <BriefFlow />
    </Suspense>
  );
}
