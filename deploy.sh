#!/bin/bash
# Deploy the Stripe checkout Cloud Function
cd functions
gcloud functions deploy merch-checkout \
  --runtime nodejs20 \
  --trigger-http \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --set-secrets 'STRIPE_SECRET_KEY=stripe-secret-key:latest'
