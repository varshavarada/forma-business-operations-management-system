# MCA defense preparation

## Presentation structure

Explain the problem: separate business records cause duplicated orders and inconsistent stock. Show the integrated customer → catalog → order → stock → payment-record → report workflow. Demonstrate one failure case, the Staff permission boundary, a cancellation/reversal, and the test evidence. Finish with limitations and what would change at larger scale.

## Questions and answers

**Why MongoDB?** Orders naturally contain a bounded list of historical line items. Embedding those snapshots makes order reads simple, while references preserve links to customers/products. MongoDB transactions handle the cross-document stock workflow. It is also the approved project stack.

**Why is money stored as an integer?** Floating-point decimal arithmetic can introduce rounding error. A price of 125.50 becomes 12,550 minor units. The frontend parses decimal strings and the backend multiplies validated integers. Amount bounds keep individual order arithmetic within JavaScript's safe integer range.

**When does stock change?** Draft creation does not reserve stock. Confirmation deducts it. Cancelling an unfulfilled confirmed order restores it. Fulfillment does not deduct it again.

**What if two users order the last unit?** The stock update includes an availability condition and runs in a transaction. Both cannot commit against the same stock value. A write conflict retries using fresh state; one succeeds and the other receives a conflict if stock is no longer sufficient.

**What happens after one item update succeeds but another fails?** The transaction aborts. The first deduction, order change, movements, audit, and idempotency record are all rolled back. A dedicated integration test verifies this.

**Why an idempotency key?** Users can double-click or retry after losing a network response. A unique user-scoped key plus request fingerprint identifies the submission. The result commits with the business change. Replays return the stored response instead of deducting stock twice.

**Why not deduct stock with `find` then `save` outside a transaction?** The value could change between reading and writing, and failures could leave only part of an order applied. Conditional writes and the transaction protect both concurrency and multi-document consistency.

**Does every MongoDB deployment support this?** No. Startup checks for a replica set or supported sharded deployment. Standalone operation is refused. Tests use an isolated replica set, not the real Atlas database.

**Is a paid order proof that funds settled?** No. It means authorized users recorded enough received-payment amounts to cover the order. No bank or gateway is contacted.

**Why preserve order prices?** Existing orders represent the quote used when the draft was created. Changing the catalog must not rewrite sale history. Item names/types/prices are embedded snapshots.

**What is the difference between authentication and authorization?** Authentication identifies the signed-in user. Authorization decides which action that user may perform. Hiding a button helps usability; server middleware supplies enforcement.

**How are passwords and sessions protected?** Passwords use Argon2 hashes. A random session identifier is sent in an HTTP-only cookie, while only its hash is stored. CSRF checks protect writes. Expiry and active status are checked on every request.

**How do you prevent NoSQL injection and XSS?** Requests must match explicit Zod schemas; client operators are not passed to MongoDB. Search text is escaped. UI text is escaped before insertion, and stored-HTML behavior is browser-tested.

**What does an index improve?** It helps the database locate/filter/order candidate records without scanning every document. The measured customer-page query examined 20 keys and 20 documents for 20 rows. This result does not mean every search or aggregation is equally efficient.

**What is the complexity of draft creation?** O(k) application work for k lines using a Map, with one batched product query. Confirmation performs O(k) conditional writes within a transaction. k is capped at 50.

**Why no React, Redis, or microservices?** A small same-origin module frontend and modular Express server meet the approved scope with fewer setup and runtime dependencies. Added infrastructure would need demonstrated value and operational support.

**What was actually measured?** Local HTTP reads against synthetic fixtures, including authorization; latency percentiles, payload bytes, query command counts, a representative query plan, startup time and Node process observations. Read the evidence file for exact environment and limits. No production capacity was proved.

**How do tests avoid real customer data?** The harness creates and destroys its own local replica set. It never uses the supplied `MONGODB_URI`. Fixtures contain only synthetic records and test accounts.

**What would you improve next?** Measure larger workloads; consider cursor pagination and indexed search; define retention/backup/recovery; validate HTTPS and deployment permissions; add password recovery/MFA if approved. Do not claim these are already implemented.

## Debugging guide

For tonight's presentation, use [the synthetic demo guide](demo-guide.md). State the current evidence precisely: 18 backend tests and 15 Chrome cases passed with no failures or skips on 9 October 2026. The earlier benchmark was not rerun for closeout. Core manual demonstrations were reported by the user; this closeout run supplies automated regression evidence.

**How do you avoid overwriting a customer's concurrent edit?** Each customer carries a version. An update must match the version read; successful updates increment it. Stale saves return `409 EDIT_CONFLICT`. Reload retrieves the latest server fields while retaining local changes for review. Two backend tests and a browser conflict-recovery case verify this behavior.

**What do delayed report and expired-session tests establish?** Browser cases verify that old report responses do not replace a newer page/report and that revoked or simulated expired-session responses render a clean login without uncaught errors. Actual session expiration is tested in the backend. These cases do not prove every network timing or browser behavior.

**Is the project published or production-ready?** No. This is a local single-business release. Atlas, deployment, real proxy/TLS operation, recovery, other browsers and production capacity remain unverified. The D: release now has independent Git metadata preserving existing history from commit `a36585f`. Release changes are staged on `main`, with no remote configured. At this pre-commit review, no commit, push or deployment has occurred for this release yet.

- Login fails: verify configured origin, account activity, exact email, and password; do not print credentials.
- Confirmation fails: check customer/item archival, available stock, current order state, and transaction-capable topology.
- Request returns 403: inspect role, browser Origin and CSRF header; do not bypass middleware.
- Request returns 409: inspect duplicate code/key, current state, stock, or payment balance.
- Startup fails: verify `.env`, replica-set topology, reachable database, and required indexes. Keep connection strings private.
- UI changes: reusable page/form helpers are in `client/app.js`; colors, spacing and breakpoints in `client/styles.css`.
- Business changes: edit the relevant route and model constraints, then update tests and documentation together.
