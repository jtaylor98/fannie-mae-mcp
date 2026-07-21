export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Fannie Mae MCP</h1>
      <p>
        Exposes Fannie Mae's public APIs (starting with Loan Limits). MCP
        endpoint: <code>/api/mcp</code> — add as a custom connector in
        Claude / Cowork.
      </p>
    </main>
  );
}
