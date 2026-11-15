# CUSTOM CLANS

## Run locally

Install Node.js 22 or newer, then double-click `start-site.bat`. It builds the
production storefront, starts the API and SQLite database in a separate
server window, and opens http://127.0.0.1:5173. Keep the server window open
while using the site. If the browser does not open automatically, copy that
address into your browser. The server window shows startup errors if any occur.

The database is created in `data/custom-clans.sqlite` and is intentionally
excluded from the deployment archive and source control. Back it up before
moving or reinstalling the local project if you want to keep local accounts
and order history.

For development, run `npm install`, `npm run dev:api`, and `npm run dev` in
separate terminals.

## Deploy with persistent storage

This app needs a running Node.js server and a persistent disk; uploading only
the `dist` folder to a static host will not provide accounts or order history.
Push the project to a Git repository, then create a Render Blueprint from that
repository using `render.yaml`. The blueprint builds the frontend, starts the
Express API, generates a session secret, and mounts persistent storage for
SQLite. Keep the generated `SESSION_SECRET` private and backed up.

## Account and order behavior

Passwords are stored as scrypt hashes (existing bcrypt accounts are upgraded
when they next sign in), and sign-in sessions are kept in SQLite. Passwords
must be 8–256 characters.
Sign-in and account creation each allow 10 attempts per IP every 15 minutes.
Placing an order opens its payment choices. Cash-on-delivery orders stay unpaid
until the owner confirms the cash was collected. UPI customers submit a
transaction reference; a reference alone never marks an order paid.

The owner reviews payments at `http://127.0.0.1:5173/admin`. Locally, the admin
key is created in `data/admin-payment-review-key`; keep that file private and
never include it in the deployment ZIP. On Render, use the generated
`ADMIN_PAYMENT_REVIEW_KEY` environment variable as the admin key. The review
page lists unpaid orders and can mark one paid only after the owner confirms
the receipt. Keep the key private.

## Payment setup

The payment page supports cash on delivery and has UPI QR / Google Pay options.
Each online option stays unavailable until the store owner configures its
corresponding public payment detail:

- Set `PAYMENT_UPI_ID` to the store's public UPI ID (for example,
  `customclans@bank`).
- Add the store's QR image at `public/payments/upi-qr.png` and set
  `PAYMENT_QR_IMAGE_PATH=/payments/upi-qr.png`.

Restart the server (and rebuild the frontend for production deployments) after
adding these values. Set `ADMIN_PAYMENT_REVIEW_KEY` to a private, random value
of at least 32 characters if configuring another production host. Never put a
UPI PIN, OTP, or bank password in the app. Customers can submit a UPI
transaction reference for manual review; the owner must verify the transfer
in their payment account before marking it paid at `/admin`.

## Laptop skin design studio

The storefront includes a lazy-loaded 3D laptop customizer at **Design Your
Laptop** in the navigation. Customers can choose one of the original,
anime-inspired skin designs, inspect it on a generic 14-inch laptop model,
change the base finish, compare the original lid, and rotate or zoom the model.
The vinyl is mapped edge-to-edge on the exterior back face of the display lid;
the screen remains on the opposite face and keeps its original dark finish.
The model is configurable concept art, not a fit guarantee for a particular
manufacturer or device.

Laptop skin products use IDs `101`–`109` at ₹1,499 each. Their catalog and
server-validated prices are defined in `src/laptopSkins.js`; update that shared
catalog when adding or repricing designs. The chosen design and base finish
are saved in the cart, order history, and payment summary.
