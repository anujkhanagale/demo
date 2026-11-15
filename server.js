import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import express from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import { laptopSkinProducts } from "./src/laptopSkins.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const scrypt = promisify(nodeScrypt);
const dataDirectory = path.resolve(process.env.DATA_DIRECTORY || path.join(root, "data"));
mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.resolve(
  process.env.DATABASE_PATH || path.join(dataDirectory, "custom-clans.sqlite"),
);
mkdirSync(path.dirname(databasePath), { recursive: true });

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must contain at least 32 characters.");
    }
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");
  }

  const secretPath = path.join(dataDirectory, "session-secret");
  try {
    return readFileSync(secretPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const secret = randomBytes(48).toString("base64url");
    writeFileSync(secretPath, secret, { mode: 0o600, flag: "wx" });
    chmodSync(secretPath, 0o600);
    return secret;
  }
}

function getAdminPaymentReviewKey() {
  if (process.env.ADMIN_PAYMENT_REVIEW_KEY) {
    if (process.env.ADMIN_PAYMENT_REVIEW_KEY.length < 32) {
      throw new Error("ADMIN_PAYMENT_REVIEW_KEY must contain at least 32 characters.");
    }
    return process.env.ADMIN_PAYMENT_REVIEW_KEY;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set ADMIN_PAYMENT_REVIEW_KEY to a random value of at least 32 characters.");
  }

  const keyPath = path.join(dataDirectory, "admin-payment-review-key");
  try {
    return readFileSync(keyPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const key = randomBytes(48).toString("base64url");
    writeFileSync(keyPath, key, { mode: 0o600, flag: "wx" });
    chmodSync(keyPath, 0o600);
    return key;
  }
}

const adminPaymentReviewKey = getAdminPaymentReviewKey();

export const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'paid', 'cancelled')),
    total INTEGER NOT NULL,
    payment_method TEXT,
    payment_reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS orders_user_date ON orders(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL,
    base_color TEXT
  );
`);

const orderColumns = new Set(
  database.prepare("PRAGMA table_info(orders)").all().map((column) => column.name),
);
if (!orderColumns.has("payment_method")) {
  database.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT");
}
if (!orderColumns.has("payment_reference")) {
  database.exec("ALTER TABLE orders ADD COLUMN payment_reference TEXT");
}
const orderItemColumns = new Set(
  database.prepare("PRAGMA table_info(order_items)").all().map((column) => column.name),
);
if (!orderItemColumns.has("base_color")) {
  database.exec("ALTER TABLE order_items ADD COLUMN base_color TEXT");
}

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.read = db.prepare("SELECT sess, expires FROM sessions WHERE sid = ?");
    this.write = db.prepare(`
      INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
    `);
    this.remove = db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.extend = db.prepare("UPDATE sessions SET expires = ? WHERE sid = ?");
    this.cleanup = db.prepare("DELETE FROM sessions WHERE expires <= ?");
  }

  get(sid, callback) {
    try {
      const row = this.read.get(sid);
      if (!row) return callback(null, null);
      if (row.expires <= Date.now()) {
        this.remove.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
      this.write.run(sid, JSON.stringify(value), expires);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
      this.extend.run(expires, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.remove.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

const products = new Map([
  [1, { name: "Action Figure", price: 7499 }],
  [2, { name: "Katana", price: 6299 }],
  [3, { name: "Masks", price: 5599 }],
  [4, { name: "Bobble Heads", price: 6899 }],
  ...laptopSkinProducts.map((skin) => [
    skin.productId,
    { name: skin.name, price: skin.price },
  ]),
]);

export const app = express();
const production = process.env.NODE_ENV === "production";
if (production) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(
  session({
    name: "customclans.sid",
    secret: getSessionSecret(),
    store: new SQLiteSessionStore(database),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", (request, response, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return next();
  const origin = request.get("origin");
  if (!origin) return response.status(403).json({ error: "Request origin is required." });
  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.host !== request.get("host") ||
      parsedOrigin.protocol !== `${request.protocol}:`
    ) {
      return response.status(403).json({ error: "Request origin is not allowed." });
    }
  } catch {
    return response.status(403).json({ error: "Request origin is invalid." });
  }
  next();
});

const createAuthRateLimit = (route) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: `Limit reached: 10 ${route} attempts per 15 minutes. Please try again in 15 minutes.`,
    },
  });
const registrationRateLimit = createAuthRateLimit("account creation");
const loginRateLimit = createAuthRateLimit("sign-in");
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many admin access attempts. Try again in 15 minutes." },
});

const selectUser = database.prepare(
  "SELECT id, email, name, password_hash FROM users WHERE email = ?",
);
const dummyPasswordHash = bcrypt.hashSync("not-a-real-password", 12);
const updatePasswordHash = database.prepare(
  "UPDATE users SET password_hash = ? WHERE id = ?",
);
const insertUser = database.prepare(
  "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)",
);
const findUserById = database.prepare("SELECT id, email, name FROM users WHERE id = ?");

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith("$2")) {
    if (Buffer.byteLength(password, "utf8") > 72) return false;
    return bcrypt.compare(password, storedHash);
  }

  const [algorithm, cost, blockSize, parallelization, encodedSalt, encodedHash] =
    storedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    cost !== "16384" ||
    blockSize !== "8" ||
    parallelization !== "1" ||
    !encodedSalt ||
    !encodedHash
  ) {
    return false;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expectedHash = Buffer.from(encodedHash, "base64url");
  if (salt.length !== 16 || expectedHash.length !== 64) return false;
  const derivedHash = await scrypt(password, salt, expectedHash.length, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(derivedHash, expectedHash);
}

function requireUser(request, response, next) {
  if (!request.session.userId) {
    return response.status(401).json({ error: "Please sign in to continue." });
  }
  next();
}

function requirePaymentReviewKey(request, response, next) {
  const providedKey = request.get("x-admin-payment-key") || "";
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(adminPaymentReviewKey);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return response.status(403).json({ error: "Admin access key is invalid." });
  }
  next();
}

function saveRegeneratedSession(request, response, user) {
  request.session.regenerate((error) => {
    if (error) return response.status(500).json({ error: "Could not create a secure session." });
    request.session.userId = user.id;
    request.session.save((saveError) => {
      if (saveError) return response.status(500).json({ error: "Could not save your session." });
      response.json({ user });
    });
  });
}

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

function getPaymentOptions() {
  const upiId = process.env.PAYMENT_UPI_ID?.trim() || "";
  const qrImagePath = process.env.PAYMENT_QR_IMAGE_PATH?.trim() || "";
  const configuredQrImagePath =
    /^\/payments\/[a-zA-Z0-9._-]+$/.test(qrImagePath) && !qrImagePath.includes("..")
      ? qrImagePath
      : "";
  const qrAssetDirectory =
    process.env.NODE_ENV === "production"
      ? path.join(root, "dist")
      : path.join(root, "public");
  const validQrImagePath =
    configuredQrImagePath &&
    existsSync(path.join(qrAssetDirectory, configuredQrImagePath.slice(1)))
      ? configuredQrImagePath
      : "";
  return {
    cashOnDelivery: true,
    qrImagePath: validQrImagePath,
    googlePayUpiId: upiId,
    onlinePaymentConfigured: Boolean(validQrImagePath || upiId),
  };
}

app.get("/api/payment-options", (_request, response) => {
  response.json(getPaymentOptions());
});

app.get("/api/auth/session", (request, response) => {
  if (!request.session.userId) {
    return response.status(401).json({ error: "Not signed in." });
  }
  const user = findUserById.get(request.session.userId);
  if (!user) {
    return request.session.destroy((error) => {
      if (error) return response.status(500).json({ error: "Could not end the expired session." });
      response.clearCookie("customclans.sid");
      response.status(401).json({ error: "Not signed in." });
    });
  }
  response.json({ user });
});

app.post("/api/auth/register", registrationRateLimit, async (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordLength = Array.from(password).length;

  if (name.length < 2 || name.length > 50) {
    return response.status(400).json({ error: "Name must be between 2 and 50 characters." });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }
  if (
    passwordLength < 8 ||
    passwordLength > 256 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    return response.status(400).json({
      error: "Password must be between 8 and 256 characters.",
    });
  }

  try {
    const user = {
      id: randomUUID(),
      email,
      name,
    };
    const passwordHash = await hashPassword(password);
    insertUser.run(user.id, user.email, user.name, passwordHash);
    saveRegeneratedSession(request, response, user);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "An account with that email already exists." });
    }
    console.error("Account registration failed:", error);
    response.status(500).json({ error: "Could not create your account. Please try again." });
  }
});

app.post("/api/auth/login", loginRateLimit, async (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || Buffer.byteLength(password, "utf8") > 1024) {
    return response.status(400).json({ error: "Enter your email and password." });
  }

  try {
    const user = selectUser.get(email);
    const passwordMatches = await verifyPassword(
      password,
      user?.password_hash || dummyPasswordHash,
    );
    if (!user || !passwordMatches) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }
    if (user.password_hash.startsWith("$2")) {
      updatePasswordHash.run(await hashPassword(password), user.id);
    }
    saveRegeneratedSession(request, response, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error("Account sign-in failed:", error);
    response.status(500).json({ error: "Could not sign in. Please try again." });
  }
});

app.post("/api/auth/logout", requireUser, (request, response) => {
  request.session.destroy((error) => {
    if (error) return response.status(500).json({ error: "Could not sign out. Please try again." });
    response.clearCookie("customclans.sid");
    response.json({ status: "ok" });
  });
});

const orderItems = database.prepare(
  "SELECT product_id AS productId, product_name AS name, quantity, unit_price AS price, base_color AS baseColor FROM order_items WHERE order_id = ?",
);
const orderRows = database.prepare(`
  SELECT
    id,
    status,
    total,
    payment_method AS paymentMethod,
    payment_reference AS paymentReference,
    created_at AS createdAt
  FROM orders WHERE user_id = ? ORDER BY created_at DESC
`);

app.get("/api/account/orders", requireUser, (request, response) => {
  const orders = orderRows.all(request.session.userId).map((order) => ({
    ...order,
    items: orderItems.all(order.id),
  }));
  response.json({ orders });
});

app.post("/api/orders/:orderId/payment-method", requireUser, (request, response) => {
  const { method } = request.body || {};
  if (!["cash_on_delivery", "upi_qr", "google_pay"].includes(method)) {
    return response.status(400).json({ error: "Choose an available payment method." });
  }
  const paymentOptions = getPaymentOptions();
  if (method === "upi_qr" && !paymentOptions.qrImagePath) {
    return response.status(400).json({ error: "The store has not set up its UPI QR code yet." });
  }
  if (method === "google_pay" && !paymentOptions.googlePayUpiId) {
    return response.status(400).json({ error: "The store has not set up its Google Pay UPI ID yet." });
  }

  const result = database
    .prepare(`
      UPDATE orders
      SET payment_method = ?, payment_reference = NULL
      WHERE id = ? AND user_id = ? AND status = 'awaiting_payment'
    `)
    .run(method, request.params.orderId, request.session.userId);
  if (result.changes === 0) {
    return response.status(404).json({
      error: "This order is unavailable or no longer accepts payment changes.",
    });
  }

  const order = orderRows
    .all(request.session.userId)
    .find((entry) => entry.id === request.params.orderId);
  response.json({
    order: { ...order, items: orderItems.all(order.id) },
    notice:
      method === "cash_on_delivery"
        ? "Cash on delivery selected. Payment will be due when your order arrives."
        : "Payment method saved. The order will remain unpaid until your payment is manually verified.",
  });
});

app.post("/api/orders/:orderId/payment-reference", requireUser, (request, response) => {
  const { method, reference } = request.body || {};
  if (!["upi_qr", "google_pay"].includes(method)) {
    return response.status(400).json({ error: "Choose an online UPI payment method." });
  }
  const paymentOptions = getPaymentOptions();
  if (method === "upi_qr" && !paymentOptions.qrImagePath) {
    return response.status(400).json({ error: "The store has not set up its UPI QR code yet." });
  }
  if (method === "google_pay" && !paymentOptions.googlePayUpiId) {
    return response.status(400).json({ error: "The store has not set up its Google Pay UPI ID yet." });
  }
  if (typeof reference !== "string" || !/^[a-zA-Z0-9-]{6,32}$/.test(reference.trim())) {
    return response.status(400).json({
      error: "Enter the 6–32 character payment reference shown by your UPI app.",
    });
  }

  const result = database
    .prepare(`
      UPDATE orders
      SET payment_method = ?, payment_reference = ?
      WHERE id = ? AND user_id = ? AND status = 'awaiting_payment'
    `)
    .run(method, reference.trim().toUpperCase(), request.params.orderId, request.session.userId);
  if (result.changes === 0) {
    return response.status(404).json({
      error: "This order is unavailable or no longer accepts payment details.",
    });
  }

  const order = orderRows
    .all(request.session.userId)
    .find((entry) => entry.id === request.params.orderId);
  response.json({
    order: { ...order, items: orderItems.all(order.id) },
    notice: "Payment reference submitted. Your order remains unpaid while the payment is verified.",
  });
});

app.get(
  "/api/admin/orders",
  adminRateLimit,
  requirePaymentReviewKey,
  (_request, response) => {
    const orders = database
      .prepare(`
        SELECT
          orders.id,
          orders.status,
          orders.total,
          orders.payment_method AS paymentMethod,
          orders.payment_reference AS paymentReference,
          orders.created_at AS createdAt,
          users.name AS customerName,
          users.email AS customerEmail
        FROM orders
        JOIN users ON users.id = orders.user_id
        WHERE orders.status = 'awaiting_payment'
        ORDER BY orders.created_at DESC
      `)
      .all()
      .map((order) => ({ ...order, items: orderItems.all(order.id) }));
    response.json({ orders });
  },
);

app.post(
  "/api/admin/orders/:orderId/mark-paid",
  adminRateLimit,
  requirePaymentReviewKey,
  (request, response) => {
    const result = database
      .prepare(`
        UPDATE orders
        SET status = 'paid'
        WHERE id = ?
          AND status = 'awaiting_payment'
          AND (
            payment_method = 'cash_on_delivery'
            OR (
              payment_method IN ('upi_qr', 'google_pay')
              AND payment_reference IS NOT NULL
            )
          )
      `)
      .run(request.params.orderId);
    if (result.changes === 0) {
      return response.status(409).json({
        error: "This order is not awaiting a verifiable payment.",
      });
    }

    const order = database
      .prepare(`
        SELECT id, status, total, payment_method AS paymentMethod,
          payment_reference AS paymentReference, created_at AS createdAt
        FROM orders WHERE id = ?
      `)
      .get(request.params.orderId);
    response.json({
      order: { ...order, items: orderItems.all(order.id) },
      notice: "Payment verified by the store. The order is now marked as paid.",
    });
  },
);

app.post("/api/orders", requireUser, (request, response) => {
  const requestedItems =
    request.body && typeof request.body === "object" ? request.body.items : undefined;
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 20) {
    return response.status(400).json({ error: "Choose at least one collectible to continue." });
  }

  const quantitiesByVariant = new Map();
  const quantitiesByProduct = new Map();
  for (const item of requestedItems) {
    if (
      !item ||
      !Number.isInteger(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10 ||
      !products.has(item.productId)
    ) {
      return response.status(400).json({ error: "The bag contains an invalid item or quantity." });
    }
    const isCustomLaptopSkin = laptopSkinProducts.some(
      (skin) => skin.productId === item.productId,
    );
    if (
      isCustomLaptopSkin &&
      item.baseColor !== undefined &&
      (typeof item.baseColor !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(item.baseColor))
    ) {
      return response.status(400).json({ error: "The custom laptop color is invalid." });
    }
    const baseColor = isCustomLaptopSkin ? item.baseColor || "#343941" : null;
    const variantKey = `${item.productId}:${baseColor || ""}`;
    const previousVariant = quantitiesByVariant.get(variantKey);
    quantitiesByVariant.set(variantKey, {
      productId: item.productId,
      quantity: (previousVariant?.quantity || 0) + item.quantity,
      baseColor,
    });
    quantitiesByProduct.set(
      item.productId,
      (quantitiesByProduct.get(item.productId) || 0) + item.quantity,
    );
  }
  if ([...quantitiesByProduct.values()].some((quantity) => quantity > 10)) {
    return response.status(400).json({ error: "A maximum of 10 of each item can be ordered." });
  }

  const orderId = randomUUID();
  const items = [...quantitiesByVariant.values()].map(({ productId, quantity, baseColor }) => ({
    productId,
    quantity,
    baseColor,
    ...products.get(productId),
  }));
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  try {
    const saveOrder = database.transaction(() => {
      database
        .prepare("INSERT INTO orders (id, user_id, status, total) VALUES (?, ?, 'awaiting_payment', ?)")
        .run(orderId, request.session.userId, total);
      const insertItem = database.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, quantity, unit_price, base_color
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insertItem.run(
          orderId,
          item.productId,
          item.name,
          item.quantity,
          item.price,
          item.baseColor,
        );
      }
    });
    saveOrder();
    response.status(201).json({
      order: { id: orderId, status: "awaiting_payment", total, items },
      notice: "Order placed and saved with status PAYMENT DUE. Payment has not been collected; online checkout is not connected yet.",
    });
  } catch (error) {
    console.error("Saving order failed:", error);
    response.status(500).json({ error: "Could not save the order. Please try again." });
  }
});

app.use(express.static(path.join(root, "dist"), { index: false, maxAge: production ? "1h" : 0 }));
app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
  response.sendFile(path.join(root, "dist", "index.html"), (error) => {
    if (error) next(error);
  });
});
app.use((error, _request, response, _next) => {
  console.error("Unhandled server error:", error);
  response.status(500).json({ error: "The server encountered an unexpected error." });
});

database.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
setInterval(() => {
  database.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
}, 60 * 60 * 1000).unref();

export function startServer() {
  const port = Number(process.env.PORT || process.env.API_PORT || (production ? 5173 : 3001));
  const host = process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1");
  return app.listen(port, host, () => {
    console.log(`CUSTOM CLANS is available at http://${host}:${port}`);
    console.log(`SQLite database: ${databasePath}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
