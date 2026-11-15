import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest } from "./api.js";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

function AdminPaymentReviewPage() {
  const [accessKey, setAccessKey] = useState("");
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const loadOrders = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { orders: pendingOrders } = await apiRequest("/api/admin/orders", {
        headers: { "X-Admin-Payment-Key": accessKey },
      });
      setOrders(pendingOrders);
      setAuthenticated(true);
    } catch (requestError) {
      setAuthenticated(false);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (order) => {
    const confirmed = window.confirm(
      `Confirm you have received and verified ${formatPrice(order.total)} for order ${order.id.slice(0, 8).toUpperCase()}?`,
    );
    if (!confirmed) return;

    setBusyOrderId(order.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(
        `/api/admin/orders/${encodeURIComponent(order.id)}/mark-paid`,
        {
          method: "POST",
          body: {},
          headers: { "X-Admin-Payment-Key": accessKey },
        },
      );
      setOrders((pendingOrders) => pendingOrders.filter((item) => item.id !== order.id));
      setNotice(`Payment verified. Order ${order.id.slice(0, 8).toUpperCase()} is marked paid.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrderId("");
    }
  };

  return (
    <main className="admin-review-page">
      <header className="payment-header">
        <a className="payment-back" href="/">
          <ArrowLeft size={17} /> BACK TO STORE
        </a>
        <span className="payment-brand">CUSTOM CLANS <i>/</i> PAYMENT REVIEW</span>
      </header>

      <section className="admin-review-content">
        <span className="eyebrow"><span className="eyebrow-line" /> STORE OWNER ACCESS</span>
        <h1>PAYMENT<br /><span>REVIEW.</span></h1>
        <p className="payment-intro">Verify UPI references against your payment account before marking an order as paid. Confirm cash collection before approving cash-on-delivery orders.</p>

        <form className="admin-key-form" onSubmit={loadOrders}>
          <label htmlFor="admin-review-key"><LockKeyhole size={15} /> ADMIN PAYMENT REVIEW KEY</label>
          <input
            id="admin-review-key"
            autoComplete="current-password"
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="Enter your private admin key"
            required
            type="password"
            value={accessKey}
          />
          <button className="button button-lime" type="submit" disabled={loading}>
            {loading ? "CHECKING..." : authenticated ? "REFRESH PENDING ORDERS" : "ACCESS PAYMENT REVIEWS"}
            {authenticated ? <RefreshCw size={15} /> : <ArrowRight size={15} />}
          </button>
        </form>

        {error && <p className="payment-error" role="alert">{error}</p>}
        {notice && <p className="payment-success" role="status"><Check size={17} /> {notice}</p>}

        {authenticated && (
          <div className="admin-review-orders">
            <div className="admin-review-heading">
              <h2>UNPAID ORDERS</h2>
              <span>{orders.length.toString().padStart(2, "0")}</span>
            </div>
            {orders.length === 0 ? (
              <p className="admin-review-empty">No unpaid orders need review.</p>
            ) : orders.map((order) => (
              <article className="admin-review-order" key={order.id}>
                <div className="admin-order-header">
                  <div>
                    <span>ORDER {order.id.slice(0, 8).toUpperCase()}</span>
                    <time>{new Date(order.createdAt).toLocaleString()}</time>
                  </div>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                <p className="admin-customer">{order.customerName} · {order.customerEmail}</p>
                <ul>
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      {item.name} × {item.quantity}
                    </li>
                  ))}
                </ul>
                <div className="admin-payment-proof">
                  <span>METHOD</span>
                  <strong>
                    {order.paymentMethod === "cash_on_delivery"
                      ? "CASH ON DELIVERY"
                      : order.paymentMethod === "upi_qr"
                        ? "UPI QR"
                        : order.paymentMethod === "google_pay"
                          ? "GOOGLE PAY"
                          : "NOT SELECTED"}
                  </strong>
                  <span>PAYMENT REFERENCE</span>
                  <strong>{order.paymentReference || "No online reference submitted"}</strong>
                </div>
                <button
                  className="admin-verify-button"
                  type="button"
                  disabled={
                    busyOrderId === order.id ||
                    !["cash_on_delivery", "upi_qr", "google_pay"].includes(order.paymentMethod) ||
                    (order.paymentMethod !== "cash_on_delivery" && !order.paymentReference)
                  }
                  onClick={() => verifyPayment(order)}
                >
                  <ShieldCheck size={16} />
                  {busyOrderId === order.id ? "VERIFYING..." : "MARK AS PAID — I VERIFIED RECEIPT"}
                </button>
              </article>
            ))}
          </div>
        )}

        <p className="admin-security-note">Keep this key private. Never mark a UPI order paid from a customer-submitted reference alone—verify that the money arrived in your account first.</p>
      </section>
    </main>
  );
}

export default AdminPaymentReviewPage;
