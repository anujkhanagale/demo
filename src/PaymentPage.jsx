import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, QrCode, Smartphone, Truck } from "lucide-react";
import { apiRequest } from "./api.js";
import { getLaptopBaseColorName } from "./laptopSkins.js";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

function PaymentPage({ order, onBack, onOrderUpdated }) {
  const [paymentOptions, setPaymentOptions] = useState(null);
  const [selectedMode, setSelectedMode] = useState(
    order.paymentMethod === "cash_on_delivery"
      ? "cash_on_delivery"
      : ["upi_qr", "google_pay"].includes(order.paymentMethod)
        ? "online"
        : "",
  );
  const [onlineMethod, setOnlineMethod] = useState(
    ["upi_qr", "google_pay"].includes(order.paymentMethod) ? order.paymentMethod : "",
  );
  const [reference, setReference] = useState(order.paymentReference || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest("/api/payment-options")
      .then((options) => {
        if (active) setPaymentOptions(options);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const savePaymentMethod = async (method) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { order: updatedOrder, notice } = await apiRequest(
        `/api/orders/${encodeURIComponent(order.id)}/payment-method`,
        { method: "POST", body: { method } },
      );
      onOrderUpdated(updatedOrder);
      setMessage(notice);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const selectOnlineMethod = (method) => {
    setOnlineMethod(method);
    setReference("");
    setError("");
    setMessage("");
    const available =
      method === "upi_qr" ? qrConfigured : googlePayConfigured;
    if (available && order.paymentMethod !== method) {
      savePaymentMethod(method);
    }
  };

  const submitPaymentReference = async (event) => {
    event.preventDefault();
    if (!onlineMethod) {
      setError("Select UPI QR or Google Pay first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { order: updatedOrder, notice } = await apiRequest(
        `/api/orders/${encodeURIComponent(order.id)}/payment-reference`,
        { method: "POST", body: { method: onlineMethod, reference } },
      );
      onOrderUpdated(updatedOrder);
      setMessage(notice);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(paymentOptions.googlePayUpiId);
      setCopied(true);
    } catch (clipboardError) {
      setError(`Could not copy the UPI ID. Please copy it manually: ${clipboardError.message}`);
    }
  };

  const orderIsPaid = order.status === "paid";
  const referenceSubmitted = Boolean(order.paymentReference);
  const qrConfigured = Boolean(paymentOptions?.qrImagePath);
  const googlePayConfigured = Boolean(paymentOptions?.googlePayUpiId);

  return (
    <main className="payment-page">
      <header className="payment-header">
        <button className="payment-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> BACK TO MY ORDERS
        </button>
        <span className="payment-brand">CUSTOM CLANS <i>/</i> CHECKOUT</span>
      </header>

      <section className="payment-layout" aria-labelledby="payment-title">
        <div className="payment-main">
          <span className="eyebrow"><span className="eyebrow-line" /> ORDER {order.id.slice(0, 8).toUpperCase()}</span>
          <h1 id="payment-title">COMPLETE YOUR<br /><span>PAYMENT.</span></h1>
          <p className="payment-intro">Choose how you would like to pay for this order.</p>

          <div className="payment-method-grid">
            <button
              type="button"
              disabled={busy}
              className={`payment-method-card ${selectedMode === "cash_on_delivery" ? "selected" : ""}`}
              onClick={() => {
                setSelectedMode("cash_on_delivery");
                setError("");
                setMessage("");
              }}
            >
              <Truck size={22} />
              <span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span>
              <span className="payment-radio" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy}
              className={`payment-method-card ${selectedMode === "online" ? "selected" : ""}`}
              onClick={() => {
                setSelectedMode("online");
                setError("");
                setMessage("");
              }}
            >
              <Smartphone size={22} />
              <span><strong>Online payment</strong><small>UPI QR code or Google Pay</small></span>
              <span className="payment-radio" aria-hidden="true" />
            </button>
          </div>

          {selectedMode === "cash_on_delivery" ? (
            <div className="payment-choice-panel">
              <span className="payment-panel-icon"><Truck size={19} /></span>
              <div>
                <h2>PAY WHEN IT ARRIVES</h2>
                <p>Confirm cash on delivery. The order will stay unpaid until payment is collected at delivery.</p>
              </div>
              <button
                className="button button-lime payment-submit"
                type="button"
                disabled={busy || orderIsPaid}
                onClick={() => savePaymentMethod("cash_on_delivery")}
              >
                {busy ? "SAVING..." : "CONFIRM CASH ON DELIVERY"} <ArrowRight size={15} />
              </button>
            </div>
          ) : selectedMode === "online" ? (
            <div className="payment-choice-panel">
              <span className="eyebrow"><span className="eyebrow-line" /> CHOOSE AN ONLINE METHOD</span>
              <div className="online-method-tabs">
                <button
                  type="button"
                  disabled={busy}
                  className={onlineMethod === "upi_qr" ? "selected" : ""}
                  onClick={() => selectOnlineMethod("upi_qr")}
                >
                  <QrCode size={17} /> UPI QR CODE
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={onlineMethod === "google_pay" ? "selected" : ""}
                  onClick={() => selectOnlineMethod("google_pay")}
                >
                  <Smartphone size={17} /> GOOGLE PAY ID
                </button>
              </div>

              {!paymentOptions ? (
                <p className="payment-setup-note">Loading the store’s payment options…</p>
              ) : !onlineMethod ? (
                <p className="payment-setup-note">Choose UPI QR code or Google Pay ID above.</p>
              ) : onlineMethod === "upi_qr" && qrConfigured ? (
                <div className="upi-details">
                  <img className="upi-qr-image" src={paymentOptions.qrImagePath} alt="CUSTOM CLANS UPI payment QR code" />
                  <p>Scan with your UPI app and pay <strong>{formatPrice(order.total)}</strong> for this order.</p>
                </div>
              ) : onlineMethod === "google_pay" && googlePayConfigured ? (
                <div className="upi-id-card">
                  <span>GOOGLE PAY / UPI ID</span>
                  <strong>{paymentOptions.googlePayUpiId}</strong>
                  <button type="button" onClick={copyUpiId}><Copy size={14} /> {copied ? "COPIED" : "COPY UPI ID"}</button>
                  <p>Pay exactly <strong>{formatPrice(order.total)}</strong> in your UPI app.</p>
                </div>
              ) : (
                <div className="payment-setup-note" role="status">
                  <strong>THIS PAYMENT OPTION ISN’T SET UP YET</strong>
                  <p>
                    {onlineMethod === "upi_qr"
                      ? "The store owner needs to add a UPI QR image before customers can use this option."
                      : "The store owner needs to add a Google Pay UPI ID before customers can use this option."}
                    {" "}No payment will be requested or marked as paid here.
                  </p>
                </div>
              )}

              {((onlineMethod === "upi_qr" && qrConfigured) ||
                (onlineMethod === "google_pay" && googlePayConfigured)) && (
                <form className="payment-reference-form" onSubmit={submitPaymentReference}>
                  <label htmlFor="payment-reference">UPI PAYMENT REFERENCE / UTR</label>
                  <input
                    id="payment-reference"
                    autoComplete="off"
                    maxLength={32}
                    minLength={6}
                    onChange={(event) => setReference(event.target.value)}
                    pattern="[A-Za-z0-9-]{6,32}"
                    placeholder="Enter the reference from your UPI app"
                    required
                    value={reference}
                  />
                  <p>Submitting a reference does not confirm payment. The order stays unpaid until the store verifies it.</p>
                  <button className="button button-lime payment-submit" type="submit" disabled={busy || orderIsPaid}>
                    {busy ? "SUBMITTING..." : "SUBMIT FOR VERIFICATION"} <ArrowRight size={15} />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <p className="payment-select-prompt">Select cash on delivery or online payment above to continue.</p>
          )}

          {orderIsPaid && <p className="payment-success"><Check size={17} /> This order has been marked as paid.</p>}
          {referenceSubmitted && !orderIsPaid && (
            <p className="payment-review-note" role="status">A payment reference has been submitted. This order is still unpaid while the store verifies it.</p>
          )}
          {message && <p className="payment-success" role="status">{message}</p>}
          {error && <p className="payment-error" role="alert">{error}</p>}
        </div>

        <aside className="payment-order-summary" aria-label="Order summary">
          <span className="eyebrow"><span className="eyebrow-line" /> ORDER SUMMARY</span>
          <h2>YOUR ORDER</h2>
          <ul>
            {order.items.map((item) => (
              <li key={`${order.id}-${item.productId}-${item.baseColor || "default"}`}>
                <span>{item.name} <i>× {item.quantity}</i></span>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
                {item.baseColor && (
                  <small className="payment-item-finish">
                    BASE FINISH · {getLaptopBaseColorName(item.baseColor).toUpperCase()}
                  </small>
                )}
              </li>
            ))}
          </ul>
          <div className="payment-total"><span>TOTAL DUE</span><strong>{formatPrice(order.total)}</strong></div>
          <p className="payment-order-status">
            ORDER STATUS <b>{orderIsPaid ? "PAID" : referenceSubmitted ? "AWAITING VERIFICATION" : "PAYMENT DUE"}</b>
          </p>
          <p className="payment-safety-note">Payment is only marked paid after the store verifies receipt. Never share your UPI PIN or OTP.</p>
        </aside>
      </section>
    </main>
  );
}

export default PaymentPage;
