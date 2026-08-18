import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import googleGIcon from "./assets/google-g-transparent.png";

import {
  Search,
  Plus,
  X,
  Trash2,
  Pencil,
  Sparkles,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Star,
  Film,
  Share2,
  Download,
  Copy,
  Check,
  RefreshCw,
  Home,
  Users,
  Settings,
  MessageCircle,
  ImagePlus,
  UserPlus,
  UserCheck,
  UserX,
  EyeOff,
  Building2,
  UserRound,
  Mail,
} from "lucide-react";

import {
  isSupabaseConfigured,
  createShareRow,
  getShareRow,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getCurrentUser,
  onAuthStateChange,
  updateUserNickname,
  updateAccountPrivacy,
  getProfile,
  ensureProfile,
  uploadProfileAvatar,
} from "./supabaseClient";

import {
  getCommunityPosts,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
  uploadCommunityImage,
  searchProfiles,
  sendFriendRequest,
  getFriendRequests,
  respondFriendRequest,
  getFriends,
  togglePostLike,
  getPostComments,
  addPostComment,
  sharePostWithFriend,
  toggleCommentLike,
  getDirectMessages,
  sendDirectMessage,
  toggleCloseFriend,
  recallDirectMessage,
  updateDirectMessage,
} from "./supabaseClient";

const STORAGE_KEY = "anime-watchlist-v3";
const PAGE_SIZE = 30;

const BUILTIN_TYPES = [
  { id: "anime", label: "動漫", emoji: "🎬", color: "#5FD3C4", builtin: true },
  { id: "novel", label: "小說", emoji: "📖", color: "#9B8CFF", builtin: true },
  { id: "drama", label: "連續劇", emoji: "📺", color: "#F2726F", builtin: true },
  { id: "series", label: "影集", emoji: "🎞️", color: "#6FA8DC", builtin: true },
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
    case "drama":
    case "series":
      return { unitDefault: "集", detailLabel: "時間（選填）", detailPlaceholder: "45:20", highlightPlaceholder: "第8集 12分15秒" };
    default:
      return { unitDefault: "", detailLabel: "備註（選填）", detailPlaceholder: "", highlightPlaceholder: "第12集 / 第3章..." };
  }
}

function emptyForm(defaultType) {
  return {
    id: null,
    title: "",
    coverUrl: "",
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

function CommentThread({ comments, onReply, onToggleLike }) {
  const commentsByParent = new Map();
  comments.forEach((comment) => {
    const parentId = comment.reply_to_id || "root";
    commentsByParent.set(parentId, [...(commentsByParent.get(parentId) || []), comment]);
  });
  const formatTime = (value) => new Date(value).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
  const renderComments = (parentId = "root", depth = 0) => (commentsByParent.get(parentId) || []).map((comment) => (
    <div key={comment.id} style={{ marginLeft: depth ? Math.min(depth, 3) * 22 : 0, padding: "5px 0 4px", paddingLeft: depth ? 10 : 0, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: "#444", display: "grid", placeItems: "center", flexShrink: 0 }}>
          {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}><span style={{ fontWeight: 400 }}>{comment.profiles?.nickname || "使用者"}</span><span style={{ color: "#AAA", fontSize: 10.5, fontWeight: 400 }}>{formatTime(comment.created_at)}</span></div>
          <div style={{ color: "#F5F5F5", marginTop: 0, whiteSpace: "pre-wrap", fontSize: 18, fontWeight: 400, textAlign: "left" }}>{comment.content}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "center" }}>
            <button onClick={() => onReply(comment)} style={{ border: 0, background: "transparent", color: "#B8B8B8", fontSize: 18, fontWeight: 400, lineHeight: 1.2, cursor: "pointer", padding: 0 }}>回覆</button>
            <button onClick={() => onToggleLike(comment)} style={{ border: 0, background: "transparent", color: comment.is_liked ? "#FFC21C" : "#B8B8B8", fontSize: 18, fontWeight: 400, lineHeight: 1.2, cursor: "pointer", padding: 0 }}>♥ {comment.like_count || 0}</button>
          </div>
        </div>
      </div>
      {renderComments(comment.id, depth + 1)}
    </div>
  ));
  return <div style={{ margin: "12px 0" }}>{renderComments()}</div>;
}

function CommunityPostCard({ post, canDelete, deleting, onDelete, onEdit, liked, onLike, onComment, friends, onShare, userId }) {
  const [revealed, setRevealed] = useState({});
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [replyToComment, setReplyToComment] = useState(null);
  const images = Array.isArray(post.community_images) ? post.community_images : [];
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  return (
    <article style={{ background: "#292929", border: "1px solid #444", borderRadius: 16, padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#444", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 12.5 }}>{profile?.nickname || "未命名使用者"}</div>
          <div style={{ color: "#AAA", fontSize: 10.5, marginTop: 2 }}>{new Date(post.created_at).toLocaleString("zh-TW")}</div>
        </div>
        {canDelete && (
          <div style={{ display: "flex", gap: 6 }}><button type="button" onClick={() => onEdit(post)} style={{ border: "1px solid #444", borderRadius: 8, background: "#000", color: "#F5EFE6", padding: "6px 8px", cursor: "pointer", fontSize: 11 }}>編輯</button><button type="button" onClick={() => onDelete(post)} disabled={deleting} aria-label="刪除貼文" style={{ border: "1px solid #5C3A47", borderRadius: 8, background: "#000", color: "#F2726F", padding: "6px 8px", cursor: deleting ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800 }}><Trash2 size={14} /> {deleting ? "刪除中" : "刪除"}</button></div>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 17, fontWeight: 900 }}>🎬 {post.work_title}</div>
      <div style={{ marginTop: 8, color: "#E5E5E5", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.content}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onLike(post.id)} style={{ border: "1px solid", borderColor: liked ? "#FFC21C" : "#444", borderRadius: 8, background: liked ? "#FFC21C" : "#000", color: liked ? "#111" : "#F5EFE6", padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>♥ {post.like_count || 0}</button>
        <button onClick={async () => { setShowComments(true); setComments(await getPostComments(post.id, userId)); }} style={{ border: "1px solid #444", borderRadius: 8, background: "#000", color: "#F5EFE6", padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>💬 {post.comment_count || 0}</button>
        <button onClick={() => setShowShare((value) => !value)} style={{ border: "1px solid #444", borderRadius: 8, background: "#000", color: "#F5EFE6", padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>↗ 分享</button>
      </div>
      {showShare && <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>{friends.length ? friends.map((friend) => <button key={friend.id} onClick={() => onShare(post.id, friend.id)} style={{ border: "1px solid #444", borderRadius: 999, background: "#000", color: "#F5EFE6", padding: "6px 10px", cursor: "pointer", fontSize: 11 }}>{friend.nickname || "好友"}</button>) : <span style={{ color: "#AAA", fontSize: 12 }}>尚無好友可分享。</span>}</div>}
      {showComments && <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div style={{ width: "min(620px,100%)", maxHeight: "80vh", overflow: "auto", background: "#242424", border: "1px solid #444", borderRadius: 16, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>留言 <button onClick={() => setShowComments(false)} style={{ border: 0, background: "transparent", color: "#FFF", cursor: "pointer" }}><X /></button></div><CommentThread comments={comments} onReply={setReplyToComment} onToggleLike={async (comment) => { const isLiked = await toggleCommentLike(comment.id, userId); setComments((previous) => previous.map((item) => item.id === comment.id ? { ...item, is_liked: isLiked, like_count: Math.max(0, (item.like_count || 0) + (isLiked ? 1 : -1)) } : item)); }} />{replyToComment && <div style={{ fontSize: 11, color: "#FFC21C", marginBottom: 5 }}>回覆 {replyToComment.profiles?.nickname || "使用者"} <button onClick={() => setReplyToComment(null)} style={{ border: 0, background: "transparent", color: "#AAA" }}>取消</button></div>}<div style={{ display: "flex", gap: 6 }}><input className="field" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="寫下留言" /><button onClick={async () => { const created = await onComment(post.id, commentText, replyToComment?.id); if (created) { setComments((previous) => [...previous, created]); setCommentText(""); setReplyToComment(null); } }} style={{ border: 0, borderRadius: 9, background: "#FFC21C", color: "#111", padding: "0 12px", fontWeight: 800 }}>送出</button></div></div></div>}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: images.length === 1 ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 12 }}>
          {images.map((image, index) => {
            const url = image.url || image.storage_path;
            const spoiler = !!image.is_spoiler;
            const show = revealed[image.id];
            return (
              <div key={image.id || index} style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#292929" }}>
                <img src={url} alt="社區圖片" style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "cover", filter: spoiler && !show ? "blur(32px)" : "none", transform: spoiler && !show ? "scale(1.08)" : "none" }} />
                {spoiler && !show && (
                  <button onClick={() => setRevealed((prev) => ({ ...prev, [image.id]: true }))} style={{ position: "absolute", inset: 0, border: 0, background: "rgba(20,22,35,.35)", color: "#F5EFE6", cursor: "pointer", fontWeight: 900, fontSize: 12 }}>
                    <EyeOff size={16} style={{ verticalAlign: -3, marginRight: 5 }} /> ⚠️ 防爆雷圖片｜點擊查看
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function AnimeWatchlist() {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [items, setItems] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);
  const [viewMode, setViewMode] = useState("list");
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
  const [showSplash, setShowSplash] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState("");
  const [accountPrivate, setAccountPrivate] = useState(false);
  const [profileRecord, setProfileRecord] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [categoryView, setCategoryView] = useState("all");
  const [currentPage, setCurrentPage] = useState("home");
  const [language, setLanguage] = useState(() => localStorage.getItem("anime-watchlist-language") || "zh-TW");
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityAudience, setCommunityAudience] = useState("public");
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityMessage, setCommunityMessage] = useState("");
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [communityWorkTitle, setCommunityWorkTitle] = useState("");
  const [communityContent, setCommunityContent] = useState("");
  const [communityFiles, setCommunityFiles] = useState([]);
  const [communitySpoilers, setCommunitySpoilers] = useState([]);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [editingCommunityPost, setEditingCommunityPost] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [likedPostIds, setLikedPostIds] = useState(() => new Set());
  const [friendTab, setFriendTab] = useState("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [closeFriendIds, setCloseFriendIds] = useState(() => new Set());
  const [friendLoading, setFriendLoading] = useState(false);
  const [chatFriendId, setChatFriendId] = useState("");
  const [chatTab, setChatTab] = useState("close");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("anime-watchlist-language", language);
  }, [language]);

  const allTypes = useMemo(() => [...BUILTIN_TYPES, ...customTypes], [customTypes]);
  const handleGoogleLogin = async () => {
  try {
    setAuthBusy(true);
    setAuthMessage("");
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
    setAuthMessage(`Google 登入失敗：${e.message || "請稍後再試"}`);
    setAuthBusy(false);
  }
};

const handleEmailAuth = async () => {
  const email = authEmail.trim();

  if (!email || !authPassword) {
    setAuthMessage("請輸入 Email 與密碼");
    return;
  }

  if (authPassword.length < 6) {
    setAuthMessage("密碼至少需要 6 個字元");
    return;
  }

  try {
    setAuthBusy(true);
    setAuthMessage("");

    if (authMode === "login") {
      await signInWithEmail(email, authPassword);
      setAuthMessage("登入成功！");
    } else {
      const result = await signUpWithEmail(email, authPassword);

      if (result?.user && !result?.session) {
        setAuthMessage("註冊成功！請到 Email 完成驗證後再登入。");
      } else {
        setAuthMessage("註冊成功！");
      }
    }
  } catch (e) {
    console.error(e);
    setAuthMessage(e.message || "登入失敗，請檢查帳號密碼");
  } finally {
    setAuthBusy(false);
  }
};

const handleLogout = async () => {
  try {
    await signOut();
    setUser(null);
  } catch (e) {
    console.error(e);
  }
};
const handleSaveNickname = async () => {
  try {
    setNicknameBusy(true);
    setNicknameMessage("");

    const updatedUser = await updateUserNickname(nickname);

    setUser(updatedUser);
    setNicknameMessage("暱稱已更新！");
  } catch (e) {
    console.error(e);
    setNicknameMessage(e.message || "暱稱更新失敗");
  } finally {
    setNicknameBusy(false);
  }
};

const handleAccountPrivacy = async (isPrivate) => {
  const confirmed = window.confirm(
    isPrivate
      ? "確定要將帳號設為私人嗎？其他使用者將無法預覽你的貼文。"
      : "確定要將帳號設為公開嗎？其他使用者將可以預覽你的公開貼文。"
  );
  if (!confirmed) return;

  try {
    await updateAccountPrivacy(isPrivate);
    setAccountPrivate(isPrivate);
    setNicknameMessage(isPrivate ? "帳號已設為私人。貼文只限好友預覽。" : "帳號已設為公開。");
  } catch (e) {
    console.error(e);
    setNicknameMessage(e.message || "隱私設定失敗；請確認已執行 Supabase SQL 腳本。");
  }
};

const handleAvatarFile = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !user) return;
  try {
    setAvatarBusy(true);
    const updatedProfile = await uploadProfileAvatar(user.id, file);
    setProfileRecord(updatedProfile);
    setNicknameMessage("頭像已更新！");
  } catch (error) {
    console.error(error);
    setNicknameMessage(error.message || "頭像上傳失敗");
  } finally {
    setAvatarBusy(false);
  }
};

  const typeInfo = useCallback(
    (id) => allTypes.find((t) => t.id === id) || BUILTIN_TYPES[3],
    [allTypes]
  );

  useEffect(() => {
  let mounted = true;

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();

      if (mounted) {
        setUser(currentUser);

setNickname(
  currentUser?.user_metadata?.nickname ||
  currentUser?.user_metadata?.full_name ||
  currentUser?.email?.split("@")[0] ||
  ""
);

if (currentUser) {
  try {
    await ensureProfile(currentUser);
    const profile = await getProfile(currentUser.id);
    if (mounted) { setProfileRecord(profile); setAccountPrivate(Boolean(profile?.is_private)); }
  } catch (profileError) {
    console.warn("建立個人資料失敗", profileError);
  }
}

setAuthLoading(false);
      }
    } catch (e) {
      console.error("登入狀態檢查失敗", e);

      if (mounted) {
        setUser(null);
        setAuthLoading(false);
      }
    }
  };

  checkAuth();

  const { data } = onAuthStateChange((event, session) => {
    if (!mounted) return;

    setUser(session?.user || null);
    setAuthLoading(false);
  });

  return () => {
    mounted = false;
    data?.subscription?.unsubscribe?.();
  };
}, []);

  useEffect(() => {
    (async () => {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value) {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed.items)) {
            // 舊版本的「漫畫」分類沒有刪掉作品：為了讓新版四大分類乾淨，舊漫畫會先歸到「其他」。
            const migrated = parsed.items.map((it) => it.type === "manga" ? { ...it, type: "other" } : it);
            setItems(migrated);
          }
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
  }, [search, watchedFilter, typeFilter, sortBy, categoryView]);

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
    if (categoryView !== "all") list = list.filter((it) => it.type === categoryView);
    else if (typeFilter !== "all") list = list.filter((it) => it.type === typeFilter);

    const sorted = [...list];
    if (sortBy === "rating") sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
    else sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sorted;
  }, [items, search, watchedFilter, typeFilter, sortBy, categoryView, typeInfo]);

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
      coverUrl: it.coverUrl || "",
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

  const handleCoverFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("請選擇圖片檔案。");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("封面圖片請小於 2 MB，以避免瀏覽器儲存空間不足。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, coverUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
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

  const openCategory = (id) => {
    setCurrentPage("home");
    setCategoryView(id);
    setTypeFilter("all");
    setWatchedFilter("all");
    setSearch("");
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
    try {
      if (code.startsWith("LOCAL-")) {
        const json = decodeURIComponent(escape(atob(code.slice(6))));
        const payload = JSON.parse(json);
        const imported = Array.isArray(payload.items) ? payload.items : [];
        const existingIds = new Set(items.map((x) => x.id));
        const merged = imported.map((x) => existingIds.has(x.id) ? { ...x, id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } : x);
        setItems((prev) => [...merged, ...prev]);
        if (Array.isArray(payload.customTypes)) {
          setCustomTypes((prev) => {
            const ids = new Set(prev.map((x) => x.id));
            return [...prev, ...payload.customTypes.filter((x) => !ids.has(x.id))];
          });
        }
        setShareMessage(`已匯入 ${merged.length} 部作品；原本的資料沒有被覆蓋。`);
      } else {
        if (!isSupabaseConfigured) throw new Error("尚未設定雲端資料庫");
        const data = await getShareRow(code);
        if (!data?.payload) throw new Error("找不到這組分享碼");
        const payload = data.payload;
        const imported = Array.isArray(payload.items) ? payload.items : [];
        const existingIds = new Set(items.map((x) => x.id));
        const merged = imported.map((x) => existingIds.has(x.id) ? { ...x, id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } : x);
        setItems((prev) => [...merged, ...prev]);
        if (Array.isArray(payload.customTypes)) {
          setCustomTypes((prev) => {
            const ids = new Set(prev.map((x) => x.id));
            return [...prev, ...payload.customTypes.filter((x) => !ids.has(x.id))];
          });
        }
        setShareMessage(`已匯入 ${merged.length} 部作品；你的原有資料保持不變。`);
      }
    } catch (e) {
      console.error(e);
      setShareMessage(`匯入失敗：${e.message || "請確認分享碼"}`);
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareCode = async () => {
    if (!shareCode) return;
    await navigator.clipboard?.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const loadCommunity = async (audience = communityAudience) => {
    if (!isSupabaseConfigured) {
      setCommunityMessage("尚未設定 Supabase，社區功能需要雲端資料庫。");
      return;
    }
    try {
      setCommunityLoading(true);
      setCommunityMessage("");
      setCommunityPosts(await getCommunityPosts({ audience, currentUserId: user?.id }));
    } catch (e) {
      console.error(e);
      setCommunityMessage(`社區載入失敗：${e.message || "請稍後再試"}`);
    } finally {
      setCommunityLoading(false);
    }
  };

  const openCommunity = async () => {
    setCurrentPage("community");
    setFriendTab("friends");
    await loadCommunity(communityAudience);
    await loadFriendsArea("friends");
  };

  const loadFriendsArea = async (tab = friendTab) => {
    if (!isSupabaseConfigured || !user) return;
    try {
      setFriendLoading(true);
      if (tab === "friends") setFriends(await getFriends(user.id));
      if (tab === "requests") setFriendRequests(await getFriendRequests(user.id));
    } catch (e) {
      console.error(e);
      setCommunityMessage(`好友資料載入失敗：${e.message || "請稍後再試"}`);
    } finally {
      setFriendLoading(false);
    }
  };

  const searchFriends = async () => {
    const q = friendSearch.trim();
    if (!q) {
      setFriendResults([]);
      return;
    }
    try {
      setFriendLoading(true);
      setFriendResults(await searchProfiles(q, user?.id));
    } catch (e) {
      console.error(e);
      setCommunityMessage(`搜尋好友失敗：${e.message || "請確認已執行 supabase-social-fixes.sql，並重新登入後再試。"}`);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleSendFriendRequest = async (profileId) => {
    try {
      setFriendLoading(true);
      await sendFriendRequest(user.id, profileId);
      setCommunityMessage("好友邀請已送出！");
      await searchFriends();
    } catch (e) {
      console.error(e);
      setCommunityMessage(`加好友失敗：${e.message || "請確認已執行 supabase-social-fixes.sql，並重新登入後再試。"}`);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleFriendRequest = async (requestId, status) => {
    try {
      setFriendLoading(true);
      await respondFriendRequest(requestId, status);
      await loadFriendsArea("requests");
      if (status === "accepted") await loadFriendsArea("friends");
    } catch (e) {
      console.error(e);
      setCommunityMessage(`好友邀請處理失敗：${e.message || "請稍後再試"}`);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCommunityFiles = (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    setCommunityFiles(files.slice(0, 6));
    setCommunitySpoilers(files.slice(0, 6).map(() => false));
  };

  const toggleCommunitySpoiler = (index) => {
    setCommunitySpoilers((prev) => prev.map((value, i) => (i === index ? !value : value)));
  };

  const submitCommunityPost = async () => {
    const workTitle = communityWorkTitle.trim();
    const content = communityContent.trim();
    if (!workTitle || !content) {
      setCommunityMessage("請先填寫作品名稱與心得內容。");
      return;
    }
    if (!isSupabaseConfigured || !user) {
      setCommunityMessage("請先登入並連接 Supabase。");
      return;
    }
    try {
      setCommunityBusy(true);
      setCommunityMessage("");
      const post = editingCommunityPost ? await updateCommunityPost(editingCommunityPost.id, user.id, workTitle, content) : await createCommunityPost(user.id, workTitle, content);
      for (let i = 0; i < communityFiles.length; i += 1) {
        await uploadCommunityImage(post.id, user.id, communityFiles[i], !!communitySpoilers[i]);
      }
      setCommunityWorkTitle("");
      setCommunityContent("");
      setCommunityFiles([]);
      setCommunitySpoilers([]);
      setShowCommunityForm(false);
      setEditingCommunityPost(null);
      setCommunityMessage(editingCommunityPost ? "文章已更新！" : "文章發布成功！");
      await loadCommunity();
    } catch (e) {
      console.error(e);
      setCommunityMessage(`發布失敗：${e.message || "請稍後再試"}`);
    } finally {
      setCommunityBusy(false);
    }
  };

  const handleEditCommunityPost = (post) => { setEditingCommunityPost(post); setCommunityWorkTitle(post.work_title); setCommunityContent(post.content); setShowCommunityForm(true); };

  const handleDeleteCommunityPost = async (post) => {
    if (!user || post.user_id !== user.id) return;
    if (!window.confirm("確定要刪除這篇貼文嗎？此操作無法復原。")) return;

    try {
      setDeletingPostId(post.id);
      setCommunityMessage("");
      await deleteCommunityPost(post.id, user.id);
      setCommunityPosts((previous) => previous.filter((item) => item.id !== post.id));
      setCommunityMessage("貼文已刪除。");
    } catch (error) {
      console.error(error);
      setCommunityMessage(`刪除貼文失敗：${error.message || "請稍後再試"}`);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handlePostLike = async (postId) => {
    if (!user) {
      setCommunityMessage("請先登入才能按讚。");
      return;
    }
    try {
      const liked = await togglePostLike(postId, user.id);
      setLikedPostIds((previous) => {
        const next = new Set(previous);
        if (liked) next.add(postId); else next.delete(postId);
        return next;
      });
      setCommunityPosts((previous) => previous.map((post) => post.id === postId ? { ...post, like_count: Math.max(0, (post.like_count || 0) + (liked ? 1 : -1)) } : post));
    } catch (error) {
      setCommunityMessage(`按讚失敗：${error.message || "請先執行社群互動 SQL"}`);
    }
  };

  const handlePostComment = async (postId, content, replyToId = null) => {
    if (!user || !content.trim()) return null;
    try {
      const created = await addPostComment(postId, user.id, content, replyToId);
      setCommunityPosts((previous) => previous.map((post) => post.id === postId ? { ...post, comment_count: (post.comment_count || 0) + 1 } : post));
      return created;
    } catch (error) {
      setCommunityMessage(`留言失敗：${error.message || "請先執行社群互動 SQL"}`);
      return null;
    }
  };

  const handlePostShare = async (postId, recipientId) => {
    if (!user) return;
    try {
      await sharePostWithFriend(postId, user.id, recipientId);
      setCommunityMessage("已分享給好友。");
    } catch (error) {
      setCommunityMessage(`分享失敗：${error.message || "請先執行社群互動 SQL"}`);
    }
  };

  const handleCloseFriend = async (friendId) => {
    try {
      const isClose = await toggleCloseFriend(user.id, friendId);
      setCloseFriendIds((previous) => { const next = new Set(previous); if (isClose) next.add(friendId); else next.delete(friendId); return next; });
    } catch (error) { setCommunityMessage(`設定摯友失敗：${error.message || "請稍後再試"}`); }
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleHighlights = (id) => {
    setExpandedHighlights((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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

  if (showSplash) {
    return (
      <>
        <style>{`
          .splash-screen {
            position: fixed; inset: 0; z-index: 99999;
            background: radial-gradient(circle at 50% 42%, #2A2F50 0%, #1B1D2E 42%, #11121D 100%);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            overflow: hidden; animation: splashFade 2.4s ease forwards;
          }
          .splash-screen::before {
            content: ""; position: absolute; width: 420px; height: 420px; border-radius: 50%;
            border: 1px solid rgba(95,211,196,.18);
            box-shadow: 0 0 80px rgba(95,211,196,.10), inset 0 0 80px rgba(242,166,90,.06);
            animation: splashRing 2.4s ease both;
          }
          .splash-screen::after {
            content: ""; position: absolute; width: 260px; height: 260px; border-radius: 50%;
            background: rgba(95,211,196,.07); filter: blur(30px);
            animation: splashGlow 2.4s ease both;
          }
          .splash-logo { position: relative; z-index: 1; font-size: 68px; line-height: 1;
            filter: drop-shadow(0 10px 25px rgba(0,0,0,.35));
            animation: splashPop .8s cubic-bezier(.2,.8,.2,1) both; }
          .splash-title { position: relative; z-index: 1; margin-top: 18px;
            font-family: 'Noto Sans TC', sans-serif; font-size: 30px; font-weight: 900;
            letter-spacing: 2px; color: #F5EFE6; animation: splashUp .8s .15s ease both; }
          .splash-title span { color: #F2A65A; }
          .splash-subtitle { position: relative; z-index: 1; margin-top: 7px; color: #9B9BC0;
            font-size: 11px; letter-spacing: 3px; animation: splashUp .8s .25s ease both; }
          .splash-loader { position: relative; z-index: 1; width: 190px; height: 4px; margin-top: 28px;
            background: #313552; border-radius: 999px; overflow: hidden; animation: splashUp .8s .3s ease both; }
          .splash-loader div { width: 42%; height: 100%;
            background: linear-gradient(90deg, #5FD3C4, #F2A65A); border-radius: inherit;
            animation: splashLoad 1.15s ease-in-out infinite; }
          .splash-hint { position: relative; z-index: 1; margin-top: 13px; color: #6E7196;
            font-size: 11px; letter-spacing: 1px; animation: splashUp .8s .4s ease both; }
          @keyframes splashPop {
            from { opacity: 0; transform: scale(.55) rotate(-8deg); }
            65% { opacity: 1; transform: scale(1.08) rotate(1deg); }
            to { opacity: 1; transform: scale(1) rotate(0); }
          }
          @keyframes splashUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes splashLoad { from { transform: translateX(-140%); } to { transform: translateX(340%); } }
          @keyframes splashRing {
            from { opacity: 0; transform: scale(.55); }
            55% { opacity: 1; transform: scale(1.04); }
            to { opacity: .72; transform: scale(1); }
          }
          @keyframes splashGlow {
            from { opacity: 0; transform: scale(.55); }
            50% { opacity: 1; transform: scale(1.12); }
            to { opacity: .55; transform: scale(1); }
          }
          @keyframes splashFade { 0%, 84% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
        `}</style>
        <div className="splash-screen">
        <div className="splash-logo">🎬</div>
        <div className="splash-title">追番手帳 <span>WATCHLIST</span></div>
        <div className="splash-subtitle">YOUR WATCH · YOUR STORY</div>
        <div className="splash-loader"><div /></div>
        <div className="splash-hint">正在開啟你的追番手帳</div>
      </div>
      </>
    );
  }

  if (authLoading) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1B1D2E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#F5EFE6",
        fontFamily: "'Noto Sans TC', sans-serif",
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 24,
          color: "#F2A65A",
          letterSpacing: 1,
        }}
      >
        CHECKING LOGIN...
      </div>
    </div>
  );
}

if (!user) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1B1D2E",
        color: "#F5EFE6",
        fontFamily: "'Noto Sans TC', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "#262A44",
          border: "1px solid #3A3E5C",
          borderRadius: 22,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 34,
              letterSpacing: 2,
            }}
          >
            追番手帳{" "}
            <span style={{ color: "#F2A65A" }}>
              WATCHLIST
            </span>
          </div>

          <div
            style={{
              color: "#9B9BC0",
              fontSize: 13,
              marginTop: 8,
            }}
          >
            登入你的帳號，開始管理自己的作品清單
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={authBusy}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 11,
            border: "1px solid #3A3E5C",
            background: "#F5EFE6",
            color: "#1B1D2E",
            fontWeight: 900,
            fontSize: 14,
            cursor: authBusy ? "wait" : "pointer",
            marginBottom: 16,
          }}
        >
          {authBusy ? "處理中..." : "🌐 使用 Google 登入"}
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "16px 0",
            color: "#6E7196",
            fontSize: 11,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#3A3E5C" }} />
          或使用 Email
          <div style={{ flex: 1, height: 1, background: "#3A3E5C" }} />
        </div>

        <input
          className="field"
          type="email"
          placeholder="Email"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          style={{ marginBottom: 8 }}
        />

        <input
          className="field"
          type="password"
          placeholder="密碼"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEmailAuth();
          }}
        />

        <button
          onClick={handleEmailAuth}
          disabled={authBusy}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "11px 14px",
            borderRadius: 11,
            border: "none",
            background: "#5FD3C4",
            color: "#1B1D2E",
            fontWeight: 900,
            cursor: authBusy ? "wait" : "pointer",
          }}
        >
          {authBusy
            ? "處理中..."
            : authMode === "login"
              ? "登入"
              : "註冊帳號"}
        </button>

        <button
          onClick={() => {
            setAuthMode((v) =>
              v === "login" ? "signup" : "login"
            );
            setAuthMessage("");
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 9,
            border: "none",
            background: "transparent",
            color: "#9B9BC0",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {authMode === "login"
            ? "還沒有帳號？註冊一個"
            : "已經有帳號？回到登入"}
        </button>

        {authMessage && (
          <div
            style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 9,
              background: "#1F2238",
              color: "#C7C6E0",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {authMessage}
          </div>
        )}
      </div>
    </div>
  );
}

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1B1D2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, color: "#F2A65A" }}>載入中...</div>
      </div>
    );
  }

  const meta = progressMeta(form.type);
  const highlightPlaceholder = form.isMovie ? "01:23:45" : meta.highlightPlaceholder;
  const isGoogleLogin = user?.app_metadata?.provider === "google" || user?.identities?.some((identity) => identity.provider === "google");

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: "#111", fontFamily: "'Noto Sans TC', sans-serif", color: "#F5EFE6", paddingBottom: 82 }}>
      {showAccount && (
  <div
    onClick={() => setShowAccount(false)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1200,
      background: "rgba(0,0,0,.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(420px, 100%)",
        background: "#151515",
        border: "1px solid #444",
        borderRadius: 20,
        padding: 22,
        boxShadow: "0 20px 60px rgba(0,0,0,.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 900 }}>
          👤 我的帳號
        </div>

        <button
          onClick={() => setShowAccount(false)}
          style={{
            border: 0,
            background: "transparent",
            color: "#B8B8B8",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div
        style={{
          background: "#292929",
          border: "1px solid #444",
          borderRadius: 13,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            color: "#A0A0A0",
            fontSize: 11,
            marginBottom: 5,
          }}
        >
          {isGoogleLogin ? "Google 登入" : "Email 登入"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, wordBreak: "break-all" }}>
          {isGoogleLogin ? <img src={googleGIcon} alt="Google" title="Google 登入" style={{ width: 23, height: 23, objectFit: "contain", display: "block", flexShrink: 0 }} /> : <Mail size={19} color="#FFC21C" strokeWidth={2} aria-label="Email 登入" />}
          <span>{user?.email || "未取得 Email"}</span>
        </div>
      </div>

      <div
        style={{
          color: "#B8B8B8",
          fontSize: 12,
          marginBottom: 7,
        }}
      >
        我的暱稱
      </div>

      <input
        className="field"
        value={nickname}
        maxLength={20}
        placeholder="輸入你的暱稱"
        onChange={(e) => setNickname(e.target.value)}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, padding: 12, border: "1px solid #444", borderRadius: 11, background: "#292929" }}>
        <span><strong>私人帳號</strong><br /><span style={{ color: "#B8B8B8", fontSize: 11 }}>開啟後，所有貼文僅限你與好友查看。</span></span>
        <button type="button" role="switch" aria-checked={accountPrivate} aria-label="切換私人帳號" onClick={() => handleAccountPrivacy(!accountPrivate)} style={{ position: "relative", flexShrink: 0, width: 46, height: 26, padding: 0, border: "1px solid", borderColor: accountPrivate ? "#FFC21C" : "#555", borderRadius: 999, background: accountPrivate ? "#FFC21C" : "#111", cursor: "pointer" }}>
          <span style={{ position: "absolute", top: 3, left: accountPrivate ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: accountPrivate ? "#111" : "#B8B8B8", transition: "left .18s ease" }} />
        </button>
      </div>

      <button
        onClick={handleSaveNickname}
        disabled={nicknameBusy}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "11px 14px",
          border: 0,
          borderRadius: 11,
          background: "#FFC21C",
          color: "#111",
          fontWeight: 900,
          cursor: nicknameBusy ? "wait" : "pointer",
        }}
      >
        {nicknameBusy ? "儲存中..." : "儲存"}
      </button>

      {nicknameMessage && (
        <div
          style={{
            marginTop: 10,
            color: "#B8B8B8",
            fontSize: 12,
          }}
        >
          {nicknameMessage}
        </div>
      )}

      <div
        style={{
          height: 1,
          background: "#3A3E5C",
          margin: "18px 0",
        }}
      />

      <button
        onClick={handleLogout}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: 11,
          border: "1px solid #F2726F",
          background: "transparent",
          color: "#F2726F",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        🚪 登出帳號
      </button>
    </div>
  </div>
)}
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
        .splash-screen { position: fixed; inset: 0; z-index: 9999; background: radial-gradient(circle at 50% 42%, #2A2F50 0%, #1B1D2E 42%, #11121D 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; animation: splashFade 2.2s ease forwards; }
        .splash-screen::before { content: ""; position: absolute; width: 420px; height: 420px; border-radius: 50%; border: 1px solid rgba(95,211,196,.14); box-shadow: 0 0 80px rgba(95,211,196,.08), inset 0 0 80px rgba(242,166,90,.05); animation: splashRing 2.2s ease both; }
        .splash-screen::after { content: ""; position: absolute; width: 260px; height: 260px; border-radius: 50%; background: rgba(95,211,196,.06); filter: blur(30px); animation: splashGlow 2.2s ease both; }
        .splash-logo { position: relative; z-index: 1; font-size: 64px; filter: drop-shadow(0 10px 25px rgba(0,0,0,.35)); animation: splashPop .8s cubic-bezier(.2,.8,.2,1) both; }
        .splash-title { position: relative; z-index: 1; margin-top: 14px; font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 2.5px; animation: splashUp .8s .15s ease both; }
        .splash-title span { color: #F2A65A; }
        .splash-subtitle { position: relative; z-index: 1; margin-top: 6px; color: #9B9BC0; font-size: 10px; letter-spacing: 3px; animation: splashUp .8s .25s ease both; }
        .splash-loader { position: relative; z-index: 1; width: 170px; height: 3px; margin-top: 26px; background: #313552; border-radius: 999px; overflow: hidden; animation: splashUp .8s .3s ease both; }
        .splash-loader div { width: 42%; height: 100%; background: linear-gradient(90deg, #5FD3C4, #F2A65A); border-radius: inherit; animation: splashLoad 1.15s ease-in-out infinite; }
        .splash-hint { position: relative; z-index: 1; margin-top: 12px; color: #6E7196; font-size: 10px; letter-spacing: 1px; animation: splashUp .8s .4s ease both; }
        @keyframes splashPop { from { opacity: 0; transform: scale(.55) rotate(-8deg); } 65% { opacity: 1; transform: scale(1.08) rotate(1deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes splashUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes splashLoad { from { transform: translateX(-140%); } to { transform: translateX(340%); } }
        @keyframes splashRing { from { opacity: 0; transform: scale(.65); } 55% { opacity: 1; transform: scale(1.03); } to { opacity: .7; transform: scale(1); } }
        @keyframes splashGlow { from { opacity: 0; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.1); } to { opacity: .55; transform: scale(1); } }
        @keyframes splashFade { 0%, 86% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
        .bottom-nav { position: fixed; z-index: 1000; left: 0; right: 0; bottom: 0; height: 70px; padding: 8px max(12px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-bottom)); display: flex; justify-content: space-around; background: rgba(12,12,12,.96); border-top: 1px solid #282828; }
        .bottom-nav button { flex: 1; max-width: 92px; border: 0; background: transparent; color: #898989; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 10px; cursor: pointer; }
        .bottom-nav button.active { color: #FFC21A; }
        .app-shell button { transition: background .16s ease, color .16s ease, border-color .16s ease; }
        .app-shell button:not(.bottom-nav button) { background: #000; color: #F5EFE6; border-color: #3C3C3C; }
        .app-shell button:disabled { opacity: .55; }
        .app-shell .field { background: #292929; border-color: #444; color: #F5EFE6; }
      `}</style>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 16px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 1.5, color: "#F5EFE6" }}>
              追番手帳 <span style={{ color: "#F2A65A" }}>WATCHLIST</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9B9BC0", marginTop: 2 }}>
              共 {items.length} 部・{items.filter((i) => i.watched).length} 部已看完
            </div>
          </div>
          {currentPage === "home" && <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", background: "#F2A65A", borderRadius: 10, padding: 3 }}>
              <button onClick={() => setViewMode("grid")} style={{ border: "none", borderRadius: 8, padding: "7px 10px", background: viewMode === "grid" ? "rgba(27,29,46,.18)" : "transparent", color: "#1B1D2E", cursor: "pointer", display: "flex" }} aria-label="卡片檢視">
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setViewMode("list")} style={{ border: "none", borderRadius: 8, padding: "7px 10px", background: viewMode === "list" ? "rgba(27,29,46,.18)" : "transparent", color: "#1B1D2E", cursor: "pointer", display: "flex" }} aria-label="精簡列表">
                <ListIcon size={15} />
              </button>
            </div>
            <button onClick={() => { setShowShare(true); setShareMessage(""); setShareCode(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFC21C", color: "#111", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              <Share2 size={15} /> 分享
            </button>
            <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFC21C", color: "#111", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
              <Plus size={16} /> 新增作品
            </button>
          </div>}
        </div>

        {currentPage === "home" && (
          <>
        {/* Category tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 2 }}>
          {[{ id: "all", label: "全部", emoji: "🏠" }, ...BUILTIN_TYPES.slice(0, 4)].map((t) => (
            <button key={t.id} onClick={() => openCategory(t.id)} style={{ flex: "0 0 auto", border: categoryView === t.id ? `1px solid ${t.color || "#5FD3C4"}` : "1px solid #2E3350", background: categoryView === t.id ? (t.color || "#5FD3C4") : "#171A2A", color: categoryView === t.id ? "#1B1D2E" : "#9B9BC0", borderRadius: 999, padding: "8px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ background: "#292929", border: "1px solid #444", borderRadius: 16, padding: 14, marginBottom: 16 }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#6E7196" }} />
            <input className="field" style={{ paddingLeft: 32 }} placeholder="搜尋作品、心得、精華、進度...（輸入 1～2 個字也可以）" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {[{ id: "all", label: "全部" }, { id: "watched", label: "已看過" }, { id: "unwatched", label: "未看過" }].map((f) => (
              <span key={f.id} className="chip" onClick={() => setWatchedFilter(f.id)} style={{ background: watchedFilter === f.id ? "#FFC21C" : "#000", border: "1px solid #444", color: watchedFilter === f.id ? "#111" : "#F5EFE6" }}>
                {f.label}
              </span>
            ))}
            {categoryView === "all" && <>
              <span style={{ width: 1, height: 18, background: "#444", margin: "0 2px" }} />
              <span className="chip" onClick={() => setTypeFilter("all")} style={{ background: typeFilter === "all" ? "#FFC21C" : "#000", border: "1px solid #444", color: typeFilter === "all" ? "#111" : "#F5EFE6" }}>
                全部類型
              </span>
              {allTypes.map((t) => (
                <span key={t.id} className="chip" onClick={() => setTypeFilter(t.id)} style={{ background: typeFilter === t.id ? "#FFC21C" : "#000", border: "1px solid #444", color: typeFilter === t.id ? "#111" : "#F5EFE6" }}>
                  {t.emoji} {t.label}
                </span>
              ))}
            </>}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginLeft: "auto", background: "#000", color: "#F5EFE6", border: "1px solid #444", borderRadius: 999, padding: "6px 10px", fontSize: 12.5 }}>
              <option value="updated">最近更新</option>
              <option value="rating">評分高到低</option>
              <option value="title">標題排序</option>
            </select>
          </div>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "#292929", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #444" }}>
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
                    style={{ width: 46, height: 46, borderRadius: 12, background: "#000", border: "1px solid #444", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="更改圖示"
                  >
                    {form.icon || typeInfo(form.type).emoji}
                  </button>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input className="field" placeholder="標題，例如：進擊的巨人" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px dashed #444", borderRadius: 10, padding: "8px 10px", background: "#000", color: "#F5EFE6", cursor: "pointer", fontSize: 12 }}>
                    <span>{form.coverUrl ? "已選擇封面圖片" : "從裝置加入封面圖片（選填）"}</span>
                    <span style={{ color: "#FFC21C", fontWeight: 800 }}>選擇圖片</span>
                    <input type="file" accept="image/*" onChange={handleCoverFile} style={{ display: "none" }} />
                  </label>
                  {form.coverUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={form.coverUrl} alt="封面預覽" style={{ width: 42, height: 56, borderRadius: 6, objectFit: "cover" }} />
                      <button type="button" onClick={() => setForm((current) => ({ ...current, coverUrl: "" }))} style={{ border: 0, background: "transparent", color: "#F2726F", cursor: "pointer", fontSize: 12 }}>移除封面</button>
                    </div>
                  )}
                </div>
              </div>
              {showIconPicker && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "#000", border: "1px solid #444", borderRadius: 10, padding: 8 }}>
                  {ICON_CHOICES.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setForm({ ...form, icon: e });
                        setIconTouched(true);
                      }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: form.icon === e ? "2px solid #FFC21C" : "2px solid #444", background: form.icon === e ? "#FFC21C" : "#000", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              {/* Type selector */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {allTypes.map((t) => (
                  <span key={t.id} className="chip" onClick={() => changeFormType(t.id)} style={{ background: form.type === t.id ? "#FFC21C" : "#000", border: "1px solid #444", color: form.type === t.id ? "#111" : "#F5EFE6" }}>
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
                <span className="chip" onClick={() => setShowTypeCreator((v) => !v)} style={{ background: "#000", border: "1px dashed #444", color: "#F5EFE6" }}>
                  <Plus size={12} style={{ verticalAlign: -2 }} /> 自訂類型
                </span>
              </div>

              {showTypeCreator && (
                <div style={{ background: "#000", border: "1px solid #444", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
                  <button onClick={createCustomType} style={{ alignSelf: "flex-start", padding: "7px 14px", borderRadius: 8, border: "none", background: "#FFC21C", color: "#111", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
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
                  <button onClick={addHighlightToForm} style={{ border: "1px solid #444", borderRadius: 10, background: "#000", color: "#F5EFE6", padding: "0 12px", cursor: "pointer" }}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #444", background: "#000", color: "#F5EFE6", fontWeight: 700, cursor: "pointer" }}>
                  取消
                </button>
                <button onClick={saveForm} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#FFC21C", color: "#111", fontWeight: 900, cursor: "pointer" }}>
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}

        {showShare && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowShare(false)}>
            <div style={{ width: "min(520px, 100%)", background: "#151515", border: "1px solid #444", borderRadius: 18, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>分享／匯入</div>
                <button onClick={() => setShowShare(false)} style={{ background: "transparent", border: "none", color: "#B8B8B8", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ background: "#292929", border: "1px solid #444", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 5 }}>分享我的觀看列表</div>
                <div style={{ fontSize: 12, color: "#B8B8B8", lineHeight: 1.6, marginBottom: 10 }}>
                  會包含作品、觀看進度、評分、心得與精彩重播。朋友匯入後會合併到自己的列表，不會清掉原本資料。
                </div>
                <button disabled={shareBusy} onClick={createShare} style={{ border: "none", borderRadius: 10, background: "#FFC21C", color: "#111", padding: "9px 13px", fontWeight: 900, cursor: shareBusy ? "wait" : "pointer" }}>
                  {shareBusy ? "建立中..." : "產生分享碼"}
                </button>
                {shareCode && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="field" readOnly value={shareCode} />
                    <button onClick={copyShareCode} style={{ border: "1px solid #444", background: "#000", color: "#F5EFE6", borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "已複製" : "複製"}
                    </button>
                  </div>
                )}
              </div>

                <div style={{ background: "#292929", border: "1px solid #444", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 5 }}>輸入朋友的分享碼</div>
                  <div style={{ fontSize: 12, color: "#B8B8B8", marginBottom: 10 }}>只會把朋友的作品加入你的清單，不會覆蓋原有資料。</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="field"
                      placeholder="例如 ABCD7K2P"
                      value={shareInput}
                      onChange={(e) => setShareInput(e.target.value.toUpperCase())}
                    />
                    <button
                      disabled={shareBusy}
                      onClick={importShare}
                      style={{ border: "none", borderRadius: 10, background: "#FFC21C", color: "#111", padding: "0 14px", fontWeight: 900, cursor: shareBusy ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Download size={15} /> 匯入
                    </button>
                  </div>
                </div>

                {shareMessage && (
                  <div style={{ marginTop: 10, padding: 10, border: "1px solid #444", borderRadius: 9, background: "#292929", color: "#F5EFE6", fontSize: 12, lineHeight: 1.5 }}>
                    {shareMessage}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* List */}
        {filtered.length === 0 ? (
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
                <div key={it.id} style={{ background: "#292929", border: "1px solid #444", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }} onClick={() => toggleExpanded(it.id)}>
                    {it.coverUrl ? <img src={it.coverUrl} alt="" style={{ width: 86, height: 112, borderRadius: 7, objectFit: "cover", background: "#222" }} /> : <div style={{ width: 86, height: 112, borderRadius: 7, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>{it.icon || t.emoji}</div>}
                    <div style={{ minWidth: 0, flex: 1, alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center", gap: 9 }}>
                      <span style={{ fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
                      <span style={{ fontSize: 14, color: "#B8B8B8", whiteSpace: "nowrap" }}>{progressText(it)}</span>
                      {!it.isMovie && it.totalUnits && Number(it.totalUnits) > 0 && <div style={{ height: 6, borderRadius: 999, background: "#333", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.round(((Number(it.progressValue) || 0) / Number(it.totalUnits)) * 100))}%`, background: "#FFC21A", borderRadius: 999 }} /></div>}
                    </div>
                    <Star size={22} color="#FFC21A" fill={it.rating ? "#FFC21A" : "none"} />
                  </div>
                  {open && (
                    <div style={{ padding: "0 14px 14px 33px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <Stars value={it.rating} />
                      {it.review && <div style={{ fontSize: 12.5, color: "#E5E5E5", lineHeight: 1.5 }}>{it.review}</div>}
                      {it.highlights && it.highlights.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#FFC21C" }}>精彩重播</div>
                          {it.highlights.map((h) => (
                            <div key={h.id} style={{ fontSize: 12, color: "#E5E5E5" }}>
                              <span style={{ color: "#FFC21C", fontWeight: 700 }}>{h.position}</span> — {h.title}
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
                        <button onClick={() => openEdit(it)} className="row-btn" style={{ padding: "6px 10px", color: "#FFC21C", flex: it.isMovie ? 1 : "none", justifyContent: "center" }}>
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
                <div key={it.id} style={{ background: "#292929", borderRadius: 16, overflow: "hidden", border: "1px solid #444", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 0" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "#000", border: "1px solid #444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{it.icon || t.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                      <Stars value={it.rating} />
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: it.watched ? "#FFC21C" : "#000", border: "1px solid", borderColor: it.watched ? "#FFC21C" : "#444", color: it.watched ? "#111" : "#F5EFE6", whiteSpace: "nowrap" }}>
                      {it.watched ? "已看過" : "未看過"}
                    </span>
                  </div>

                  <div className="sprocket" style={{ margin: "10px 14px 0" }}>
                    {Array.from({ length: 24 }).map((_, i) => <span key={i} />)}
                  </div>

                  <div style={{ padding: "8px 14px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {it.review && (
                      <div style={{ fontSize: 12.5, color: "#E5E5E5", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.review}</div>
                    )}

                    <div style={{ fontSize: 12, color: "#B8B8B8", display: "flex", alignItems: "center", gap: 6 }}>
                      {it.isMovie ? <Film size={13} /> : <PlayCircle size={13} />} {progressText(it)}
                    </div>

                    {pct !== null && (
                      <div style={{ height: 6, borderRadius: 999, background: "#000", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#FFC21C", borderRadius: 999 }} />
                      </div>
                    )}

                    {it.highlights && it.highlights.length > 0 && (
                      <div>
                        <div onClick={() => toggleHighlights(it.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#FFC21C", fontWeight: 700, cursor: "pointer" }}>
                          {hOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <Star size={12} /> 精彩重播（{it.highlights.length}）
                        </div>
                        {hOpen && (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {it.highlights.map((h) => (
                              <div key={h.id} style={{ fontSize: 11.5, color: "#E5E5E5" }}>
                                <span style={{ color: "#FFC21C", fontWeight: 700 }}>{h.position}</span> — {h.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {!it.isMovie && (
                        <button onClick={() => bumpProgress(it.id)} style={{ flex: 1, fontSize: 11.5, padding: "6px 0", borderRadius: 8, border: "1px solid #444", background: "#000", color: "#F5EFE6", cursor: "pointer" }}>
                          +1 {it.progressUnit || ""}
                        </button>
                      )}
                      <button onClick={() => openEdit(it)} style={{ flex: it.isMovie ? 1 : "none", padding: "6px 10px", borderRadius: 8, border: "1px solid #444", background: "#000", color: "#FFC21C", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => removeItem(it.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #5C3A47", background: "#000", color: "#F2726F", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleCount < filtered.length && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #444", background: "#000", color: "#F5EFE6", cursor: "pointer", fontSize: 13 }}>
              顯示更多（還有 {filtered.length - visibleCount} 部）
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: "#4E527A", marginTop: 20, height: 14 }}>
          {saveState === "saving" ? "儲存中..." : saveState === "saved" ? "已儲存 ✓" : ""}
        </div>
      </>
    )}

        {["community", "friends"].includes(currentPage) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{currentPage === "friends" ? "好友" : "🌐 社區"}</div>
                <div style={{ color: "#9B9BC0", fontSize: 12, marginTop: 4 }}>{currentPage === "friends" ? "我的好友、好友邀請與找好友。" : "分享作品、心得與圖片。"}</div>
              </div>
              {currentPage === "community" && <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCurrentPage("home")} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #444", borderRadius: 10, background: "#000", color: "#F5EFE6", padding: "9px 11px", cursor: "pointer" }}>
                  <Home size={14} /> 回主頁
                </button>
                <button onClick={loadCommunity} disabled={communityLoading} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #444", borderRadius: 10, background: "#000", color: "#F5EFE6", padding: "9px 11px", cursor: communityLoading ? "wait" : "pointer" }}>
                  <RefreshCw size={14} /> 重新整理
                </button>
                <button onClick={() => setShowCommunityForm((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, border: 0, borderRadius: 10, background: "#FFC21C", color: "#111", padding: "9px 13px", fontWeight: 900, cursor: "pointer" }}>
                  <Plus size={15} /> 發表文章
                </button>
              </div>}
            </div>

            {currentPage === "community" && (
              <div style={{ display: "flex", gap: 8, padding: 4, background: "#292929", border: "1px solid #444", borderRadius: 12 }}>
                {[
                  ["public", "公開社區"],
                  ["friends", "好友社區"],
                ].map(([audience, label]) => (
                  <button
                    key={audience}
                    onClick={() => { setCommunityAudience(audience); loadCommunity(audience); }}
                    disabled={communityLoading && communityAudience === audience}
                    style={{ flex: 1, padding: "10px 12px", border: "1px solid", borderColor: communityAudience === audience ? "#FFC21C" : "#444", borderRadius: 9, background: communityAudience === audience ? "#FFC21C" : "#000", color: communityAudience === audience ? "#111" : "#F5EFE6", fontWeight: 900, cursor: "pointer" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {currentPage === "community" && showCommunityForm && (
              <div style={{ background: "#292929", border: "1px solid #444", borderRadius: 16, padding: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>{editingCommunityPost ? "✏️ 編輯貼文" : "✍️ 發表心得"}</div>
                <input className="field" placeholder="作品名稱，例如：葬送的芙莉蓮" value={communityWorkTitle} onChange={(e) => setCommunityWorkTitle(e.target.value)} />
                <textarea className="field" rows={5} placeholder="分享你的心得、感想或推薦理由……" value={communityContent} onChange={(e) => setCommunityContent(e.target.value)} style={{ marginTop: 8, resize: "vertical" }} />
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", border: "1px solid #444", borderRadius: 9, background: "#000", color: "#F5EFE6", cursor: "pointer", fontSize: 12 }}>
                    <ImagePlus size={15} /> 加入圖片
                    <input type="file" accept="image/*" multiple onChange={handleCommunityFiles} style={{ display: "none" }} />
                  </label>
                  <span style={{ color: "#6E7196", fontSize: 11 }}>最多 6 張；圖片可個別設定防爆雷</span>
                </div>
                {communityFiles.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginTop: 10 }}>
                    {communityFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} style={{ background: "#000", border: "1px solid #444", borderRadius: 10, padding: 7, overflow: "hidden" }}>
                        <img src={URL.createObjectURL(file)} alt="預覽" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 7, filter: communitySpoilers[index] ? "blur(12px)" : "none" }} />
                        <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, color: communitySpoilers[index] ? "#FFC21C" : "#B8B8B8", fontSize: 11, cursor: "pointer" }}>
                          <input type="checkbox" checked={!!communitySpoilers[index]} onChange={() => toggleCommunitySpoiler(index)} /> ⚠️ 防爆雷
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowCommunityForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid #444", background: "#000", color: "#F5EFE6", cursor: "pointer" }}>取消</button>
                  <button disabled={communityBusy} onClick={submitCommunityPost} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: 0, background: "#FFC21C", color: "#111", fontWeight: 900, cursor: communityBusy ? "wait" : "pointer" }}>{communityBusy ? "發布中..." : "發布"}</button>
                </div>
              </div>
            )}

            {currentPage === "friends" && <div style={{ background: "#292929", border: "1px solid #444", borderRadius: 16, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  ["friends", "我的好友", UserCheck],
                  ["requests", "好友邀請", UserPlus],
                  ["search", "找好友", Search],
                ].map(([id, label, Icon]) => (
                  <button key={id} onClick={() => { setFriendTab(id); if (id !== "search") loadFriendsArea(id); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: "1px solid", borderColor: friendTab === id ? "#FFC21C" : "#444", borderRadius: 9, padding: "8px 6px", background: friendTab === id ? "#FFC21C" : "#000", color: friendTab === id ? "#111" : "#F5EFE6", cursor: "pointer", fontSize: 11.5, fontWeight: 800 }}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              {friendTab === "search" && (
                <div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="field" placeholder="輸入暱稱搜尋" value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchFriends()} />
                    <button onClick={searchFriends} style={{ border: 0, borderRadius: 9, background: "#FFC21C", color: "#111", padding: "0 14px", fontWeight: 900, cursor: "pointer" }}><Search size={15} /></button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
                    {friendResults.map((profile) => (
                      <div key={profile.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#1F2238", borderRadius: 9, padding: 9 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#3A3E5C", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                        <div style={{ flex: 1, fontWeight: 800, fontSize: 12 }}>{profile.nickname || "未命名使用者"}<div style={{ color: "#F2A65A", fontSize: 10, marginTop: 2 }}>{profile.friend_code ? `#${profile.friend_code}` : ""}</div></div>
                        <button onClick={() => handleSendFriendRequest(profile.id)} style={{ border: 0, borderRadius: 8, background: "#F2A65A", color: "#1B1D2E", padding: "6px 9px", fontWeight: 900, cursor: "pointer", fontSize: 11 }}><UserPlus size={13} /> 加好友</button>
                      </div>
                    ))}
                    {friendResults.length === 0 && <div style={{ color: "#6E7196", fontSize: 11.5, textAlign: "center", padding: 14 }}>搜尋暱稱即可找到其他使用者</div>}
                  </div>
                </div>
              )}
              {friendTab === "requests" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {friendRequests.map((request) => (
                    <div key={request.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#1F2238", borderRadius: 9, padding: 9 }}>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 12 }}>{request.requester?.nickname || "使用者"}</div><div style={{ color: "#6E7196", fontSize: 10.5, marginTop: 2 }}>想加你為好友</div></div>
                      <button onClick={() => handleFriendRequest(request.id, "accepted")} style={{ border: 0, borderRadius: 8, background: "#5FD3C4", color: "#1B2238", padding: "6px 9px", cursor: "pointer" }}><UserCheck size={14} /></button>
                      <button onClick={() => handleFriendRequest(request.id, "rejected")} style={{ border: "1px solid #3A3E5C", borderRadius: 8, background: "transparent", color: "#F2726F", padding: "6px 9px", cursor: "pointer" }}><UserX size={14} /></button>
                    </div>
                  ))}
                  {friendRequests.length === 0 && <div style={{ color: "#6E7196", fontSize: 11.5, textAlign: "center", padding: 14 }}>目前沒有新的好友邀請</div>}
                </div>
              )}
              {friendTab === "friends" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {friends.map((friend) => (
                    <div key={friend.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#1F2238", borderRadius: 9, padding: 9 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#3A3E5C", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                      <div style={{ flex: 1, fontWeight: 800, fontSize: 12 }}>{friend.nickname || "未命名使用者"}</div>
                      <button onClick={() => handleCloseFriend(friend.id)} style={{ border: 0, borderRadius: 8, background: closeFriendIds.has(friend.id) ? "#F2A65A" : "#3A3E5C", color: closeFriendIds.has(friend.id) ? "#111" : "#DDD", padding: "5px 7px", fontSize: 10, cursor: "pointer" }}>{closeFriendIds.has(friend.id) ? "摯友" : "設為摯友"}</button>
                      <UserCheck size={15} color="#5FD3C4" />
                    </div>
                  ))}
                  {friends.length === 0 && <div style={{ color: "#6E7196", fontSize: 11.5, textAlign: "center", padding: 14 }}>還沒有好友，去「找好友」開始吧</div>}
                </div>
              )}
            </div>}

            {currentPage === "community" && communityMessage && <div style={{ padding: 10, border: "1px solid #444", borderRadius: 9, background: "#292929", color: "#F5EFE6", fontSize: 12 }}>{communityMessage}</div>}

            {currentPage === "community" && friendTab === "friends" && (communityLoading || friendLoading) ? (
              <div style={{ textAlign: "center", color: "#6E7196", padding: 30 }}>載入中...</div>
            ) : currentPage === "community" && friendTab === "friends" && communityPosts.length === 0 ? (
              <div style={{ textAlign: "center", color: "#B8B8B8", padding: 50, background: "#292929", border: "1px solid #444", borderRadius: 16 }}>
                <MessageCircle size={28} style={{ marginBottom: 8 }} />
                <div>目前還沒有社區文章</div>
                <div style={{ fontSize: 11, marginTop: 5 }}>成為第一個分享心得的人吧！</div>
              </div>
            ) : currentPage === "community" && friendTab === "friends" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {communityPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    canDelete={post.user_id === user?.id}
                    deleting={deletingPostId === post.id}
                    onDelete={handleDeleteCommunityPost}
                    onEdit={handleEditCommunityPost}
                    liked={likedPostIds.has(post.id)}
                    onLike={handlePostLike}
                    onComment={handlePostComment}
                    friends={friends}
                    onShare={handlePostShare}
                    userId={user?.id}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
        {currentPage === "chat" && (
          <div style={{ background: "#151515", border: "1px solid #2B2B2B", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>聊天</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[["close", "摯友"], ["friends", "好友"], ["strangers", "陌生人"]].map(([id, label]) => <button key={id} onClick={() => { setChatTab(id); setChatFriendId(""); setChatMessages([]); }} style={{ flex: 1, padding: 9, borderRadius: 9, border: "1px solid", borderColor: chatTab === id ? "#FFC21C" : "#444", background: chatTab === id ? "#FFC21C" : "#000", color: chatTab === id ? "#111" : "#F5EFE6", fontWeight: 800 }}>{label}</button>)}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>{friends.filter((friend) => chatTab === "close" ? closeFriendIds.has(friend.id) : chatTab === "friends" ? !closeFriendIds.has(friend.id) : false).map((friend) => <button key={friend.id} onClick={async () => { setChatFriendId(friend.id); setChatMessages(await getDirectMessages(user.id, friend.id)); }} style={{ border: "1px solid #444", borderRadius: 999, padding: "7px 10px", background: chatFriendId === friend.id ? "#FFC21C" : "#000", color: chatFriendId === friend.id ? "#111" : "#F5EFE6" }}>{friend.nickname || "好友"}</button>)}{chatTab === "strangers" && <span style={{ color: "#AAA", fontSize: 12, padding: "7px 0" }}>尚無陌生人對話。</span>}</div>
            <div style={{ minHeight: 220, display: "flex", flexDirection: "column", gap: 7 }}>{chatMessages.map((message) => <div key={message.id} style={{ alignSelf: message.sender_id === user?.id ? "flex-end" : "flex-start", maxWidth: "78%" }}><div style={{ background: message.sender_id === user?.id ? "#FFC21C" : "#292929", color: message.sender_id === user?.id ? "#111" : "#FFF", padding: "8px 10px", borderRadius: 12 }}>{message.reply_to_id && <div style={{ marginBottom: 5, padding: "4px 6px", borderLeft: "2px solid currentColor", opacity: .72, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>回覆：{chatMessages.find((item) => item.id === message.reply_to_id)?.content || "原訊息已收回"}</div>}{message.recalled_at ? "訊息已收回" : message.content}{message.edited_at && "（已編輯）"}</div><div style={{ display: "flex", gap: 6, fontSize: 10, marginTop: 3 }}><button onClick={() => setReplyTo(message)} style={{ background: "transparent", border: 0, color: "#888" }}>回覆</button><button onClick={() => navigator.clipboard?.writeText(message.content)} style={{ background: "transparent", border: 0, color: "#888" }}>複製</button>{message.sender_id === user?.id && !message.recalled_at && <button onClick={async () => { const nextContent = window.prompt("編輯訊息", message.content); if (nextContent === null || !nextContent.trim()) return; const updated = await updateDirectMessage(message.id, nextContent); setChatMessages((items) => items.map((item) => item.id === message.id ? updated : item)); }} style={{ background: "transparent", border: 0, color: "#888" }}>編輯</button>}{message.sender_id === user?.id && !message.recalled_at && <button onClick={async () => { const updated = await recallDirectMessage(message.id); setChatMessages((items) => items.map((item) => item.id === message.id ? updated : item)); }} style={{ background: "transparent", border: 0, color: "#F2726F" }}>收回</button>}</div></div>)}{!chatFriendId && <div style={{ color: "#888", textAlign: "center", padding: "34px 0" }}>{chatTab === "strangers" ? "目前沒有陌生人對話。" : "選擇一位好友後，即可開始文字聊天。"}</div>}</div>
            {chatFriendId && <div style={{ marginTop: 10 }}><div style={{ display: "flex", gap: 7 }}><input className="field" value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder={replyTo ? `回覆：${replyTo.content}` : "輸入訊息"} onKeyDown={async (event) => { if (event.key === "Enter") { const sent = await sendDirectMessage(user.id, chatFriendId, chatText, replyTo?.id); if (sent) { setChatMessages((items) => [...items, sent]); setChatText(""); setReplyTo(null); } } }} /><button onClick={async () => { const sent = await sendDirectMessage(user.id, chatFriendId, chatText, replyTo?.id); if (sent) { setChatMessages((items) => [...items, sent]); setChatText(""); setReplyTo(null); } }} style={{ border: 0, borderRadius: 9, background: "#F2A65A", color: "#111", padding: "0 14px", fontWeight: 800 }}>送出</button></div>{replyTo && <button onClick={() => setReplyTo(null)} style={{ marginTop: 5, border: 0, background: "transparent", color: "#888", fontSize: 11 }}>取消回覆</button>}</div>}
          </div>
        )}
        {currentPage === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#151515", border: "1px solid #2B2B2B", borderRadius: 16, padding: 20, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", background: "#2A2A2A", overflow: "hidden", fontSize: 30 }}>{profileRecord?.avatar_url ? <img src={profileRecord.avatar_url} alt="個人頭像" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{nickname || "未命名使用者"}</div>
              <div style={{ color: "#FFC21A", marginTop: 4 }}>#{profileRecord?.friend_code || String(user?.id || "000000").replace(/[^0-9]/g, "").slice(-6).padStart(6, "0")}</div>
              <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 12, padding: "8px 12px", border: "1px solid #444", borderRadius: 9, background: "#000", color: "#F5EFE6", cursor: avatarBusy ? "wait" : "pointer", fontSize: 12, fontWeight: 800 }}>
                {avatarBusy ? "上傳中..." : "更換頭像"}
                <input type="file" accept="image/*" onChange={handleAvatarFile} disabled={avatarBusy} style={{ display: "none" }} />
              </label>
            </div>
            <div style={{ background: "#151515", border: "1px solid #2B2B2B", borderRadius: 16, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>好友列表（{friends.length}）</div>
              {friends.length ? friends.map((friend) => <div key={friend.id} style={{ padding: "9px 0", borderTop: "1px solid #282828" }}>{friend.nickname || "未命名使用者"}</div>) : <div style={{ color: "#888", fontSize: 13 }}>目前還沒有好友。</div>}
            </div>
          </div>
        )}
        {currentPage === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>設定</div>
            <div style={{ background: "#151515", border: "1px solid #2B2B2B", borderRadius: 16, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>語言</div>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="field"><option value="zh-TW">繁體中文</option><option value="en">English</option></select>
            </div>
            <button onClick={() => { setShowAccount(true); setNicknameMessage(""); }} style={{ padding: 12, border: "1px solid #444", borderRadius: 12, background: "#151515", color: "inherit", textAlign: "left", fontWeight: 800 }}>帳號與隱私設定</button>
          </div>
        )}
      </div>
      <nav className="bottom-nav" aria-label="主要導覽">
        <button className={currentPage === "home" ? "active" : ""} onClick={() => setCurrentPage("home")}><Home size={21} /><span>主頁</span></button>
        <button className={currentPage === "community" ? "active" : ""} onClick={openCommunity}><Building2 size={21} /><span>社區</span></button>
        <button className={currentPage === "chat" ? "active" : ""} onClick={() => { setCurrentPage("chat"); loadFriendsArea("friends"); }}><MessageCircle size={21} /><span>聊天</span></button>
        <button className={currentPage === "friends" ? "active" : ""} onClick={() => { setCurrentPage("friends"); setFriendTab("friends"); loadFriendsArea("friends"); }}><Users size={21} /><span>好友</span></button>
        <button className={currentPage === "profile" ? "active" : ""} onClick={() => { setCurrentPage("profile"); loadFriendsArea("friends"); }}><UserRound size={21} /><span>個人</span></button>
        <button className={currentPage === "settings" ? "active" : ""} onClick={() => setCurrentPage("settings")}><Settings size={21} /><span>設定</span></button>
      </nav>
    </div>
  );
}
