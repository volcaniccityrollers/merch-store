# VCR Merch Store

Event merch store for Volcanic City Rollers. Customers browse products on their phone, add to cart, and pay via Stripe Checkout. Items handed over at the table — no shipping.

## Architecture

- **Static site** — GitHub Pages (HTML/CSS/JS, no build step)
- **Payments** — Google Cloud Function → Stripe Checkout
- **Product data** — `products.json` in this repo, updated via admin panel
- **Admin** — Passcode-protected `/admin.html`

## Local Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Deploying the Cloud Function

```bash
cd cloud-functions/merch-checkout  # in the main VCR repo
gcloud functions deploy merch-checkout \
  --gen2 --runtime=nodejs22 \
  --region=australia-southeast1 \
  --entry-point=merch-checkout \
  --trigger-http --allow-unauthenticated \
  --project=vcr-tooling
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live) |
| `ADMIN_PASSCODE` | Passcode for admin panel |
| `GITHUB_TOKEN` | GitHub PAT with repo write access |
| `GITHUB_REPO` | `volcaniccityrollers/merch-store` |

## Custom Domain

Add a CNAME file containing `shop.volcaniccityrollers.co.nz` and set a DNS CNAME record pointing `shop` to `volcaniccityrollers.github.io`.

## Currency

The store supports NZD and AUD. Toggle the active currency from the admin panel — prices are set independently per currency so they stay round numbers.
