import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminPaymentReviewPage from "./AdminPaymentReviewPage.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {window.location.pathname === "/admin" ? <AdminPaymentReviewPage /> : <App />}
  </React.StrictMode>,
);
