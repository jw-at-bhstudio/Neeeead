"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "./AuthModal";
import { getCurrentUser } from "../lib/supabase/creatures";
import { supabase } from "../lib/supabase/client";
import { featureFlags } from "../lib/featureFlags";
import type { User } from "@supabase/supabase-js";

type NavItem = { href: string; label: string };

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userLabel, setUserLabel] = useState<string>("游客");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSquareEnabled, setIsSquareEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    const applyUser = (user: User | null) => {
      if (!mounted) return;
      setUserLabel(user?.email?.split("@")[0] ?? "游客");
      setIsSignedIn(Boolean(user));
    };

    getCurrentUser()
      .then((user) => applyUser(user))
      .catch(() => applyUser(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Use session payload first to avoid stale reads right after sign-in.
      applyUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Delay env-flag driven nav rendering until mount to avoid hydration mismatch.
    setIsSquareEnabled(featureFlags.enableSquare);
  }, []);

  const handleAuthSuccess = async () => {
    const user = await getCurrentUser().catch(() => null);
    setUserLabel(user?.email?.split("@")[0] ?? "游客");
    setIsSignedIn(Boolean(user));
  };

  const isActive = useMemo(
    () => (href: string) => pathname === href || (href === "/new" && pathname === "/"),
    [pathname]
  );

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/new", label: "捏只新的" },
      { href: "/my", label: "我的盒子" },
      ...(isSquareEnabled ? [{ href: "/square", label: "盒子广场" }] : []),
      { href: "/account", label: "我的账号" },
    ],
    [isSquareEnabled]
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-surface bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <nav className="flex items-center gap-1 text-lg">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  isActive(item.href)
                    ? "bg-surface text-text"
                    : "text-text-muted hover:bg-surface hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => {
              if (isSignedIn) {
                router.push("/account");
                return;
              }
              setIsAuthModalOpen(true);
            }}
            className="text-lg text-text-muted transition-colors hover:text-text"
          >
            {userLabel === "游客" ? "登录/注册" : userLabel}
          </button>
        </div>
      </header>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
