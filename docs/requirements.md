# Requirements and business rules

## Problem statement and objectives

Small businesses often maintain customers, product availability, orders, and payment notes separately. This creates inconsistent stock, duplicated submissions, and unclear pending work. This project provides one controlled workflow with persisted records, traceable changes, and operational summaries.

Objectives: protect data integrity; enforce permissions on the server; provide a clear responsive interface; make order and inventory operations atomic; document how the implementation works; verify claims with isolated tests and measurements.

## Approved functional scope

| Module | Behavior |
|---|---|
| Accounts | Administrator creates accounts and changes roles/status; login/logout; self password change |
| Customers | Unique customer codes; editing; archival; name search; name/date sorting; pagination |
| Catalog | Unique SKU; stocked product or non-stocked service; integer-minor-unit price; archive/edit; search/sort/pagination |
| Inventory | Opening and adjustment movements with reasons; nonnegative stock; low-stock worklist; paginated movement history |
| Orders | Server-calculated drafts; confirm/fulfill/cancel transitions; immutable snapshots; status filter and paginated list |
| Payments | Manually record partial/full payments; bounded amounts; linked reversals; paginated payment history |
| Overview | Persisted confirmed/fulfilled sales, recorded payments, balances, customers, recent daily sales, fulfillment and balance worklists |
| Reports | Sales and outstanding balance date ranges; inventory snapshot; sales CSV export up to 1,000 rows with truncation warning |
| Audit | Actor, action, entity, record identifier, time and reason; manager/admin access |

Name search is literal case-insensitive substring matching. Catalog/customer list pages expose sorting and visibility filters. Order lists expose status filtering and order/customer-name search. Histories use newest-first pagination. Not every module has arbitrary user-selected sorting or full-text search.

## Roles and use cases

Administrator: bootstrap business access, create staff/manager accounts, perform all operations, review history. Manager: catalog, stock, fulfillment/cancellation, manual payments and reversals, reporting and audit. Staff: customer records, read catalog, create drafts, confirm orders. Staff cannot adjust stock, manage users, fulfill/cancel orders, record payments, or inspect management reports/history.

All roles access shared records in one business. Ownership is not a privacy boundary in this scope. Record-level checks validate existence, archival status, type, current state, stock, and payment balance before permitted changes.

## Business invariants

- One configured currency, default INR. Entered decimal prices become integer minor units. Quantities are whole units.
- Product stock begins at zero; opening inventory is an auditable adjustment. Services never consume stock.
- An order has 1–50 distinct items; each quantity is 1–100,000. Server snapshots names, types, and prices on draft creation. Users cannot supply order totals or historical prices.
- Confirming uses the draft's quoted prices. Later catalog price/name edits do not modify existing orders. Draft line editing/repricing is outside this scope; create a replacement draft when needed.
- Drafts do not reserve inventory. Confirmation subtracts stock and writes movements in one transaction.
- Valid states: draft → confirmed or cancelled; confirmed → fulfilled or cancelled. Fulfilled/cancelled are terminal.
- Cancelling a confirmed unfulfilled order restores product stock. Payment balance must be zero first. Fulfilled returns/refunds are excluded.
- Payments are records of receipts reported by authorized staff. They are not a gateway integration or proof of financial settlement. Amounts must be positive and no greater than the remaining balance.
- Reversal creates a negative linked record and marks the original reversed. It does not transfer or refund money.
- Referenced customers/catalog records are archived, not deleted. Archived customers/items prevent confirmation, but historical orders remain readable and eligible stock can be restored.
- Stock is capped at 1,000,000,000 units. Unit price is capped at 100,000,000 minor units; order total at 100,000,000,000. Single payment/adjustment bounds are enforced.
- Dashboard and report summaries refuse amounts outside the supported safe-integer range rather than displaying rounded totals.
- Retry-sensitive mutations require an idempotency key. The same user/key/request returns the stored response; key reuse with different data is rejected. Keys are retained indefinitely in this version.

## Differentiators

Low-stock review costs one bounded result query and uses configured thresholds, not fabricated forecasts. Pending fulfillment and outstanding balance worklists identify concrete action items from order state and recorded balances. Their business value is visibility; neither schedules purchases or sends automated reminders.

## Nonfunctional requirements and acceptance

Server-side validation and authorization, hashed passwords, protected cookie sessions, CSRF checks, request limits, sanitized errors, shared design components, keyboard-accessible forms/dialogs, contained mobile table overflow, bounded result sets, indexed common reads, and reproducible isolated tests.

Acceptance requires an integrated browser workflow, transactional race/rollback tests, correct report arithmetic, restart persistence, documented setup, and honest performance evidence. Automated passing checks establish the tested local behavior; they do not prove general production security or scalability.

## Explicit exclusions and limitations

No multitenancy, subscriptions, gateway, tax engine, discounts, fractional quantities, returns, credit notes, email delivery, password recovery email, automated reminders, predictive inventory, offline mode, Redis, queues, deployment, or external data import.

Offset pagination is capped but grows more expensive on deep pages. Substring search scans candidate records rather than providing an indexed full-text search. Summary aggregation cost grows with matching data. Audit and idempotency retention need an operational archival policy before large-scale use. Rate limiting is per process. Charts use order creation date for confirmed/fulfilled orders, not a separate confirmation date. Reports show current balances for the selected order-creation period and are not historical accounting statements.
