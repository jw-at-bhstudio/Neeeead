"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "../../components/AuthModal";
import {
  deleteMyCreature,
  getCurrentUser,
  listMyCreatures,
} from "../../lib/supabase/creatures";
import { Button } from "../../components/Button";
import brandPresetConfig from "../../brandPreset.json";
import { TRAIT_LEVEL_WORDS } from "../../utils/copywriting";

type MyCreature = {
  id: string;
  title: string;
  sound_mimic?: string;
  status: string;
  params: Record<string, number>;
  shape?: {
    pathData?: string;
  };
  eyes?: Array<{
    x: number;
    y: number;
  }>;
  created_at: string;
};

const STATUS_LABEL_MAP: Record<string, string> = {
  private_draft: "私有",
  public_pool: "在广场",
  archived: "已归档",
};

function getStatusLabel(status: string) {
  return STATUS_LABEL_MAP[status] ?? "私有";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function toBucket(value01: number) {
  return Math.min(5, Math.floor(clamp01(value01) * 6));
}

function getTendency(value01: number, left: string, right: string) {
  return value01 >= 0.5 ? right : left;
}

function getPathBounds(pathData: string) {
  const nums = pathData.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 2) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function getCardShapeFit(pathData: string, strokeWidth: number) {
  const bounds = getPathBounds(pathData);
  if (!bounds) {
    return { tx: 0, ty: 0, scale: 1 };
  }

  const frameSize = 1800;
  const padding = strokeWidth / 2 + 60;
  const totalWidth = bounds.width + padding * 2;
  const totalHeight = bounds.height + padding * 2;
  const scale = Math.min(frameSize / totalWidth, frameSize / totalHeight, 1);

  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;
  const frameCenter = frameSize / 2;

  return {
    tx: frameCenter - cx * scale,
    ty: frameCenter - cy * scale,
    scale,
  };
}

export default function MyPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyCreature[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MyCreature | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyCreature | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

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
    const rows = await listMyCreatures(80, user.id).catch(() => []);
    setItems(rows as unknown as MyCreature[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [items, query]);

  const handleComingSoon = (featureName: string) => {
    setMsg(`${featureName}开发中，敬请期待`);
  };

  const openDeleteDialog = (item: MyCreature) => {
    setDeleteTarget(item);
    setDeleteConfirmInput("");
    setMsg(null);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteConfirmInput("");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmInput.trim() !== deleteTarget.title) {
      setMsg("输入名称不一致，已取消回炉");
      return;
    }

    setDeletingId(deleteTarget.id);
    setMsg(null);
    try {
      await deleteMyCreature(deleteTarget.id);
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      if (activeItem?.id === deleteTarget.id) {
        setActiveItem(null);
      }
      setMsg("已回炉，数据已清理");
      closeDeleteDialog();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "回炉失败");
    } finally {
      setDeletingId(null);
    }
  };

  const detailData = useMemo(() => {
    if (!activeItem) return null;
    const params = activeItem.params ?? {};
    const numPoints = Number(params.numPoints ?? brandPresetConfig.vertices.min);
    const irregularity = Number(params.irregularity ?? brandPresetConfig.irregularity.min);
    const complexity = Number(params.complexity ?? brandPresetConfig.complexity.min);
    const roundness = Number(params.roundness ?? 0);
    const strokeOffset = Number(params.strokeOffset ?? brandPresetConfig.strokeOffset.min);

    const traits = {
      confidant: normalize(numPoints, brandPresetConfig.vertices.min, brandPresetConfig.vertices.max),
      actionStyle: normalize(irregularity, brandPresetConfig.irregularity.min, brandPresetConfig.irregularity.max),
      innerWorld: normalize(complexity, brandPresetConfig.complexity.min, brandPresetConfig.complexity.max),
      socialStyle: normalize(strokeOffset, brandPresetConfig.strokeOffset.min, brandPresetConfig.strokeOffset.max),
    };

    return {
      traits,
      traitLines: [
        `知己 / ${getTendency(traits.confidant, "少而精", "广而多")} - ${TRAIT_LEVEL_WORDS.confidant[toBucket(traits.confidant)]}`,
        `行事 / ${getTendency(traits.actionStyle, "计划派", "随性派")} - ${TRAIT_LEVEL_WORDS.actionStyle[toBucket(traits.actionStyle)]}`,
        `内心 / ${getTendency(traits.innerWorld, "简单纯粹", "丰富纠结")} - ${TRAIT_LEVEL_WORDS.innerWorld[toBucket(traits.innerWorld)]}`,
        `处世 / ${getTendency(traits.socialStyle, "坦率直接", "圆融周到")} - ${TRAIT_LEVEL_WORDS.socialStyle[toBucket(traits.socialStyle)]}`,
      ],
      ratios: [
        { label: "金", value: normalize(numPoints, brandPresetConfig.vertices.min, brandPresetConfig.vertices.max) },
        { label: "火", value: normalize(irregularity, brandPresetConfig.irregularity.min, brandPresetConfig.irregularity.max) },
        { label: "木", value: normalize(complexity, brandPresetConfig.complexity.min, brandPresetConfig.complexity.max) },
        { label: "水", value: clamp01(roundness) },
        { label: "土", value: normalize(strokeOffset, brandPresetConfig.strokeOffset.min, brandPresetConfig.strokeOffset.max) },
      ],
    };
  }, [activeItem]);

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6 text-text-muted">加载中...</main>;
  }

  if (!userEmail) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl text-text">我的盒子</h1>
        <p className="mt-2 text-text-muted">请先登录后查看和管理你的捏物</p>
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
      <p className="mt-2 text-lg text-text-muted">当前账号：{userEmail}</p>
      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索我的捏物标题"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-border sm:w-80"
        />
      </div>
      {msg && <p className="mt-2 text-lg text-primary">{msg}</p>}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="rounded-md border border-surface bg-surface/30 p-4 cursor-pointer hover:border-border transition-colors"
            onClick={() => setActiveItem(item)}
          >
            <div className="aspect-square rounded-md border border-border/40 bg-bg/40 flex items-center justify-center overflow-hidden">
              {item.shape?.pathData ? (
                <svg viewBox="0 0 1800 1800" className="h-full w-full">
                  {(() => {
                    const strokeWidth = Number(item.params?.strokeOffset ?? 360);
                    const fit = getCardShapeFit(item.shape.pathData, strokeWidth);
                    return (
                      <g transform={`translate(${fit.tx}, ${fit.ty}) scale(${fit.scale})`}>
                        <path
                          d={item.shape.pathData}
                          fill="var(--color-accent)"
                          stroke="var(--color-accent)"
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {(item.eyes ?? []).map((eye, index) => (
                          <circle
                            key={`eye-${index}`}
                            cx={eye.x}
                            cy={eye.y}
                            r={45}
                            fill="#000000"
                          />
                        ))}
                      </g>
                    );
                  })()}
                </svg>
              ) : (
                <span className="text-lg text-text-muted">暂无图形</span>
              )}
            </div>
            <p className="mt-3 truncate text-text">{item.title}</p>
            <p className="mt-1 text-lg text-text-muted">
              出生：{new Date(item.created_at).toLocaleString("zh-CN")}
            </p>
            <p className="mt-1 text-lg text-text-muted">状态：{getStatusLabel(item.status)}</p>

            <div className="mt-3 grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="secondary"
                className="text-lg px-2 opacity-60"
                onClick={() => handleComingSoon("修改功能")}
              >
                修改
              </Button>
              <Button
                variant="secondary"
                className="text-lg px-2 text-primary opacity-60"
                onClick={() => handleComingSoon("放生功能")}
              >
                放生
              </Button>
              <Button
                variant="secondary"
                className="text-lg px-2 text-alert"
                disabled={deletingId === item.id}
                onClick={() => openDeleteDialog(item)}
              >
                {deletingId === item.id ? "..." : "回炉"}
              </Button>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="text-text-muted">你还没有保存捏物，先去「捏只新的」</p>}
        {items.length > 0 && filteredItems.length === 0 && (
          <p className="text-text-muted">没有匹配的结果，试试换个关键词</p>
        )}
      </div>

      {activeItem && detailData && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 lg:p-8 backdrop-blur-sm">
          <div className="mx-auto h-full max-w-3xl overflow-y-auto rounded-lg border border-surface bg-bg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl text-text">{activeItem.title}</h2>
              <button
                onClick={() => setActiveItem(null)}
                className="text-2xl text-text-muted hover:text-text transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="rounded-md border border-border/40 bg-bg/40 p-3">
              <p className="text-lg text-text-muted">声音：{activeItem.sound_mimic || "哇呜"}</p>
              <p className="mt-1 text-lg text-text-muted">
                出生：{new Date(activeItem.created_at).toLocaleString("zh-CN")}
              </p>
              <p className="mt-1 text-lg text-text-muted">状态：{getStatusLabel(activeItem.status)}</p>
            </div>

            <div className="rounded-md border border-surface p-3 space-y-1">
              <p className="text-text">物种习性（四维）</p>
              {detailData.traitLines.map((line) => (
                <p key={line} className="text-lg text-text-muted">
                  {line}
                </p>
              ))}
            </div>

            <div className="rounded-md border border-surface p-3">
              <p className="text-text mb-2">金木水火土配方比例（0~1）</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {detailData.ratios.map((ratio) => (
                  <div key={ratio.label} className="rounded border border-border/50 px-2 py-1">
                    <p className="text-lg text-text-muted">
                      {ratio.label}：{ratio.value.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/80 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-24 w-full max-w-lg rounded-lg border border-surface bg-bg p-5 space-y-4">
            <h3 className="text-2xl text-text">确认回炉</h3>
            <p className="text-lg text-text-muted">
              删除后不可恢复。请输入捏物名称「{deleteTarget.title}」确认删除。
            </p>
            <input
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="请输入捏物名称"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-border"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={closeDeleteDialog}
                disabled={deletingId === deleteTarget.id}
              >
                取消
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={handleDeleteConfirm}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? "处理中..." : "确认回炉"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
