import { Suspense } from "react";
import ExplorerApp from "./ExplorerApp";

export const metadata = {
  title: "Fannie Mae API Explorer",
  description: "Standalone workspace for exploring Fannie Mae's public APIs.",
};

// The app reads deep-link params from the URL, so it renders on the client.
export const dynamic = "force-dynamic";

export default function ExplorerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#6b7280" }}>Loading explorer…</div>}>
      <ExplorerApp />
    </Suspense>
  );
}
