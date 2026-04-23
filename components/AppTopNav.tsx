"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "./AuthModal";
import { getCurrentUser } from "../lib/supabase/creatures";
import { supabase } from "../lib/supabase/client";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/new", label: "捏只新的" },
  { href: "/my", label: "我的盒子" },
  { href: "/square", label: "盒子广场" },
  { href: "/account", label: "我的账号" },
];

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userLabel, setUserLabel] = useState<string>("游客");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((user) => {
        if (!mounted) return;
        setUserLabel(user?.email?.split("@")[0] ?? "游客");
        setIsSignedIn(Boolean(user));
      })
      .catch(() => {
        if (!mounted) return;
        setUserLabel("游客");
        setIsSignedIn(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const user = await getCurrentUser().catch(() => null);
      setUserLabel(user?.email?.split("@")[0] ?? "游客");
      setIsSignedIn(Boolean(user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isActive = useMemo(
    () => (href: string) => pathname === href || (href === "/new" && pathname === "/"),
    [pathname]
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-surface bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <nav className="flex items-center gap-1 text-sm">
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
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            {userLabel === "游客" ? "登录/注册" : userLabel}
          </button>
        </div>
      </header>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
