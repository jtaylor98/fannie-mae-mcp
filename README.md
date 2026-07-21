# Fannie Mae MCP

A remote MCP server exposing Fannie Mae's public APIs, starting with the
Loan Limits API. Uses OAuth2 client-credentials against Fannie Mae's
PingOne authorization server -- no user-facing OAuth flow needed, just a
client ID and secret from the Developer Portal.

Tools exposed:
- `list_apis` — catalog of all 16 public APIs (only Loan Limits is wired to live data so far)
- `get_all_loan_limits` — loan limits for every US county/territory
- `get_historical_loan_limits` — loan limits for a given calendar year (2009-2019)
- `get_loan_limits_by_county` — loan limits for one specific state + county

## 1. Prerequisites

- A Fannie Mae Developer Portal account with an approved app for the
  **Loan Limits API** (Public APIs category)
- Your app's **client ID** and **client secret**
- The **token endpoint URL** shown on the portal's "Create Access Token"
  step (PingOne URL specific to your app)
- A [Vercel](https://vercel.com) account

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:<you>/fannie-mae-mcp.git
git push -u origin main
```

## 3. Import into Vercel

1. Go to vercel.com/new → **Import Git Repository** → select this repo
2. In **Environment Variables**, add `FANNIE_CLIENT_ID`,
   `FANNIE_CLIENT_SECRET`, and `FANNIE_TOKEN_URL`
3. Click Deploy

Every future `git push` to `main` auto-deploys.

## 4. Connect it to Claude / Cowork

Add a custom connector pointing at:

```
https://<your-vercel-domain>/api/mcp
```

Then try: *"List the Fannie Mae APIs available, then get loan limits for
Los Angeles County, CA."*

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your credentials
npm run dev
```

## Notes

- Access tokens expire after 1 hour and are cached in memory per warm
  serverless instance; a cold start just fetches a fresh one automatically.
- Only Loan Limits is implemented so far. The other 15 catalog entries in
  `list_apis` are for browsing/reference -- extending to a new API means
  pulling its own Swagger docs first (base path, params, response shape)
  before wiring it up, the same way Loan Limits was built.
