// src/App.js   (plain JavaScript – no TypeScript, no extra deps)
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Home,
  ListPlus,
  ListMinus,
  Zap,
  Play,
  Clock,
  ChevronDown,
  X,
} from "lucide-react";

/* -------------------------------------------------
   1. FIREBASE CONFIG – replace with YOUR project
   ------------------------------------------------- */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
};

/* -------------------------------------------------
   2. EPISODE DATA – replace ytId & thumbnails
   ------------------------------------------------- */
const EPISODES = [
  {
    id: "s1e3",
    season: 1,
    episode: 3,
    title: "Senior Prank Gone Wild",
    description:
      "The crew tries the biggest prank ever – it ends up on the school PA!",
    duration: "24 min",
    ytId: "dQw4w9WgXcQ", // <-- YOUR UNLISTED ID
    thumbnail:
      "https://placehold.co/1280x720/8B5CF6/ffffff?text=S01+E03+NEW&font=roboto",
  },
  {
    id: "s1e2",
    season: 1,
    episode: 2,
    title: "Cafeteria Food Fight",
    description: "Joe negotiates a better menu… and chaos ensues.",
    duration: "22 min",
    ytId: "qNq_lK7sX40",
    thumbnail:
      "https://placehold.co/1280x720/10B981/ffffff?text=S01+E02&font=roboto",
  },
  {
    id: "s1e1",
    season: 1,
    episode: 1,
    title: "Pilot – First Day Drama",
    description: "The hosts break down the week’s biggest campus gossip.",
    duration: "23 min",
    ytId: "yJg-Y5by-7U",
    thumbnail:
      "https://placehold.co/1280x720/EF4444/ffffff?text=S01+E01&font=roboto",
  },
  // add more episodes here …
];
const LATEST = EPISODES[0];

/* -------------------------------------------------
   3. FIREBASE INITIALISATION (anonymous)
   ------------------------------------------------- */
let firebaseApp, auth, db;
const initFirebase = async () => {
  if (firebaseApp) return;
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js"
  );
  const {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js"
  );
  const {
    getFirestore,
    doc,
    onSnapshot,
    setDoc,
    arrayUnion,
    arrayRemove,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js"
  );

  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);

  await signInAnonymously(auth);
  return { auth, db };
};

/* -------------------------------------------------
   4. YOUTUBE IFRAME API (dynamic load)
   ------------------------------------------------- */
let ytReady = false;
const ytCallbacks = [];
const loadYT = () => {
  if (ytReady) return;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytReady = true;
    ytCallbacks.forEach((c) => c());
    ytCallbacks.length = 0;
  };
};
const onYTReady = (cb) => (ytReady ? cb() : ytCallbacks.push(cb));

/* -------------------------------------------------
   5. COMPONENTS
   ------------------------------------------------- */
const EpisodeCard = React.memo(
  ({ ep, onPlay, inList, toggleList }) => (
    <div
      className="group flex-shrink-0 w-48 cursor-pointer overflow-hidden rounded-xl bg-gray-800 shadow-lg transition-transform hover:scale-105"
      onClick={() => onPlay(ep)}
    >
      <div className="relative">
        <img
          src={ep.thumbnail}
          alt={ep.title}
          className="aspect-video w-full object-cover"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleList(ep.id, inList);
          }}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          {inList ? (
            <ListMinus size={18} className="text-red-400" />
          ) : (
            <ListPlus size={18} />
          )}
        </button>
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-semibold text-white">
          {ep.title}
        </p>
        <p className="text-xs text-gray-400">
          S{ep.season} E{ep.episode} • {ep.duration}
        </p>
      </div>
    </div>
  )
);

const SeasonRow = ({ season, eps, onPlay, list, toggle }) => (
  <section className="mb-12">
    <h2 className="mb-4 text-2xl font-bold text-white">
      Season {season}
    </h2>
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {eps.map((ep) => (
        <EpisodeCard
          key={ep.id}
          ep={ep}
          onPlay={onPlay}
          inList={list.includes(ep.id)}
          toggleList={toggle}
        />
      ))}
    </div>
  </section>
);

const CustomPlayer = ({ ep, onClose }) => {
  const container = useRef(null);
  const player = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const interval = useRef(null);

  const init = useCallback(() => {
    if (!container.current) return;
    player.current = new window.YT.Player(container.current, {
      videoId: ep.ytId,
      playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0 },
      events: {
        onReady: (e) => {
          setDuration(e.target.getDuration());
          e.target.playVideo();
        },
        onStateChange: (e) => setPlaying(e.data === 1),
      },
    });
  }, [ep.ytId]);

  useEffect(() => {
    onYTReady(init);
    return () => {
      if (interval.current) clearInterval(interval.current);
      player.current?.destroy?.();
    };
  }, [init]);

  useEffect(() => {
    if (interval.current) clearInterval(interval.current);
    if (playing && player.current) {
      interval.current = setInterval(() => {
        const cur = player.current.getCurrentTime();
        const dur = player.current.getDuration();
        setProgress((cur / dur) * 100);
      }, 500);
    }
  }, [playing]);

  const togglePlay = () => {
    playing ? player.current.pauseVideo() : player.current.playVideo();
  };
  const seek = (e) => {
    const pct = e.target.value / 100;
    player.current.seekTo(pct * player.current.getDuration());
  };
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
      >
        <X size={24} />
      </button>

      <div className="relative flex-1">
        <div ref={container} className="h-full w-full" />
      </div>

      <div className="bg-gradient-to-t from-black/90 to-transparent p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="text-white hover:text-pink-400"
          >
            {playing ? (
              <svg
                width="28"
                height="28"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <Play size={28} fill="currentColor" />
            )}
          </button>

          <span className="text-sm text-gray-300">
            {fmt(player.current?.getCurrentTime() ?? 0)} / {fmt(duration)}
          </span>

          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={seek}
            className="flex-1 h-1 rounded-full bg-gray-600 appearance-none cursor-pointer [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:appearance-none"
            style={{
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
            }}
          />

          <button
            onClick={onClose}
            className="text-white hover:text-pink-400"
            title="Minimise"
          >
            <ChevronDown size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------
   6. MAIN APP
   ------------------------------------------------- */
export default function App() {
  const [uid, setUid] = useState(null);
  const [myList, setMyList] = useState([]);
  const [page, setPage] = useState("home");
  const [playingEp, setPlayingEp] = useState(null);
  const [ready, setReady] = useState(false);

  // ---- Firebase init + auth + myList listener ----
  useEffect(() => {
    (async () => {
      const { auth, db } = await initFirebase();
      onAuthStateChanged(auth, (user) => {
        const id = user?.uid ?? crypto.randomUUID();
        setUid(id);
        const ref = doc(db, "users", id, "private", "myList");
        const unsub = onSnapshot(ref, (snap) => {
          setMyList(snap.exists() ? snap.data().episodes || [] : []);
          setReady(true);
        });
        return unsub;
      });
    })();
  }, []);

  // ---- YouTube API load ----
  useEffect(() => loadYT(), []);

  // ---- Helper: toggle My List ----
  const toggleList = async (epId, added) => {
    if (!uid) return;
    const { db } = await initFirebase();
    const ref = doc(db, "users", uid, "private", "myList");
    await setDoc(
      ref,
      { episodes: added ? arrayRemove(epId) : arrayUnion(epId) },
      { merge: true }
    );
  };

  // ---- Group episodes by season (newest first) ----
  const seasons = useMemo(() => {
    const map = new Map();
    EPISODES.forEach((ep) => {
      const arr = map.get(ep.season) || [];
      arr.push(ep);
      map.set(ep.season, arr);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([, eps]) => eps);
  }, []);

  const myListEps = useMemo(
    () => EPISODES.filter((e) => myList.includes(e.id)),
    [myList]
  );

  const openPlayer = (ep) => {
    setPlayingEp(ep);
    setPage("player");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#141414] text-white">
        Loading…
      </div>
    );
  }

  return (
    <>
      {/* Tailwind CDN (works on Netlify) */}
      <script src="https://cdn.tailwindcss.com"></script>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-black/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-8">
          <h1 className="flex items-center text-2xl font-black text-pink-400">
            <Zap className="mr-2" size={28} />
            SCHOOL TV
          </h1>
          <nav className="hidden space-x-6 md:flex">
            <button
              onClick={() => setPage("home")}
              className={`flex items-center text-sm font-medium transition ${
                page === "home" ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Home size={18} className="mr-1" />
              Home
            </button>
            <button
              onClick={() => setPage("mylist")}
              className={`flex items-center text-sm font-medium transition ${
                page === "mylist"
                  ? "text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <ListPlus size={18} className="mr-1" />
              My List
            </button>
          </nav>
        </div>
        <div className="text-xs text-gray-400">
          {uid ? `ID: ${uid.slice(0, 8)}…` : "Anonymous"}
        </div>
      </header>

      {/* ---------- HOME PAGE ---------- */}
      {page === "home" && (
        <main className="pt-16 bg-[#141414] text-white">
          {/* Hero */}
          <section
            className="relative h-[70vh] cursor-pointer overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${LATEST.thumbnail})` }}
            onClick={() => openPlayer(LATEST)}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 max-w-2xl">
              <p className="mb-2 flex items-center text-sm font-bold uppercase text-pink-400">
                <Zap size={16} className="mr-1" />
                Just Dropped
              </p>
              <h2 className="mb-3 text-5xl font-black leading-tight text-white drop-shadow-lg">
                {LATEST.title}
              </h2>
              <p className="mb-6 hidden text-lg text-gray-300 md:block">
                {LATEST.description}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openPlayer(LATEST);
                  }}
                  className="flex items-center rounded-full bg-white px-6 py-3 font-bold text-black shadow-xl hover:bg-gray-200"
                >
                  <Play fill="black" size={20} className="mr-2" />
                  Watch Now
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleList(LATEST.id, myList.includes(LATEST.id));
                  }}
                  className="flex items-center rounded-full bg-gray-700/80 px-6 py-3 font-bold text-white shadow-xl backdrop-blur-sm hover:bg-gray-600/90"
                >
                  {myList.includes(LATEST.id) ? (
                    <>
                      <ListMinus size={20} className="mr-2 text-red-400" />
                      Remove
                    </>
                  ) : (
                    <>
                      <ListPlus size={20} className="mr-2" />
                      My List
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Season rows */}
          <div className="px-6 pt-12 pb-20">
            {seasons.map((eps) => {
              const seasonNum = eps[0].season;
              return (
                <SeasonRow
                  key={seasonNum}
                  season={seasonNum}
                  eps={eps}
                  onPlay={openPlayer}
                  list={myList}
                  toggle={toggleList}
                />
              );
            })}
          </div>
        </main>
      )}

      {/* ---------- PLAYER PAGE ---------- */}
      {page === "player" && playingEp && (
        <CustomPlayer ep={playingEp} onClose={() => setPage("home")} />
      )}

      {/* ---------- MY LIST PAGE ---------- */}
      {page === "mylist" && (
        <main className="pt-20 px-6 pb-20 bg-[#141414] text-white">
          <h1 className="mb-8 flex items-center text-4xl font-bold text-pink-400">
            <ListPlus size={36} className="mr-3" />
            My List ({myListEps.length})
          </h1>

          {myListEps.length === 0 ? (
            <p className="rounded-lg bg-gray-800 p-12 text-center text-lg text-gray-400">
              Nothing here yet! Add episodes from Home with the
              <ListPlus className="mx-1 inline" size={20} /> button.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {myListEps.map((ep) => (
                <div
                  key={ep.id}
                  className="cursor-pointer overflow-hidden rounded-xl bg-gray-800 shadow-lg transition hover:scale-105"
                  onClick={() => openPlayer(ep)}
                >
                  <img
                    src={ep.thumbnail}
                    alt={ep.title}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-white">
                      {ep.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      S{ep.season} E{ep.episode}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleList(ep.id, true);
                      }}
                      className="mt-2 w-full rounded-full border border-red-500 py-1 text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white"
                    >
                      <ListMinus size={14} className="mr-1 inline" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </>
  );
}

/* -------------------------------------------------
   Tiny CSS helpers
   ------------------------------------------------- */
const style = document.createElement("style");
style.innerHTML = `
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
`;
document.head.appendChild(style);
