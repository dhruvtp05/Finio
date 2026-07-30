"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/transactions", label: "Transactions" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass = (href: string) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
    }`;

  return (
    <nav className="finio-card relative mb-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          Finio
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {session?.user?.email && (
            <span className="hidden max-w-[180px] truncate text-sm text-slate-500 dark:text-slate-400 lg:inline">
              {session.user.email}
            </span>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="finio-btn-secondary hidden sm:inline-flex"
          >
            Sign out
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <span className="text-lg leading-none" aria-hidden>
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
          {session?.user?.email && (
            <p className="mt-3 truncate px-3 text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="finio-btn-secondary mt-3 w-full sm:hidden"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
