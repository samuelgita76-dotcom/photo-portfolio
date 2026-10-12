# Expiring portfolio links

The portfolio remains a static GitHub Pages site. Expiring links use a small Cloudflare Worker and a D1 database; the worker validates every share URL and can revoke it immediately. No admin secret is stored in the browser's local storage.

## Set up the link service

1. Create a Cloudflare account and install Node.js if it is not already installed.
2. From PowerShell, open the repository's `worker` folder and authenticate Wrangler:

   ```powershell
   cd "C:\Users\user\OneDrive\Desktop\photo portfolio\worker"
   npx wrangler login
   npx wrangler d1 create photo-portfolio-links
   ```

3. Copy the `database_id` from Wrangler's output into `worker\wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Confirm `SITE_URL` in `worker\wrangler.toml` matches the published GitHub Pages address. The default is `https://samuelgita76-dotcom.github.io/photo-portfolio`.
5. Create the database table and deploy the worker:

   ```powershell
   npx wrangler d1 execute photo-portfolio-links --remote --file=.\schema.sql
   npx wrangler secret put ADMIN_SECRET>a23a4bSAMUELGITAUWAMBUI
   npx wrangler deploy
   ```

   When prompted, enter a long, unique admin secret and keep it in a password manager. Wrangler prints the deployed `workers.dev` address.

## Use the manager

1. Open the published portfolio and choose **EDIT THIS SITE** → **MANAGE EXPIRING LINKS**.
2. Enter the deployed worker URL and the admin secret. The secret is used only for requests in the open page and is not saved.
3. Select an expiry (1 hour, 24 hours, 7 days, or 30 days), then create, copy, refresh, or revoke links. Only the generated link token is kept in this browser so its **COPY** button remains available later; the admin secret is never persisted.

Links use an unpredictable 256-bit token, keep only its SHA-256 hash in D1, and are checked server-side on each visit. The Worker supports expiries up to one year through its API; the manager offers common presentation durations.

## Important limitation

These links are expiring entry points to the **published** portfolio, not private copies of browser edits. The existing GitHub Pages address remains public, and a visitor could open it directly even after a share link expires. Browser-only text and photo edits are not sent to GitHub or included in these links. To make the portfolio itself private or share individualized edited snapshots, it would need to be moved behind authenticated hosting and its images/content stored by the backend.

Cloudflare Workers and D1 have free and paid usage limits that can change. Review the current Cloudflare plan and usage before relying on this for high traffic.
