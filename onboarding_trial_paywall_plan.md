# CalSnap AI — Onboarding trial paywall (after 1.1.0)

Do not build this while version 1.1.0 is in App Store review. 1.1.0 stays one free meal a day, and the trial sheet can be closed.

Use this plan only if 1.1.0 is live and paid subscriptions stay near one.

## Decision

Remove the free meal. Show the 7-day trial during onboarding. The sheet has no skip and no close. The App Store description must stop offering a free plan before that build is submitted.

Someone who already pays must still be able to restore. Restore Purchases stays on the trial sheet, with the price, the 7-day trial length, and the cancel terms visible.

## What changes for the customer

- A new install finishes the goal screen and lands on the trial sheet.
- There is no Skip and no X.
- Logging a photo, barcode, quick add, or staple requires an active trial or subscription.
- The yearly plan stays preselected.
- Plans stay $49.99/year and $9.99/month, each with a 7-day trial.
- Sign in with Apple still does not unlock Pro.

## What stays

- Water, weight, streaks, and Insights can stay available before purchase only if the listing does not call them a free meal plan. Meal logging does not.
- Delete Account stays in Settings.
- The daily meal count in the iOS keychain can stay. It is unused once every meal requires Pro.

## App Store text

Replace the free-plan paragraph. The description should say CalSnap AI Pro is a 7-day free trial, then $9.99/month or $49.99/year, and that meal logging starts after the trial begins. Remove “1 free meal a day.”

Review notes should say the trial sheet appears at the end of onboarding, it cannot be skipped, and Restore Purchases is on that sheet. Use a Sandbox Apple ID.

## Code to change when this is approved

- `components/OnboardingModal.tsx` — after Skip or finish, open the trial sheet. Remove a path that reaches Today without Pro.
- `components/PaywallModal.tsx` — hide the close button for this onboarding reason. Keep Restore Purchases.
- `app/(tabs)/index.tsx` — do not offer a second closeable launch sheet for a new free user.
- `services/freeTier.js` and `services/storage.ts` — stop allowing one free meal log per day.
- `config/pricing.json` — replace free-tier headlines with trial copy.
- Snap, barcode, quick add, and staples — each log opens the trial sheet until Pro is active.

## Leave 1.1.0 alone

Do not ship this as an EAS update on top of the build now in review. It is a new store version, with a new description, after the sales check above.
