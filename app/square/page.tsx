"use client";

import { useEffect, useState } from "react";
import { listPublicCreatures } from "../../lib/supabase/creatures";

type PublicCreature = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function SquarePage() {
  const [items, setItems] = useState<PublicCreature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublicCreatures(60)
      .then((rows) => setItems(rows as unknown as PublicCreature[]))
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl text-text">盒子广场</h1>
      <p className="mt-2 text-sm text-text-muted">公开捏物只读浏览</p>

      {loading && <p className="mt-6 text-text-muted">加载中...</p>}
      {error && <p className="mt-6 text-red-300">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-md border border-surface bg-surface/30 p-4">
              <p className="truncate text-text">{item.title}</p>
              <p className="mt-1 text-xs text-text-muted">状态：{item.status}</p>
              <p className="mt-1 text-xs text-text-muted">
                创建于：{new Date(item.created_at).toLocaleString("zh-CN")}
              </p>
            </article>
          ))}
          {items.length === 0 && <p className="text-text-muted">广场还没有公开捏物。</p>}
        </div>
      )}
    </main>
  );
}
