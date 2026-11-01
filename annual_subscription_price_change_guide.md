# CalSnap AI — Annual Subscription Price Change Plan ($49.99 → $39.99)

This document provides a step-by-step specification for updating the **CalSnap AI Pro** annual plan price from **$49.99/year** to **$39.99/year**. 

---

## 1. Mathematical Breakdown & Field Comparison

All pricing values are calculated relative to the standalone **Monthly Plan ($9.99/month)** ($119.88 total annual cost if billed monthly).

| Metric / Field | Old Value ($49.99/yr) | New Value ($39.99/yr) | Mathematical Rationale |
| :--- | :--- | :--- | :--- |
| **Annual Price (`display_price`)** | `$49.99` | **`$39.99`** | Base annual subscription price |
| **Monthly Equivalent (`monthly_equivalent`)** | `$4.16/mo` | **`$3.33/mo`** | $\frac{\$39.99}{12 \text{ months}} = \$3.3325\text{/mo}$ |
| **Savings Badge (`savings_badge`)** | `SAVE 58%` | **`SAVE 67%`** | $\frac{\$119.88 - \$39.99}{\$119.88} = 66.64\% \rightarrow 67\%$ |

---

## 2. Codebase Changes

### Target File
* [`config/pricing.json`](file:///c:/Workspaces/CalSnapAI/config/pricing.json#L29-L37)

### JSON Diff
```diff
   "annual": {
     "price_id": "calsnap_yearly",
-    "display_price": "$49.99",
+    "display_price": "$39.99",
     "period": "/year",
-    "monthly_equivalent": "$4.16/mo",
+    "monthly_equivalent": "$3.33/mo",
-    "savings_badge": "SAVE 58%",
+    "savings_badge": "SAVE 67%",
     "trial_days": 7,
     "recommended": true
   }
```

---

## 3. Affected Components & Verification

Because all frontend UI screens consume `pricing.json` dynamically, updating `config/pricing.json` automatically updates pricing displays across the entire app without requiring edits to component logic:

* [`components/PaywallModal.tsx`](file:///c:/Workspaces/CalSnapAI/components/PaywallModal.tsx) — Displays `$39.99/year`, `$3.33/mo`, and `SAVE 67%` badge.
* [`app/(tabs)/settings.tsx`](file:///c:/Workspaces/CalSnapAI/app/(tabs)/settings.tsx) — Displays updated subscription banner & pricing.
* [`app/(tabs)/snap.tsx`](file:///c:/Workspaces/CalSnapAI/app/(tabs)/snap.tsx) — Displays updated paywall triggers upon daily snap limit exhaustion.
* [`app/(tabs)/insights.tsx`](file:///c:/Workspaces/CalSnapAI/app/(tabs)/insights.tsx) — Updates Pro lock notices for Glucose & PDF export.
* [`services/api.ts`](file:///c:/Workspaces/CalSnapAI/services/api.ts) — References pricing identifiers.

---

## 4. External Payment Consoles Checklist

Before or immediately after releasing the app update, perform the following in your store dashboards for product ID `calsnap_yearly`:

1. **Apple App Store Connect:**
   - Navigate to **App In-App Purchases / Subscriptions** $\rightarrow$ `calsnap_yearly`.
   - Set Subscription Price to **$39.99 USD** (and review auto-calculated regional pricing).
2. **Google Play Console:**
   - Navigate to **Monetize $\rightarrow$ Subscriptions** $\rightarrow$ `calsnap_yearly`.
   - Update Base Plan price to **$39.99 USD**.
3. **RevenueCat / Stripe (if applicable):**
   - Update the entitlement package for the yearly product to point to the updated $39.99 price tier.
