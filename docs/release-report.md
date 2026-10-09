# Local release report

The approved single-business application is implemented and locally verified in `D:\business-operations-management-system`. It connects accounts and roles, customers, products/services, inventory, orders, manual payment tracking, dashboards, operational reports and activity history. This report describes a local portfolio release, not commercial production readiness.

## Functionality and pages

| Page | Completed behavior |
|---|---|
| Sign-in/account | Controlled login/logout, password change and session revocation |
| Overview | Persisted sales, payments/balances, customer count, daily sales, stock and pending-action worklists |
| Customers | Creation/editing, archive confirmation, search/sort/visibility filters, pagination |
| Catalog | Product/service distinction, price editing, stock adjustment reasons, thresholds, search/sort/pagination |
| Orders | Draft creation with searchable selectors, server pricing, order search/status filter, confirmation/fulfillment/cancellation |
| Order review | Historical lines, balance, manual payment records/reversals, paginated payment history |
| Inventory history | Bounded movement history with readable product/order/actor references |
| Reports | Sales, outstanding balances and inventory snapshot; bounded sales CSV export |
| Activity history | Authorized actor/action/entity history |
| Team & access | Administrator account creation, role/status updates and session revocation |

All public business actions have API implementations with server-side permissions and validation. The browser suite covers the central workflows and important recovery cases; it is not an assertion that every possible UI/input combination was exhaustively tested.

## Engineering integrity

Confirmation and cancellation transact over orders, catalog stock, movements, audits and stored operation responses. Conditional stock updates, shared-order payment writes, and MongoDB write conflict retries prevent tested overselling and overpayment races. A stable private HMAC key protects submission fingerprints, and keys/results persist across process restart. Standalone MongoDB is refused. Historical prices are preserved and integer arithmetic is bounded; unsafe report sums are rejected.

The database has ten Mongoose models: User, Session, Customer, Product, Order, Movement, Payment, Audit, Operation and Policy. Unique identifiers, TTL sessions, query-oriented compound indexes and additive setup scripts are documented in [architecture.md](architecture.md); exact declarations are in `server/models.js`. There are no public deletion APIs for referenced business records.

The complete API inventory, fields, headers, roles, limits and status codes are in [api.md](api.md). Node/Express/MongoDB/Mongoose are retained as required. The frontend deliberately uses small same-origin browser modules and shared UI helpers instead of adding a heavy runtime framework.

## Verification and measurements

- Backend: **18 passed, 0 failed, 0 skipped** test groups against isolated real MongoDB processes.
- Browser: **15 passed, 0 failed, 0 skipped** Chrome cases, including 390 px mobile, 820 px tablet and 1440 px desktop.
- Security checks: authentication/roles, CSRF/origin, field allowlists, revoked/expired sessions, safe account responses, rate limits, request limits, stored-text escaping and transactional consistency.
- Setup checks: private configuration generation/overwrite refusal, additive index reapplication, first-admin creation and repeat refusal.
- Earlier local benchmark (not rerun for closeout): 1,000 customers, 200 products and 2,000 orders; read endpoint p95 33.14–67.44 ms. Order maximum observed latency was 199.29 ms; do not substitute p95 for worst-case latency.
- Customer explain: 20 keys and 20 documents examined for 20 rows.
- Detailed environment, resource/asset sizes, methodology and unexecuted checks: [verification.md](verification.md), local ignored `docs/evidence/performance.json`.

Installation-time npm audit reported no advisories. This is a point-in-time dependency check, not proof that the application has no vulnerabilities.

## Project inventory

There was no existing source to modify. Application files:

- `server/app.js`, `server/index.js`, `server/core.js`, `server/models.js`.
- `server/routes/auth.js`, `master.js`, `orders.js`, `management.js`, `reporting.js`.
- `client/index.html`, `client/styles.css`, `client/app.js`.
- `scripts/configure.js`, `seed.js`, `indexes.js`, `demo.js`, `run-browser.js`, `benchmark.js`, and the optional diagnostic `browser-server.js`.
- `tests/helpers.js`, `tests/business.test.js`, `tests/customer-concurrency.test.js`, `tests/browser/workflow.spec.js`, `tests/browser/remediation.spec.js`, `playwright.config.js`.
- `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `README.md`.
- Documentation: requirements, architecture, API, security, verification, progress, viva, this report, the local demo guide and LinkedIn draft. Generated JSON evidence and screenshots are excluded.

Installed dependencies and generated Playwright reports are local supporting artifacts. No private `.env` was created in the official workspace. The D: release now has independent Git metadata preserving existing history from commit `a36585f`. Release changes are staged on `main`, with no remote configured. At this pre-commit review, no commit, push or deployment has occurred for this release yet.

## Setup and demonstration

For an immediate isolated demonstration:

```powershell
Set-Location D:\business-operations-management-system
npm run demo
```

Open the printed address and use the synthetic account instructions in [README.md](../README.md). Create a customer, product and opening stock; confirm an order; record a manual payment; fulfill it; inspect overview, reports and activity. Demonstrate insufficient stock, Staff restrictions and reversal/cancellation as explained there.

For persistent data, follow the README's `configure → db:indexes → seed → start` procedure and provide a private transaction-capable database URI. These commands must be reviewed for the intended external database before execution. The agent has not connected to Atlas or made external database changes.

Verification commands are `npm test`, `npm run test:browser` and `npm run benchmark`. The optional benchmark was not rerun for closeout; it overwrites only its local ignored evidence file. Fixtures never use the persistent database configuration.

## Limitations and remaining risks

Single-business operation only; no tenant/subscription system, gateway settlement, taxes, discounts, returns, email recovery or MFA. Operational reports are based on order-creation dates and current balances. Search and all-time aggregates grow with matching data, offsets become slower on deep pages, and audit/idempotency retention requires an operational policy. Rate limiting is process-local. Money reports intentionally refuse sums beyond the safe integer range.

Atlas connectivity/topology/indexes, deployment, HTTPS/proxy behavior, backups/recovery, production abuse/capacity, formal security/accessibility audits, other browsers and real-user usability remain unverified. Synthetic local passing tests do not establish those properties.

MCA presentation, beginner explanations, debugging steps and defense questions are in [viva.md](viva.md). They distinguish implemented behavior, measured evidence and future work.


## Closeout change summary — 9 October 2026

Both full suites completed once with isolated synthetic databases after sandbox process-launch approval. Backend: 18 passed in 24.429 seconds. Browser: 15 passed in 38.2 seconds. No application assertion failures, fixes or affected-test reruns. The eight prior defect fixes were supplied as complete by the user; this closeout verifies the current suites without reopening a broad audit. Core manual demonstrations were reported by the user, not repeated during this closeout.

Closeout edits: README.md; docs/architecture.md; docs/api.md; docs/verification.md; docs/viva.md; docs/release-report.md; .gitignore. Added: docs/demo-guide.md and docs/linkedin-summary.md. Application code and test definitions were unchanged. The browser suite regenerated docs/evidence/dashboard.png, test-results/ and playwright-report/; fixture helpers also updated .cache/. These generated artifacts are excluded.

The source review found no private environment file in the project inventory; .env.example contains loopback configuration and a blank secret. Ignore rules cover private environment files, credential/key files, temporary databases, screenshots, traces, logs and generated reports. Ignore patterns are preventive and cannot remove already tracked files. The D: release now has independent Git metadata preserving existing history from commit `a36585f`; the baseline diff, staged files and Git ignore rules have been reviewed. The original C: repository and its untracked files remain untouched.

Git status at the pre-commit review: release changes are staged on `main`, with no unstaged changes or nonignored untracked files. Existing commit `a36585f` is preserved and no remote is configured. No commit, push, deployment or publication has occurred for this release yet.
