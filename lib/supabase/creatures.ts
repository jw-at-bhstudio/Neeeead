import { supabase } from "./client";
import type { Database, Json } from "./database.types";

type CreatureInsert = Database["public"]["Tables"]["creatures"]["Insert"];
type CreatureRow = Database["public"]["Tables"]["creatures"]["Row"];

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
  title?: string;
  seed: number;
  params?: Json;
  shape?: Json;
  eyes?: Json;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreatureInsert = {
    creator_id: user.id,
    owner_id: user.id,
    title: input.title ?? "未命名捏物",
    status: "private_draft",
    seed: input.seed,
    params: input.params ?? {},
    shape: input.shape ?? {},
    eyes: input.eyes ?? [],
  };

  // Temporary cast: this project uses hand-written DB types.
  // Replace with generated Supabase types later for full generic inference.
  const creaturesTable = supabase.from("creatures" as any);
  const { data, error } = await creaturesTable.insert(payload as any).select().single();
  if (error) throw error;
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

export async function listMyCreatures(limit = 50) {
  const user = await getCurrentUser();
  if (!user) return [];

  const creaturesTable = supabase.from("creatures" as any);
  const { data, error } = await creaturesTable
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

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
