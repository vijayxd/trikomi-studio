import React, { useState, useEffect, useMemo } from "react";
import { 
  Heart, 
  ExternalLink, 
  Search, 
  Filter, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  Tag, 
  Grid3X3, 
  ArrowUpDown, 
  RefreshCw,
  FolderHeart,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShoppingBag,
  SlidersHorizontal,
  Compass,
  Trash2,
  AlertTriangle
} from "lucide-react";

export interface Style3DGarmentItem {
  id: string;
  name: string;
  new_name?: string;
  needsReview?: boolean;
  reviewReason?: string;
  thumbnail: string;
  remoteThumbnail?: string;
  url: string;
  source?: string;
  fileFormatStatus?: string;
  tags?: string[];
  aiVisionScore?: number;
}

const FAVORITES_STORAGE_KEY = "style3d_favorite_garments";
const ITEMS_PER_PAGE = 36;

export const DedicatedCatalogPage: React.FC = () => {
  const [items, setItems] = useState<Style3DGarmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "favorites">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "name_asc" | "name_desc" | "ai_score_desc" | "ai_score_asc">("default");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Persistent Favorites via localStorage
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length > 0) return parsed;
      }
      return {};
    } catch {
      return {};
    }
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Automated Sequential Batch Queue Runner
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueList, setQueueList] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [completedAssetIds, setCompletedAssetIds] = useState<Record<string, boolean>>({});

  // Fetch already downloaded assets from disk on mount to skip re-downloading
  useEffect(() => {
    fetch("/api/downloaded-assets")
      .then((r) => r.json())
      .then((list: string[]) => {
        if (Array.isArray(list)) {
          const map: Record<string, boolean> = {};
          list.forEach((id) => { map[id] = true; });
          setCompletedAssetIds((prev) => ({ ...prev, ...map }));
          console.log(`[Catalog] Found ${list.length} garments already downloaded in Downloads folder.`);
        }
      })
      .catch((err) => console.warn("Could not check downloaded assets:", err));
  }, []);

  // Listen to Server-Sent Events (SSE) from Vite bridge to advance queue automatically
  useEffect(() => {
    const eventSource = new EventSource("/api/transfer-stream");
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.id) {
          console.log("[Catalog SSE] Received completed garment transfer:", payload.id);
          setCompletedAssetIds((prev) => ({ ...prev, [payload.id]: true }));
        }
      } catch (e) {}
    };
    return () => {
      eventSource.close();
    };
  }, []);

  // Open next item strictly 1-by-1 and close tab via window handle
  useEffect(() => {
    if (!isQueueRunning) return;
    if (queueIndex >= queueList.length) {
      setIsQueueRunning(false);
      alert(`🎉 Batch Queue Complete! All ${queueList.length} items have been processed and saved.`);
      return;
    }

    const currentId = queueList[queueIndex];
    console.log(`[Single Tab Queue] Processing item [${queueIndex + 1} of ${queueList.length}]: ${currentId}`);

    // Open single popup/tab and keep reference
    const garmentTab = window.open(
      `https://www.style3d.ai/style/${currentId}?func=resproduct&auto_export=true`,
      "style3d_auto_tab"
    );

    let advanced = false;
    const advanceNext = () => {
      if (advanced) return;
      advanced = true;
      if (garmentTab && !garmentTab.closed) {
        try { garmentTab.close(); } catch (e) {}
      }
      clearInterval(pollInterval);
      clearTimeout(safetyTimeout);
      // Wait 1.5s between tabs so Chrome GPU frees WebGL context
      setTimeout(() => {
        setQueueIndex((prev) => prev + 1);
      }, 1500);
    };

    // Poll if transfer was received from bridge SSE
    const pollInterval = setInterval(() => {
      if (completedAssetIds[currentId]) {
        advanceNext();
      }
    }, 1000);

    // Safety fallback: if asset takes longer than 40s or user closed tab, advance
    const safetyTimeout = setTimeout(() => {
      console.warn(`[Single Tab Queue] Timeout on ${currentId}, moving to next.`);
      advanceNext();
    }, 40000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(safetyTimeout);
    };
  }, [isQueueRunning, queueIndex, queueList, completedAssetIds]);

  // Sync favorites from catalog tags if localStorage was empty
  useEffect(() => {
    if (items.length > 0) {
      setFavorites((prev) => {
        if (Object.keys(prev).length === 0) {
          const initialFavs: Record<string, boolean> = {};
          items.forEach((it) => {
            if (it.tags?.includes("favourite")) {
              initialFavs[it.id] = true;
            }
          });
          if (Object.keys(initialFavs).length > 0) {
            try {
              localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(initialFavs));
            } catch (err) {
              console.warn("Could not save initial favorites to localStorage", err);
            }
            return initialFavs;
          }
        }
        return prev;
      });
    }
  }, [items]);

  // Load catalog dataset
  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/data/style3d_library_catalog.json?v=" + Date.now());
      if (!res.ok) {
        throw new Error(`Catalog dataset not found (HTTP ${res.status})`);
      }
      const data: Style3DGarmentItem[] = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load garment catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode, categoryFilter, sortBy]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFavorites((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        delete updated[id];
      } else {
        updated[id] = true;
      }
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn("Could not save favorites to localStorage", err);
      }
      return updated;
    });
  };

  const clearFavorites = () => {
    if (window.confirm("Are you sure you want to clear all favorites?")) {
      setFavorites({});
      try {
        localStorage.removeItem(FAVORITES_STORAGE_KEY);
      } catch (err) {
        console.warn("Could not clear favorites from localStorage", err);
      }
    }
  };

  const copyUrl = (item: Style3DGarmentItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const exportFavoritesJson = () => {
    const favItems = items.filter((item) => favorites[item.id]);
    const blob = new Blob([JSON.stringify(favItems, null, 2)], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `style3d_favorite_garments_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  // Categories derived from names & tags
  const detectedCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add("⚡ Shortlist Level 2 (Final)");
    cats.add("🏆 Shortlist Level 1");
    cats.add("⚡ Sportswear");
    items.forEach((item) => {
      const lower = item.name.toLowerCase();
      if (lower.includes("dress") || lower.includes("gown") || lower.includes("skirt")) cats.add("Dresses & Skirts");
      else if (lower.includes("jacket") || lower.includes("coat") || lower.includes("blazer") || lower.includes("parka") || lower.includes("down")) cats.add("Outerwear & Jackets");
      else if (lower.includes("pant") || lower.includes("trouser") || lower.includes("jean") || lower.includes("shorts") || lower.includes("bottom")) cats.add("Pants & Bottoms");
      else if (lower.includes("shirt") || lower.includes("top") || lower.includes("tee") || lower.includes("t-shirt") || lower.includes("hoodie") || lower.includes("sweater") || lower.includes("sweatshirt")) cats.add("Tops & Sweaters");
      else if (lower.includes("suit") || lower.includes("vest") || lower.includes("cardigan")) cats.add("Suits & Vests");
    });
    return Array.from(cats);
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (filterMode === "favorites" && !favorites[item.id]) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = item.name.toLowerCase().includes(q) || (item.new_name && item.new_name.toLowerCase().includes(q));
          const matchId = item.id.toLowerCase().includes(q);
          const matchTag = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
          if (!matchName && !matchId && !matchTag) return false;
        }

        if (categoryFilter !== "all") {
          if (categoryFilter === "⚡ Shortlist Level 2 (Final)") {
            return item.tags?.includes("level2shortlit") || item.tags?.includes("shortlistlevel2");
          }
          if (categoryFilter === "🏆 Shortlist Level 1") {
            return item.tags?.includes("shortlistlevel1");
          }
          if (categoryFilter === "⚡ Sportswear") {
            return item.tags?.includes("sports");
          }
          const lower = (item.new_name || item.name).toLowerCase();
          if (categoryFilter === "Dresses & Skirts" && !(lower.includes("dress") || lower.includes("gown") || lower.includes("skirt"))) return false;
          if (categoryFilter === "Outerwear & Jackets" && !(lower.includes("jacket") || lower.includes("coat") || lower.includes("blazer") || lower.includes("parka") || lower.includes("down") || lower.includes("windbreaker") || lower.includes("puffer"))) return false;
          if (categoryFilter === "Pants & Bottoms" && !(lower.includes("pant") || lower.includes("trouser") || lower.includes("jean") || lower.includes("shorts") || lower.includes("bottom") || lower.includes("legging") || lower.includes("tights"))) return false;
          if (categoryFilter === "Tops & Sweaters" && !(lower.includes("shirt") || lower.includes("top") || lower.includes("tee") || lower.includes("t-shirt") || lower.includes("hoodie") || lower.includes("sweater") || lower.includes("sweatshirt") || lower.includes("bra") || lower.includes("tank"))) return false;
          if (categoryFilter === "Suits & Vests" && !(lower.includes("suit") || lower.includes("vest") || lower.includes("cardigan"))) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "ai_score_desc") return (b.aiVisionScore || 0) - (a.aiVisionScore || 0);
        if (sortBy === "ai_score_asc") return (a.aiVisionScore || 0) - (b.aiVisionScore || 0);
        const nameA = a.new_name || a.name;
        const nameB = b.new_name || b.name;
        if (sortBy === "name_asc") return nameA.localeCompare(nameB);
        if (sortBy === "name_desc") return nameB.localeCompare(nameA);
        return 0;
      });
  }, [items, favorites, filterMode, searchQuery, categoryFilter, sortBy]);

  const favoritesCount = useMemo(() => {
    return items.filter((it) => favorites[it.id]).length;
  }, [items, favorites]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0b0f17", color: "#f1f5f9" }}>
      
      {/* ========================================================= */}
      {/* DEDICATED HEADER                                         */}
      {/* ========================================================= */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(11, 15, 23, 0.88)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "14px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}>
        {/* Top bar: Brand, Status, Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          
          {/* Brand Logo & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(2, 132, 199, 0.35)"
            }}>
              <Grid3X3 size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "19px", fontWeight: "700", color: "#fff", letterSpacing: "-0.01em" }}>
                  Style3D Garment Catalog
                </h1>
                <span style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "3px 9px",
                  borderRadius: "14px",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.3)"
                }}>
                  {items.length > 0 ? `${items.length.toLocaleString()} Assets` : "Loading..."}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                Explore 3D fashion models, inspect official thumbnails, and save your favorites.
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => loadCatalog()}
              title="Reload catalog data"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "7px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(30, 41, 59, 0.6)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Reload</span>
            </button>

            {favoritesCount > 0 && (
              <>
                <button
                  onClick={clearFavorites}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "7px",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "#f87171",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title="Clear all saved favorites"
                >
                  <Trash2 size={13} />
                  <span>Clear Favorites</span>
                </button>

                <button
                  onClick={exportFavoritesJson}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "7px",
                    border: "1px solid rgba(244, 114, 182, 0.35)",
                    background: "rgba(244, 114, 182, 0.15)",
                    color: "#f472b6",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(244, 114, 182, 0.2)"
                  }}
                  title="Download your favorites as JSON file"
                >
                  <Download size={13} />
                  <span>Export ({favoritesCount})</span>
                </button>

                <button
                  onClick={() => {
                    if (isQueueRunning) {
                      setIsQueueRunning(false);
                      return;
                    }
                    const favItems = items.filter((item) => favorites[item.id]);
                    if (favItems.length === 0) return alert("No favorites selected!");

                    // Filter out already downloaded assets to prevent re-downloading
                    const pendingItems = favItems.filter((item) => !completedAssetIds[item.id]);

                    if (pendingItems.length === 0) {
                      return alert(`All ${favItems.length} favorite garments have already been downloaded to your Downloads folder! Nothing to do.`);
                    }

                    const alreadyDoneCount = favItems.length - pendingItems.length;
                    const confirmMsg = alreadyDoneCount > 0
                      ? `Found ${alreadyDoneCount} already downloaded items (skipping them).\n\nStart Automated Queue for remaining ${pendingItems.length} garments?\n\nOpens 1 tab at a time, transfers thin OBJ & textures to Downloads, closes that tab, and continues.`
                      : `Start Automated Queue for ${pendingItems.length} garments?\n\nOpens 1 tab at a time, transfers thin OBJ & textures to Downloads, closes that tab, and continues.`;

                    if (window.confirm(confirmMsg)) {
                      setQueueList(pendingItems.map(f => f.id));
                      setQueueIndex(0);
                      setIsQueueRunning(true);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "7px",
                    border: isQueueRunning ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(16, 185, 129, 0.4)",
                    background: isQueueRunning
                      ? "linear-gradient(135deg, rgba(220, 38, 38, 0.3), rgba(239, 68, 68, 0.3))"
                      : "linear-gradient(135deg, rgba(5, 150, 105, 0.3), rgba(16, 185, 129, 0.3))",
                    color: isQueueRunning ? "#f87171" : "#34d399",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
                  }}
                  title={isQueueRunning ? "Click to stop running queue" : "Automated sequential queue for favorites"}
                >
                  {isQueueRunning ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Stop Queue ({queueIndex}/{queueList.length})</span>
                    </>
                  ) : (
                    <span>
                      🚀 Run Auto-Queue ({Object.keys(favorites).filter(id => favorites[id] && !completedAssetIds[id]).length} pending)
                    </span>
                  )}
                </button>
              </>
            )}

            <a
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "7px",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(37, 99, 235, 0.2))",
                color: "#38bdf8",
                fontSize: "12px",
                fontWeight: "600",
                textDecoration: "none",
                cursor: "pointer"
              }}
            >
              <Layers size={13} />
              <span>Open 3D UV Studio ↗</span>
            </a>
          </div>
        </div>

        {/* Filter bar: Search, Tabs, Categories, Sorting */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          
          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "280px", flex: "1 1 300px", maxWidth: "460px" }}>
            <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search garments by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 14px 8px 36px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "rgba(15, 23, 42, 0.7)",
                color: "#fff",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* All vs Favorites Switcher */}
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(15, 23, 42, 0.8)",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)"
          }}>
            <button
              onClick={() => setFilterMode("all")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: filterMode === "all" ? "linear-gradient(135deg, #0284c7, #2563eb)" : "transparent",
                color: filterMode === "all" ? "#fff" : "#94a3b8",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <span>All Assets</span>
              <span style={{
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "10px",
                background: filterMode === "all" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)"
              }}>
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setFilterMode("favorites")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: filterMode === "favorites" ? "linear-gradient(135deg, #ec4899, #db2777)" : "transparent",
                color: filterMode === "favorites" ? "#fff" : "#94a3b8",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <Heart size={12} fill={filterMode === "favorites" ? "#fff" : "none"} color={filterMode === "favorites" ? "#fff" : "#f472b6"} />
              <span>Favorites</span>
              <span style={{
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "10px",
                background: filterMode === "favorites" ? "rgba(255, 255, 255, 0.25)" : "rgba(244, 114, 182, 0.15)",
                color: filterMode === "favorites" ? "#fff" : "#f472b6"
              }}>
                {favoritesCount}
              </span>
            </button>
          </div>

          {/* Category Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "rgba(15, 23, 42, 0.8)",
                color: "#e2e8f0",
                fontSize: "12.5px",
                outline: "none"
              }}
            >
              <option value="all">All Categories</option>
              {detectedCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowUpDown size={13} color="#94a3b8" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: "6px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "rgba(15, 23, 42, 0.8)",
                color: "#e2e8f0",
                fontSize: "12.5px",
                outline: "none"
              }}
            >
              <option value="default">Default API Order</option>
              <option value="ai_score_desc">⚡ AI Vision Match: Highest First</option>
              <option value="ai_score_asc">⚡ AI Vision Match: Lowest First</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA                                        */}
      {/* ========================================================= */}
      <main style={{ flex: 1, padding: "24px 28px", boxSizing: "border-box" }}>
        
        {loading && items.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            gap: "14px",
            color: "#94a3b8"
          }}>
            <RefreshCw size={32} className="spin-animation" color="#38bdf8" />
            <span style={{ fontSize: "15px", fontWeight: "500" }}>Loading Style3D catalog assets...</span>
          </div>
        ) : error && items.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            gap: "12px",
            color: "#f87171"
          }}>
            <span style={{ fontSize: "16px", fontWeight: "600" }}>{error}</span>
            <button
              onClick={() => loadCatalog()}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #f87171",
                background: "rgba(248, 113, 113, 0.15)",
                color: "#f87171",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              Retry Loading
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            gap: "12px",
            color: "#94a3b8"
          }}>
            {filterMode === "favorites" ? (
              <>
                <FolderHeart size={44} color="#f472b6" style={{ opacity: 0.7 }} />
                <span style={{ fontSize: "17px", fontWeight: "600", color: "#f1f5f9" }}>No Favorites Added Yet</span>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Click the heart icon on any garment card to shortlist it here.
                </p>
                <button
                  onClick={() => setFilterMode("all")}
                  style={{
                    marginTop: "8px",
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "1px solid #38bdf8",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}
                >
                  Browse All Assets
                </button>
              </>
            ) : (
              <>
                <Search size={38} color="#64748b" />
                <span style={{ fontSize: "15px" }}>No garments match your search "{searchQuery}"</span>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "20px"
            }}>
              {paginatedItems.map((item) => {
                const isFav = !!favorites[item.id];
                return (
                  <div
                    key={item.id}
                    style={{
                      background: item.needsReview 
                        ? "rgba(45, 26, 14, 0.75)" 
                        : "rgba(15, 23, 42, 0.65)",
                      borderRadius: "12px",
                      border: item.needsReview 
                        ? "1px solid rgba(245, 158, 11, 0.65)" 
                        : (isFav ? "1px solid rgba(244, 114, 182, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)"),
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: item.needsReview
                        ? "0 6px 20px rgba(245, 158, 11, 0.22)"
                        : (isFav ? "0 6px 20px rgba(244, 114, 182, 0.18)" : "0 4px 14px rgba(0, 0, 0, 0.3)"),
                      transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease"
                    }}
                  >
                    {/* Thumbnail Image */}
                    <div style={{
                      width: "100%",
                      height: "240px",
                      background: "#080c14",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <img
                        src={item.thumbnail.startsWith("/thumbnails/") ? item.thumbnail : (item.thumbnail || item.remoteThumbnail)}
                        alt={item.name}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          transition: "transform 0.25s ease, opacity 0.2s ease"
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (item.remoteThumbnail && target.src !== item.remoteThumbnail) {
                            target.src = item.remoteThumbnail;
                          } else {
                            target.style.opacity = "0.2";
                          }
                        }}
                      />

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => toggleFavorite(item.id, e)}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: isFav ? "1px solid #f472b6" : "1px solid rgba(255, 255, 255, 0.25)",
                          background: isFav ? "rgba(244, 114, 182, 0.25)" : "rgba(15, 23, 42, 0.75)",
                          backdropFilter: "blur(6px)",
                          color: isFav ? "#f472b6" : "#cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          zIndex: 2
                        }}
                      >
                        <Heart size={16} fill={isFav ? "#f472b6" : "none"} color={isFav ? "#f472b6" : "#cbd5e1"} />
                      </button>

                      {/* Official & Sports Badges */}
                      <div style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {(item.tags?.includes("level2shortlit") || item.tags?.includes("shortlistlevel2")) && (
                          <span 
                            title="Shortlist Level 2: Curated Final Active Sportswear Piece"
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "3px 7px",
                              borderRadius: "5px",
                              background: "rgba(168, 85, 247, 0.3)",
                              color: "#c084fc",
                              border: "1px solid rgba(192, 132, 252, 0.5)",
                              backdropFilter: "blur(4px)",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                          >
                            ⚡ Shortlist L2
                          </span>
                        )}
                        {item.tags?.includes("shortlistlevel1") && !(item.tags?.includes("level2shortlit") || item.tags?.includes("shortlistlevel2")) && (
                          <span 
                            title="Shortlist Level 1: Athletic Piece"
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "3px 7px",
                              borderRadius: "5px",
                              background: "rgba(245, 158, 11, 0.25)",
                              color: "#fbbf24",
                              border: "1px solid rgba(251, 191, 36, 0.45)",
                              backdropFilter: "blur(4px)",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                          >
                            🏆 Shortlist L1
                          </span>
                        )}
                        {item.tags?.includes("sports") && !item.tags?.includes("shortlistlevel1") && (
                          <span 
                            title={item.aiVisionScore ? `AI Vision Confidence: ${(item.aiVisionScore * 100).toFixed(0)}%` : "Sportswear"}
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "3px 7px",
                              borderRadius: "5px",
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(52, 211, 153, 0.45)",
                              backdropFilter: "blur(4px)",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                          >
                            ⚡ Sports{item.aiVisionScore ? ` ${(item.aiVisionScore * 100).toFixed(0)}%` : ""}
                          </span>
                        )}
                        {item.source && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "3px 7px",
                            borderRadius: "5px",
                            background: "rgba(15, 23, 42, 0.85)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            backdropFilter: "blur(4px)"
                          }}>
                            {item.source}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div style={{
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      flex: 1,
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                          <h4 
                            title={item.new_name || item.name}
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: "700",
                              color: item.needsReview 
                                ? "#fbbf24" 
                                : (item.new_name ? "#f472b6" : "#f1f5f9"),
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {item.new_name || item.name}
                          </h4>
                          {item.needsReview && (
                            <span 
                              title="Flagged for removal / duplicate review"
                              style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "rgba(245, 158, 11, 0.25)",
                                color: "#f59e0b",
                                border: "1px solid rgba(245, 158, 11, 0.5)",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                flexShrink: 0
                              }}
                            >
                              <AlertTriangle size={10} />
                              Review
                            </span>
                          )}
                        </div>

                        {item.needsReview && item.reviewReason && (
                          <div style={{
                            fontSize: "10.5px",
                            fontWeight: "500",
                            color: "#fde68a",
                            background: "rgba(245, 158, 11, 0.15)",
                            border: "1px dashed rgba(245, 158, 11, 0.4)",
                            borderRadius: "4px",
                            padding: "3px 6px",
                            marginTop: "4px"
                          }}>
                            ⚠️ {item.reviewReason}
                          </div>
                        )}

                        {item.new_name && (
                          <div 
                            title={item.name}
                            style={{ 
                              fontSize: "11px", 
                              color: "#94a3b8", 
                              whiteSpace: "nowrap", 
                              overflow: "hidden", 
                              textOverflow: "ellipsis",
                              marginTop: "2px"
                            }}
                          >
                            Orig: {item.name}
                          </div>
                        )}
                        <span style={{ fontSize: "10.5px", color: "#64748b", fontFamily: "monospace", display: "block", marginTop: "2px" }}>
                          ID: {item.id.slice(0, 12)}...
                        </span>
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "8px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                        gap: "8px"
                      }}>
                        <button
                          onClick={(e) => copyUrl(item, e)}
                          title="Copy direct asset URL"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "5px",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: copiedId === item.id ? "rgba(16, 185, 129, 0.2)" : "rgba(30, 41, 59, 0.5)",
                            color: copiedId === item.id ? "#34d399" : "#94a3b8",
                            fontSize: "11px",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedId === item.id ? "Copied" : "Copy URL"}</span>
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 12px",
                            borderRadius: "5px",
                            background: "linear-gradient(135deg, #0284c7, #2563eb)",
                            color: "#fff",
                            fontSize: "11.5px",
                            fontWeight: "600",
                            textDecoration: "none",
                            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)"
                          }}
                          title="Open 3D model in Style3D viewer"
                        >
                          <span>Open 3D</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                marginTop: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "16px 0"
              }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: currentPage === 1 ? "rgba(15, 23, 42, 0.4)" : "rgba(30, 41, 59, 0.7)",
                    color: currentPage === 1 ? "#64748b" : "#e2e8f0",
                    fontSize: "12px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Page <strong style={{ color: "#fff" }}>{currentPage}</strong> of <strong style={{ color: "#fff" }}>{totalPages}</strong> ({filteredItems.length} items)
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: currentPage === totalPages ? "rgba(15, 23, 42, 0.4)" : "rgba(30, 41, 59, 0.7)",
                    color: currentPage === totalPages ? "#64748b" : "#e2e8f0",
                    fontSize: "12px",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ========================================================= */}
      {/* DEDICATED FOOTER                                         */}
      {/* ========================================================= */}
      <footer style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        background: "#080c14",
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        fontSize: "12px",
        color: "#64748b"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span>© 2026 Style3D 3D Garment Pipeline</span>
          <span style={{ color: "rgba(255, 255, 255, 0.15)" }}>•</span>
          <span>Catalog Database: <strong style={{ color: "#38bdf8" }}>{items.length.toLocaleString()} Assets</strong></span>
          <span style={{ color: "rgba(255, 255, 255, 0.15)" }}>•</span>
          <span>Favorites Shortlisted: <strong style={{ color: "#f472b6" }}>{favoritesCount}</strong></span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a 
            href="https://www.style3d.ai/3d-design-library" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: "#94a3b8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <span>Official Style3D Library</span>
            <ExternalLink size={11} />
          </a>
          <span style={{ color: "rgba(255, 255, 255, 0.15)" }}>•</span>
          <a 
            href="/" 
            style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <span>Studio Dashboard</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
