# FORMA professional fictional demonstration

Actual completion results and the full file inventory are recorded in [professional verification](professional-verification.md).

This opt-in scenario enhances the existing application. It is not a production deployment or a record of real customer transactions. The original `npm run demo`, shared test fixture, persistent administrator bootstrap and benchmark remain separate.

## Startup and isolation

Prerequisites: Node.js 24, installed project dependencies, and permission to launch local MongoDB child processes. MongoDB 7.0.14 must be cached or downloadable by `mongodb-memory-server`; first-time startup may require a large download. For automatic capture, install a Playwright Chromium browser or use installed Chrome on Windows (`PLAYWRIGHT_CHANNEL=chrome`). No new dependencies are required.

```powershell
npm run demo:professional
```

Startup takes roughly four minutes because 930 business mutations use the normal authenticated APIs at no more than 240 requests/minute. Open the printed loopback URL after reconciliation succeeds. Sign in with `administrator@example.test` and the temporary synthetic password `SyntheticPass123!`. The administrator is **Ananya Mehta**; Manager and Staff accounts are Rohan Iyer and Kavya Rao. These names are fictional. Do not use these credentials outside the temporary fixture.

The runner creates its own temporary single-node replica set and `boms_professional` database. It accepts no URI and never reads the configured `MONGODB_URI`. It refuses to start when Mongoose is already connected. Before mutation and historical finalization it checks the expected database name, loopback host and generated port. There is no fallback to persistent MongoDB. Startup failure cleans up its server/connection/database; Ctrl+C performs graceful cleanup. An abrupt process or operating-system termination is outside this graceful-cleanup guarantee.

The default reference date is **10 October 2026**, the deterministic seed is **20261010**, and the six creation-date months are **May–October 2026**. To use another date:

```powershell
npm run demo:professional -- --reference-date=2026-10-10
```

Dates must be valid and no later than the current Asia/Kolkata date. Names, catalog, quantities, balances and date allocation are deterministic for the same seed/reference date. MongoDB IDs, session credentials and UUID order numbers intentionally vary; business snapshots and public order-number generation are preserved. Verification records a scenario fingerprint rather than claiming byte-identical databases.

## Data and chronology

The scenario contains exactly 150 fictional businesses, 30 stocked products, 10 services, and 200 orders (50 confirmed, 150 fulfilled). Forty orders are unpaid, 80 partially paid and 80 fully paid. There are 160 positive manual payment receipts, 30 opening-stock movements and 400 order deductions. No payment reversals or cancelled orders are included in this scenario; existing regression tests retain those workflows.

Customers have reserved `.example.test` addresses and empty optional phone numbers, avoiding invented dialable personal contacts. Catalog descriptions and prices represent unbranded office technology, peripherals, networking and maintenance services. Prices and calculations use integer INR minor units. Opening stock covers planned demand plus a reproducible ending balance, including a few low-stock products. Services have zero stock and no movements.

Normal creation, opening adjustments, order confirmation, payment and fulfillment use the existing Origin/CSRF/session/role checks, validation, idempotency and transactions. A private finalization transaction changes only timestamps on generated documents and stored operation-response timestamps. It does not change order lines, prices, totals, names, states, quantities, payment amounts or UUID order numbers. No public endpoint accepts historical dates.

Foundation accounts precede customer/catalog creation; opening stock precedes sales. Each order is created at 09:xx Kolkata time, confirmed one hour later, paid (where applicable) three hours later and fulfilled (where applicable) five hours later. Related stock movements and audit events carry the matching event times. Historical dates are fictional scenario dates, not evidence that these HTTP requests actually ran in those months. Login sessions retain actual runtime expiry dates.

The schema has no `confirmedAt` or `fulfilledAt` fields. Those event dates are represented by existing audit events, while `Order.updatedAt` represents the last generated order mutation. Reports remain operational summaries based on **order creation dates and current balances**, not payment-period accounting statements.

## Dashboard and reports

Choose **Monthly · Six months**, then set **Ending month** to the reference month and select **Update chart**. The six buckets cover calendar months in Asia/Kolkata, from inclusive first-month midnight through exclusive next-month midnight. Empty months remain visible as zero values. The current month may be incomplete. The daily 30-day view remains the default. Sales and eligible-order KPI totals cover all time; the outstanding and customer cards show current balances and active customer counts. The chart has its own selected-period sales total.

Run a Sales report from the first generated month's first day through the reference date (default `2026-05-01` through `2026-10-10`). Sales includes current confirmed/fulfilled orders created in that range. Paid amounts are their current recorded balances, regardless of payment date. Outstanding is sales minus paid. Inventory is a current snapshot of stocked products only. The existing 366-day validation, 1,000-detail-row limit, pagination and formula-safe CSV export remain enforced.

## Capture and verification

```powershell
npm test
npm run test:browser
npm run demo:capture
```

Capture creates a fresh instance of the same professional scenario, reconciles it, signs in normally, visits all five screens, downloads the 200-row CSV and reconciles again. It does not run against the regression fixture. Artifacts are written under the ignored `docs/evidence/professional/` directory:

- `figure-1-business-overview.png`
- `figure-2-customers.png`
- `figure-3-operational-reports.png`
- `figure-4-sales-orders.png`
- `figure-5-products-services.png`
- `supplement-monthly-mobile.png`
- `sales-report.csv`
- `verification.json`

Desktop viewport: 1440 × 1100. Customer/order/catalog images capture their full paginated screens; the overview and report images show the viewport, including the graph or summary and initial rows. The supplemental mobile image uses 390 × 844. The manifest includes actual browser/version, capture time, scenario fingerprint and reconciliation results, without cookies, passwords or tokens.

If automated capture is unavailable, first run `demo:professional` and wait for successful reconciliation. In one unchanged instance: sign in as Ananya, select the monthly view/reference month, capture Overview; open Customers and sort Name A–Z; run the full-period Sales report and export CSV; open Orders with all statuses; open Catalog and sort Name A–Z. Keep the pagination totals visible in list captures. Save the five files under the names above, recording the reference date and seed. Do not mix these images with regression-test screenshots or images from a subsequently edited dataset.

## Verification scope

Startup reconciliation checks counts/uniqueness, references, planned amounts/states, integer line totals, payment sums, stock histories (including nonnegative intermediate stock), service exclusions, audit/payment/movement chronology, stored-response timestamps, monthly aggregation, API pagination and sales/outstanding/inventory reports. Focused tests cover calendar boundaries, timezone/year transitions, empty buckets, invalid parameters, pagination terminology and preservation of the minimal test fixture. The browser suite and capture workflow check rendering and navigation separately from accounting correctness.

No production throughput or scalability claim is made. The monthly query uses the existing status/creation-date index and returns six grouped rows; the API never loads all orders for chart rendering. Bounded full fixture reads occur only in the dedicated 200-order reconciliation operation.
