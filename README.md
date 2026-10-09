# Business Operations Management System

An MCA mini-project for a small business selling stocked products and services. Forma is the original interface name used by this project. The application connects customer records, a catalog, stock movements, sales orders, manual payment tracking, operational reporting, and audit history.

Built from scratch in `D:\business-operations-management-system`. No earlier project was imported. No commit, push, or deployment has been performed.

## Technology and frontend decision

Node.js, Express 5, MongoDB, Mongoose, Zod, Argon2, Helmet, and server-side sessions. The frontend uses browser JavaScript modules and reusable rendering/form helpers with shared CSS tokens. There is no bundler, framework runtime, external font request, or UI component library. Same-origin delivery simplifies cookies, CSRF, setup, and debugging. This approach fits a small operations application; larger teams may benefit from a framework once the component/state complexity warrants it.

## Run an isolated demonstration

Requires Node 24, npm, and internet access on the first run to download the isolated MongoDB 7.0.14 binary. The Windows binary is approximately 592 MB compressed. Tests and demo helpers never use `MONGODB_URI` and never connect to Atlas.

```powershell
Set-Location D:\business-operations-management-system
npm ci
npm run demo
```

Open the loopback address printed by the demo. Synthetic accounts:

| Email | Role |
|---|---|
| administrator@example.test | Administrator |
| manager@example.test | Manager |
| staff@example.test | Staff |

Synthetic password for these test-only accounts: `SyntheticPass123!`. These credentials are never automatically created in an external database. Demo data is temporary and removed when the demo fixture stops.

## Run with your persistent database

Use a dedicated application database on a transaction-capable replica set or supported sharded deployment. Startup checks the topology. A standalone MongoDB server is refused. No Atlas credentials have been supplied or tested in this workspace.

```powershell
npm run configure
# Edit .env privately: MONGODB_URI, APP_ORIGIN, PORT, NODE_ENV, CURRENCY.
# APP_ORIGIN must exactly match the origin opened in your browser.
npm run db:indexes
$adminCredential = Get-Credential -Message 'Choose the first administrator email and a password of at least 12 characters'
$env:ADMIN_EMAIL = $adminCredential.UserName
$env:ADMIN_PASSWORD = $adminCredential.GetNetworkCredential().Password
npm run seed
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:ADMIN_EMAIL
npm start
```

Configure creates a private `.env` with a random submission-fingerprint secret and refuses to overwrite an existing file. Keep that secret stable across restarts; changing it invalidates replay comparison for existing submission keys. Supported currencies are INR, USD, EUR and GBP, each using two decimal places.

Bootstrap creates only the first administrator and refuses to run if an administrator exists. It does not insert business fixtures or reset data. Index creation is additive; it never uses `syncIndexes`, drops collections, or removes indexes. Review the target and existing data before running either command. Unique-index conflicts must be resolved deliberately, not by deleting records.

For production configuration, use `NODE_ENV=production`, an HTTPS `APP_ORIGIN`, HTTPS termination, and a correctly configured trusted reverse proxy. Production disables automatic index creation; run the reviewed index command first. This repository has not been deployed or operationally validated.

With the sample local origin, open `http://localhost:3000`. Keep the database URI and generated fingerprint key private.

## Verification commands

```powershell
npm test
npm run test:browser
```

Backend tests use a real isolated MongoDB replica set. Browser tests create their own database/server and close both afterward. On this Windows machine the runner detects installed Google Chrome; otherwise install Playwright Chromium with `npx playwright install chromium`, or select an installed browser through `PLAYWRIGHT_CHANNEL`. Downloads and native process launch may require environment approval.

Release closeout on 9 October 2026: **18 backend tests and 15 Chrome browser cases passed**, with no failures or skips. Both suites used isolated synthetic databases. See [verification results](docs/verification.md) for coverage and limits. Run tests sequentially on resource-constrained machines.

The optional `npm run benchmark` writes `docs/evidence/performance.json`; it was not rerun for closeout. Browser screenshots, traces, reports and generated benchmark evidence are excluded by `.gitignore`.

## Main workflow

1. Sign in as administrator. Add a customer and a catalog product priced at 125.50.
2. Record opening stock of 10 with an adjustment reason.
3. Create a draft order for quantity 2. Inventory remains 10.
4. Confirm the order. Inventory becomes 8; total is 251.00.
5. Record a received payment of 251.00. No money is processed by this application.
6. Mark the order fulfilled. Dashboard, reports, and activity history reflect the persisted records.
7. Demonstrate a second order that exceeds available stock: confirmation fails without partial stock deductions.
8. Demonstrate a confirmed, unfulfilled order cancellation: reverse recorded payments first; cancellation restores product stock once.
9. Sign in as Staff and demonstrate forbidden management operations, including direct API rejection.

## Documentation

- [Requirements, roles, acceptance and limitations](docs/requirements.md)
- [Architecture, database and algorithms](docs/architecture.md)
- [API contracts](docs/api.md)
- [Security and operational assumptions](docs/security.md)
- [Testing and performance evidence](docs/verification.md)
- [MCA defense and viva preparation](docs/viva.md)
- [Local demonstration guide](docs/demo-guide.md)
- [LinkedIn project summary draft](docs/linkedin-summary.md)
- [Implementation progress](docs/progress.md)
- [Local release report](docs/release-report.md)

This is a verified local portfolio application, not a claim of commercial production readiness. It is a single-business system, not a subscription or multitenant platform.
