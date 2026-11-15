import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import customClansLogo from "../logo-transparent.png";
import actionFigureImage from "../action figure.jpg";
import katanaImage from "../katana.webp";
import masksImage from "../masks.jpeg";
import bobbleHeadsImage from "../bobble heads.jpeg";
import AuthPage from "./AuthPage.jsx";
import PaymentPage from "./PaymentPage.jsx";
import laptopSkins, { getLaptopBaseColorName } from "./laptopSkins.js";
import { apiRequest } from "./api.js";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Heart,
  Instagram,
  LogOut,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

const products = [
  {
    id: 1,
    name: "Action Figure",
    character: "Naruto Uzumaki collectible figure",
    price: 7499,
    tag: "ACTION FIGURE",
    image: actionFigureImage,
    imageAlt: "Naruto action figure collectible with a blue effect display",
  },
  {
    id: 2,
    name: "Katana",
    character: "White and gold display sword",
    price: 6299,
    tag: "KATANA",
    image: katanaImage,
    imageAlt: "White and gold katana collectible display",
  },
  {
    id: 3,
    name: "Masks",
    character: "Spider-Man inspired mask",
    price: 5599,
    tag: "MASK",
    image: masksImage,
    imageAlt: "Red Spider-Man inspired character mask",
  },
  {
    id: 4,
    name: "Bobble Heads",
    character: "Monkey D. Luffy · One Piece",
    price: 6899,
    tag: "BOBBLE HEAD",
    image: bobbleHeadsImage,
    imageAlt: "Monkey D. Luffy bobble head collectible",
  },
];
const LaptopCustomizer = lazy(() => import("./LaptopCustomizer.jsx"));

const cartStorageKey = "custom-clans-cart";
const getCartKey = (item) =>
  item.baseColor ? `${item.id}-${item.baseColor}` : String(item.id);

function readSavedCart() {
  try {
    const savedItems = JSON.parse(window.localStorage.getItem(cartStorageKey) || "[]");
    if (!Array.isArray(savedItems)) return [];
    return savedItems.flatMap((item) => {
      const standardProduct = products.find((entry) => entry.id === item?.id);
      const skin = laptopSkins.find((entry) => entry.productId === item?.id);
      const product = standardProduct || (skin && {
        id: skin.productId,
        skinId: skin.id,
        name: `Laptop Skin — ${skin.name}`,
        character: `${skin.category} · Custom laptop skin`,
        price: skin.price,
        tag: "CUSTOM LAPTOP SKIN",
        image: skin.artwork,
        imageAlt: `${skin.name} laptop skin design preview`,
        baseColor: item.baseColor || "#343941",
      });
      return product && Number.isInteger(item.quantity) && item.quantity > 0
        ? [{ ...product, quantity: Math.min(item.quantity, 10) }]
        : [];
    });
  } catch (error) {
    console.error("Could not restore the saved shopping bag:", error);
    return [];
  }
}

const instagramImages = [
  actionFigureImage,
  katanaImage,
  masksImage,
  bobbleHeadsImage,
];

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

function DeferredLaptopCustomizer({ onAddToCart }) {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (isNearViewport) return undefined;
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "350px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [isNearViewport]);

  return (
    <div id="design-studio" ref={sectionRef}>
      {isNearViewport ? (
        <Suspense fallback={<div className="laptop-studio-placeholder laptop-studio-loading">OPENING THE DESIGN STUDIO...</div>}>
          <LaptopCustomizer onAddToCart={onAddToCart} />
        </Suspense>
      ) : (
        <div className="laptop-studio-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

function App() {
  const [cart, setCart] = useState(readSavedCart);
  const [wishlist, setWishlist] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [customer, setCustomer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authServerError, setAuthServerError] = useState("");
  const [authRetry, setAuthRetry] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const filteredProducts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return term
      ? products.filter((product) =>
          `${product.name} ${product.character}`.toLowerCase().includes(term),
        )
      : products;
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    setAuthLoading(true);
    setAuthServerError("");
    apiRequest("/api/auth/session")
      .then(({ user }) => {
        if (active) setCustomer(user);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          setCustomer(null);
          return;
        }
        setAuthServerError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authRetry]);

  useEffect(() => {
    if (!customer) {
      setOrders([]);
      return;
    }
    let active = true;
    setOrdersError("");
    apiRequest("/api/account/orders")
      .then(({ orders: savedOrders }) => {
        if (active) setOrders(savedOrders);
      })
      .catch((error) => {
        if (active) setOrdersError(error.message);
      });
    return () => {
      active = false;
    };
  }, [customer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        cartStorageKey,
        JSON.stringify(
          cart.map(({ id, quantity, baseColor }) => ({ id, quantity, baseColor })),
        ),
      );
    } catch (error) {
      console.error("Could not save the shopping bag on this device:", error);
    }
  }, [cart]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      cartOpen || quickView || searchOpen || accountOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, quickView, searchOpen, accountOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setAccountOpen(false);
        setQuickView(null);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const addToCart = (product) => {
    setCart((items) => {
      const productKey = getCartKey(product);
      const current = items.find((item) => getCartKey(item) === productKey);
      return current
        ? items.map((item) =>
            getCartKey(item) === productKey
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, 10),
                }
              : item,
          )
        : [...items, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (itemToChange, amount) => {
    const itemKey = getCartKey(itemToChange);
    setCart((items) =>
      items
        .map((item) =>
          getCartKey(item) === itemKey
            ? { ...item, quantity: Math.min(item.quantity + amount, 10) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const toggleWishlist = (id) => {
    setWishlist((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  };

  const handleSubscribe = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribeMessage("Signup isn't connected in this preview; your email wasn't saved.");
    setEmail("");
  };

  const handleCheckout = async (items = cart) => {
    if (items.length === 0) return false;
    setCheckoutMessage("");
    setOrderSubmitting(true);
    try {
      const { order, notice } = await apiRequest("/api/orders", {
        method: "POST",
        body: {
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            ...(item.baseColor ? { baseColor: item.baseColor } : {}),
          })),
        },
      });
      const placedOrder = {
        ...order,
        createdAt: new Date().toISOString(),
        items: order.items.map((item) => ({ ...item, productId: item.productId })),
      };
      setOrders((savedOrders) => [
        placedOrder,
        ...savedOrders,
      ]);
      setCart((savedItems) =>
        savedItems
          .map((savedItem) => {
            const orderedItem = order.items.find(
              (item) =>
                item.productId === savedItem.id &&
                (item.baseColor || null) === (savedItem.baseColor || null),
            );
            return orderedItem
              ? { ...savedItem, quantity: savedItem.quantity - orderedItem.quantity }
              : savedItem;
          })
          .filter((savedItem) => savedItem.quantity > 0),
      );
      setCheckoutMessage(notice);
      setPaymentOrder(placedOrder);
      return true;
    } catch (error) {
      setCheckoutMessage(error.message);
      return false;
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    setOrdersError("");
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setCustomer(null);
      setCart([]);
      setWishlist([]);
      setPaymentOrder(null);
      setAccountOpen(false);
    } catch (error) {
      setOrdersError(error.message);
    } finally {
      setSigningOut(false);
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  if (authLoading) {
    return (
      <main className="auth-loading">
        <img src={customClansLogo} alt="CUSTOM CLANS" />
        <span>OPENING THE COLLECTOR'S GATE...</span>
      </main>
    );
  }

  if (!customer) {
    return (
      <MotionConfig reducedMotion="user">
        <AuthPage
          onAuthenticated={(user) => {
            setAuthServerError("");
            setCustomer(user);
          }}
          serverError={authServerError}
          onRetry={() => setAuthRetry((count) => count + 1)}
        />
      </MotionConfig>
    );
  }

  if (paymentOrder) {
    return (
      <MotionConfig reducedMotion="user">
        <PaymentPage
          order={paymentOrder}
          onBack={() => {
            setPaymentOrder(null);
            setAccountOpen(true);
          }}
          onOrderUpdated={(updatedOrder) => {
            setPaymentOrder(updatedOrder);
            setOrders((savedOrders) =>
              savedOrders.map((order) =>
                order.id === updatedOrder.id ? updatedOrder : order,
              ),
            );
          }}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-hidden bg-ink text-paper">
      <header className={`site-header ${scrolled ? "header-scrolled" : ""}`}>
        <div className="header-inner">
          <a className="wordmark" href="#home" aria-label="Custom Clans home">
            <img src={customClansLogo} alt="CUSTOM CLANS" />
          </a>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#collections">Collections</a>
            <a href="#design-studio">Design Your Laptop</a>
            <a href="#about">Our Story</a>
          </nav>
          <div className="header-actions">
            <button className="icon-button search-trigger" aria-label="Search products" onClick={() => setSearchOpen(true)}>
              <Search size={19} strokeWidth={1.6} />
            </button>
            <button className="icon-button cart-trigger" aria-label={`Open bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`} onClick={() => setCartOpen(true)}>
              <ShoppingBag size={19} strokeWidth={1.6} />
              <span className="cart-count">{cartCount}</span>
            </button>
            <button className="account-trigger" onClick={() => setAccountOpen(true)} aria-label={`Open account for ${customer.name}`}>
              <UserRound size={17} />
              <span>HI, {customer.name.split(" ")[0].toUpperCase()}</span>
            </button>
            <button
              className="icon-button menu-trigger"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav className="mobile-nav" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} aria-label="Mobile navigation">
              {[["Home", "#home"], ["Collections", "#collections"], ["Design Your Laptop", "#design-studio"], ["Our Story", "#about"]].map(([label, href]) => (
                <a key={label} href={href} onClick={closeMobileMenu}>{label}<ArrowUpRight size={15} /></a>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        <section id="home" className="hero-section">
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />
          <motion.div className="hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } } }}>
            <motion.div className="eyebrow" variants={reveal}><span className="eyebrow-line" /> A DIFFERENT KIND OF COLLECTOR</motion.div>
            <motion.h1 variants={reveal}>BRING YOUR<br />FAVORITE WORLDS<br /><span>TO LIFE.</span></motion.h1>
            <motion.p variants={reveal}>Discover premium anime figures and collectibles<br className="desktop-break" /> crafted for true fans.</motion.p>
            <motion.div className="hero-actions" variants={reveal}>
              <a className="button button-lime" href="#collections">EXPLORE COLLECTION <ArrowUpRight size={15} /></a>
              <a className="button button-outline" href="#collections">VIEW COLLECTIBLES <ArrowRight size={15} /></a>
            </motion.div>
            <motion.div className="hero-footnote" variants={reveal}>
              <div className="avatar-stack" aria-hidden="true"><span>CC</span><span>✦</span><span>+</span></div>
              <span>FOR THE FANS WHO<br />NEVER GREW OUT OF IT</span>
            </motion.div>
          </motion.div>
          <motion.div className="hero-visual" initial={{ opacity: 0, scale: 0.94, x: 25 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-image-wrap">
              <img src={actionFigureImage} alt="Naruto action figure collectible with a blue effect display" />
              <div className="hero-image-overlay" />
            </div>
            <motion.div className="hero-sticker" animate={{ rotate: [0, 5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
              <span>COLLECT<br />WHAT YOU<br />LOVE</span><ArrowDownRight size={18} />
            </motion.div>
            <div className="hero-image-caption"><span>01 / 06</span><span>THE WORLDS WE LOVE</span></div>
            <div className="hero-side-label">EST. FOR THE FANDOM — 2024</div>
          </motion.div>
          <a className="scroll-cue" href="#collections"><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
        </section>

        <section className="ticker" aria-label="Store highlights">
          <div className="ticker-track">{Array.from({ length: 4 }).map((_, index) => <span key={index}>BUILT FOR THE FANDOM <i>✳</i> MADE TO BE DISPLAYED <i>✳</i> KEEP YOUR WORLD CLOSE <i>✳</i></span>)}</div>
        </section>

        <section id="collections" className="section collections-section">
          <motion.div className="section-heading" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }}>
            <div><span className="eyebrow"><span className="eyebrow-line" /> FIND YOUR WORLD</span><h2>COLLECT YOUR<br /><span>UNIVERSE.</span></h2></div>
            <div className="section-heading-side"><p>Figures, masks and keepsakes<br />for the worlds you love.</p><a className="text-link" href="#about">OUR STORY <ArrowUpRight size={15} /></a></div>
          </motion.div>
          <div className="collection-grid">
            {products.map((product, index) => (
              <motion.article key={product.id} className="collection-card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ delay: index * 0.07, duration: 0.55 }}>
                <img src={product.image} alt={product.imageAlt} loading="lazy" />
                <div className="collection-shade" />
                <button className={`wishlist-button ${wishlist.includes(product.id) ? "is-wishlisted" : ""}`} onClick={() => toggleWishlist(product.id)} aria-label={wishlist.includes(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}><Heart size={17} fill={wishlist.includes(product.id) ? "currentColor" : "none"} /></button>
                <div className="collection-info"><span>{product.character}</span><h3>{product.name}</h3></div>
                <div className="collection-actions">
                  <button className="collection-add" onClick={() => addToCart(product)}>ADD TO BAG <Plus size={14} /></button>
                  <button className="collection-arrow" onClick={() => setQuickView(product)} aria-label={`View ${product.name}`}><ArrowUpRight size={19} /></button>
                </div>
              </motion.article>
            ))}
          </div>
          <div className="catalog-note">COLLECTIBLE PHOTOS FROM YOUR UPLOADS. CONFIRM PRODUCT DETAILS AND PRICES BEFORE LAUNCH.</div>
          <div className="collection-bottom"><span>FOUR WAYS TO COLLECT YOUR WORLD</span><a href="#about">OUR STORY <ArrowRight size={14} /></a></div>
        </section>
        <DeferredLaptopCustomizer onAddToCart={addToCart} />
        <section id="about" className="brand-section">
          <div className="brand-image">
            <img src={masksImage} alt="Red Spider-Man inspired character mask" loading="lazy" />
            <span className="brand-image-label">A LITTLE PIECE OF YOUR WORLD / CC-001</span>
            <div className="brand-image-stamp">MADE<br />FOR THE<br /><b>FANDOM</b></div>
          </div>
          <motion.div className="brand-copy" initial="hidden" whileInView="visible" variants={{ visible: { transition: { staggerChildren: 0.14 } } }} viewport={{ once: true, amount: 0.25 }}>
            <motion.span className="eyebrow" variants={reveal}><span className="eyebrow-line" /> A NOTE FROM THE CLAN</motion.span>
            <motion.h2 variants={reveal}>NOT JUST<br />FIGURES.<br /><span>IT'S A PASSION.</span></motion.h2>
            <motion.p variants={reveal}>Some stories stay with you. The late-night episodes, the characters who felt like friends, the worlds you never really left behind. CUSTOM CLANS is for keeping a little piece of them close — one shelf-worthy collectible at a time.</motion.p>
            <motion.a className="text-link" href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer" variants={reveal}>GET TO KNOW THE CLAN <ArrowUpRight size={15} /></motion.a>
            <motion.div className="brand-number" variants={reveal}>01 <span>/ OUR WHY</span></motion.div>
          </motion.div>
        </section>

        <section className="offer-section">
          <div className="offer-pattern" aria-hidden="true" />
          <div className="offer-top"><span>COMING SOON / WATCH THIS SPACE</span><span>THE NEXT CHAPTER</span></div>
          <div className="offer-content">
            <span className="offer-kicker"><Sparkles size={14} /> A PROMO SPACE FOR WHAT'S NEXT</span>
            <h2>LEVEL UP<br />YOUR <span>COLLECTION.</span></h2>
            <p>New drops, rare finds and seasonal surprises<br className="desktop-break" /> will land here when they're ready.</p>
            <a className="button button-lime" href="#collections">EXPLORE THE COLLECTION <ArrowUpRight size={15} /></a>
          </div>
          <div className="offer-art"><img src={katanaImage} alt="White and gold katana collectible display" loading="lazy" /><div className="offer-art-circle">COMING<br />SOON</div></div>
          <div className="offer-bottom"><span>GOOD THINGS COME TO THOSE WHO COLLECT.</span><span>KEEP YOUR WORLD CLOSE.</span></div>
        </section>

        <section className="community-section section">
          <motion.div className="section-heading" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div><span className="eyebrow"><span className="eyebrow-line" /> NOTES FROM THE CLAN</span><h2>THE STORY IS<br /><span>STILL YOURS.</span></h2></div>
            <p className="community-intro">We don't do made-up reviews. When verified customer stories are available, you'll find them right here.</p>
          </motion.div>
          <div className="review-panel">
            <span className="review-quote-mark" aria-hidden="true">✳</span>
            <div className="review-copy">
              <span className="review-label">A SPACE FOR REAL COLLECTORS</span>
              <p>No made-up reviews.<br />Just the real deal, when it arrives.</p>
              <a className="text-link" href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">SHARE YOUR COLLECTION <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <p className="no-reviews-note"><span className="note-dot" /> CUSTOMER REVIEWS WILL APPEAR HERE ONCE VERIFIED.</p>
        </section>

        <section className="instagram-section">
          <div className="instagram-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> OUT IN THE WILD</span><h2>FOLLOW THE CLAN<span className="heading-period">.</span></h2></div><a className="text-link" href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer"><Instagram size={16} /> @CUSTOMCLANS <ArrowUpRight size={14} /></a></div>
          <div className="instagram-grid">{instagramImages.map((image, index) => <a key={image} className="instagram-tile" href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer" aria-label={`View CUSTOM CLANS on Instagram, gallery image ${index + 1}`}><img src={image} alt={`Anime collectible inspiration ${index + 1}`} loading="lazy" /><span><Instagram size={19} /></span></a>)}</div>
          <div className="instagram-bottom"><span>YOUR SHELF. YOUR STORY. YOUR PEOPLE.</span><a href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">TAG US IN YOUR WORLD <ArrowUpRight size={14} /></a></div>
        </section>
      </main>

      <footer id="footer" className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="wordmark footer-wordmark" href="#home" aria-label="Custom Clans home"><img src={customClansLogo} alt="CUSTOM CLANS" /></a>
            <p>A home for the stories that stay with us. Collect your world, one piece at a time.</p>
            <a className="footer-instagram" href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer"><Instagram size={16} /> FOLLOW THE CLAN <ArrowUpRight size={13} /></a>
          </div>
          <div className="footer-links"><h3>EXPLORE</h3><a href="#collections">Collections</a><a href="#about">Our story</a></div>
          <div className="footer-links"><h3>HERE TO HELP</h3><a href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">Get in touch</a><a href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">Shipping & returns</a><a href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">Order support</a><a href="https://www.instagram.com/customclans/" target="_blank" rel="noreferrer">FAQs</a></div>
          <div className="footer-newsletter"><h3>GOOD THINGS, OCCASIONALLY.</h3><p>New drops, rare finds and a little love for your inbox.</p><form onSubmit={handleSubscribe}><label className="sr-only" htmlFor="newsletter-email">Your email address</label><input id="newsletter-email" type="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} required /><button type="submit" aria-label="Subscribe to newsletter"><ArrowRight size={17} /></button></form><span className="newsletter-message" aria-live="polite">{subscribeMessage}</span><div className="policy-links"><span>PRIVACY</span><span>·</span><span>TERMS</span><span>·</span><span>SHIPPING — PUBLISHING SOON</span></div></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} CUSTOM CLANS. MADE FOR THE FANDOM.</span><span>ALL CHARACTERS. ALL HEART.</span><a href="#home">BACK TO TOP <ArrowDown size={13} /></a></div>
      </footer>

      <AnimatePresence>
        {accountOpen && (
          <Overlay onClose={() => setAccountOpen(false)}>
            <motion.aside
              className="account-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Your account"
            >
              <div className="drawer-heading">
                <div>
                  <span className="eyebrow"><span className="eyebrow-line" /> YOUR CORNER OF THE CLAN</span>
                  <h2>HEY, {customer.name.split(" ")[0].toUpperCase()}.</h2>
                </div>
                <button className="icon-button" onClick={() => setAccountOpen(false)} aria-label="Close account"><X size={21} /></button>
              </div>
              <div className="account-details">
                <span>ACCOUNT EMAIL</span>
                <strong>{customer.email}</strong>
              </div>
              <div className="account-orders">
                <div className="account-orders-heading"><h3>YOUR ORDERS</h3><span>{orders.length.toString().padStart(2, "0")}</span></div>
                {ordersError && <p className="account-error" role="alert">{ordersError}</p>}
                {!ordersError && orders.length === 0 && (
                  <div className="account-empty"><ShoppingBag size={25} /><p>Your order history will live here.</p><span>When you place an order, we’ll keep its details tied to this account.</span></div>
                )}
                {orders.map((order) => (
                  <article className="account-order" key={order.id}>
                    <div className="account-order-top">
                      <strong>ORDER {order.id.slice(0, 8).toUpperCase()}</strong>
                      <span className={`order-status ${order.status}`}>
                        {order.status === "paid"
                          ? "PAID"
                          : order.status === "cancelled"
                            ? "CANCELLED"
                            : order.paymentReference
                              ? "AWAITING VERIFICATION"
                              : order.paymentMethod === "cash_on_delivery"
                                ? "CASH ON DELIVERY"
                                : "PAYMENT DUE"}
                      </span>
                    </div>
                    <time>{new Date(order.createdAt).toLocaleDateString()}</time>
                    <ul>{order.items.map((item) => <li key={`${order.id}-${item.productId}-${item.baseColor || "default"}`}>{item.name} × {item.quantity}{item.baseColor && <small className="order-item-finish"> · {getLaptopBaseColorName(item.baseColor)}</small>}</li>)}</ul>
                    <strong className="account-order-total">{formatPrice(order.total)}</strong>
                    <div className="account-order-payment">
                      <span>
                        {order.status === "paid"
                          ? "PAYMENT COMPLETE"
                          : order.paymentReference
                            ? "PAYMENT AWAITING VERIFICATION"
                            : order.paymentMethod === "cash_on_delivery"
                              ? "CASH ON DELIVERY · PAYMENT DUE"
                              : "PAYMENT DUE"}
                      </span>
                      {order.status !== "paid" && order.status !== "cancelled" && (
                        <button
                          className="account-pay-button"
                          type="button"
                          onClick={() => {
                            setPaymentOrder(order);
                            setAccountOpen(false);
                          }}
                        >
                          {order.paymentReference ? "VIEW PAYMENT" : "PAY NOW"} <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                <p className="payment-disclaimer">UPI references need manual verification. The website never marks an order paid based only on a customer-submitted reference.</p>
              </div>
              <button className="account-logout" onClick={handleLogout} disabled={signingOut}>
                <LogOut size={16} /> {signingOut ? "SIGNING OUT..." : "SIGN OUT"}
              </button>
            </motion.aside>
          </Overlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && <Overlay onClose={() => setCartOpen(false)}><motion.aside className="cart-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} role="dialog" aria-modal="true" aria-label="Shopping bag">
          <div className="drawer-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR PICKS</span><h2>THE BAG <span>({cartCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={21} /></button></div>
          {cart.length === 0 ? <div className="empty-bag"><ShoppingBag size={32} strokeWidth={1} /><h3>{checkoutMessage ? "YOUR ORDER IS SAVED." : "YOUR BAG IS TAKING A BREATHER."}</h3><p>{checkoutMessage || "There's room for a little more of your world."}</p><button className="button button-lime" onClick={() => { setCartOpen(false); document.querySelector("#collections")?.scrollIntoView({ behavior: "smooth" }); }}>EXPLORE COLLECTIBLES <ArrowRight size={15} /></button></div> : <>
            <div className="cart-items">{cart.map((item) => <div className="cart-item" key={getCartKey(item)}><img src={item.image} alt={item.imageAlt} /><div className="cart-item-copy"><span>{item.character}</span><h3>{item.name}</h3><strong>{formatPrice(item.price)}</strong>{item.baseColor && <small className="cart-item-finish">BASE FINISH · {getLaptopBaseColorName(item.baseColor).toUpperCase()}</small>}<button className="cart-view-button" onClick={() => { setQuickView(item); setCartOpen(false); }}>VIEW PRODUCT <ArrowUpRight size={13} /></button><div className="quantity-controls"><button onClick={() => changeQuantity(item, -1)} aria-label={`Remove one ${item.name}`}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item, 1)} aria-label={`Add one ${item.name}`} disabled={item.quantity >= 10}><Plus size={13} /></button></div></div><button className="remove-item" onClick={() => setCart((items) => items.filter((entry) => getCartKey(entry) !== getCartKey(item)))} aria-label={`Remove ${item.name} from bag`}><X size={16} /></button></div>)}</div>
            <div className="cart-summary"><div><span>SUBTOTAL</span><strong>{formatPrice(cartTotal)}</strong></div><p>Place your order now. Payment is not connected in this preview; no charge will be made.</p><button className="button button-lime checkout-button" disabled={orderSubmitting} onClick={() => handleCheckout()}>{orderSubmitting ? "PLACING ORDER..." : "PLACE ORDER — PAYMENT DUE"} <ArrowRight size={15} /></button><span className="checkout-note" aria-live="polite">{checkoutMessage || "PAYMENT WILL REMAIN DUE UNTIL CHECKOUT IS CONNECTED"}</span></div>
          </>}
        </motion.aside></Overlay>}
      </AnimatePresence>

      <AnimatePresence>
        {quickView && <Overlay onClose={() => setQuickView(null)}><motion.div className="quick-view-modal" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.98 }} transition={{ duration: 0.25 }} role="dialog" aria-modal="true" aria-label={`Quick view: ${quickView.name}`}>
          <button className="quick-close icon-button" onClick={() => setQuickView(null)} aria-label="Close quick view"><X size={21} /></button><div className="quick-image"><img src={quickView.image} alt={quickView.imageAlt} /></div><div className="quick-copy"><span className="eyebrow"><span className="eyebrow-line" /> {quickView.tag}</span><h2>{quickView.name}</h2><p>{quickView.character}</p><strong>{formatPrice(quickView.price)}</strong><p className="quick-description">A shelf-worthy piece for the stories that stay with you. Find your next favourite and give your collection a new centrepiece.</p><button className="button button-lime" onClick={() => { addToCart(quickView); setQuickView(null); }}>ADD TO BAG <Plus size={16} /></button><button className="button button-outline quick-order-button" disabled={orderSubmitting} onClick={async () => { await handleCheckout([{ ...quickView, quantity: 1 }]); }}>{orderSubmitting ? "PLACING ORDER..." : "PLACE ORDER — PAYMENT DUE"} <ArrowRight size={15} /></button><span className="quick-shipping">PAYMENT IS NOT CONNECTED — NO CHARGE WILL BE MADE</span></div>
        </motion.div></Overlay>}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && <Overlay onClose={() => { setSearchOpen(false); setSearchQuery(""); }}><motion.div className="search-modal" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} role="dialog" aria-modal="true" aria-label="Search products">
          <div className="search-top"><span className="eyebrow"><span className="eyebrow-line" /> LOOKING FOR SOMETHING?</span><button className="icon-button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="Close search"><X size={21} /></button></div><div className="search-input-wrap"><Search size={22} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search your next favourite..." aria-label="Search products" /></div><div className="search-results">{filteredProducts.length ? filteredProducts.map((product) => <button key={product.id} className="search-result" onClick={() => { setSearchOpen(false); setSearchQuery(""); setQuickView(product); }}><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.character}</small></span><span>{formatPrice(product.price)}</span><ArrowUpRight size={15} /></button>) : <p className="search-empty">No pieces found. Try a character or series name.</p>}</div>
        </motion.div></Overlay>}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function Overlay({ children, onClose }) {
  return <motion.div className="overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>{children}</motion.div>;
}

export default App;
