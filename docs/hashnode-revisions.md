# FORMA case-study replacement text

These targeted replacements were prepared during the demo refinements. The project owner reports that the article has since been published; this file is retained as an editorial reference. The existing article text was not supplied or remotely inspected, so apply them to the corresponding paragraphs during editorial review. Do not publish automatically.

## Introduction

Business operations involve closely connected information. A customer places a sales order containing products or services. Product orders may affect inventory, while recorded payments determine the remaining outstanding balance. FORMA brings these relationships into one operational workspace.

## Illustrative feature list

Use this only where the existing feature list is illustrative:

FORMA connects customers, sales orders, products and services, inventory movements, manual payment tracking and operational reports, among others.

## Transaction terminology

A database transaction groups related changes into a single unit of work. If an operation fails before the transaction commits, the transaction can be aborted, ensuring that its changes are not permanently applied.

In FORMA, order confirmation uses a Mongoose session with MongoDB's `withTransaction()`. Customer and catalog checks, conditional stock deductions, inventory movements, the order status, the audit event and the stored idempotency result participate in the same transaction. A successful commit makes those changes durable together; a failure before commit prevents partial changes from being permanently applied. Reversing a payment or cancelling an eligible order is a separate business operation, not a rollback of an already committed transaction.

Implementation references: `server/routes/orders.js` (`registerOrders`, confirmation transition) and `server/core.js` (`mutate`, `audit`). Transaction options are snapshot read concern and majority write concern. The application requires a transaction-capable MongoDB deployment.

## Demonstration disclosure

The figures use isolated, temporary MongoDB replica sets containing the same reproducible fictional scenario: 150 customers, 40 products and services, and 200 sales orders across May–October 2026. The administrator, Ananya Mehta, is fictional. The data is not real customer activity or evidence of production deployment. Order creation dates, current payment balances and inventory histories were reconciled before and after capture.

## Figure captions

1. **Business overview:** Monthly confirmed sales for May–October 2026, grouped by order creation month in Asia/Kolkata. The chart shows six calendar-month buckets and its selected-period total; KPI cards show all-time values. October contains activity only through the fictional reference date.
2. **Customers:** The first page of 150 fictional business customers, sorted by name, with server-side pagination and the contextual customer count.
3. **Operational reports:** Sales summary and initial detail rows for orders created from 1 May through 10 October 2026. Recorded payments and outstanding amounts reflect current balances of those orders, not receipts received only during the selected period.
4. **Sales orders:** The first page of 200 fictional orders with creation dates, confirmed/fulfilled states and paid, partially paid or unpaid balances. The dashboard and reports use the same deterministic demonstration scenario; generated order numbers may vary when an isolated instance is recreated.
5. **Products and services:** The first page of a 40-item catalog comprising 30 stocked products and 10 non-stocked services. Product balances reconcile with opening inventory and confirmation movements; services do not deduct stock.

If a different reference date is used, update the months/date range and captions to match `verification.json` and the actual captures. Use the newly generated professional figure files, not the regression suite's `dashboard.png`.

## Technical limits to retain

Payments are manually recorded receipts; FORMA does not process funds. Reports are operational summaries based on order creation dates and current status/balances, not historical accounting statements. Confirmation and fulfillment dates are represented by audit events rather than dedicated order timestamp fields. Historical demo timestamps are adjusted only in the newly created temporary fixture; public APIs do not support backdating. The demonstration does not establish production readiness or production-scale performance.
