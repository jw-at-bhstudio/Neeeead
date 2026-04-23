"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "../../components/AuthModal";
import { Button } from "../../components/Button";
import { getCurrentUser, signOutUser } from "../../lib/supabase/creatures";

export default function AccountPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    const user = await getCurrentUser().catch(() => null);
    setEmail(user?.email ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const onSignOut = async () => {
    await signOutUser().catch(() => null);
    await refreshUser();
  };

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6 text-text-muted">加载中...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl text-text">我的账号</h1>
      {!email ? (
        <>
          <p className="mt-2 text-text-muted">你当前未登录。</p>
          <Button className="mt-4" onClick={() => setAuthOpen(true)}>
            登录/注册
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-text-muted">当前账号：{email}</p>
          <Button className="mt-4" variant="secondary" onClick={onSignOut}>
            退出登录
          </Button>
        </>
      )}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onSuccess={refreshUser} />
    </main>
  );
}
