# Forma — Business Operations Management System

## Project overview

Forma is an MCA mini-project for a small business selling stocked products and services. It connects customer records, a catalog, stock movements, sales orders, manual payment tracking, operational reports, and audit history. Administrator, Manager, and Staff roles control access to business operations.

Forma brings customer, stock, order, and payment records into one workflow so that a sale can be followed from draft through fulfillment. It is a locally verified portfolio project; deployment and production operation remain unverified.

## Technical Case Study

Read the detailed technical case study covering FORMA's architecture, database design, security, transactional workflows, and testing.

[FORMA: Building a Full-Stack Business Operations Management System](https://vaidehi.hashnode.dev/forma-building-a-full-stack-business-operations-management-system)

## Key features

- Customer records with editing, archival, search, sorting, and pagination.
- A product and service catalog, stock adjustments with reasons, movement history, and low-stock review.
- Sales orders with server-calculated prices, draft confirmation, fulfillment, and cancellation.
- Manual payment records, partial payments, and linked reversals; no funds are processed.
- A dashboard, date-bounded sales and outstanding-balance reports, inventory snapshots, and sales CSV export.
- Administrator, Manager, and Staff permissions, account management, password changes, session revocation, and audit history.

## Tech stack

- **Backend:** Node.js 24, Express 5, MongoDB, and Mongoose.
- **Validation and security:** Zod, Argon2, Helmet, and server-side cookie sessions.
- **Frontend:** browser JavaScript modules and CSS, served by Express from the same origin.
- **Verification:** Node.js test runner, Playwright, and isolated MongoDB replica sets managed by mongodb-memory-server.

## Engineering highlights

- **Transactional stock updates:** confirmation and cancellation keep stock changes, order state, movements, audit events, and saved submission results together.
- **Duplicate and concurrent submissions:** idempotency keys handle retries, and customer version checks reject stale edits.
- **Money calculations:** amounts use bounded integer minor units, and reports reject sums outside the supported safe-integer range.
- **Server-side access control:** role checks protect operations independently of which controls the browser displays. Cookie sessions and origin/CSRF checks protect authenticated writes.

The frontend uses browser JavaScript modules, shared rendering and form helpers, and CSS tokens. Serving it from the same origin keeps cookie sessions, CSRF checks, and local setup straightforward. A small module-based frontend fits this project; a framework may help if its component and state management become more complex.

<a id="run-an-isolated-demonstration"></a>

## Quick start / isolated demo

Requires Node.js 24 and npm. Download and extract the repository ZIP, or clone it using the URL from GitHub's **Code** menu. Open a terminal in the extracted or cloned project directory, where `package.json` is located. All commands below run from that directory. The administrator credential commands in the persistent setup section use PowerShell.

The first demo or test run needs internet access to download MongoDB 7.0.14 unless the binary is already cached. The Windows binary is approximately 592 MB compressed. Tests and demo helpers create an isolated local database and never use `MONGODB_URI` or connect to Atlas.

```sh
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

For the populated professional scenario (150 customers, 40 catalog items and 200 orders across six months), use `npm run demo:professional`. To generate its five article figures and CSV, use `npm run demo:capture`. Both create their own temporary replica set; the original demo and regression fixtures remain minimal. See [professional demo instructions](docs/professional-demo.md) and [targeted Hashnode revisions](docs/hashnode-revisions.md).

### Example workflow

1. Sign in as administrator. Add a customer and a catalog product priced at 125.50.
2. Record opening stock of 10 with an adjustment reason.
3. Create a draft order for quantity 2. Inventory remains 10.
4. Confirm the order. Inventory becomes 8; total is 251.00.
5. Record a received payment of 251.00. No money is processed by this application.
6. Mark the order fulfilled. Dashboard, reports, and activity history reflect the persisted records.
7. Demonstrate a second order that exceeds available stock: confirmation fails without partial stock deductions.
8. Demonstrate a confirmed, unfulfilled order cancellation: reverse recorded payments first; cancellation restores product stock once.
9. Sign in as Staff and demonstrate forbidden management operations, including direct API rejection.

## Persistent database setup

Use a dedicated application database on a transaction-capable replica set or supported sharded deployment. Startup checks the topology. A standalone MongoDB server is refused. Atlas connectivity has not been validated.

After installing dependencies with `npm ci`, run these commands from the project directory:

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

## Verification and testing

```powershell
npm test
npm run test:browser
```

Backend tests use a real isolated MongoDB replica set. Browser tests create their own database/server and close both afterward. On Windows, the runner detects Google Chrome at its standard installation path; otherwise install Playwright Chromium with `npx playwright install chromium`, or select an installed browser through `PLAYWRIGHT_CHANNEL`. Restricted environments may require permission to download binaries or launch local processes.

Recorded release verification on 9 October 2026: **18 backend tests and 15 Chrome browser cases passed**, with no failures or skips. Both suites used isolated synthetic databases. The committed [verification summary](docs/verification.md) records coverage, timings, and limits; it does not include raw test console output. Run tests sequentially on resource-constrained machines.

The optional `npm run benchmark` generates `docs/evidence/performance.json` locally. The committed verification summary includes the earlier benchmark results; the benchmark was not rerun for release verification. Generated JSON, screenshots, traces, and browser reports are ignored and absent from a fresh clone. New runs produce results for your environment rather than reproducing the recorded timings exactly.

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

## Known limitations

Forma supports one business. Payments are manual receipt records; there is no payment gateway, tax engine, returns workflow, password recovery, or MFA. Reports use order-creation dates and current balances, so they are operational summaries rather than historical accounting statements.

Atlas connectivity, deployment, HTTPS/proxy behavior, backups, other browsers, and production capacity remain unverified. Search, deep pagination, aggregates, and history retention need further work as data grows. See the [requirements and limitations](docs/requirements.md) and [security boundaries](docs/security.md) for details.
