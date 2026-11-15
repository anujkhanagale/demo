import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
import { apiRequest } from "./api.js";
import actionFigureImage from "../action figure.jpg";
import customClansLogo from "../logo-transparent.png";

function AuthPage({ onAuthenticated, serverError, onRetry }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setPassword("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { user } = await apiRequest(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body: isRegister ? { name, email, password } : { email, password },
        },
      );
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-grain" aria-hidden="true" />
      <header className="auth-header">
        <a href="#auth" className="auth-logo" aria-label="CUSTOM CLANS">
          <img src={customClansLogo} alt="CUSTOM CLANS" />
        </a>
        <span><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span>
      </header>
      <section className="auth-layout">
        <motion.div
          className="auth-art"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img src={actionFigureImage} alt="Naruto collectible from the CUSTOM CLANS collection" />
          <div className="auth-art-shade" />
          <div className="auth-art-copy">
            <span className="auth-kicker"><span /> THE CLAN IS CALLING</span>
            <h1>YOUR WORLD.<br />YOUR <em>COLLECTION.</em></h1>
            <p>Sign in to keep your collection and order history close.</p>
            <div className="auth-art-stamp"><KeyRound size={17} /><span>MEMBER<br />ACCESS</span></div>
          </div>
          <span className="auth-art-index">CC / 001 — THE COLLECTOR'S GATE</span>
        </motion.div>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
        >
          <span className="auth-kicker"><span /> ACCESS THE CLAN</span>
          <h2>{isRegister ? "JOIN THE CLAN." : "WELCOME BACK."}</h2>
          <p className="auth-subtitle">
            {isRegister
              ? "Create your account and keep your collection in one place."
              : "Your collection is right where you left it."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              SIGN IN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              CREATE ACCOUNT
            </button>
          </div>

          {serverError ? (
            <div className="auth-alert" role="alert">
              <p>{serverError}</p>
              <button type="button" onClick={onRetry}>TRY AGAIN <ArrowRight size={14} /></button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {isRegister && (
                <label>
                  <span>YOUR NAME</span>
                  <input
                    autoComplete="name"
                    maxLength={50}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we call you?"
                    required
                    value={name}
                  />
                </label>
              )}
              <label>
                <span>EMAIL ADDRESS</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                <span>PASSWORD</span>
                <div className="password-input">
                  <input
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    maxLength={isRegister ? 256 : undefined}
                    minLength={isRegister ? 8 : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                    required
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                  >
                    {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {isRegister && <small>Use between 8 and 256 characters.</small>}
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" disabled={submitting} type="submit">
                {submitting
                  ? "ONE MOMENT..."
                  : isRegister
                    ? "CREATE MY ACCOUNT"
                    : "SIGN IN"}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          <p className="auth-privacy">Your account is private. Passwords are securely hashed.</p>
        </motion.div>
      </section>
      <footer className="auth-footer">
        <span>COLLECT WHAT YOU LOVE.</span>
        <span>© {new Date().getFullYear()} CUSTOM CLANS</span>
      </footer>
    </main>
  );
}

export default AuthPage;
