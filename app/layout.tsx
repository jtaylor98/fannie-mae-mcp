export const metadata = {
  title: "Fannie Mae MCP",
  description: "MCP server exposing Fannie Mae's public APIs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
