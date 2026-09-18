# Transfer Regression Checks

Run with Node 22 and Java 21 installed:

```sh
npm ci
npx playwright install chromium
npm run test:emulators
```

The runner uses the `demo-bank-checks` project, Auth on localhost:9099 and
Firestore on localhost:8080. It applies the repository's actual Firestore rules.
Test accounts and balances exist only in the emulator. No production data is
written. The Vite test configuration replaces only Firebase initialization and
EmailJS delivery; the application, transfer components, OTP logic, account ledger,
cache, and PDF generator are the real modules.

Coverage includes signed-in transfers, two independent device sessions, concurrent
debits, insufficient funds, duplicate references, changed retry details, suspended
accounts, unauthorized writes, network failure, user cache isolation, OTP expiry,
one-time use, attempt limits, delivery failure, receipts, and PIN lock restoration.
Transfer checks also cover legacy decimal balances without `balanceCents`, strict
USD amount parsing, expired/changed sessions, server-confirmed preflight reads, and
retrying an already committed debit when the remaining balance is lower.
Admin checks cover user selection, name/email/account search, keyboard dismissal,
and long user details without horizontal overflow at 320, 390, 768, and 1365 pixels.
Browser screenshots are written to the ignored `test-results/` directory.

## Opt-in Live Ledger Check

On Windows with the Firebase CLI signed in to `td-project-pro`, run:

```sh
node tests/live-ledger-smoke.mjs --allow-production-test-data
```

This is not part of CI. It creates a temporary test account with a $0.29 simulated
balance, tests exact debits, independent authenticated sessions and duplicate
retries, then removes its own test data. It never changes existing customer
accounts or sends email. A cleanup record (without tokens or passwords) is saved
in `test-results/live-ledger-fixture.json` in case the check is interrupted.

On 2026-09-18 the old production rules rejected the legacy decimal fixture with
`permission-denied`. After deploying rounded-cent rules, the live check passed.
The corrected ruleset is `d7a51580-18c4-4e3d-80a1-3fac5a9e35df`.

## Limits

Email delivery is replaced by a test inbox. These tests do not prove EmailJS inbox
delivery, production App Check configuration, or real banking settlement.
The current application generates and verifies OTPs in the browser, and records
transfers in Firestore; it does not call a bank settlement API. Server-side OTP
authorization is still required before treating this as a system for real funds.

The project-wide lint command has pre-existing failures in unrelated components.
Changes to transfer services and components are checked with ESLint separately.
