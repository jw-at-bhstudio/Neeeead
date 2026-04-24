import { supabase } from "./client";
import type { Database, Json } from "./database.types";

type CreatureInsert = Database["public"]["Tables"]["creatures"]["Insert"];
type CreatureRow = Database["public"]["Tables"]["creatures"]["Row"];

function isMissingSoundMimicColumnError(error: any) {
  return error?.code === "42703" || error?.message?.includes("sound_mimic");
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  // In unauthenticated state Supabase can return AuthSessionMissingError.
  // This is expected for guests and should be treated as "no user".
  if (error) {
    if (error.name === "AuthSessionMissingError" || error.message?.includes("Auth session missing")) {
      return null;
    }
    throw error;
  }
  return data.user;
}

export async function saveMyCreatureDraft(input: {
  title: string;
  sound_mimic: string;
  seed: number;
  params?: Json;
  shape?: Json;
  eyes?: Json;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const normalizedTitle = input.title.trim();
  if (!normalizedTitle) throw new Error("名字不能为空");
  if (normalizedTitle.length > 20) throw new Error("名字不能超过20个字");

  // Validate title uniqueness
  const creaturesTable = supabase.from("creatures" as any);
  const { data: existingTitle, error: existingTitleError } = await creaturesTable
    .select("id")
    .eq("title", normalizedTitle)
    .maybeSingle();
  if (existingTitleError) {
    throw new Error("保存失败：暂时无法检查重名，请稍后再试");
  }
  if (existingTitle) throw new Error(`名字「${normalizedTitle}」已被别人使用，请换一个吧`);

  const payload: any = {
    creator_id: user.id,
    owner_id: user.id,
    title: normalizedTitle,
    sound_mimic: input.sound_mimic,
    status: "private_draft",
    seed: input.seed,
    params: input.params ?? {},
    shape: input.shape ?? {},
    eyes: input.eyes ?? [],
  };

  let { data, error } = await creaturesTable.insert(payload).select().single();
  if (error && isMissingSoundMimicColumnError(error)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.sound_mimic;
    const fallback = await creaturesTable.insert(legacyPayload).select().single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    if (error.code === '23505') {
      if (error.message?.includes('uq_creatures_title')) {
        throw new Error(`名字「${normalizedTitle}」已被别人使用，请换一个吧`);
      }
      if (error.message?.includes('idx_creatures_unique_params')) {
        throw new Error("这个形态的捏物已经存在了，请调整一下参数或重新随机生成");
      }
    }
    if (isMissingSoundMimicColumnError(error)) {
      throw new Error("保存失败：数据库字段未更新，请先执行最新 migration（需要包含 sound_mimic 字段）");
    }
    if (error.code === '42501') {
      throw new Error("保存失败：当前账号没有写入权限，请重新登录后重试");
    }
    if (error.code === 'PGRST301' || error.message?.includes("JWT")) {
      throw new Error("保存失败：登录状态已过期，请重新登录");
    }
    throw error;
  }
  return data as unknown as CreatureRow;
}

export async function listPublicCreatures(limit = 24) {
  const creaturesTable = supabase.from("creatures" as any);
  const { data, error } = await creaturesTable
    .select("*")
    .eq("status", "public_pool")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as CreatureRow[];
}

export async function listMyCreatures(limit = 50, ownerId?: string) {
  const resolvedOwnerId =
    ownerId ??
    (await getCurrentUser()
      .then((user) => user?.id ?? null)
      .catch(() => null));
  if (!resolvedOwnerId) return [];

  const creaturesTable = supabase.from("creatures" as any);
  let { data, error } = await creaturesTable
    .select("id,title,sound_mimic,status,params,shape,eyes,created_at,updated_at")
    .eq("owner_id", resolvedOwnerId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error && isMissingSoundMimicColumnError(error)) {
    const fallback = await creaturesTable
      .select("id,title,status,params,shape,eyes,created_at,updated_at")
      .eq("owner_id", resolvedOwnerId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    data = (fallback.data ?? []).map((item: any) => ({
      ...item,
      sound_mimic: "哇呜",
      eyes: Array.isArray(item?.eyes) ? item.eyes : [],
    }));
    error = fallback.error;
  }

  if (error) throw error;
  return (data ?? []) as unknown as CreatureRow[];
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateMyCreatureStatus(
  creatureId: string,
  status: "private_draft" | "public_pool"
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const creaturesTable = supabase.from("creatures" as any);
  const { data, error } = await creaturesTable
    .update({ status } as any)
    .eq("id", creatureId)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as CreatureRow;
}

export async function updateMyCreatureTitle(creatureId: string, title: string, sound_mimic: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const nextTitle = title.trim();
  if (!nextTitle) throw new Error("标题不能为空");
  if (nextTitle.length > 20) throw new Error("标题不能超过20个字");
  const nextSound = sound_mimic.trim() || '哇呜';

  const creaturesTable = supabase.from("creatures" as any);
  let { data, error } = await creaturesTable
    .update({ title: nextTitle, sound_mimic: nextSound } as any)
    .eq("id", creatureId)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error && isMissingSoundMimicColumnError(error)) {
    const fallback = await creaturesTable
      .update({ title: nextTitle } as any)
      .eq("id", creatureId)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    data = fallback.data
      ? (Object.assign({}, fallback.data as any, {
          sound_mimic: (fallback.data as any)?.sound_mimic ?? nextSound,
        }) as any)
      : fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === '23505' && error.message?.includes('uq_creatures_title')) {
      throw new Error(`名字「${nextTitle}」已被别人使用，请换一个吧`);
    }
    throw error;
  }
  return data as unknown as CreatureRow;
}

export async function deleteMyCreature(creatureId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const creaturesTable = supabase.from("creatures" as any);
  const { error } = await creaturesTable.delete().eq("id", creatureId).eq("owner_id", user.id);

  if (error) throw error;
}

export async function releaseMyCreature(creatureId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const creaturesTable = supabase.from("creatures" as any);
  // Release means setting owner_id to null and making it public
  const { data, error } = await creaturesTable
    .update({ owner_id: null, status: "public_pool" } as any)
    .eq("id", creatureId)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as CreatureRow;
}
