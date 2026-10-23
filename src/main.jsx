import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ccc } from "@ckb-ccc/connector-react";
import {
  MotionConfig,
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Play,
  Search,
  Gamepad2,
  Grid2X2,
  Library,
  Code2,
  ChevronRight,
  Check,
  Wallet,
  X,
  Expand,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Plus,
  Terminal,
  Globe,
  Clock,
  Menu,
  ExternalLink,
  Settings2,
  Copy,
  Download,
  Users,
  Sparkles,
  Monitor,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import {
  WalletPickerGuard,
  BrandIcon,
  Spinner,
  Modal,
  Notice,
  Skeletons,
  GameCard,
  GameDetails,
  PageHeading,
} from "./ui.jsx";
import {
  genres,
  selectGames,
  gameMeta,
  accountLabel,
  apiError,
} from "./ui-model.mjs";
import "./style.css";
import initialGames from "../server/catalog.json";
async function api(url, body) {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("The service is temporarily unavailable. Please try again.");
  }
  if (!r.ok) {
    const e = Error(data.error || "Something went wrong. Please try again.");
    e.status = r.status;
    throw e;
  }
  return data;
}
const short = (a) => (a ? `${a.slice(0, 9)}…${a.slice(-6)}` : "");
const filter = async (info) =>
  ["CkbSecp256k1", "BtcEcdsa", "JoyId"].includes(info.signer.signType);
function readMotion() {
  try {
    return localStorage.getItem("utxoplay:motion") || "system";
  } catch {
    return "system";
  }
}
function Root() {
  const [client, setClient] = useState(null);
  useEffect(() => {
    const owner = ccc.ClientPublicMainnet.open();
    setClient(owner.value);
    return () => void owner.dispose();
  }, []);
  if (!client)
    return (
      <div className="boot" role="status">
        <BrandIcon />
        <span>Opening your playground…</span>
        <Spinner />
      </div>
    );
  return (
    <ccc.Provider
      defaultClient={client}
      clientOptions={[{ client, name: "CKB Mainnet" }]}
      name="UTXOPlay"
      icon={location.origin + "/brand/utxoplay-logo-dark-192.png"}
      signerFilter={filter}
      hideKhie
      connectorProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-label": "Choose your wallet",
        style: {
          "--background": "#181e1b",
          "--divider": "#303b34",
          "--btn-primary": "#222d26",
          "--btn-primary-hover": "#344b3b",
          "--btn-secondary": "#303b34",
          "--btn-secondary-hover": "#415648",
          "--icon-primary": "#edf5ef",
          "--icon-secondary": "#a3b2a8",
          "--tip-color": "#a3b2a8",
          color: "#edf5ef",
        },
      }}
    >
      <App />
    </ccc.Provider>
  );
}
function useAccountResource(user, url, revision = 0) {
  const [state, setState] = useState({
    owner: null,
    data: [],
    loading: false,
    error: "",
  });
  useEffect(() => {
    let live = true;
    const id = user?.id;
    if (!id) {
      setState({ owner: null, data: [], loading: false, error: "" });
      return;
    }
    setState({ owner: id, data: [], loading: true, error: "" });
    api(url)
      .then((d) => {
        if (live)
          setState({
            owner: id,
            data: d.games || d.projects || [],
            loading: false,
            error: "",
          });
      })
      .catch((e) => {
        if (live)
          setState({ owner: id, data: [], loading: false, error: apiError(e) });
      });
    return () => {
      live = false;
    };
  }, [user?.id, url, revision]);
  return state.owner === user?.id
    ? state
    : { data: [], loading: !!user, error: "" };
}
function App() {
  const [page, setPage] = useState(location.pathname),
    [games, setGames] = useState(initialGames),
    [user, setUser] = useState(null),
    [loadingUser, setLoadingUser] = useState(true),
    [accountError, setAccountError] = useState("");
  const [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All games"),
    [mode, setMode] = useState("all"),
    [featured, setFeatured] = useState("openstrike");
  const [toast, setToast] = useState(null),
    [dialog, setDialog] = useState(null),
    [details, setDetails] = useState(null),
    [walletBusy, setWalletBusy] = useState(false),
    [walletPhase, setWalletPhase] = useState("idle"),
    [intent, setIntent] = useState(false),
    [walletError, setWalletError] = useState(""),
    [launching, setLaunching] = useState(""),
    [projectBusy, setProjectBusy] = useState(false),
    [projectError, setProjectError] = useState("");
  const [projectDraft, setProjectDraft] = useState({
      title: "",
      description: "",
      url: "",
    }),
    [mobileNav, setMobileNav] = useState(false),
    [frameKey, setFrameKey] = useState(0),
    [immersive, setImmersive] = useState(false),
    [frameStatus, setFrameStatus] = useState("loading"),
    [revision, setRevision] = useState(0),
    [motionSetting, setMotionSetting] = useState(readMotion),
    [online, setOnline] = useState(navigator.onLine);
  const signer = ccc.useSigner();
  const { open, close: closePicker, disconnect, wallet, isOpen } = ccc.useCcc();
  const previousSigner = useRef(null),
    signing = useRef(false),
    authEpoch = useRef(0),
    authTransition = useRef(Promise.resolve()),
    launchLock = useRef(false),
    searchRef = useRef(null),
    mainRef = useRef(null),
    frameRef = useRef(null),
    frameTimer = useRef(null),
    walletPickerSeen = useRef(false),
    cancelSignature = useRef(null);
  const reduceSystem = useReducedMotion(),
    reduced = motionSetting === "reduced" || !!reduceSystem;
  const libraryState = useAccountResource(user, "/api/library", revision),
    projectState = useAccountResource(
      page === "/developers" && !user?.guest ? user : null,
      "/api/developer/projects",
      revision,
    );
  const libraryGames = libraryState.data
    .map((p) => ({ ...games.find((g) => g.id === p.game), updated: p.updated }))
    .filter((g) => g.id);
  const game = games.find((g) => page === "/play/" + g.id),
    hero = games.find((g) => g.id === featured) || games[0],
    signedIn = !!user && !user.guest;
  const notify = useCallback(
    (text, type = "success") => setToast({ text, type, id: Date.now() }),
    [],
  );
  const loadAccount = useCallback(async () => {
    setLoadingUser(true);
    setAccountError("");
    try {
      setUser((await api("/api/me")).user);
    } catch (e) {
      setAccountError(apiError(e));
    } finally {
      setLoadingUser(false);
    }
  }, []);
  function exitImmersive() {
    setImmersive(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  function enterImmersive() {
    setImmersive(true);
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function go(p) {
    if (p === page) {
      setMobileNav(false);
      return;
    }
    exitImmersive();
    history.pushState({}, "", p);
    setPage(p);
    setMobileNav(false);
    setDialog(null);
    setDetails(null);
    window.scrollTo(0, 0);
    setRevision((r) => r + 1);
  }
  const navigateRef = useRef(go);
  navigateRef.current = go;
  useEffect(() => {
    const onPop = () => {
      setPage(location.pathname);
      setMobileNav(false);
      setDialog(null);
      setDetails(null);
      setRevision((r) => r + 1);
      window.scrollTo(0, 0);
    };
    addEventListener("popstate", onPop);
    loadAccount();
    api("/api/games")
      .then((d) => setGames(d.games))
      .catch(() => {});
    return () => removeEventListener("popstate", onPop);
  }, [loadAccount]);
  useEffect(() => {
    document.title =
      (game
        ? game.title
        : page === "/library"
          ? "Your library"
          : page === "/developers"
            ? "Studio"
            : "Good games. Yours to play.") + " · UTXOPlay";
    if (!page.startsWith("/play/")) exitImmersive();
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.type === "error" ? 10000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
    try {
      localStorage.setItem("utxoplay:motion", motionSetting);
    } catch {}
  }, [motionSetting, reduced]);
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.defaultPrevented ||
        page.startsWith("/play/") ||
        dialog ||
        details ||
        isOpen ||
        e.target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (
        (e.key === "/" && !e.ctrlKey && !e.metaKey) ||
        ((e.metaKey || e.ctrlKey) && e.key === "k")
      ) {
        e.preventDefault();
        if (page !== "/") navigateRef.current("/");
        requestAnimationFrame(() => {
          document.getElementById("collection")?.scrollIntoView({
            block: "start",
            behavior: reduced ? "instant" : "smooth",
          });
          searchRef.current?.focus({ preventScroll: true });
        });
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [page, dialog, details, isOpen, reduced]);
  // Serialize wallet changes before a new challenge to prevent a late logout revoking the new account.
  useEffect(() => {
    if (previousSigner.current && previousSigner.current !== signer) {
      cancelSignature.current?.();
      authEpoch.current++;
      setUser(null);
      setFrameKey((k) => k + 1);
      authTransition.current = authTransition.current
        .catch(() => {})
        .then(() => api("/api/auth/logout", {}));
      authTransition.current.catch((e) => notify(apiError(e), "error"));
    }
    previousSigner.current = signer;
  }, [signer, notify]);
  async function signIn() {
    if (!signer || signing.current) return;
    const epoch = authEpoch.current;
    signing.current = true;
    setWalletBusy(true);
    setWalletPhase("signature");
    setIntent(false);
    setWalletError("");
    setDialog("wallet");
    const cancellation = new Promise((_, reject) => {
      cancelSignature.current = () => reject(new Error("Sign-in cancelled."));
    });
    cancellation.catch(() => {});
    try {
      await authTransition.current;
      if (epoch !== authEpoch.current) return;
      const address = await Promise.race([
        signer.getRecommendedAddress(),
        cancellation,
      ]);
      const challenge = await api("/api/auth/challenge", { address });
      if (epoch !== authEpoch.current) return;
      const proof = await Promise.race([
        signer.signMessage(challenge.message),
        cancellation,
      ]);
      if (epoch !== authEpoch.current) return;
      setWalletPhase("verifying");
      cancelSignature.current = null;
      const d = await api("/api/auth/verify", { id: challenge.id, proof });
      if (epoch !== authEpoch.current) return;
      setUser(d.user);
      setDialog(null);
      setFrameKey((k) => k + 1);
      notify("You’re signed in. Your wallet library is ready.");
    } catch (e) {
      if (epoch === authEpoch.current) setWalletError(apiError(e));
    } finally {
      cancelSignature.current = null;
      setWalletBusy(false);
      setWalletPhase("idle");
      signing.current = false;
    }
  }
  useEffect(() => {
    if (intent && signer && !isOpen) void signIn();
  }, [intent, signer, isOpen]);
  useEffect(() => {
    if (isOpen) walletPickerSeen.current = true;
    else if (walletPickerSeen.current) {
      walletPickerSeen.current = false;
      if (!signer) {
        setIntent(false);
        setDialog("wallet");
      }
    }
  }, [isOpen, signer]);
  function connect() {
    setWalletError("");
    setDialog("wallet");
  }
  function chooseWallet(change = false) {
    if (signer && !change) {
      void signIn();
      return;
    }
    setIntent(true);
    flushSync(() => setDialog(null));
    open();
  }
  async function logout() {
    setWalletBusy(true);
    try {
      authEpoch.current++;
      await api("/api/auth/logout", {});
      previousSigner.current = null;
      await disconnect();
      setIntent(false);
      setUser(null);
      setFrameKey((k) => k + 1);
      setDialog(null);
      go("/");
      notify("Signed out. Your saved games are kept for your next visit.");
    } catch (e) {
      setWalletError(apiError(e));
    } finally {
      setWalletBusy(false);
    }
  }
  function syncFrame() {
    frameRef.current?.contentWindow?.postMessage(
      { type: "utxoplay:immersion", enabled: immersive },
      location.origin,
    );
  }
  useEffect(() => {
    syncFrame();
    document.body.classList.toggle("playing-immersive", immersive);
    return () => document.body.classList.remove("playing-immersive");
  }, [immersive, page]);
  useEffect(() => {
    setFrameStatus("loading");
    clearTimeout(frameTimer.current);
    if (game && user)
      frameTimer.current = setTimeout(
        () => setFrameStatus((s) => (s === "loading" ? "slow" : s)),
        15000,
      );
    return () => clearTimeout(frameTimer.current);
  }, [game?.id, user?.id, frameKey]);
  useEffect(() => {
    const onMessage = (e) => {
      if (
        e.origin !== location.origin ||
        e.source !== frameRef.current?.contentWindow
      )
        return;
      if (e.data?.type === "utxoplay:game-start") enterImmersive();
      if (e.data?.type === "utxoplay:exit-immersive") exitImmersive();
      if (e.data?.type === "utxoplay:game-ready") {
        setFrameStatus("ready");
        clearTimeout(frameTimer.current);
      }
    };
    const onFull = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    const onKey = (e) => {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !document.querySelector("dialog[open]")
      )
        exitImmersive();
    };
    addEventListener("message", onMessage);
    addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      removeEventListener("message", onMessage);
      removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, []);
  async function launch(id) {
    if (launchLock.current || loadingUser) return;
    launchLock.current = true;
    setLaunching(id);
    try {
      if (!user) setUser((await api("/api/guest", {})).user);
      setDetails(null);
      go("/play/" + id);
    } catch (e) {
      notify(apiError(e), "error");
    } finally {
      setLaunching("");
      launchLock.current = false;
    }
  }
  async function copy(text, message = "Copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify(
        "Clipboard is unavailable. Select and copy the text instead.",
        "error",
      );
    }
  }
  function browseGenre(value) {
    setGenre(value);
    setQuery("");
    setMode("all");
    go("/");
    requestAnimationFrame(() =>
      document
        .getElementById("collection")
        ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" }),
    );
  }
  function resetFilters() {
    setQuery("");
    setGenre("All games");
    setMode("all");
    searchRef.current?.focus();
  }
  const filtered = selectGames(games, { query, genre, mode });
  const navItems = [
    ["/", "Discover", Grid2X2],
    ["/library", "My library", Library],
    ["/developers", "Developer studio", Code2],
  ];
  const navContent = (
    <>
      <p className="sidebar-label">PLAY SOMETHING GOOD</p>
      <nav aria-label="Main navigation">
        {navItems.map(([p, label, Icon]) => (
          <button
            key={p}
            aria-current={page === p ? "page" : undefined}
            className={page === p ? "selected" : ""}
            onClick={() => go(p)}
          >
            <Icon size={18} />
            {label}
            {p === "/library" && libraryGames.length > 0 && (
              <span className="count">{libraryGames.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="side-rule" />
      <p className="sidebar-label">YOUR KIND OF PLAY</p>
      <nav aria-label="Genres">
        {genres.map((g) => (
          <button
            key={g}
            aria-pressed={page === "/" && genre === g}
            onClick={() => browseGenre(g)}
          >
            <span className={"genre-dot " + g.toLowerCase().split(" ")[0]} />
            {g}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="build-note">
          <Code2 size={22} />
          <strong>Make the next great game.</strong>
          <p>A small studio. A big playground.</p>
          <button onClick={() => go("/developers")}>
            Start building <ArrowUpRight size={14} />
          </button>
        </div>
        <button
          className="preference-link"
          onClick={() => {
            setMobileNav(false);
            setDialog("preferences");
          }}
        >
          <Settings2 size={15} />
          Display preferences
        </button>
        <a
          className="source-link"
          href="https://github.com/Myelin-Labs/UTXOPlay"
          target="_blank"
          rel="noreferrer"
        >
          Built in the open <ArrowUpRight size={12} />
        </a>
      </div>
    </>
  );
  return (
    <MotionConfig
      reducedMotion={reduced ? "always" : "user"}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={"app" + (immersive ? " immersive" : "")}
        inert={isOpen ? true : undefined}
      >
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNav}
          >
            <Menu />
          </button>
          <button
            className="brand"
            onClick={() => go("/")}
            aria-label="UTXOPlay home"
          >
            <BrandIcon />
            <span>
              UTXO<span className="brand-light">Play</span>
              <small>YOUR OPEN PLAYGROUND</small>
            </span>
          </button>
          <div className="top-context">
            <span className="status-dot" />
            Good games. Zero downloads.
          </div>
          <div className="top-right">
            <button
              className="top-search icon-btn"
              aria-label="Search games"
              onClick={() => {
                go("/");
                requestAnimationFrame(() => {
                  document.getElementById("collection")?.scrollIntoView({
                    behavior: reduced ? "instant" : "smooth",
                  });
                  searchRef.current?.focus({ preventScroll: true });
                });
              }}
            >
              <Search size={18} />
            </button>
            <span className="guest-pill">
              {loadingUser ? "Checking account…" : accountLabel(user)}
            </span>
            <button
              className="wallet-button"
              disabled={walletBusy || loadingUser}
              onClick={connect}
            >
              {walletBusy ? <Spinner /> : <Wallet size={17} />}
              <span>
                {walletBusy
                  ? "Signing in…"
                  : signedIn
                    ? short(user.address)
                    : "Connect wallet"}
              </span>
            </button>
          </div>
        </header>
        <div className="shell">
          <aside className="sidebar">{navContent}</aside>
          <main className="main" id="main" tabIndex={-1} ref={mainRef}>
            {!online && (
              <Notice>
                You’re offline. Reconnect to load games or save changes.
              </Notice>
            )}
            {accountError && (
              <Notice onRetry={loadAccount}>{accountError}</Notice>
            )}
            {page === "/" ? (
              <>
                <PageHeading
                  eyebrow="PRESS PLAY. FEEL SOMETHING."
                  title={
                    <>
                      Your next <em>good time.</em>
                    </>
                  }
                  description="Four little worlds. No downloads. A lot of ‘one more round’."
                >
                  <div className="edition">
                    <span>CURATED COLLECTION</span>
                    <b>
                      VOL. 01 <i>↗</i>
                    </b>
                  </div>
                </PageHeading>
                <section
                  className={"hero " + hero.id}
                  aria-label="Featured game"
                  style={{ "--accent": gameMeta[hero.id]?.accent }}
                >
                  <AnimatePresence initial={false}>
                    <motion.img
                      key={hero.id}
                      className="hero-image"
                      src={hero.cover}
                      alt=""
                      initial={{ opacity: 0, scale: reduced ? 1 : 1.025 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45 }}
                    />
                  </AnimatePresence>
                  <div className="hero-shade" />
                  <div className="hero-orbit" aria-hidden="true" />
                  <div className="hero-content">
                    <span className="pill">
                      <Sparkles size={12} />
                      {hero.id === "openstrike"
                        ? "NEW ON THE PLAYGROUND"
                        : "IN THE SPOTLIGHT"}
                    </span>
                    <motion.div
                      key={hero.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="hero-game-name">
                        {hero.title} <span>／ {hero.genre}</span>
                      </p>
                      <h2>
                        {hero.headline.split("|").map((line, i) => (
                          <React.Fragment key={line}>
                            {i > 0 && <br />}
                            {line}
                          </React.Fragment>
                        ))}
                      </h2>
                      <p className="hero-description">{hero.heroDescription}</p>
                    </motion.div>
                    <div className="hero-actions">
                      <button
                        className="primary"
                        disabled={!!launching || loadingUser}
                        onClick={() => launch(hero.id)}
                      >
                        {launching === hero.id ? (
                          <Spinner />
                        ) : (
                          <Play size={17} fill="currentColor" />
                        )}
                        {launching === hero.id
                          ? "Opening…"
                          : "Play " + hero.title}
                        <ArrowUpRight size={17} />
                      </button>
                      <button
                        className="hero-details"
                        onClick={() => setDetails(hero)}
                      >
                        Take a look <ArrowRight size={17} />
                      </button>
                    </div>
                    <div className="hero-trust">
                      <span>
                        <Check size={13} />
                        Always free
                      </span>
                      <span>
                        <Check size={13} />
                        No wallet required
                      </span>
                    </div>
                  </div>
                  <div className="hero-bottom">
                    <span className="hero-caption">
                      {gameMeta[hero.id]?.tag}
                    </span>
                    <span className="hero-index">
                      0{games.findIndex((g) => g.id === hero.id) + 1}
                      <i> / 0{games.length}</i>
                    </span>
                    <button
                      className="hero-next icon-btn"
                      aria-label="Next featured game"
                      onClick={() =>
                        setFeatured(
                          games[
                            (games.findIndex((g) => g.id === hero.id) + 1) %
                              games.length
                          ].id,
                        )
                      }
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </section>
                <div className="feature-rail" aria-label="Choose featured game">
                  {games.map((g, i) => (
                    <button
                      key={g.id}
                      aria-pressed={hero.id === g.id}
                      onClick={() => setFeatured(g.id)}
                      className={hero.id === g.id ? "active" : ""}
                    >
                      <img src={g.cover} alt="" />
                      <span>
                        <small>
                          0{i + 1} / {g.genre}
                        </small>
                        <b>{g.title}</b>
                      </span>
                      {hero.id === g.id && (
                        <motion.i
                          layoutId="featured-mark"
                          className="featured-mark"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <div className="benefits">
                  <span>
                    <Globe size={16} />
                    Open a tab. Start a game.
                  </span>
                  <span>
                    <Wallet size={16} />A wallet when you want one.
                  </span>
                  <span>
                    <ShieldCheck size={16} />A replay you can keep.
                  </span>
                </div>
                {libraryGames.length > 0 && (
                  <section className="recent-strip">
                    <div>
                      <span className="eyebrow">BACK FOR ANOTHER ROUND?</span>
                      <h2>Jump back in.</h2>
                    </div>
                    <button
                      className="recent-game"
                      onClick={() => launch(libraryGames[0].id)}
                      disabled={!!launching}
                    >
                      <img src={libraryGames[0].cover} alt="" />
                      <span>
                        <strong>{libraryGames[0].title}</strong>
                        <small>{gameMeta[libraryGames[0].id]?.length}</small>
                      </span>
                      <Play size={18} fill="currentColor" />
                    </button>
                    <button
                      className="text-link"
                      onClick={() => go("/library")}
                    >
                      Your library <ArrowRight size={15} />
                    </button>
                  </section>
                )}
                <section className="collection" id="collection">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">FIND YOUR NEXT FAVORITE</span>
                      <h2>
                        Small collection. <span>Big play energy.</span>
                      </h2>
                    </div>
                    <label className="search">
                      <Search size={18} />
                      <input
                        ref={searchRef}
                        aria-label="Search games"
                        placeholder="Search your next obsession"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query ? (
                        <button
                          onClick={() => {
                            setQuery("");
                            searchRef.current?.focus();
                          }}
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <kbd>/</kbd>
                      )}
                    </label>
                  </div>
                  <div className="filter-row">
                    <div
                      className="genre-filters"
                      role="group"
                      aria-label="Filter by genre"
                    >
                      {genres.map((g) => (
                        <button
                          key={g}
                          aria-pressed={genre === g}
                          className={genre === g ? "active" : ""}
                          onClick={() => setGenre(g)}
                        >
                          {g}
                          {g === "All games" && <span>{games.length}</span>}
                        </button>
                      ))}
                    </div>
                    <label className="mode-select">
                      <Users size={15} />
                      <span className="sr-only">Play style</span>
                      <select
                        aria-label="Play style"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="all">Any play style</option>
                        <option value="solo">Play solo</option>
                        <option value="friends">With a friend</option>
                      </select>
                    </label>
                    <span className="results" role="status">
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "game" : "games"}
                    </span>
                  </div>
                  <div className="game-grid">
                    {filtered.map((g) => (
                      <GameCard
                        key={g.id}
                        g={g}
                        onPlay={launch}
                        onDetails={setDetails}
                        launching={launching}
                      />
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="empty">
                      <Search size={32} />
                      <h3>No matches. Plenty to play.</h3>
                      <p>
                        Try another search or clear your filters to see all{" "}
                        {games.length} games.
                      </p>
                      <button className="outline" onClick={resetFilters}>
                        Clear filters <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </section>
                <section className="wallet-banner">
                  <div className="wallet-art" aria-hidden="true">
                    <BrandIcon />
                    <span>
                      <Check size={13} />
                    </span>
                  </div>
                  <div>
                    <span className="eyebrow">SAME YOU. ANY SCREEN.</span>
                    <h2>Your games, wherever you land.</h2>
                    <p>
                      Connect a CKB-compatible wallet for a library you can
                      return to.
                      <br />
                      Just here to play? A guest session works too.
                    </p>
                  </div>
                  <button className="outline" onClick={connect}>
                    {signedIn ? "Your account" : "Meet your wallet library"}
                    <ArrowUpRight size={17} />
                  </button>
                </section>
              </>
            ) : page === "/library" ? (
              <>
                <PageHeading
                  eyebrow="YOUR PERSONAL PLAYGROUND"
                  title="Welcome back to play."
                  description={
                    signedIn
                      ? "Your wallet library. Ready whenever you are."
                      : "Your guest library lives in this browser. Make yourself at home."
                  }
                />
                <div className="library-summary">
                  <div className="identity-orb">
                    <Library size={24} />
                  </div>
                  <div>
                    <strong>
                      {signedIn ? short(user.address) : "Your guest collection"}
                    </strong>
                    <p>
                      {libraryGames.length} games played ·{" "}
                      {signedIn
                        ? "Available when you sign in on another device"
                        : "Keep this browser’s cookies to keep access"}
                    </p>
                  </div>
                  <button className="outline" onClick={connect}>
                    {signedIn ? "Account details" : "Connect a wallet"}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {libraryState.error ? (
                  <Notice onRetry={() => setRevision((r) => r + 1)}>
                    {libraryState.error}
                  </Notice>
                ) : loadingUser || libraryState.loading ? (
                  <Skeletons />
                ) : libraryGames.length ? (
                  <div className="game-grid library-grid">
                    {libraryGames.map((g) => (
                      <GameCard
                        key={g.id}
                        g={g}
                        updated={g.updated}
                        onPlay={launch}
                        onDetails={setDetails}
                        launching={launching}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty collection-empty">
                    <Gamepad2 size={42} />
                    <h2>Every library starts with a first game.</h2>
                    <p>
                      Play something you like. It will be waiting right here.
                    </p>
                    <button className="primary" onClick={() => go("/")}>
                      Find a game <ArrowRight size={17} />
                    </button>
                  </div>
                )}
                {!signedIn && (
                  <p className="library-note">
                    <ShieldCheck size={16} />
                    Wallet and guest libraries are separate. Signing in won’t
                    move your guest progress.
                  </p>
                )}
              </>
            ) : page === "/developers" ? (
              <>
                <PageHeading
                  eyebrow="UTXOPLAY / STUDIO"
                  title={
                    <>
                      Build something <em>worth playing.</em>
                    </>
                  }
                  description="Wallet identity, replayable sessions, and room for your next idea."
                />
                <section className="developer-hero">
                  <div>
                    <span className="pill">
                      <Code2 size={14} />
                      FROM FIRST BUILD TO FIRST PLAYER
                    </span>
                    <h2>
                      You build the fun.
                      <br />
                      <span>We bring the playground.</span>
                    </h2>
                    <p>
                      Explore real game integrations and save your project in a
                      private workspace. Publishing is curated for this release.
                    </p>
                    <div className="dev-hero-actions">
                      <button
                        className="primary"
                        onClick={() =>
                          signedIn ? setDialog("project") : connect()
                        }
                      >
                        <Plus size={17} />
                        Create a project
                      </button>
                      <a className="text-link" href="/integration.html">
                        Read the guide <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                  <div className="code-panel">
                    <div className="code-title">
                      <span />
                      <span />
                      <span />
                      <b>utxoplay.manifest.json</b>
                      <button
                        className="icon-btn"
                        aria-label="Copy example manifest"
                        onClick={() =>
                          copy(
                            JSON.stringify(
                              {
                                name: "Your next great game",
                                version: "1.0.0",
                                entrypoint: "https://your.game",
                                genre: "arcade",
                                runtime: "browser",
                              },
                              null,
                              2,
                            ),
                            "Example manifest copied.",
                          )
                        }
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                    <pre>
                      <span className="code-comment">
                        // Big ideas start small.
                      </span>
                      {"\n" +
                        JSON.stringify(
                          {
                            name: "Your next great game",
                            version: "1.0.0",
                            entrypoint: "https://your.game",
                            genre: "arcade",
                            runtime: "browser",
                          },
                          null,
                          2,
                        )}
                    </pre>
                    <span className="code-footer">
                      <CheckCircle2 size={14} />
                      Start with the same tools as our games.
                    </span>
                  </div>
                </section>
                <div className="dev-features">
                  <a href="/integration.html">
                    <Wallet />
                    <h3>Bring your players.</h3>
                    <p>
                      CKB-compatible identity, verified by the store. No private
                      keys in your game.
                    </p>
                    <span>
                      Explore identity <ArrowUpRight size={15} />
                    </span>
                  </a>
                  <a
                    href="https://github.com/Myelin-Labs/myelin-openstrike/blob/main/docs/DEVELOPERS.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <RefreshCw />
                    <h3>Make it replayable.</h3>
                    <p>
                      Learn from real native game sessions, signed records and
                      downloadable replays.
                    </p>
                    <span>
                      View a working integration <ArrowUpRight size={15} />
                    </span>
                  </a>
                  <a
                    href="https://github.com/Myelin-Labs/UTXOPlay"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Terminal />
                    <h3>Start in the open.</h3>
                    <p>
                      Clone the store, validate a manifest, and build on the
                      launch games.
                    </p>
                    <span>
                      Browse the source <ArrowUpRight size={15} />
                    </span>
                  </a>
                </div>
                <div className="section-head">
                  <div>
                    <span className="eyebrow">YOUR WORKSPACE</span>
                    <h2>
                      Projects{" "}
                      <span className="heading-count">
                        {signedIn ? projectState.data.length : 0}
                      </span>
                    </h2>
                  </div>
                  {signedIn && (
                    <button
                      className="outline"
                      onClick={() => setDialog("project")}
                    >
                      <Plus size={16} />
                      New project
                    </button>
                  )}
                </div>
                <p className="muted">
                  Private drafts, just for you. Saving a project doesn’t publish
                  it.
                </p>
                {!signedIn ? (
                  <div className="empty compact">
                    <Code2 size={30} />
                    <h3>A home for your work in progress.</h3>
                    <p>
                      Sign in with a CKB-compatible wallet to create and manage
                      your projects.
                    </p>
                    <button className="primary" onClick={connect}>
                      <Wallet size={17} />
                      Sign in to Studio
                    </button>
                  </div>
                ) : projectState.error ? (
                  <Notice onRetry={() => setRevision((r) => r + 1)}>
                    {projectState.error}
                  </Notice>
                ) : projectState.loading ? (
                  <Skeletons />
                ) : projectState.data.length ? (
                  <div className="projects">
                    {projectState.data.map((p) => (
                      <article key={p.id}>
                        <div className="project-icon">
                          <Code2 />
                        </div>
                        <div>
                          <span className="eyebrow">PRIVATE DRAFT</span>
                          <h3>{p.title}</h3>
                          <p>{p.description}</p>
                          <a href={p.url} target="_blank" rel="noreferrer">
                            Open game <ExternalLink size={14} />
                          </a>
                        </div>
                        <span className="project-date">
                          {new Date(p.created).toLocaleDateString()}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty compact">
                    <Plus size={32} />
                    <h3>Your next game starts here.</h3>
                    <p>
                      Save a title, a description and a playable URL. Come back
                      whenever you’re ready.
                    </p>
                    <button
                      className="outline"
                      onClick={() => setDialog("project")}
                    >
                      Create your first project <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </>
            ) : game ? (
              <>
                <div className="play-heading">
                  <button onClick={() => go("/")} className="back">
                    <ArrowLeft size={16} />
                    Store
                  </button>
                  <span className="play-divider">/</span>
                  <span>{game.title}</span>
                  <div className="play-tools">
                    <button
                      onClick={() => setDialog("reload")}
                      aria-label="Reload game"
                      title="Reload game"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => setDialog("controls")}
                      aria-label="Game controls"
                      title="Game controls"
                    >
                      <Gamepad2 size={17} />
                      <span>Controls</span>
                    </button>
                    <button
                      onClick={immersive ? exitImmersive : enterImmersive}
                      aria-label={
                        immersive ? "Exit immersive mode" : "Fullscreen"
                      }
                    >
                      {immersive ? <X size={17} /> : <Expand size={17} />}
                      <span>{immersive ? "Exit" : "Fullscreen"}</span>
                    </button>
                  </div>
                </div>
                <div className="play-title">
                  <div>
                    <div className="eyebrow">
                      {game.genre}
                      <span>·</span>
                      {game.players}
                    </div>
                    <h1>{game.title}</h1>
                  </div>
                  <span className="save-indicator">
                    <i />
                    {loadingUser
                      ? "Checking account"
                      : signedIn
                        ? "Wallet library"
                        : user
                          ? "Guest library"
                          : "Free to play"}
                  </span>
                </div>
                {loadingUser ? (
                  <div className="launch-placeholder" role="status">
                    <Spinner />
                    <h2>Getting your playground ready…</h2>
                  </div>
                ) : user ? (
                  <div
                    className={
                      "game-stage " +
                      (frameStatus === "ready" ? "is-ready" : "")
                    }
                  >
                    <iframe
                      ref={frameRef}
                      key={game.id + ":" + frameKey}
                      className={"game-frame " + game.id}
                      src={"/games/" + game.id + "/"}
                      title={game.title}
                      onLoad={syncFrame}
                      allow="fullscreen; autoplay"
                      allowFullScreen
                    />
                    {frameStatus !== "ready" && (
                      <div className="frame-loading" role="status">
                        {frameStatus === "slow" ? (
                          <>
                            <WifiOff size={30} />
                            <h2>The game is taking a little longer.</h2>
                            <p>
                              Check your connection, then try reloading the
                              game.
                            </p>
                            <button
                              className="primary"
                              onClick={() => setFrameKey((k) => k + 1)}
                            >
                              <RefreshCw size={16} />
                              Try again
                            </button>
                          </>
                        ) : (
                          <>
                            <Spinner />
                            <h2>Opening {game.title}…</h2>
                            <p>Getting everything ready for your next round.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="launch-placeholder"
                    style={{ "--launch-cover": `url(${game.cover})` }}
                  >
                    <div>
                      <span className="pill">FREE · IN YOUR BROWSER</span>
                      <h2>Your next round is waiting.</h2>
                      <p>
                        Play as a guest, or connect a wallet to open your
                        library.
                      </p>
                      <button
                        className="primary"
                        disabled={!!launching}
                        onClick={() => launch(game.id)}
                      >
                        {launching ? <Spinner /> : <Play size={17} />}Play as a
                        guest <ArrowRight size={17} />
                      </button>
                      <button className="text-link" onClick={connect}>
                        Connect a wallet instead <Wallet size={15} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="play-info">
                  <div>
                    <Gamepad2 size={21} />
                    <h3>Find your rhythm.</h3>
                    <p>{game.controls}</p>
                  </div>
                  <div>
                    <ShieldCheck size={21} />
                    <h3>A round worth keeping.</h3>
                    <p>
                      {["teeworlds", "openstrike"].includes(game.id)
                        ? "Completed rounds are replayed and saved to your account. Live rounds continue if you leave the page. Download your verified export after a match."
                        : "Your moves and launches save as you play. Replay and export your session inside the game."}
                    </p>
                    <p>
                      {signedIn
                        ? "Sign back in with this wallet to return to your library."
                        : "Guest saves belong to this browser. Wallet accounts have a separate library."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">
                <Gamepad2 size={38} />
                <h1>This page took a wrong turn.</h1>
                <p>There are better adventures in the store.</p>
                <button className="primary" onClick={() => go("/")}>
                  Back to the playground <ArrowRight size={17} />
                </button>
              </div>
            )}
            <footer className="footer">
              <div>
                <button className="brand" onClick={() => go("/")}>
                  <BrandIcon />
                  <span>
                    UTXO<span className="brand-light">Play</span>
                  </span>
                </button>
                <p>A little more play in your day.</p>
              </div>
              <nav aria-label="Footer navigation">
                <button onClick={() => go("/developers")}>Studio</button>
                <a
                  href="https://github.com/Myelin-Labs/UTXOPlay"
                  target="_blank"
                  rel="noreferrer"
                >
                  Source <ArrowUpRight size={12} />
                </a>
                <a href="/about.html">About</a>
                <a href="/privacy.html">Privacy</a>
                <button onClick={() => setDialog("preferences")}>
                  Preferences
                </button>
              </nav>
              <span>© {new Date().getFullYear()} UTXOPlay</span>
            </footer>
          </main>
        </div>
        {isOpen && (
          <WalletPickerGuard
            onClose={() => {
              setIntent(false);
              closePicker();
            }}
          />
        )}
        {mobileNav && (
          <Modal
            title="Navigation"
            onClose={() => setMobileNav(false)}
            className="mobile-drawer"
          >
            {navContent}
          </Modal>
        )}
        {details && (
          <GameDetails
            game={details}
            onClose={() => setDetails(null)}
            onPlay={launch}
            launching={launching}
          />
        )}
        {dialog === "wallet" && (
          <Modal
            title="Wallet account"
            onClose={() => {
              if (!walletBusy || walletPhase === "signature") {
                if (walletBusy) {
                  authEpoch.current++;
                  cancelSignature.current?.();
                }
                setDialog(null);
                setIntent(false);
              }
            }}
            dismissible={!walletBusy || walletPhase === "signature"}
            className="wallet-modal"
          >
            <div className="modal-icon">
              <BrandIcon />
            </div>
            <div className="eyebrow">YOUR KEY TO THE PLAYGROUND</div>
            <h2>
              {signedIn ? "You’re right at home." : "One wallet. More play."}
            </h2>
            {signedIn ? (
              <>
                <p>
                  Your CKB account is signed in. Your library is ready on any
                  device you sign in from.
                </p>
                <div className="address">{user.address}</div>
                <button
                  className="text-link copy-address"
                  onClick={() => copy(user.address, "Wallet address copied.")}
                >
                  <Copy size={15} />
                  Copy address
                </button>
                <button
                  className="primary full"
                  onClick={() => {
                    setDialog(null);
                    go("/library");
                  }}
                >
                  Open my library <ArrowRight size={17} />
                </button>
                <button
                  className="text-button"
                  disabled={walletBusy}
                  onClick={logout}
                >
                  {walletBusy ? <Spinner /> : <LogOut size={15} />}Sign out
                </button>
              </>
            ) : (
              <>
                <p>
                  Choose a wallet and sign a login message. No funds needed, and
                  nothing to buy.
                </p>
                <div className="wallet-steps">
                  <span className={walletBusy || signer ? "done" : ""}>
                    <b>{signer ? <Check size={13} /> : 1}</b>Choose wallet
                  </span>
                  <i />
                  <span className={walletBusy ? "current" : ""}>
                    <b>2</b>Sign in
                  </span>
                </div>
                <div className="wallet-list">
                  <span>JoyID</span>
                  <span>UTXO Global</span>
                  <span>UniSat</span>
                  <span>OKX</span>
                </div>
                <button
                  className="primary full"
                  disabled={walletBusy}
                  onClick={() => chooseWallet()}
                >
                  {walletBusy ? <Spinner /> : <Wallet size={17} />}
                  <span>
                    {walletBusy
                      ? walletPhase === "verifying"
                        ? "Verifying your signature…"
                        : "Confirm in your wallet…"
                      : signer
                        ? "Sign in with " + (wallet?.name || "wallet")
                        : "Choose a wallet"}
                  </span>
                  {!walletBusy && <ArrowUpRight size={17} />}
                </button>
                {signer && !walletBusy && (
                  <button
                    className="text-button"
                    onClick={() => chooseWallet(true)}
                  >
                    Choose another wallet
                  </button>
                )}
                <div className="modal-note">
                  <ShieldCheck size={16} />
                  <span>A login signature only. No transactions.</span>
                </div>
                <p className="fine">
                  CKB mainnet · Available choices depend on your installed
                  wallets. Wallet and guest libraries stay separate.
                </p>
              </>
            )}
            {walletError && <Notice>{walletError}</Notice>}
          </Modal>
        )}
        {dialog === "project" && (
          <Modal
            title="Create a project"
            onClose={() => setDialog(null)}
            dismissible={!projectBusy}
          >
            <form
              className="project-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (projectBusy) return;
                setProjectBusy(true);
                setProjectError("");
                try {
                  await api("/api/developer/projects", projectDraft);
                  setRevision((r) => r + 1);
                  setDialog(null);
                  setProjectDraft({ title: "", description: "", url: "" });
                  notify("Project saved. Your draft is private to you.");
                } catch (err) {
                  setProjectError(apiError(err));
                } finally {
                  setProjectBusy(false);
                }
              }}
            >
              <div className="eyebrow">
                <Code2 size={16} />
                UTXOPLAY STUDIO
              </div>
              <h2>Something worth playing.</h2>
              <p>Start with the essentials. Your draft stays private.</p>
              <label>
                Game title
                <input
                  autoFocus
                  name="title"
                  value={projectDraft.title}
                  onChange={(e) =>
                    setProjectDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  required
                  minLength={3}
                  maxLength={80}
                  placeholder="Your game’s name"
                />
              </label>
              <label>
                Description <span>{projectDraft.description.length}/2000</span>
                <textarea
                  name="description"
                  value={projectDraft.description}
                  onChange={(e) =>
                    setProjectDraft((d) => ({
                      ...d,
                      description: e.target.value,
                    }))
                  }
                  required
                  maxLength={2000}
                  placeholder="What makes it fun?"
                />
              </label>
              <label>
                Playable URL
                <input
                  name="url"
                  type="url"
                  value={projectDraft.url}
                  onChange={(e) =>
                    setProjectDraft((d) => ({ ...d, url: e.target.value }))
                  }
                  required
                  maxLength={500}
                  pattern="https://.*"
                  placeholder="https://your.game"
                  aria-describedby="url-help"
                />
              </label>
              <p id="url-help" className="fine">
                Use an HTTPS link. We won’t publish or run it when you save.
              </p>
              {projectError && <Notice>{projectError}</Notice>}
              <button className="primary full" disabled={projectBusy}>
                {projectBusy ? <Spinner /> : <Plus size={17} />}{" "}
                {projectBusy ? "Saving your draft…" : "Save project"}
              </button>
              <p className="fine centered">
                Close and reopen this form to keep editing your unsaved draft.
              </p>
            </form>
          </Modal>
        )}
        {dialog === "preferences" && (
          <Modal title="Display preferences" onClose={() => setDialog(null)}>
            <div className="modal-icon">
              <Settings2 />
            </div>
            <div className="eyebrow">MAKE YOURSELF COMFORTABLE</div>
            <h2>Your kind of motion.</h2>
            <p>
              Keep the little transitions, or make the store a quieter place.
            </p>
            <fieldset className="motion-options">
              <legend className="sr-only">Animation preference</legend>
              {[
                [
                  "system",
                  "Follow your device",
                  "Subtle transitions. Respects your system’s reduced-motion setting.",
                ],
                [
                  "reduced",
                  "Reduce motion",
                  "No moving backgrounds or sliding transitions.",
                ],
              ].map(([v, label, desc]) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="motion"
                    value={v}
                    checked={motionSetting === v}
                    onChange={() => setMotionSetting(v)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </span>
                  {motionSetting === v && <Check size={18} />}
                </label>
              ))}
            </fieldset>
            <p className="fine">
              Saved on this browser. This controls the store, not effects inside
              games.
            </p>
          </Modal>
        )}
        {dialog === "controls" && game && (
          <Modal title="Game controls" onClose={() => setDialog(null)}>
            <div className="modal-icon">
              <Gamepad2 />
            </div>
            <div className="eyebrow">{game.title}</div>
            <h2>Get into your groove.</h2>
            <p>{game.controls}</p>
            <div className="control-note">
              <p>{gameMeta[game.id]?.note}</p>
              <p>
                Escape exits fullscreen. Online rounds continue while you view
                this menu.
              </p>
            </div>
            <button
              className="primary full"
              onClick={() => {
                setDialog(null);
                requestAnimationFrame(() => frameRef.current?.focus());
              }}
            >
              Back to the game <ArrowRight size={16} />
            </button>
          </Modal>
        )}
        {dialog === "reload" && game && (
          <Modal title="Reload game" onClose={() => setDialog(null)}>
            <div className="modal-icon">
              <RefreshCw />
            </div>
            <h2>Reload {game.title}?</h2>
            <p>
              Your saved progress stays. Reloading interrupts your controls; a
              live online round will keep running.
            </p>
            <div className="dialog-actions">
              <button className="outline" onClick={() => setDialog(null)}>
                Keep playing
              </button>
              <button
                className="primary"
                onClick={() => {
                  setFrameKey((k) => k + 1);
                  setDialog(null);
                }}
              >
                Reload game <RefreshCw size={16} />
              </button>
            </div>
          </Modal>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div
              className={"toast " + toast.type}
              role={toast.type === "error" ? "alert" : "status"}
              key={toast.id}
              initial={{ opacity: 0, y: reduced ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            >
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <WifiOff size={18} />
              )}
              <span>{toast.text}</span>
              <button
                className="icon-btn"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")).render(<Root />);
