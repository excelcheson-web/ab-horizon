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
Browser screenshots are written to the ignored `test-results/` directory.

## Limits

Email delivery is replaced by a test inbox. These tests do not prove EmailJS inbox
delivery, production App Check configuration, or real banking settlement.
The current application generates and verifies OTPs in the browser, and records
transfers in Firestore; it does not call a bank settlement API. Server-side OTP
authorization is still required before treating this as a system for real funds.

The project-wide lint command has pre-existing failures in unrelated components.
Changes to transfer services and components are checked with ESLint separately.
