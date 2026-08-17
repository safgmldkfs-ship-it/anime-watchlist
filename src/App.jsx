import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, X, Trash2, Pencil, Sparkles, PlayCircle, ChevronDown, ChevronRight, LayoutGrid, List as ListIcon, Star, Film, Share2, Download, Copy, Check, Cloud, CloudOff, Users, Home, UserRound, CheckSquare } from "lucide-react";
import { isSupabaseConfigured, createShareRow, getShareRow } from "./supabaseClient";

const STORAGE_KEY = "anime-watchlist-v3";
const PAGE_SIZE = 30;
const LOCAL_PROFILE_KEY = "anime-watchlist-profile-v1";

const BUILTIN_TYPES = [
  { id: "anime", label: "動畫", emoji: "🎬", color: "#5FD3C4", builtin: true },
  { id: "manga", label: "漫畫", emoji: "📖", color: "#F2726F", builtin: true },
  { id: "novel", label: "小說", emoji: "📔", color: "#9B8CFF", builtin: true },
  { id: "other", label: "其他", emoji: "✨", color: "#F2A65A", builtin: true },
];

const COLOR_SWATCHES = ["#5FD3C4", "#F2726F", "#9B8CFF", "#F2A65A", "#6FA8DC", "#F49AC2", "#8BD17C", "#E0C368"];

const ICON_CHOICES = [
  "🎬", "📖", "📔", "✨", "🍿", "🎭", "👑", "⚔️", "🐉", "💖", "🌸", "🔥",
  "🎧", "📺", "🎮", "🕹️", "🏆", "💫", "🌙", "⭐", "🎨", "🧙", "🦸", "👻",
];

function progressMeta(type) {
  switch (type) {
    case "anime":
      return { unitDefault: "集", detailLabel: "時間（分:秒）", detailPlaceholder: "12:34", highlightPlaceholder: "第12集 12分15秒" };
    case "manga":
      return { unitDefault: "話", detailLabel: "頁數（選填）", detailPlaceholder: "第5頁", highlightPlaceholder: "第5話 第10頁" };
    case "novel":
      return { unitDefault: "章", detailLabel: "頁碼（選填）", detailPlaceholder: "第120頁", highlightPlaceholder: "第12章" };
    default:
      return { unitDefault: "", detailLabel: "備註（選填）", detailPlaceholder: "", highlightPlaceholder: "第12集 / 第3章..." };
  }
}

function emptyForm(defaultType) {
  return {
    id: null,
    title: "",
    type: defaultType,
    icon: "",
    rating: 0,
    review: "",
    watched: false,
    isMovie: false,
    progressUnit: "集",
    progressValue: "",
    progressDetail: "",
    totalUnits: "",
    highlights: [],
  };
}

function Stars({ value, size = 14, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={onChange ? () => onChange(n === value ? 0 : n) : undefined}
          style={{ fontSize: size, color: n <= value ? "#F2A65A" : "#454A6B", cursor: onChange ? "pointer" : "default", lineHeight: 1 }}
        >
          {n <= value ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export default function AnimeWatchlist() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [watchedFilter, setWatchedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm("anime"));
  const [iconTouched, setIconTouched] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showTypeCreator, setShowTypeCreator] = useState(false);
  const [newType, setNewType] = useState({ label: "", emoji: "🏷️", color: COLOR_SWATCHES[0] });
  const [newHighlight, setNewHighlight] = useState({ position: "", title: "" });
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [expandedHighlights, setExpandedHighlights] = useState(() => new Set());
  const [saveState, setSaveState] = useState("idle");
  const [showShare, setShowShare] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [shareInput, setShareInput] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // 分開「我的清單」與「他人清單」，朋友資料只會暫存在 friendItems。
  const [currentPage, setCurrentPage] = useState("home");
  const [friendItems, setFriendItems] = useState([]);
  const [friendCustomTypes, setFriendCustomTypes] = useState([]);
  const [friendShareCode, setFriendShareCode] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());
  const [friendMessage, setFriendMessage] = useState("");
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  const allTypes = useMemo(() => [...BUILTIN_TYPES, ...customTypes], [customTypes]);
  const typeInfo = (id) => allTypes.find((t) => t.id === id) || BUILTIN_TYPES[3];

  useEffect(() => {
    (async () => {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value) {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed.items)) setItems(parsed.items);
          if (Array.isArray(parsed.customTypes)) setCustomTypes(parsed.customTypes);
          if (parsed.viewMode === "grid" || parsed.viewMode === "list") setViewMode(parsed.viewMode);
        }
      } catch (e) {
        console.warn("讀取本機資料失敗", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        // 永久保存於這台瀏覽器；也修正舊版沒有保存 customTypes 的問題。
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, customTypes, viewMode, savedAt: Date.now() }));
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch (e) {
        console.warn("本機儲存失敗", e);
        setSaveState("idle");
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [items, viewMode, customTypes, loading]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, watchedFilter, typeFilter, sortBy]);

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => {
        const typeLabel = typeInfo(it.type)?.label || "";
        const highlights = (it.highlights || []).map((h) => `${h.position || ""} ${h.title || ""}`).join(" ");
        const haystack = [
          it.title,
          it.review,
          it.progressDetail,
          it.progressUnit,
          typeLabel,
          highlights,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    if (watchedFilter === "watched") list = list.filter((it) => it.watched);
    if (watchedFilter === "unwatched") list = list.filter((it) => !it.watched);
    if (typeFilter !== "all") list = list.filter((it) => it.type === typeFilter);

    const sorted = [...list];
    if (sortBy === "rating") sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
    else sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sorted;
  }, [items, search, watchedFilter, typeFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  const openAdd = () => {
    const t = typeInfo("anime");
    setForm({ ...emptyForm("anime"), icon: t.emoji });
    setIconTouched(false);
    setShowIconPicker(false);
    setShowTypeCreator(false);
    setNewHighlight({ position: "", title: "" });
    setShowForm(true);
  };

  const openEdit = (it) => {
    const t = typeInfo(it.type);
    setForm({
      id: it.id,
      title: it.title,
      type: it.type,
      icon: it.icon || t.emoji,
      rating: it.rating,
      review: it.review,
      watched: it.watched,
      isMovie: !!it.isMovie,
      progressUnit: it.progressUnit ?? progressMeta(it.type).unitDefault,
      progressValue: it.progressValue ?? "",
      progressDetail: it.progressDetail ?? "",
      totalUnits: it.totalUnits ?? "",
      highlights: it.highlights ?? [],
    });
    setIconTouched(!!it.icon && it.icon !== t.emoji);
    setShowIconPicker(false);
    setShowTypeCreator(false);
    setNewHighlight({ position: "", title: "" });
    setShowForm(true);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const bumpProgress = (id) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progressValue: (Number(it.progressValue) || 0) + 1, updatedAt: Date.now() } : it)));
  };

  const changeFormType = (typeId) => {
    const meta = progressMeta(typeId);
    const t = typeInfo(typeId);
    setForm((f) => ({
      ...f,
      type: typeId,
      progressUnit: meta.unitDefault,
      icon: iconTouched ? f.icon : t.emoji,
    }));
  };

  const createCustomType = () => {
    const label = newType.label.trim();
    if (!label) return;
    const id = `custom${Date.now()}`;
    const created = { id, label, emoji: newType.emoji || "🏷️", color: newType.color, builtin: false };
    setCustomTypes((prev) => [...prev, created]);
    setForm((f) => ({ ...f, type: id, icon: iconTouched ? f.icon : created.emoji }));
    setNewType({ label: "", emoji: "🏷️", color: COLOR_SWATCHES[0] });
    setShowTypeCreator(false);
  };

  const deleteCustomType = (id) => {
    setCustomTypes((prev) => prev.filter((t) => t.id !== id));
    if (form.type === id) changeFormType("anime");
    if (typeFilter === id) setTypeFilter("all");
  };

  const addHighlightToForm = () => {
    if (!newHighlight.position.trim() && !newHighlight.title.trim()) return;
    setForm((f) => ({ ...f, highlights: [...f.highlights, { id: `h${Date.now()}`, ...newHighlight }] }));
    setNewHighlight({ position: "", title: "" });
  };

  const removeHighlightFromForm = (id) => {
    setForm((f) => ({ ...f, highlights: f.highlights.filter((h) => h.id !== id) }));
  };

  const saveForm = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload = {
      title,
      type: form.type,
      icon: form.icon,
      rating: Number(form.rating) || 0,
      review: form.review,
      watched: form.watched,
      isMovie: form.isMovie,
      progressUnit: form.progressUnit,
      progressValue: form.progressValue,
      progressDetail: form.progressDetail,
      totalUnits: form.totalUnits,
      highlights: form.highlights,
      updatedAt: Date.now(),
    };
    if (form.id) {
      setItems((prev) => prev.map((it) => (it.id === form.id ? { ...it, ...payload } : it)));
    } else {
      setItems((prev) => [{ id: `a${Date.now()}`, ...payload }, ...prev]);
    }
    setShowForm(false);
    setForm(emptyForm("anime"));
  };

  const makeShareCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createShare = async () => {
    setShareBusy(true);
    setShareMessage("");
    setCopied(false);
    try {
      const payload = { items, customTypes, viewMode, exportedAt: Date.now() };
      if (!isSupabaseConfigured) {
        // 沒有設定雲端資料庫時，仍可產生本機匯出碼，方便備份/搬家。
        const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        setShareCode(`LOCAL-${code}`);
        setShareMessage("目前是本機分享碼，只適合匯出/匯入；要讓朋友跨電腦輸入分享碼觀看，請完成 Supabase 設定。");
        return;
      }
      let code = makeShareCode();
      for (let i = 0; i < 5; i++) {
        const existing = await getShareRow(code);
        if (!existing) break;
        code = makeShareCode();
      }
      await createShareRow(code, payload);
      setShareCode(code);
      setShareMessage("分享碼已建立。朋友輸入這組碼即可查看，不會覆蓋他自己的資料。");
    } catch (e) {
      console.error(e);
      setShareMessage(`分享失敗：${e.message || "請檢查 Supabase 設定"}`);
    } finally {
      setShareBusy(false);
    }
  };

  const importShare = async () => {
    const code = shareInput.trim().toUpperCase();
    if (!code) return;

    setShareBusy(true);
    setShareMessage("");
    setFriendMessage("");
    setFriendItems([]);
    setFriendCustomTypes([]);
    setSelectedFriendIds(new Set());

    try {
      let payload;

      if (code.startsWith("LOCAL-")) {
        const json = decodeURIComponent(escape(atob(code.slice(6))));
        payload = JSON.parse(json);
      } else {
        if (!isSupabaseConfigured) throw new Error("尚未設定雲端資料庫");
        const data = await getShareRow(code);
        if (!data?.payload) throw new Error("找不到這組分享碼");
        payload = data.payload;
      }

      const imported = Array.isArray(payload.items) ? payload.items : [];
      const importedTypes = Array.isArray(payload.customTypes) ? payload.customTypes : [];

      setFriendItems(imported);
      setFriendCustomTypes(importedTypes);
      setFriendShareCode(code);
      setSelectedFriendIds(new Set());
      setCurrentPage("friends");
      setShowShare(false);
      setShareInput("");
      setFriendMessage(`成功載入 ${imported.length} 部作品。這些作品目前只在「他人清單」中，不會加入你的清單。`);
    } catch (e) {
      console.error(e);
      setShareMessage(`匯入失敗：${e.message || "請確認分享碼"}`);
    } finally {
      setShareBusy(false);
    }
  };

  const toggleFriendItem = (id) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFriendItems = () => {
    if (friendItems.length > 0 && selectedFriendIds.size === friendItems.length) {
      setSelectedFriendIds(new Set());
    } else {
      setSelectedFriendIds(new Set(friendItems.map((it) => it.id)));
    }
  };

  const closeFriendList = () => {
    setFriendItems([]);
    setFriendCustomTypes([]);
    setSelectedFriendIds(new Set());
    setFriendShareCode("");
    setFriendMessage("");
    setCurrentPage("friends");
  };

  const importSelectedFriendItems = () => {
    if (selectedFriendIds.size === 0) {
      setFriendMessage("請先勾選想加入自己清單的作品。");
      return;
    }

    const selected = friendItems.filter((it) => selectedFriendIds.has(it.id));
    const existingTitles = new Set(items.map((it) => (it.title || "").trim().toLowerCase()));
    const duplicates = selected.filter((it) => existingTitles.has((it.title || "").trim().toLowerCase()));
    const toImport = selected.filter((it) => !existingTitles.has((it.title || "").trim().toLowerCase()));

    setItems((prev) => [
      ...toImport.map((it, index) => ({
        ...it,
        id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        updatedAt: Date.now(),
      })),
      ...prev,
    ]);

    if (friendCustomTypes.length > 0) {
      setCustomTypes((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...friendCustomTypes.filter((t) => !ids.has(t.id))];
      });
    }

    setSelectedFriendIds(new Set());
    setFriendMessage(
      `已選 ${selected.length} 部：新增 ${toImport.length} 部${duplicates.length ? `，${duplicates.length} 部因為你的清單已經有同名作品而跳過` : ""}。`
    );
  };

  const friendTypeInfo = (id) =>
    [...BUILTIN_TYPES, ...customTypes, ...friendCustomTypes].find((t) => t.id === id) || BUILTIN_TYPES[3];

  const copyShareCode = async () => {
    if (!shareCode) return;
    await navigator.clipboard?.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ items, customTypes, viewMode }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anime-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleHighlights = (id) => {
    setExpandedHighlights((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const progressText = (it) => {
    if (it.isMovie) return it.progressDetail ? it.progressDetail : "劇場版";
    const unit = it.progressUnit || "";
    const val = it.progressValue || 0;
    let s = unit ? `第 ${val} ${unit}` : `${val}`;
    if (it.totalUnits) s += ` / 共 ${it.totalUnits} ${unit}`;
    if (it.progressDetail) s += `・${it.progressDetail}`;
    return s;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1B1D2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, color: "#F2A65A" }}>載入中...</div>
      </div>
    );
  }

  const meta = progressMeta(form.type);
  const highlightPlaceholder = form.isMovie ? "01:23:45" : meta.highlightPlaceholder;

  return (
    <div style={{ minHeight: "100vh", background: "#1B1D2E", fontFamily: "'Noto Sans TC', sans-serif", color: "#F5EFE6" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #6E7196; }
        .field { width: 100%; border-radius: 10px; border: 1px solid #3A3E5C; background: #1F2238; color: #F5EFE6; padding: 9px 12px; font-size: 13px; font-family: 'Noto Sans TC', sans-serif; }
        .field:focus { outline: 2px solid #5FD3C4; outline-offset: 1px; }
        .chip { border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; border: 1px solid transparent; position: relative; }
        .grid-wrap { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px) { .grid-wrap { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 980px) { .grid-wrap { grid-template-columns: 1fr 1fr 1fr; } }
        .sprocket { display: flex; gap: 3px; margin-top: 6px; }
        .sprocket span { width: 4px; height: 4px; border-radius: 50%; background: #3A3E5C; }
        .row-btn { background: transparent; border: 1px solid #3A3E5C; border-radius: 8px; color: #9B9BC0; cursor: pointer; display: flex; align-items: center; }
        .type-x { position: absolute; top: -5px; right: -5px; width: 15px; height: 15px; border-radius: 50%; background: #1B1D2E; border: 1px solid #3A3E5C; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 16px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 1.5, color: "#F5EFE6" }}>
              追番手帳 <span style={{ color: "#F2A65A" }}>WATCHLIST</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9B9BC0", marginTop: 2 }}>
              {currentPage === "home"
                ? `共 ${items.length} 部・${items.filter((i) => i.watched).length} 部已看完`
                : friendShareCode
                  ? `正在查看分享碼 ${friendShareCode}・${friendItems.length} 部作品`
                  : "查看朋友分享的清單，不會影響你的資料"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {currentPage === "home" ? (
              <>
                <div style={{ display: "flex", background: "#262A44", borderRadius: 10, padding: 3 }}>
                  <button onClick={() => setViewMode("grid")} style={{ border: "none", borderRadius: 8, padding: "7px 10px", background: viewMode === "grid" ? "#3A3E5C" : "transparent", color: viewMode === "grid" ? "#F5EFE6" : "#6E7196", cursor: "pointer", display: "flex" }} aria-label="卡片檢視">
                    <LayoutGrid size={15} />
                  </button>
                  <button onClick={() => setViewMode("list")} style={{ border: "none", borderRadius: 8, padding: "7px 10px", background: viewMode === "list" ? "#3A3E5C" : "transparent", color: viewMode === "list" ? "#F5EFE6" : "#6E7196", cursor: "pointer", display: "flex" }} aria-label="精簡列表">
                    <ListIcon size={15} />
                  </button>
                </div>
                <button onClick={() => { setShowShare(true); setShareMessage(""); setShareCode(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#262A44", color: "#F5EFE6", border: "1px solid #3A3E5C", borderRadius: 12, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  <Share2 size={15} /> 分享
                </button>
                <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F2A65A", color: "#1B1D2E", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
                  <Plus size={16} /> 新增作品
                </button>
              </>
            ) : (
              <button onClick={() => { setShowShare(true); setShareMessage(""); setShareCode(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#262A44", color: "#F5EFE6", border: "1px solid #3A3E5C", borderRadius: 12, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                <Users size={15} /> 查看另一位朋友
              </button>
            )}
          </div>
        </div>

        {/* Page navigation */}
        <div style={{ display: "flex", gap: 6, background: "#262A44", borderRadius: 14, padding: 5, marginBottom: 16, position: "sticky", bottom: 12, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          <button onClick={() => setCurrentPage("home")} style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 12px", background: currentPage === "home" ? "#5FD3C4" : "transparent", color: currentPage === "home" ? "#1B1D2E" : "#9B9BC0", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Home size={15} /> 我的清單
          </button>
          <button onClick={() => setCurrentPage("friends")} style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 12px", background: currentPage === "friends" ? "#5FD3C4" : "transparent", color: currentPage === "friends" ? "#1B1D2E" : "#9B9BC0", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Users size={15} /> 他人清單
          </button>
        </div>

        {currentPage === "home" && (
          <>
        {/* Search + filters */}
        <div style={{ background: "#262A44", borderRadius: 16, padding: 14, marginBottom: 16 }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#6E7196" }} />
            <input className="field" style={{ paddingLeft: 32 }} placeholder="搜尋作品、心得、精華、進度...（輸入 1～2 個字也可以）" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {[{ id: "all", label: "全部" }, { id: "watched", label: "已看過" }, { id: "unwatched", label: "未看過" }].map((f) => (
              <span key={f.id} className="chip" onClick={() => setWatchedFilter(f.id)} style={{ background: watchedFilter === f.id ? "#5FD3C4" : "#1F2238", color: watchedFilter === f.id ? "#1B1D2E" : "#9B9BC0" }}>
                {f.label}
              </span>
            ))}
            <span style={{ width: 1, height: 18, background: "#3A3E5C", margin: "0 2px" }} />
            <span className="chip" onClick={() => setTypeFilter("all")} style={{ background: typeFilter === "all" ? "#F2A65A" : "#1F2238", color: typeFilter === "all" ? "#1B1D2E" : "#9B9BC0" }}>
              全部類型
            </span>
            {allTypes.map((t) => (
              <span key={t.id} className="chip" onClick={() => setTypeFilter(t.id)} style={{ background: typeFilter === t.id ? t.color : "#1F2238", color: typeFilter === t.id ? "#1B1D2E" : "#9B9BC0" }}>
                {t.emoji} {t.label}
              </span>
            ))}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginLeft: "auto", background: "#1F2238", color: "#F5EFE6", border: "1px solid #3A3E5C", borderRadius: 999, padding: "6px 10px", fontSize: 12.5 }}>
              <option value="updated">最近更新</option>
              <option value="rating">評分高到低</option>
              <option value="title">標題排序</option>
            </select>
          </div>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "#262A44", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #3A3E5C" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{form.id ? "編輯作品" : "新增作品"}</div>
              <X size={18} style={{ cursor: "pointer", color: "#9B9BC0" }} onClick={() => setShowForm(false)} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Icon + title */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <button
                    onClick={() => setShowIconPicker((v) => !v)}
                    style={{ width: 46, height: 46, borderRadius: 12, background: typeInfo(form.type).color, border: "none", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="更改圖示"
                  >
                    {form.icon || typeInfo(form.type).emoji}
                  </button>
                </div>
                <input className="field" placeholder="標題，例如：進擊的巨人" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ flex: 1 }} />
              </div>
              {showIconPicker && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "#1F2238", borderRadius: 10, padding: 8 }}>
                  {ICON_CHOICES.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setForm({ ...form, icon: e });
                        setIconTouched(true);
                      }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: form.icon === e ? "2px solid #F2A65A" : "2px solid transparent", background: "#262A44", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              {/* Type selector */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {allTypes.map((t) => (
                  <span key={t.id} className="chip" onClick={() => changeFormType(t.id)} style={{ background: form.type === t.id ? t.color : "#1F2238", color: form.type === t.id ? "#1B1D2E" : "#9B9BC0" }}>
                    {t.emoji} {t.label}
                    {!t.builtin && (
                      <span
                        className="type-x"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomType(t.id);
                        }}
                      >
                        <X size={9} color="#9B9BC0" />
                      </span>
                    )}
                  </span>
                ))}
                <span className="chip" onClick={() => setShowTypeCreator((v) => !v)} style={{ background: "transparent", border: "1px dashed #3A3E5C", color: "#9B9BC0" }}>
                  <Plus size={12} style={{ verticalAlign: -2 }} /> 自訂類型
                </span>
              </div>

              {showTypeCreator && (
                <div style={{ background: "#1F2238", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="field"
                      placeholder="類型名稱，例如：特攝"
                      value={newType.label}
                      onChange={(e) => setNewType({ ...newType, label: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <input
                      className="field"
                      placeholder="🏷️"
                      value={newType.emoji}
                      onChange={(e) => setNewType({ ...newType, emoji: e.target.value })}
                      style={{ width: 56, textAlign: "center" }}
                      maxLength={4}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {COLOR_SWATCHES.map((c) => (
                      <span
                        key={c}
                        onClick={() => setNewType({ ...newType, color: c })}
                        style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: newType.color === c ? "2px solid white" : "2px solid transparent" }}
                      />
                    ))}
                  </div>
                  <button onClick={createCustomType} style={{ alignSelf: "flex-start", padding: "7px 14px", borderRadius: 8, border: "none", background: "#F2A65A", color: "#1B1D2E", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                    建立類型
                  </button>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12.5, color: "#9B9BC0" }}>評分</span>
                <Stars value={form.rating} size={22} onChange={(v) => setForm({ ...form, rating: v })} />
              </div>

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.watched} onChange={(e) => setForm({ ...form, watched: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#5FD3C4" }} />
                  是否觀看過
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isMovie} onChange={(e) => setForm({ ...form, isMovie: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#F2A65A" }} />
                  劇場版／單篇作品（不分集）
                </label>
              </div>

              {!form.isMovie && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>進度單位（集／章／話...）</div>
                      <input className="field" placeholder={meta.unitDefault || "自訂單位"} value={form.progressUnit} onChange={(e) => setForm({ ...form, progressUnit: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>目前進度到第幾{form.progressUnit || ""}</div>
                      <input className="field" type="number" min="0" placeholder="12" value={form.progressValue} onChange={(e) => setForm({ ...form, progressValue: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>{meta.detailLabel}</div>
                      <input className="field" placeholder={meta.detailPlaceholder} value={form.progressDetail} onChange={(e) => setForm({ ...form, progressDetail: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>總{form.progressUnit || "數"}（選填）</div>
                      <input className="field" type="number" min="0" placeholder="24" value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {form.isMovie && (
                <div>
                  <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>觀看時長／備註（選填）</div>
                  <input className="field" placeholder="01:23:45" value={form.progressDetail} onChange={(e) => setForm({ ...form, progressDetail: e.target.value })} />
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: "#9B9BC0", marginBottom: 4 }}>觀後感</div>
                <textarea className="field" rows={3} placeholder="寫點感想吧..." value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} style={{ resize: "vertical" }} />
              </div>

              {/* Highlights */}
              <div style={{ borderTop: "1px solid #3A3E5C", paddingTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F2A65A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Star size={13} /> 精彩重播片段
                </div>
                {form.highlights.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {form.highlights.map((h) => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1F2238", borderRadius: 8, padding: "6px 10px" }}>
                        <span style={{ fontSize: 12, color: "#F2A65A", fontWeight: 700, whiteSpace: "nowrap" }}>{h.position}</span>
                        <span style={{ fontSize: 12, color: "#C7C6E0", flex: 1 }}>{h.title}</span>
                        <X size={13} style={{ cursor: "pointer", color: "#6E7196" }} onClick={() => removeHighlightFromForm(h.id)} />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="field" placeholder={highlightPlaceholder} value={newHighlight.position} onChange={(e) => setNewHighlight({ ...newHighlight, position: e.target.value })} style={{ flex: "0 0 40%" }} />
                  <input className="field" placeholder="精華標題，例如：勝利的戰爭" value={newHighlight.title} onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })} />
                  <button onClick={addHighlightToForm} style={{ border: "none", borderRadius: 10, background: "#3A3E5C", color: "#F5EFE6", padding: "0 12px", cursor: "pointer" }}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #3A3E5C", background: "transparent", color: "#9B9BC0", fontWeight: 700, cursor: "pointer" }}>
                  取消
                </button>
                <button onClick={saveForm} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#5FD3C4", color: "#1B1D2E", fontWeight: 900, cursor: "pointer" }}>
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {showShare && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowShare(false)}>
            <div style={{ width: "min(520px, 100%)", background: "#262A44", border: "1px solid #3A3E5C", borderRadius: 18, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>分享／匯入</div>
                <button onClick={() => setShowShare(false)} style={{ background: "transparent", border: "none", color: "#9B9BC0", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ background: "#1F2238", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 5 }}>分享我的觀看列表</div>
                <div style={{ fontSize: 12, color: "#9B9BC0", lineHeight: 1.6, marginBottom: 10 }}>
                  會包含作品、觀看進度、評分、心得與精彩重播。朋友匯入後會合併到自己的列表，不會清掉原本資料。
                </div>
                <button disabled={shareBusy} onClick={createShare} style={{ border: "none", borderRadius: 10, background: "#5FD3C4", color: "#1B1D2E", padding: "9px 13px", fontWeight: 900, cursor: shareBusy ? "wait" : "pointer" }}>
                  {shareBusy ? "建立中..." : "產生分享碼"}
                </button>
                {shareCode && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="field" readOnly value={shareCode} />
                    <button onClick={copyShareCode} style={{ border: "1px solid #3A3E5C", background: "#262A44", color: "#F5EFE6", borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "已複製" : "複製"}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ background: "#1F2238", borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 5 }}>輸入朋友的分享碼</div>
                <div style={{ fontSize: 12, color: "#9B9BC0", marginBottom: 10 }}>只會「加入」朋友的作品，不會覆蓋你自己的作品。</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field" placeholder="例如 ABCD7K2P" value={shareInput} onChange={(e) => setShareInput(e.target.value.toUpperCase())} />
                  <button disabled={shareBusy} onClick={importShare} style={{ border: "none", borderRadius: 10, background: "#F2A65A", color: "#1B1D2E", padding: "0 14px", fontWeight: 900, cursor: shareBusy ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Download size={15} /> 匯入
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <button onClick={exportBackup} style={{ border: "1px solid #3A3E5C", background: "transparent", color: "#9B9BC0", borderRadius: 9, padding: "7px 10px", cursor: "pointer", fontSize: 12 }}>
                  備份成 JSON
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: isSupabaseConfigured ? "#5FD3C4" : "#9B9BC0" }}>
                  {isSupabaseConfigured ? <Cloud size={14} /> : <CloudOff size={14} />}
                  {isSupabaseConfigured ? "雲端分享已啟用" : "尚未連接雲端"}
                </div>
              </div>
              {shareMessage && <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: "#1F2238", color: "#C7C6E0", fontSize: 12, lineHeight: 1.5 }}>{shareMessage}</div>}
            </div>
          </div>
        )}

        {/* Other people's list */}
        {currentPage === "friends" && (
          <div style={{ background: "#262A44", borderRadius: 16, border: "1px solid #313552", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, display: "flex", alignItems: "center", gap: 7 }}><UserRound size={18} /> 他人的觀看清單</div>
                <div style={{ fontSize: 11.5, color: "#9B9BC0", marginTop: 4 }}>分享碼：{friendShareCode || "尚未載入"}</div>
              </div>
              <button onClick={closeFriendList} title="關閉這份朋友清單" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #3A3E5C", background: "#1F2238", color: "#9B9BC0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={17} /></button>
            </div>

            {friendItems.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button onClick={toggleAllFriendItems} style={{ border: "1px solid #3A3E5C", borderRadius: 9, background: "#1F2238", color: "#C7C6E0", padding: "8px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckSquare size={14} /> {selectedFriendIds.size === friendItems.length ? "取消全選" : "全部選取"}
                </button>
                <button onClick={importSelectedFriendItems} style={{ border: "none", borderRadius: 9, background: "#5FD3C4", color: "#1B1D2E", padding: "8px 14px", cursor: "pointer", fontWeight: 900, fontSize: 12 }}>
                  加入我的清單{selectedFriendIds.size > 0 ? `（${selectedFriendIds.size}）` : ""}
                </button>
              </div>
            )}

            {friendMessage && <div style={{ background: "#1F2238", borderRadius: 9, padding: 10, marginBottom: 12, color: "#C7C6E0", fontSize: 12, lineHeight: 1.5 }}>{friendMessage}</div>}

            {friendItems.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6E7196", padding: "34px 0", fontSize: 13 }}>
                <Users size={20} style={{ marginBottom: 8 }} />
                <div>目前沒有載入朋友清單。</div>
                <div style={{ marginTop: 5 }}>按右上角「查看另一位朋友」輸入分享碼即可。</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {friendItems.map((it) => {
                  const t = friendTypeInfo(it.type);
                  const selected = selectedFriendIds.has(it.id);
                  const alreadyExists = items.some((mine) => (mine.title || "").trim().toLowerCase() === (it.title || "").trim().toLowerCase());
                  return (
                    <div key={it.id} style={{ background: "#1F2238", borderRadius: 12, border: selected ? "1px solid #5FD3C4" : "1px solid #313552", padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleFriendItem(it.id)} style={{ width: 18, height: 18, marginTop: 3, accentColor: "#5FD3C4", cursor: "pointer" }} />
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{it.icon || t.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900, fontSize: 14 }}>{it.title}</div>
                            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: it.watched ? "rgba(95,211,196,0.15)" : "rgba(242,114,111,0.15)", color: it.watched ? "#5FD3C4" : "#F2726F" }}>{it.watched ? "已看" : "未看"}</span>
                            {alreadyExists && <span style={{ fontSize: 10.5, color: "#5FD3C4" }}>✓ 你已有</span>}
                          </div>
                          <div style={{ marginTop: 4 }}><Stars value={it.rating} /></div>
                          <div style={{ fontSize: 11.5, color: "#9B9BC0", marginTop: 5 }}>{progressText(it)}</div>
                          {it.review && <div style={{ marginTop: 8, fontSize: 12.5, color: "#C7C6E0", lineHeight: 1.6 }}><strong style={{ color: "#F2A65A" }}>心得：</strong>{it.review}</div>}
                          {it.highlights?.length > 0 && (
                            <div style={{ marginTop: 8, background: "#262A44", borderRadius: 8, padding: 8 }}>
                              <div style={{ fontSize: 11.5, color: "#F2A65A", fontWeight: 800, marginBottom: 5 }}>⭐ 精彩重播</div>
                              {it.highlights.map((h) => <div key={h.id} style={{ fontSize: 11.5, color: "#C7C6E0", marginTop: 3 }}><span style={{ color: "#F2A65A", fontWeight: 700 }}>{h.position}</span> — {h.title}</div>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {currentPage === "home" && (
          filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6E7196", padding: "40px 0", fontSize: 13 }}>
            <Sparkles size={20} style={{ marginBottom: 8 }} />
            <div>還沒有作品，點右上角新增一部吧</div>
          </div>
        ) : viewMode === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((it) => {
              const t = typeInfo(it.type);
              const open = expandedIds.has(it.id);
              return (
                <div key={it.id} style={{ background: "#262A44", borderRadius: 12, border: "1px solid #313552", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }} onClick={() => toggleExpanded(it.id)}>
                    {open ? <ChevronDown size={15} color="#6E7196" /> : <ChevronRight size={15} color="#6E7196" />}
                    <span style={{ fontSize: 14 }}>{it.icon || t.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
                    <span style={{ fontSize: 11, color: "#9B9BC0", whiteSpace: "nowrap" }}>{progressText(it)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: it.watched ? "rgba(95,211,196,0.15)" : "rgba(242,114,111,0.15)", color: it.watched ? "#5FD3C4" : "#F2726F" }}>
                      {it.watched ? "已看" : "未看"}
                    </span>
                  </div>
                  {open && (
                    <div style={{ padding: "0 14px 14px 33px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <Stars value={it.rating} />
                      {it.review && <div style={{ fontSize: 12.5, color: "#C7C6E0", lineHeight: 1.5 }}>{it.review}</div>}
                      {it.highlights && it.highlights.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#F2A65A" }}>精彩重播</div>
                          {it.highlights.map((h) => (
                            <div key={h.id} style={{ fontSize: 12, color: "#C7C6E0" }}>
                              <span style={{ color: "#F2A65A", fontWeight: 700 }}>{h.position}</span> — {h.title}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        {!it.isMovie && (
                          <button onClick={() => bumpProgress(it.id)} className="row-btn" style={{ flex: 1, fontSize: 11.5, padding: "6px 0", justifyContent: "center" }}>
                            +1 {it.progressUnit || ""}
                          </button>
                        )}
                        <button onClick={() => openEdit(it)} className="row-btn" style={{ padding: "6px 10px", color: "#5FD3C4", flex: it.isMovie ? 1 : "none", justifyContent: "center" }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => removeItem(it.id)} className="row-btn" style={{ padding: "6px 10px", color: "#F2726F" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid-wrap">
            {visible.map((it) => {
              const t = typeInfo(it.type);
              const pct = !it.isMovie && it.totalUnits && Number(it.totalUnits) > 0 ? Math.min(100, Math.round(((Number(it.progressValue) || 0) / Number(it.totalUnits)) * 100)) : null;
              const hOpen = expandedHighlights.has(it.id);
              return (
                <div key={it.id} style={{ background: "#262A44", borderRadius: 16, overflow: "hidden", border: "1px solid #313552", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 0" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{it.icon || t.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                      <Stars value={it.rating} />
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: it.watched ? "rgba(95,211,196,0.15)" : "rgba(242,114,111,0.15)", color: it.watched ? "#5FD3C4" : "#F2726F", whiteSpace: "nowrap" }}>
                      {it.watched ? "已看過" : "未看過"}
                    </span>
                  </div>

                  <div className="sprocket" style={{ margin: "10px 14px 0" }}>
                    {Array.from({ length: 24 }).map((_, i) => <span key={i} />)}
                  </div>

                  <div style={{ padding: "8px 14px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {it.review && (
                      <div style={{ fontSize: 12.5, color: "#C7C6E0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.review}</div>
                    )}

                    <div style={{ fontSize: 12, color: "#9B9BC0", display: "flex", alignItems: "center", gap: 6 }}>
                      {it.isMovie ? <Film size={13} /> : <PlayCircle size={13} />} {progressText(it)}
                    </div>

                    {pct !== null && (
                      <div style={{ height: 6, borderRadius: 999, background: "#1F2238", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: t.color, borderRadius: 999 }} />
                      </div>
                    )}

                    {it.highlights && it.highlights.length > 0 && (
                      <div>
                        <div onClick={() => toggleHighlights(it.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#F2A65A", fontWeight: 700, cursor: "pointer" }}>
                          {hOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <Star size={12} /> 精彩重播（{it.highlights.length}）
                        </div>
                        {hOpen && (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {it.highlights.map((h) => (
                              <div key={h.id} style={{ fontSize: 11.5, color: "#C7C6E0" }}>
                                <span style={{ color: "#F2A65A", fontWeight: 700 }}>{h.position}</span> — {h.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {!it.isMovie && (
                        <button onClick={() => bumpProgress(it.id)} style={{ flex: 1, fontSize: 11.5, padding: "6px 0", borderRadius: 8, border: "1px solid #3A3E5C", background: "transparent", color: "#9B9BC0", cursor: "pointer" }}>
                          +1 {it.progressUnit || ""}
                        </button>
                      )}
                      <button onClick={() => openEdit(it)} style={{ flex: it.isMovie ? 1 : "none", padding: "6px 10px", borderRadius: 8, border: "1px solid #3A3E5C", background: "transparent", color: "#5FD3C4", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => removeItem(it.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #3A3E5C", background: "transparent", color: "#F2726F", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {visibleCount < filtered.length && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #3A3E5C", background: "#262A44", color: "#9B9BC0", cursor: "pointer", fontSize: 13 }}>
              顯示更多（還有 {filtered.length - visibleCount} 部）
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: "#4E527A", marginTop: 20, height: 14 }}>
          {saveState === "saving" ? "儲存中..." : saveState === "saved" ? "已儲存 ✓" : ""}
        </div>
      </div>
    </div>
  );
}
