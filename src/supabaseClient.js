import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;


// ============================================================
// 基本工具
// ============================================================

function requireSupabase() {
  if (!supabase) {
    throw new Error("尚未設定 Supabase，請確認 .env.local");
  }

  return supabase;
}


// ============================================================
// 分享功能
// ============================================================

export async function createShareRow(shareCode, payload) {
  const client = requireSupabase();

  const { error } = await client
    .from("watchlist_shares")
    .insert({
      share_code: shareCode,
      payload,
    });

  if (error) {
    throw error;
  }
}


export async function getShareRow(shareCode) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("watchlist_shares")
    .select("payload")
    .eq("share_code", shareCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}


// ============================================================
// 登入功能
// ============================================================

// Google 登入
export async function signInWithGoogle() {
  const client = requireSupabase();

  const { data, error } =
    await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

  if (error) {
    throw error;
  }

  return data;
}


// Email / 密碼登入
export async function signInWithEmail(email, password) {
  const client = requireSupabase();

  const { data, error } =
    await client.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}


// Email / 密碼註冊
export async function signUpWithEmail(email, password) {
  const client = requireSupabase();

  const { data, error } =
    await client.auth.signUp({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}


// 登出
export async function signOut() {
  if (!supabase) {
    return;
  }

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}


// 取得目前登入使用者
export async function getCurrentUser() {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}


// 監聽登入 / 登出
export function onAuthStateChange(callback) {
  if (!supabase) {
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    };
  }

  return supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
}


// ============================================================
// 使用者暱稱
// ============================================================

export async function updateUserNickname(nickname) {
  const client = requireSupabase();

  const value = String(nickname || "").trim();

  if (!value) {
    throw new Error("暱稱不能為空");
  }

  if (value.length > 30) {
    throw new Error("暱稱最多 30 個字");
  }

  const { data, error } =
    await client.auth.updateUser({
      data: {
        nickname: value,
      },
    });

  if (error) {
    throw error;
  }

  if (data?.user?.id) {
    const { error: profileError } =
      await client
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            nickname: value,
          },
          {
            onConflict: "id",
          }
        );

    if (profileError) {
      throw profileError;
    }
  }

  return data.user;
}

export async function updateAccountPrivacy(isPrivate) {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();

  if (!user?.id) {
    throw new Error("請先登入");
  }

  const { error } = await client
    .from("profiles")
    .update({ is_private: Boolean(isPrivate) })
    .eq("id", user.id);

  if (error) {
    throw error;
  }
}

export async function getProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("id, nickname, avatar_url, friend_code, is_private").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadProfileAvatar(userId, file) {
  const client = requireSupabase();
  if (!userId || !file) throw new Error("請先選擇頭像圖片");
  if (!String(file.type || "").startsWith("image/")) throw new Error("請選擇圖片檔案");
  if (file.size > 5 * 1024 * 1024) throw new Error("頭像圖片不可超過 5MB");

  const safeName = String(file.name || "avatar.png").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = String(userId) + "/" + String(Date.now()) + "-" + safeName;
  const { error: uploadError } = await client.storage
    .from("profile-avatars")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage.from("profile-avatars").getPublicUrl(path);
  const avatarUrl = publicUrlData?.publicUrl;
  if (!avatarUrl) throw new Error("無法取得頭像網址");

  const { data, error } = await client
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("id, nickname, avatar_url, friend_code, is_private")
    .single();
  if (error) throw error;
  return data;
}


// ============================================================
// 社區 / 好友
// ============================================================

// 確保使用者有 profile
export async function ensureProfile(user) {
  if (!supabase || !user?.id) {
    return null;
  }

  const nickname =
    user.user_metadata?.nickname ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "使用者";

  const avatarUrl =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  const { data, error } =
    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nickname,
          avatar_url: avatarUrl,
        },
        {
          onConflict: "id",
        }
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getProfilesByIds(client, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await client
    .from("profiles")
    .select("id, nickname, avatar_url, is_private")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((profile) => [profile.id, profile]));
}


// =========================
// 取得社區文章
// =========================

export async function getCommunityPosts({ audience = "public", currentUserId } = {}) {
  if (!supabase) {
    throw new Error("尚未設定 Supabase");
  }

  const client = requireSupabase();

  const { data: posts, error: postsError } = await client
    .from("community_posts")
    .select(
      "id, user_id, work_title, content, created_at, updated_at"
    )
    .order("created_at", {
      ascending: false,
    });

  if (postsError) {
    throw postsError;
  }

  const profilesById = await getProfilesByIds(
    client,
    (posts || []).map((post) => post.user_id)
  );
  let friendUserIds = new Set();

  if (currentUserId) {
    const { data: relationships, error: relationshipError } = await client
      .from("friendships")
      .select("user_a, user_b")
      .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`);

    if (relationshipError) {
      throw relationshipError;
    }

    friendUserIds = new Set(
      (relationships || []).map((row) => row.user_a === currentUserId ? row.user_b : row.user_a)
    );
  }

  const visiblePosts = (posts || []).filter((post) => {
    if (audience === "friends") {
      return friendUserIds.has(post.user_id);
    }

    return post.user_id !== currentUserId
      && !friendUserIds.has(post.user_id)
      && !profilesById.get(post.user_id)?.is_private;
  });
  const postIds = visiblePosts.map((post) => post.id);
  let images = [];

  if (postIds.length) {
    const { data, error } = await client
      .from("community_images")
      .select("id, post_id, user_id, storage_path, is_spoiler, created_at")
      .in("post_id", postIds);

    if (error) {
      throw error;
    }

    images = data || [];
  }

  const imagesByPostId = new Map();
  for (const image of images) {
    const postImages = imagesByPostId.get(image.post_id) || [];
    postImages.push(image);
    imagesByPostId.set(image.post_id, postImages);
  }

  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    client.from("community_post_likes").select("post_id").in("post_id", postIds),
    client.from("community_post_comments").select("post_id").in("post_id", postIds),
  ]);
  if (likesError) throw likesError;
  if (commentsError) throw commentsError;
  const likeCounts = new Map();
  const commentCounts = new Map();
  (likes || []).forEach((row) => likeCounts.set(row.post_id, (likeCounts.get(row.post_id) || 0) + 1));
  (comments || []).forEach((row) => commentCounts.set(row.post_id, (commentCounts.get(row.post_id) || 0) + 1));

  return Promise.all(visiblePosts.map(async (post) => {
    const postImages = await Promise.all((imagesByPostId.get(post.id) || []).map(async (image) => {
      let url = image.storage_path || "";

      if (!url.startsWith("http")) {
        const { data: signedUrlData, error: signedUrlError } = await client.storage
          .from("community-images")
          .createSignedUrl(image.storage_path, 60 * 60);

        if (signedUrlError) {
          throw signedUrlError;
        }

        url = signedUrlData?.signedUrl || "";
      }

      return {
        ...image,
        url,
      };
    }));

    return {
      ...post,
      profiles: profilesById.get(post.user_id) || null,
      community_images: postImages,
      like_count: likeCounts.get(post.id) || 0,
      comment_count: commentCounts.get(post.id) || 0,
    };
  }));
}

// ============================================================
// 建立社區文章
// ============================================================

export async function createCommunityPost(
  userId,
  workTitle,
  content
) {
  const client = requireSupabase();

  if (!userId) {
    throw new Error("找不到登入使用者");
  }

  const title =
    String(workTitle || "").trim();

  const text =
    String(content || "").trim();

  if (!title) {
    throw new Error("請輸入作品名稱");
  }

  if (!text) {
    throw new Error("請輸入分享內容");
  }

  if (title.length > 100) {
    throw new Error("作品名稱最多 100 個字");
  }

  if (text.length > 5000) {
    throw new Error("分享內容最多 5000 個字");
  }

  const { data, error } =
    await client
      .from("community_posts")
      .insert({
        user_id: userId,
        work_title: title,
        content: text,
      })
      .select(`
        id,
        user_id,
        work_title,
        content,
        created_at,
        updated_at
      `)
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCommunityPost(postId, userId, workTitle, content) {
  const client = requireSupabase();
  const { data, error } = await client.from("community_posts").update({ work_title: String(workTitle).trim(), content: String(content).trim(), updated_at: new Date().toISOString() }).eq("id", postId).eq("user_id", userId).select("id, user_id, work_title, content, created_at, updated_at").single();
  if (error) throw error;
  return data;
}

// =========================
// 刪除自己的社區文章
// =========================

export async function deleteCommunityPost(postId, userId) {
  const client = requireSupabase();

  if (!postId || !userId) {
    throw new Error("缺少貼文或使用者資訊");
  }

  const { data: images, error: imagesError } = await client
    .from("community_images")
    .select("storage_path")
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (imagesError) {
    throw imagesError;
  }

  const paths = (images || []).map((image) => image.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await client.storage
      .from("community-images")
      .remove(paths);

    if (storageError) {
      console.warn("無法清除貼文圖片檔案", storageError);
    }
  }

  const { error: imageDeleteError } = await client
    .from("community_images")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (imageDeleteError) {
    throw imageDeleteError;
  }

  const { data: deletedPost, error: postDeleteError } = await client
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (postDeleteError) {
    throw postDeleteError;
  }

  if (!deletedPost) {
    throw new Error("找不到貼文，或你沒有刪除它的權限");
  }
}

export async function togglePostLike(postId, userId) {
  const client = requireSupabase();
  const { data: existing, error: lookupError } = await client.from("community_post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await client.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from("community_post_likes").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  return true;
}

export async function getPostComments(postId, currentUserId = null) {
  const client = requireSupabase();
  const { data, error } = await client.from("community_post_comments").select("id, user_id, content, reply_to_id, created_at").eq("post_id", postId).order("created_at", { ascending: true });
  if (error) throw error;
  const profiles = await getProfilesByIds(client, (data || []).map((comment) => comment.user_id));
  const commentIds = (data || []).map((comment) => comment.id);
  let likes = [];
  if (commentIds.length) {
    const { data: likeRows, error: likesError } = await client
      .from("community_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);
    if (likesError) throw likesError;
    likes = likeRows || [];
  }
  const likeCounts = new Map();
  const likedIds = new Set();
  likes.forEach((like) => {
    likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) || 0) + 1);
    if (like.user_id === currentUserId) likedIds.add(like.comment_id);
  });
  return (data || []).map((comment) => ({
    ...comment,
    profiles: profiles.get(comment.user_id) || null,
    like_count: likeCounts.get(comment.id) || 0,
    is_liked: likedIds.has(comment.id),
  }));
}

export async function addPostComment(postId, userId, content, replyToId = null) {
  const client = requireSupabase();
  const text = String(content || "").trim();
  if (!text) return null;
  const { data, error } = await client.from("community_post_comments").insert({ post_id: postId, user_id: userId, content: text, reply_to_id: replyToId }).select("id, user_id, content, reply_to_id, created_at").single();
  if (error) throw error;
  const profiles = await getProfilesByIds(client, [userId]);
  return { ...data, profiles: profiles.get(userId) || null, like_count: 0, is_liked: false };
}

export async function toggleCommentLike(commentId, userId) {
  const client = requireSupabase();
  const { data: existing, error } = await client.from("community_comment_likes").select("comment_id").eq("comment_id", commentId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (existing) { const { error: removeError } = await client.from("community_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId); if (removeError) throw removeError; return false; }
  const { error: insertError } = await client.from("community_comment_likes").insert({ comment_id: commentId, user_id: userId });
  if (insertError) throw insertError;
  return true;
}

export async function sharePostWithFriend(postId, senderId, recipientId) {
  const client = requireSupabase();
  const { error } = await client.from("community_post_shares").insert({ post_id: postId, sender_id: senderId, recipient_id: recipientId });
  if (error) throw error;
}

export async function getDirectMessages(userId, friendId) {
  const client = requireSupabase();
  const { data, error } = await client.from("direct_messages").select("id, sender_id, recipient_id, content, reply_to_id, created_at, edited_at, recalled_at").or(`and(sender_id.eq.${userId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${userId})`).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendDirectMessage(senderId, recipientId, content, replyToId = null) {
  const client = requireSupabase();
  const text = String(content || "").trim();
  if (!text) return null;
  const { data, error } = await client.from("direct_messages").insert({ sender_id: senderId, recipient_id: recipientId, content: text, reply_to_id: replyToId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDirectMessage(messageId, content) {
  const client = requireSupabase();
  const { data, error } = await client.from("direct_messages").update({ content: String(content).trim(), edited_at: new Date().toISOString() }).eq("id", messageId).select().single();
  if (error) throw error;
  return data;
}

export async function recallDirectMessage(messageId) {
  const client = requireSupabase();
  const { data, error } = await client.from("direct_messages").update({ recalled_at: new Date().toISOString(), content: "" }).eq("id", messageId).select().single();
  if (error) throw error;
  return data;
}


// =========================
// 上傳社區圖片
// =========================

export async function uploadCommunityImage(
  postId,
  userId,
  file,
  isSpoiler = false
) {
  if (!supabase) {
    throw new Error("尚未設定 Supabase");
  }

  if (!file) {
    return null;
  }

  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );

  const path =
    String(userId) +
    "/" +
    String(postId) +
    "/" +
    String(Date.now()) +
    "-" +
    safeName;

  const { error: uploadError } =
    await supabase.storage
      .from("community-images")
      .upload(
        path,
        file,
        {
          upsert: false,
          contentType: file.type,
        }
      );

  if (uploadError) {
    throw new Error(
      "圖片上傳失敗：" +
        uploadError.message +
        "（請確認 Storage 已建立 community-images bucket）"
    );
  }

  const {
    data: imageRow,
    error: rowError,
  } = await supabase
    .from("community_images")
    .insert({
      post_id: postId,
      user_id: userId,
      storage_path: path,
      is_spoiler: isSpoiler,
    })
    .select(
      "id, post_id, user_id, storage_path, is_spoiler, created_at"
    )
    .single();

  if (rowError) {
    throw rowError;
  }

  const publicUrl =
    supabase.storage
      .from("community-images")
      .getPublicUrl(path)
      .data.publicUrl;

  return {
    ...imageRow,
    url: publicUrl,
  };
}


// =========================
// 搜尋使用者
// =========================

export async function searchProfiles(
  query,
  currentUserId
) {
  if (!supabase) {
    throw new Error("尚未設定 Supabase");
  }

  const keyword = String(query || "").trim();

  if (!keyword) {
    return [];
  }

  let request = supabase.from("profiles").select("id, nickname, avatar_url, friend_code");
  if (keyword.startsWith("#")) {
    request = request.eq("friend_code", keyword.slice(1));
  } else {
    request = request.ilike("nickname", "%" + keyword + "%");
  }
  const { data, error } = await request.neq("id", currentUserId).limit(20);

  if (error) {
    throw error;
  }

  return data || [];
}


// ============================================================
// 發送好友邀請
// ============================================================

export async function sendFriendRequest(
  requesterId,
  recipientId
) {
  const client = requireSupabase();

  if (
    !requesterId ||
    !recipientId ||
    requesterId === recipientId
  ) {
    throw new Error(
      "無法對自己發送好友邀請"
    );
  }

  // 檢查是否已經存在好友關係
  const {
    data: friendship,
    error: friendshipError,
  } = await client
    .from("friendships")
    .select("id")
    .or(
      `and(user_a.eq.${requesterId},user_b.eq.${recipientId}),and(user_a.eq.${recipientId},user_b.eq.${requesterId})`
    )
    .limit(1);

  if (friendshipError) {
    throw friendshipError;
  }

  if (friendship?.length) {
    throw new Error("你們已經是好友");
  }

  // 檢查待處理邀請
  const {
    data: existing,
    error: existingError,
  } = await client
    .from("friend_requests")
    .select(
      "id, requester_id, recipient_id, status"
    )
    .or(
      `and(requester_id.eq.${requesterId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${requesterId})`
    )
    .in(
      "status",
      [
        "pending",
        "accepted",
      ]
    )
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existing?.length) {
    if (existing[0].status === "accepted") {
      throw new Error("你們已經是好友");
    }

    throw new Error(
      "你們已經有待處理的好友邀請"
    );
  }

  const { data, error } =
    await client
      .from("friend_requests")
      .insert({
        requester_id: requesterId,
        recipient_id: recipientId,
        status: "pending",
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}


// ============================================================
// 取得好友邀請
// ============================================================

export async function getFriendRequests(
  userId
) {
  const client = requireSupabase();

  if (!userId) {
    return [];
  }

  const { data: requests, error } =
    await client
      .from("friend_requests")
      .select("id, requester_id, recipient_id, status, created_at")
      .eq(
        "recipient_id",
        userId
      )
      .eq(
        "status",
        "pending"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  const profilesById = await getProfilesByIds(
    client,
    (requests || []).map((request) => request.requester_id)
  );

  return (requests || []).map((request) => ({
    ...request,
    requester: profilesById.get(request.requester_id) || null,
  }));
}


// ============================================================
// 接受 / 拒絕好友邀請
// ============================================================

export async function respondFriendRequest(
  requestId,
  status
) {
  const client = requireSupabase();

  if (
    ![
      "accepted",
      "rejected",
    ].includes(status)
  ) {
    throw new Error(
      "無效的好友邀請狀態"
    );
  }

  const {
    data: request,
    error: requestError,
  } = await client
    .from("friend_requests")
    .update({
      status,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      requestId
    )
    .select(
      "id, requester_id, recipient_id, status"
    )
    .single();

  if (requestError) {
    throw requestError;
  }

  // 接受好友後建立 friendships
  if (status === "accepted") {
    const {
      data: existingFriendship,
      error:
        existingFriendshipError,
    } = await client
      .from("friendships")
      .select("id")
      .or(
        `and(user_a.eq.${request.requester_id},user_b.eq.${request.recipient_id}),and(user_a.eq.${request.recipient_id},user_b.eq.${request.requester_id})`
      )
      .limit(1);

    if (existingFriendshipError) {
      throw existingFriendshipError;
    }

    if (!existingFriendship?.length) {
      const {
        error: friendshipError,
      } = await client
        .from("friendships")
        .insert({
          user_a:
            request.requester_id,
          user_b:
            request.recipient_id,
        });

      if (friendshipError) {
        throw friendshipError;
      }
    }
  }

  return request;
}


// ============================================================
// 取得好友列表
// ============================================================

export async function getFriends(
  userId
) {
  const client = requireSupabase();

  if (!userId) {
    return [];
  }

  const { data, error } =
    await client
      .from("friendships")
      .select(
        "id, user_a, user_b"
      )
      .or(
        `user_a.eq.${userId},user_b.eq.${userId}`
      );

  if (error) {
    throw error;
  }

  const friendIds =
    (data || []).map(
      (row) =>
        row.user_a === userId
          ? row.user_b
          : row.user_a
    );

  if (!friendIds.length) {
    return [];
  }

  const {
    data: profiles,
    error: profileError,
  } = await client
    .from("profiles")
    .select(
      "id, nickname, avatar_url"
    )
    .in(
      "id",
      friendIds
    );

  if (profileError) {
    throw profileError;
  }

  return profiles || [];
}

export async function toggleCloseFriend(userId, friendId) {
  const client = requireSupabase();
  const { data, error } = await client.from("friendships").select("id, close_friend_user_ids").or(`and(user_a.eq.${userId},user_b.eq.${friendId}),and(user_a.eq.${friendId},user_b.eq.${userId})`).maybeSingle();
  if (error) throw error;
  const ids = new Set(data?.close_friend_user_ids || []);
  if (ids.has(userId)) ids.delete(userId); else ids.add(userId);
  const { error: updateError } = await client.from("friendships").update({ close_friend_user_ids: [...ids] }).eq("id", data.id);
  if (updateError) throw updateError;
  return ids.has(userId);
}
