import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";

let app;
let database;
let server;
let dataDirectory;
let baseUrl;
let cookie;
let testQrPath;

before(async () => {
  dataDirectory = mkdtempSync(path.join(os.tmpdir(), "custom-clans-auth-"));
  process.env.DATA_DIRECTORY = dataDirectory;
  process.env.DATABASE_PATH = path.join(dataDirectory, "test.sqlite");
  process.env.SESSION_SECRET = "test-session-secret-with-more-than-32-characters";
  process.env.HOST = "127.0.0.1";
  process.env.PORT = "0";
  process.env.NODE_ENV = "development";
  process.env.ADMIN_PAYMENT_REVIEW_KEY =
    "test-admin-payment-review-key-with-more-than-32-characters";
  delete process.env.PAYMENT_UPI_ID;
  delete process.env.PAYMENT_QR_IMAGE_PATH;
  const legacyDatabase = new Database(process.env.DATABASE_PATH);
  legacyDatabase.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'paid', 'cancelled')),
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  legacyDatabase.close();
  ({ app, database } = await import("../server.js"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  database?.close();
  if (testQrPath) rmSync(testQrPath, { force: true });
  if (dataDirectory) rmSync(dataDirectory, { recursive: true, force: true });
});

async function request(
  route,
  { method = "GET", body, authenticated = false, origin = true, headers: extraHeaders = {} } = {},
) {
  const headers = { ...extraHeaders };
  if (origin && method !== "GET") headers.Origin = baseUrl;
  if (body) headers["Content-Type"] = "application/json";
  if (authenticated && cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

test("accounts, sessions, and order history persist without inventing paid purchases", async () => {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.status, "ok");

  const homepage = await fetch(baseUrl);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /CUSTOM CLANS — Collect Your World/);

  const unauthenticated = await request("/api/account/orders");
  assert.equal(unauthenticated.response.status, 401);
  assert.deepEqual(
    database.prepare("PRAGMA table_info(orders)").all().map((column) => column.name)
      .filter((name) => name.startsWith("payment_")),
    ["payment_method", "payment_reference"],
  );

  const rejectedOrigin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "someone@example.com", password: "examplepassword1" },
    origin: false,
  });
  assert.equal(rejectedOrigin.response.status, 403);

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Test Collector",
      email: "  COLLECTOR@example.test ",
      password: "Anime12345test",
    },
  });
  assert.equal(registration.response.status, 200);
  assert.equal(registration.payload.user.email, "collector@example.test");
  cookie = registration.response.headers.get("set-cookie").split(";")[0];
  assert.match(database.prepare("SELECT password_hash FROM users").get().password_hash, /^scrypt\$/);

  const session = await request("/api/auth/session", { authenticated: true });
  assert.equal(session.payload.user.name, "Test Collector");

  const shortPassword = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Short Password",
      email: "short-password@example.test",
      password: "Abc1234",
    },
  });
  assert.equal(shortPassword.response.status, 400);
  assert.match(shortPassword.payload.error, /between 8 and 256 characters/);

  const eightCharacterPassword = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Eight Character",
      email: "eight-character@example.test",
      password: "sakuraaa",
    },
  });
  assert.equal(eightCharacterPassword.response.status, 200);

  const tooLongPassword = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Very Long Password",
      email: "too-long-password@example.test",
      password: `Anime123${"x".repeat(249)}`,
    },
  });
  assert.equal(tooLongPassword.response.status, 400);

  const longPassword = `Anime123${"collector".repeat(10)}`;
  const longPasswordRegistration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Long Password",
      email: "long-password@example.test",
      password: longPassword,
    },
  });
  assert.equal(longPasswordRegistration.response.status, 200);
  assert.match(
    database
      .prepare("SELECT password_hash FROM users WHERE email = ?")
      .get("long-password@example.test").password_hash,
    /^scrypt\$/,
  );
  const longPasswordLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "long-password@example.test", password: longPassword },
  });
  assert.equal(longPasswordLogin.response.status, 200);

  database
    .prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
    .run("legacy-user", "legacy@example.test", "Legacy Collector", bcrypt.hashSync("legacy-password9", 4));
  const legacyLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "legacy@example.test", password: "legacy-password9" },
  });
  assert.equal(legacyLogin.response.status, 200);
  assert.match(
    database.prepare("SELECT password_hash FROM users WHERE id = ?").get("legacy-user")
      .password_hash,
    /^scrypt\$/,
  );

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    authenticated: true,
    body: {
      name: "Another Collector",
      email: "collector@example.test",
      password: "AnotherPassword123",
    },
  });
  assert.equal(duplicate.response.status, 409);

  const invalidOrder = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: { items: [{ productId: 1, quantity: 999, price: 1 }] },
  });
  assert.equal(invalidOrder.response.status, 400);

  const savedOrder = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: {
      items: [
        { productId: 1, quantity: 2, price: 1 },
        { productId: 3, quantity: 1 },
      ],
    },
  });
  assert.equal(savedOrder.response.status, 201);
  assert.equal(savedOrder.payload.order.status, "awaiting_payment");
  assert.equal(savedOrder.payload.order.total, 20597);
  assert.match(savedOrder.payload.notice, /status PAYMENT DUE/);
  assert.match(savedOrder.payload.notice, /Payment has not been collected/);

  const arbitraryLaptopPrice = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: { items: [{ productId: 101, quantity: 1, baseColor: "blue", price: 1 }] },
  });
  assert.equal(arbitraryLaptopPrice.response.status, 400);

  const customLaptopOrder = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: { items: [{ productId: 101, quantity: 1, baseColor: "#B57F80" }] },
  });
  assert.equal(customLaptopOrder.response.status, 201);
  assert.equal(customLaptopOrder.payload.order.total, 1499);
  assert.equal(customLaptopOrder.payload.order.items[0].name, "Laptop Skin — Hidden Leaf");
  assert.equal(customLaptopOrder.payload.order.items[0].baseColor, "#B57F80");

  const distinctLaptopFinishesOrder = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: {
      items: [
        { productId: 101, quantity: 1, baseColor: "#343941" },
        { productId: 101, quantity: 1, baseColor: "#aeb7c2" },
      ],
    },
  });
  assert.equal(distinctLaptopFinishesOrder.response.status, 201);
  assert.equal(distinctLaptopFinishesOrder.payload.order.total, 2998);
  assert.equal(distinctLaptopFinishesOrder.payload.order.items.length, 2);

  const unconfiguredOptions = await request("/api/payment-options");
  assert.equal(unconfiguredOptions.payload.cashOnDelivery, true);
  assert.equal(unconfiguredOptions.payload.onlinePaymentConfigured, false);

  const deniedAdminAccess = await request("/api/admin/orders", {
    headers: { "X-Admin-Payment-Key": "incorrect" },
  });
  assert.equal(deniedAdminAccess.response.status, 403);

  const unavailableGpay = await request(`/api/orders/${savedOrder.payload.order.id}/payment-method`, {
    method: "POST",
    authenticated: true,
    body: { method: "google_pay" },
  });
  assert.equal(unavailableGpay.response.status, 400);

  const cashOrder = await request("/api/orders", {
    method: "POST",
    authenticated: true,
    body: { items: [{ productId: 2, quantity: 1 }] },
  });
  assert.equal(cashOrder.response.status, 201);
  const cashMethod = await request(
    `/api/orders/${cashOrder.payload.order.id}/payment-method`,
    { method: "POST", authenticated: true, body: { method: "cash_on_delivery" } },
  );
  assert.equal(cashMethod.response.status, 200);
  assert.equal(cashMethod.payload.order.paymentMethod, "cash_on_delivery");
  assert.equal(cashMethod.payload.order.status, "awaiting_payment");

  const paymentDirectory = path.join(process.cwd(), "public", "payments");
  mkdirSync(paymentDirectory, { recursive: true });
  testQrPath = path.join(paymentDirectory, `test-${process.pid}.png`);
  writeFileSync(testQrPath, "test QR image placeholder");
  process.env.PAYMENT_UPI_ID = "customclans@okaxis";
  process.env.PAYMENT_QR_IMAGE_PATH = `/payments/${path.basename(testQrPath)}`;

  const configuredOptions = await request("/api/payment-options");
  assert.equal(configuredOptions.payload.onlinePaymentConfigured, true);
  assert.equal(configuredOptions.payload.qrImagePath, process.env.PAYMENT_QR_IMAGE_PATH);
  assert.equal(configuredOptions.payload.googlePayUpiId, "customclans@okaxis");

  const invalidReference = await request(
    `/api/orders/${savedOrder.payload.order.id}/payment-reference`,
    {
      method: "POST",
      authenticated: true,
      body: { method: "google_pay", reference: "bad" },
    },
  );
  assert.equal(invalidReference.response.status, 400);

  const submittedReference = await request(
    `/api/orders/${savedOrder.payload.order.id}/payment-reference`,
    {
      method: "POST",
      authenticated: true,
      body: { method: "google_pay", reference: "utr123456789" },
    },
  );
  assert.equal(submittedReference.response.status, 200);
  assert.equal(submittedReference.payload.order.paymentMethod, "google_pay");
  assert.equal(submittedReference.payload.order.paymentReference, "UTR123456789");
  assert.equal(submittedReference.payload.order.status, "awaiting_payment");
  assert.match(submittedReference.payload.notice, /remains unpaid/);

  const history = await request("/api/account/orders", { authenticated: true });
  assert.equal(history.payload.orders.length, 4);
  const onlineOrderInHistory = history.payload.orders.find(
    (order) => order.id === savedOrder.payload.order.id,
  );
  assert.equal(onlineOrderInHistory.paymentMethod, "google_pay");
  assert.equal(onlineOrderInHistory.paymentReference, "UTR123456789");
  assert.equal(onlineOrderInHistory.status, "awaiting_payment");
  assert.equal(onlineOrderInHistory.items.length, 2);
  const codOrderInHistory = history.payload.orders.find(
    (order) => order.id === cashOrder.payload.order.id,
  );
  assert.equal(codOrderInHistory.paymentMethod, "cash_on_delivery");
  const laptopOrderInHistory = history.payload.orders.find(
    (order) => order.id === customLaptopOrder.payload.order.id,
  );
  assert.equal(laptopOrderInHistory.items[0].productId, 101);
  assert.equal(laptopOrderInHistory.items[0].baseColor, "#B57F80");
  const laptopFinishVariants = history.payload.orders.find(
    (order) => order.id === distinctLaptopFinishesOrder.payload.order.id,
  );
  assert.deepEqual(
    laptopFinishVariants.items.map((item) => item.baseColor).sort(),
    ["#343941", "#aeb7c2"],
  );

  const adminQueue = await request("/api/admin/orders", {
    headers: { "X-Admin-Payment-Key": process.env.ADMIN_PAYMENT_REVIEW_KEY },
  });
  assert.equal(adminQueue.response.status, 200);
  assert.equal(adminQueue.payload.orders.length, 4);
  const adminOnlineOrder = adminQueue.payload.orders.find(
    (order) => order.id === savedOrder.payload.order.id,
  );
  assert.equal(adminOnlineOrder.customerEmail, "collector@example.test");
  assert.equal(adminOnlineOrder.paymentReference, "UTR123456789");

  const deniedPaymentReview = await request(
    `/api/admin/orders/${savedOrder.payload.order.id}/mark-paid`,
    { method: "POST" },
  );
  assert.equal(deniedPaymentReview.response.status, 403);

  const verifiedOnlinePayment = await request(
    `/api/admin/orders/${savedOrder.payload.order.id}/mark-paid`,
    {
      method: "POST",
      headers: { "X-Admin-Payment-Key": process.env.ADMIN_PAYMENT_REVIEW_KEY },
    },
  );
  assert.equal(verifiedOnlinePayment.response.status, 200);
  assert.equal(verifiedOnlinePayment.payload.order.status, "paid");
  assert.match(verifiedOnlinePayment.payload.notice, /Payment verified by the store/);

  const verifiedCodPayment = await request(
    `/api/admin/orders/${cashOrder.payload.order.id}/mark-paid`,
    {
      method: "POST",
      headers: { "X-Admin-Payment-Key": process.env.ADMIN_PAYMENT_REVIEW_KEY },
    },
  );
  assert.equal(verifiedCodPayment.response.status, 200);
  assert.equal(verifiedCodPayment.payload.order.status, "paid");

  const nonexistentOrder = await request(
    "/api/admin/orders/does-not-exist/mark-paid",
    {
      method: "POST",
      headers: { "X-Admin-Payment-Key": process.env.ADMIN_PAYMENT_REVIEW_KEY },
    },
  );
  assert.equal(nonexistentOrder.response.status, 409);

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const restoredSession = await request("/api/auth/session", { authenticated: true });
  assert.equal(restoredSession.payload.user.email, "collector@example.test");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "COLLECTOR@example.test", password: "Anime12345test" },
  });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get("set-cookie").split(";")[0];

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const failedLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "collector@example.test", password: "wrong-password-123" },
    });
    assert.equal(failedLogin.response.status, 401);
  }
  const rateLimitedLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "collector@example.test", password: "wrong-password-123" },
  });
  assert.equal(rateLimitedLogin.response.status, 429);
  assert.match(rateLimitedLogin.payload.error, /10 sign-in attempts per 15 minutes/);

  const registrationAfterLoginLimit = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Letters Only",
      email: "letters-only@example.test",
      password: "sakuraaa",
    },
  });
  assert.equal(registrationAfterLoginLimit.response.status, 200);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    authenticated: true,
  });
  assert.equal(logout.response.status, 200);

  const afterLogout = await request("/api/auth/session", { authenticated: true });
  assert.equal(afterLogout.response.status, 401);
});
