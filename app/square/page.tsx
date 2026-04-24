"use client";

import { featureFlags } from "../../lib/featureFlags";

export default function SquarePage() {
  if (!featureFlags.enableSquare) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl text-text">盒子广场</h1>
        <p className="mt-2 text-lg text-text-muted">该功能当前未开启</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 min-h-[70vh] flex flex-col">
      <h1 className="text-2xl text-text">盒子广场</h1>
      <div className="flex-1 mt-6 rounded-lg border border-surface bg-surface/20 flex flex-col items-center justify-center gap-4">
        <svg viewBox="0 0 120 120" className="w-36 h-36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M20 35 L60 20 L100 35 L60 50 Z"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M20 35 L20 80 L60 100 L60 50 Z"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M100 35 L100 80 L60 100 L60 50 Z"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-lg text-text-muted">即将上线，敬请期待</p>
      </div>
    </main>
  );
}
