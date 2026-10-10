# Professional demo completion and verification

Initial demo verification was completed locally on **10 October 2026**; subsequent checks are recorded below. This report describes observed local results, not production readiness. Verification used isolated temporary databases and did not change persistent data, deploy the application or edit the remote article.

The final presentation refinement replaces repeated place/category combinations with 150 curated fictional business names. Customer codes, all synthetic contact details and order allocations remain unchanged; planned financial and monthly totals were compared with the preceding manifest. Active/archived filters and accessible labels now use customers or items, preserving their query values. Tests and capture verify the revised names, contextual filter labels and existing archived-filter behavior. CSV customer identities must match the same demo plan.

## Recorded executed checks

| Command/check | Actual result |
|---|---|
| Initial `npm test` | **25 passed, 0 failed, 0 skipped**, 269.571 seconds; includes the existing 18 cases and seven new cases |
| `npm run test:browser` | **16 passed, 0 failed**, 39.5 seconds; includes the existing 15 cases and one new presentation case |
| `npm run demo:capture` | Exit 0; five article figures, one mobile supplement, a 200-row CSV and a verification manifest generated |
| Pre/post-capture reconciliation | Passed in the same unchanged temporary scenario |
| CSV financial reconciliation | Passed; 200 distinct order rows; sales/paid sums equal the report and fixture totals |
| Narrow-phone review | Final capture passed page-overflow and currency-card-fit assertions at 390 × 844 |
| Source syntax / `git diff --check` | Passed; only Git's existing LF/CRLF conversion notices |
| Subsequent affected professional-demo file | **2 passed, 0 failed, 0 skipped**, 259.044 seconds; exit 0 with a seven-minute test limit |
| Subsequent full backend suite | **25 passed, 0 failed, 0 skipped**, 323.562 seconds; exit 0 with a seven-minute execution limit, which was not reached |
| Subsequent dashboard browser check | **1 passed, 0 failed, 0 skipped**, 10.9 seconds; additional Chrome assertions verified all four labels and responsive fit |

Environment: Node.js 24.20.0, local MongoDB 7.0.14 single-node replica sets, Chrome 154.0.8037.98. Initial sandbox attempts failed to launch child processes (`EPERM`), before application assertions could run. Required process-launch permission was obtained and the commands were rerun. Raw console transcripts are not stored in this Markdown report; final capture evidence is in the generated manifest.

The first successful capture exposed crowded large currency values inside two-column phone KPI cards during visual review. Cards now stack below 420 pixels. The final browser suite and entire capture were rerun after that change; the full-capture figures came from the same newly generated instance. Figure 1 was subsequently recaptured alone at 1440 × 1100 after four label changes, using a fresh isolated reproduction with the identical scenario fingerprint. Figures 2–5, the mobile supplement, CSV and manifest were hash-checked as unchanged. Generated IDs and order numbers vary between instances; business data and reconciled totals remain the same.

## Reconciled scenario

Reference date: **2026-10-10**. Seed: **20261010**. Currency: **INR**. Scenario fingerprint: `9872b01cc39804b93e2fbb4c0c8def4b19b1ef3f32ab9371f10118bb5ae86bf3`.

| Entity/relationship | Verified value |
|---|---:|
| Fictional customers | 150 |
| Stocked products / services | 30 / 10 |
| Sales orders | 200 |
| Confirmed / fulfilled | 50 / 150 |
| Unpaid / partially paid / fully paid | 40 / 80 / 80 |
| Positive payment receipts | 160 |
| Opening / deduction movements | 30 / 400 |
| Audit events / stored operations | 930 / 930 |
| Current stocked units, summed across products | 485 |
| Sales | ₹1,70,90,250.00 |
| Recorded payments | ₹1,10,56,575.00 |
| Outstanding | ₹60,33,675.00 |

All computations use integer minor units: sales `1709025000`, paid `1105657500`, outstanding `603367500`. Payment sums equal each order's paid balance. All stocked products reconcile with their opening adjustments and subsequent movements, with no negative intermediate balances. Services have no movements and zero stock. Codes/SKUs/order numbers are unique; references, line calculations, planned snapshots/states and historical event relationships passed verification.

| Kolkata creation month | Orders | Eligible sales |
|---|---:|---:|
| May 2026 | 24 | ₹17,47,250.00 |
| June 2026 | 28 | ₹21,16,800.00 |
| July 2026 | 31 | ₹25,82,550.00 |
| August 2026 | 35 | ₹32,85,400.00 |
| September 2026 | 38 | ₹31,70,200.00 |
| October 2026 | 44 | ₹41,88,050.00 |

The monthly chart groups currently confirmed/fulfilled orders by creation month. The default report covers 1 May through 10 October and uses current payment balances. Those totals equal all-time values in this finite demo because every generated order belongs to that period; the application does not assume these totals always match. Boundary tests explicitly demonstrate different all-time and selected-period totals, zero months and inclusive/exclusive Kolkata boundaries.

## Files created or modified

| File | Change and reason |
|---|---|
| `scripts/professional-data.js` (new) | Deterministic fictional customer/catalog/order plan and opening-stock allocation |
| `scripts/professional-demo.js` (new) | Own temporary replica-set lifecycle, normal authenticated workflows and private timestamp finalization |
| `scripts/professional-verify.js` (new) | Shared read-only financial, inventory, referential and historical reconciliation |
| `scripts/run-professional-demo.js` (new) | Opt-in interactive startup and graceful signal handling |
| `scripts/capture-professional-demo.js` (new) | Genuine isolated capture, CSV checks and pre/post-capture verification |
| `package.json` | Adds `demo:professional` and `demo:capture`; dependencies unchanged |
| `server/reporting-period.js` (new) | Shared Kolkata six-calendar-month boundaries and zero-month filling |
| `server/routes/reporting.js` | Adds optional bounded monthly trend and period metadata; retains default daily view and all-time KPIs |
| `server/models.js` | Adds optional bounded catalog description; indexes unchanged |
| `server/routes/master.js` | Validates optional descriptions; old payloads remain valid |
| `client/pagination.js` (new) | One renderer and singular/plural terms for every pagination context |
| `client/app.js` | Chart selection/period labels, contextual pagination and escaped catalog descriptions |
| `client/styles.css` | Responsive chart controls/descriptions and readable narrow-phone KPI cards |
| `tests/professional-demo.test.js` (new) | Deterministic planning, full reconciliation, no public backdating and unchanged minimal fixture |
| `tests/reporting-period.test.js` (new) | Timezone/year/month boundaries, empty buckets, totals, invalid inputs and description compatibility |
| `tests/pagination.test.js` (new) | All noun forms, pagination boundaries and payment controls |
| `tests/browser/presentation.spec.js` (new) | Monthly rendering, zero-height empty bars and context labels across screens |
| `README.md` | Discoverable opt-in startup/capture commands and documentation links |
| `docs/api.md` | Documents additive chart parameters/metadata and optional descriptions |
| `docs/professional-demo.md` (new) | Startup, isolation, chronology, capture, manual fallback and limitations |
| `docs/hashnode-revisions.md` (new) | Targeted introduction, feature-list, transaction, disclosure and figure-caption replacements |
| `docs/professional-verification.md` (new) | This factual completion record |

The shared `tests/helpers.js`, original `scripts/demo.js`, persistent `scripts/seed.js`, transaction helper, authentication/session routes, order workflows, existing test definitions and dependency lockfile are unchanged. The integration test starts a fresh default fixture after closing the professional fixture and verifies zero business records and the original `Test Administrator` identity.

## Startup and generated artifacts

```powershell
npm run demo:professional
npm run demo:capture
```

Startup takes roughly four minutes because existing API rate limits remain active. The professional runner never reads `MONGODB_URI`, requires a disconnected process and checks the generated temporary database/host/port before writes. Its own server and temporary replica set are closed after capture; no demo server remains running from these capture commands.

All final professional artifacts are local and ignored by Git, under `docs/evidence/professional/`:

- `figure-1-business-overview.png`
- `figure-2-customers.png`
- `figure-3-operational-reports.png`
- `figure-4-sales-orders.png`
- `figure-5-products-services.png`
- `supplement-monthly-mobile.png`
- `sales-report.csv`
- `verification.json`

The full-capture manifest records capture time `2026-10-10T15:30:32.915Z` (**21:00:32 Asia/Kolkata**), browser version, filenames, checks and reconciliation. The manifest was not rewritten for the subsequent Figure 1-only capture. Screenshots were visually inspected. The professional files are separate from the existing regression artifacts such as `docs/evidence/dashboard.png`.

## Scope and limits

Historical dates are fictional fixture timestamps, finalized privately in the newly created temporary database after normal workflows. They do not prove transactions occurred in those months. Confirmation/fulfillment chronology uses existing audits because there are no dedicated order fields for those event dates. Current balances and order-creation reporting are retained; no payment-period accounting ledger is claimed. This scenario has no cancellations or reversals, while existing regression tests continue to exercise both.

MongoDB IDs, UUID order numbers and authentication material intentionally vary across runs. Business data, allocation, amounts and reference-date history are reproducible. The fixed reference month remains selectable even on later runs. Graceful cleanup does not guarantee cleanup after forced operating-system termination.

No new dependency, public backdating route, destructive reset, authorization bypass, rate-limit bypass, index migration or deployment or remote Hashnode edit was introduced. Monthly aggregation stays bounded and uses existing status/creation-date indexes; no new production benchmark was performed. The project owner reports that the Hashnode article has been published; the prepared replacement text remains an editorial reference. No remote article edit was performed during this work.

The reported test pause was not reproduced as an indefinite cleanup hang. The first planning test passes quickly; the following integration test performs 930 authenticated mutations paced at 250 ms, while its progress callback defaults to a no-op. Both the affected file and the full suite exited normally; no cleanup change was made.

## Isolated GitHub integration verification

The 22 improvements were integrated onto the existing GitHub main history in a separate worktree. Existing README content and publication documents were retained, with one additive demo paragraph in the README. Application and test files remained byte-identical to the previously verified local versions; only the new documentation was clarified.

Targeted pagination/reporting checks passed **5 tests, 0 failed, 0 skipped** in **14.107 seconds**. The targeted Chrome presentation case passed **1 test, 0 failed, 0 skipped** in **6.7 seconds**; direct browser assertions also verified all four updated dashboard labels. JavaScript syntax, relative imports and the unchanged 150/40/200 scenario fingerprint were checked. The earlier full backend result of 25/25 was retained; the lengthy suite was not unnecessarily repeated. No screenshots were regenerated during integration.
