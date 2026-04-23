"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "../../components/AuthModal";
import {
  getCurrentUser,
  listMyCreatures,
  updateMyCreatureStatus,
} from "../../lib/supabase/creatures";
import { Button } from "../../components/Button";

type MyCreature = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function MyPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyCreature[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const user = await getCurrentUser().catch(() => null);
    if (!user) {
      setUserEmail(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setUserEmail(user.email ?? null);
    const rows = await listMyCreatures(80).catch(() => []);
    setItems(rows as unknown as MyCreature[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleTogglePublish = async (item: MyCreature) => {
    const nextStatus = item.status === "public_pool" ? "private_draft" : "public_pool";
    const nextLabel = nextStatus === "public_pool" ? "已发布到广场" : "已撤回为私有";

    setUpdatingId(item.id);
    setMsg(null);
    try {
      await updateMyCreatureStatus(item.id, nextStatus);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row))
      );
      setMsg(nextLabel);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6 text-text-muted">加载中...</main>;
  }

  if (!userEmail) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl text-text">我的盒子</h1>
        <p className="mt-2 text-text-muted">请先登录后查看和管理你的捏物。</p>
        <Button className="mt-4" onClick={() => setAuthOpen(true)}>
          登录/注册
        </Button>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={load} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl text-text">我的盒子</h1>
      <p className="mt-2 text-sm text-text-muted">当前账号：{userEmail}</p>
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-surface bg-surface/30 p-4">
            <p className="truncate text-text">{item.title}</p>
            <p className="mt-1 text-xs text-text-muted">状态：{item.status}</p>
            <p className="mt-1 text-xs text-text-muted">
              创建于：{new Date(item.created_at).toLocaleString("zh-CN")}
            </p>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              disabled={updatingId === item.id}
              onClick={() => handleTogglePublish(item)}
            >
              {updatingId === item.id
                ? "处理中..."
                : item.status === "public_pool"
                ? "撤回私有"
                : "发布到广场"}
            </Button>
          </article>
        ))}
        {items.length === 0 && <p className="text-text-muted">你还没有保存捏物，先去「捏只新的」。</p>}
      </div>
    </main>
  );
}
