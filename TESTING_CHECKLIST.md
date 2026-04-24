# Testing Checklist

## Auth
- signup works
- login works
- forgot password link generated
- reset password token works
- email verification token works

## Resume flow
- upload PDF
- upload DOCX
- blank/invalid file rejected
- free user stops after 4 analyses
- standard user can continue
- pro user can continue

## Feature gating
- standard user gets blocked on Job Match and PDF export
- pro user can use Job Match and PDF export

## Payments
- one-time Pro checkout opens
- signature verify succeeds
- user becomes Pro
- admin can create Razorpay plans
- pricing page lists active plans
- subscription create returns short_url

## Webhooks
- payment webhook ignores duplicates
- subscription pending/active/halted updates state as expected
