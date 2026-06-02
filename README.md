# Merch Store

VCR event merchandise store with Stripe checkout.

## Structure

```
site/           <- GitHub Pages (static storefront)
functions/      <- Stripe checkout Cloud Function
```

## Deployment

- **Storefront:** Served from `site/` via GitHub Pages
- **Checkout:** Deployed as a Cloud Function in `vcr-tooling`

```bash
# Deploy checkout function
cd functions
gcloud functions deploy merch-checkout \
  --runtime nodejs20 \
  --trigger-http \
  --region australia-southeast1
```

## Environment Variables (checkout function)

- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
