Render deployment guide

1) Connect your GitHub repo to Render and create a new Web Service.

2) Repository settings on Render:
   - Branch: `main` (or the branch you want to deploy)
   - Environment: `Node` (use Node 18+ as needed)
   - Build Command: `npm install`
   - Start Command: `npm start`

3) Environment variables (set these in Render's service settings):
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - HUBSPOT_CLIENT_ID
   - HUBSPOT_CLIENT_SECRET
   - HUBSPOT_REDIRECT_URI
   - HUBSPOT_WEBHOOK_SECRET
   - HUBSPOT_PAT (optional)
   - WIX_API_KEY
   - WIX_ACCOUNT_ID
   - WIX_SITE_ID
   - ENCRYPTION_KEY
   - UPSTASH_REDIS_REST_URL / REDIS_URL
   - PORT (optional; Render provides one)
   - NODE_ENV=production

4) After the service is deployed, copy its public URL (e.g. `https://wix-hubspot-integration-server.onrender.com`).

5) Update your Vercel frontend configuration: set `VITE_API_BASE` to the Render URL (no trailing slash), so the client requests target the backend.

6) Optional: If you prefer a Docker deploy, create a Dockerfile that builds the client and serves `dist/` from the Express server; I can add that for you.
