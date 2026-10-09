# Local demonstration guide

Use only synthetic local data. Do not run `configure`, `seed`, `db:indexes` or `start` for this demonstration.

## Start and sign in

Prerequisites: Node 24, installed npm dependencies, cached MongoDB 7.0.14 binary (first use needs a download), and a modern browser. From the project directory run:

```powershell
npm run demo
```

Open the exact loopback URL printed by the command; its port changes each run. Sign in with `administrator@example.test` and `SyntheticPass123!`. Manager and Staff accounts use `manager@example.test` and `staff@example.test` with the same synthetic password. The helper generates its own temporary replica set and never reads `MONGODB_URI`. Keep the terminal running during the demo.

## Main demonstration (about 8 minutes)

1. Customers: create `DEMO-001`, name `Synthetic Demo Customer`.
2. Catalog: create product `DEMO-SKU`, name `Synthetic Demo Product`, price `125.50`, reorder level `3`. Adjust stock by `10` with reason `Synthetic opening stock`.
3. Orders: create a draft for that customer and product, quantity `2`. Show total `251.00` and stock still `10`.
4. Review and confirm. Show stock `8`. Record payment `251.00`, reference `Synthetic demo receipt`, then fulfill. Explain that this records a receipt; no funds move.
5. Refresh, then show persisted overview, today's sales report, CSV export and activity history. Persistence here lasts within the running fixture; restart durability is covered separately by the backend tests.
6. Create a second order for quantity `9`. Confirmation should fail for insufficient stock; stock remains `8` and the order remains draft.
7. Create another order for quantity `1`, confirm and record payment `25.00`. Reverse it with a correction reason, then cancel. Stock returns to `8` once.
8. Sign out and sign in as Staff. Show customer/order access and absence of catalog adjustment, fulfillment, payment, reports and account-management controls. Direct API rejection is established by the backend suite.

## Optional customer conflict demonstration

Use two signed-in browser windows. Open the same customer's edit dialog in both. Save a name change in the second window; attempt a phone change in the first. Show the conflict, choose “Reload latest customer,” review the retained phone edit alongside the latest name, then save.

## Stop and reset

Press Ctrl+C in the demo terminal; graceful shutdown closes the server and temporary database. Run `npm run demo` again for fresh accounts and empty business records. Never delete or reset a supplied database. Share no screenshots or exports containing private data; generated images and reports are ignored.

If startup is blocked by process permissions, obtain local permission to launch MongoDB. If the binary is missing or download fails, report the setup issue; do not substitute Atlas. Tonight's release evidence is 18/18 backend and 15/15 Chrome cases passing; other browsers and production operation remain unverified.
