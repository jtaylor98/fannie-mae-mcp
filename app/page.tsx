export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Fannie Mae MCP</h1>
      <p>Exposes Fannie Mae&apos;s public APIs. MCP endpoint: <code>/api/mcp</code></p>
      <p>
        Prefer a full UI? Open the{" "}
        <a href="/explorer" style={{ color: "#05314d", fontWeight: 700 }}>Fannie Mae API Explorer</a>{" "}
        — a standalone workspace to run any API, compare results side by side, and share deep links.
      </p>
    </main>
  );
}
