# Jeloura

Jeloura is an Arabic RTL cosmetics storefront.

## Hosting layout

- `hatchable-source/` mirrors the Hatchable v8 project source, including API handlers, SQL migrations, admin UI, and configuration.
- `cloudflare-pages/` is the separate static storefront intended for Cloudflare Pages.
- PostgreSQL data, order processing, product/shipping APIs, image storage, and the admin dashboard remain on the existing Hatchable project: https://jeloura.hatchable.site
- The admin dashboard entry URL is https://jeloura.beauty1.workers.dev/admin. Cloudflare routes `/admin` to the custom Hatchable admin login so the existing secure session and APIs continue to work.

## Cloudflare Pages settings

- Framework preset: None
- Build command: leave empty
- Build output directory: `cloudflare-pages`
- Connect this repository's `main` branch after the static copy is ready.

## Important deployment checks

Before switching customer traffic to Cloudflare Pages, configure and verify CORS on the Hatchable public API for the final Pages origin. The storefront must call the Hatchable API origin, not a relative `/api` path. Keep the Hatchable project available as the backend and source of truth.

Do not commit credentials, access tokens, customer exports, or database dumps. Configure any future secrets in the hosting provider's secret manager.

## Source of truth

The live Hatchable deployment is currently v8. This repository is a source-control copy; pushing here does not deploy or modify the live Hatchable project.

## Current repository contents

- `api/`, `migrations/`, `seed.sql`, `hatchable.toml`: Hatchable v8 backend/source snapshot.
- `public/`: complete Hatchable v8 website source, including the admin dashboard.
- `cloudflare-pages/`: public-only storefront copy. Admin routes are redirected to the existing Hatchable admin URL. Its browser API base is configured to call the Hatchable API.

## CORS is a required pre-launch gate

The Cloudflare Pages storefront is on a different origin from `jeloura.hatchable.site`. The Hatchable public API must explicitly allow the final Pages origin and handle browser OPTIONS preflight requests for GET and POST. This has not yet been configured or verified. Until CORS is enabled and tested, do not switch the production storefront to Cloudflare Pages; keep using the Hatchable live site.

No Cloudflare Pages project has been created or deployed yet. No database data or customer records are included in this repository.

## Automatic Cloudflare Workers deployment

The repository includes `wrangler.toml` and `.github/workflows/deploy-cloudflare-workers.yml`.
A push to `main` that changes `cloudflare-pages/**` or `wrangler.toml` starts a deployment to the Worker named `jeloura`.

Configure these repository Actions secrets once:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token authorized to deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID`: the account ID that owns `jeloura.beauty1.workers.dev`.

Then run the workflow once from **GitHub → Actions → Deploy Jeloura to Cloudflare Workers → Run workflow**. Future matching pushes deploy automatically.

The administration entry URL is `https://jeloura.beauty1.workers.dev/admin`. It redirects to the existing secure login at `https://jeloura.hatchable.site/admin-login.html`. The legacy `/admin-login.htm` path redirects to the canonical `.html` page.
