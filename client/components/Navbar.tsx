"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function Navbar() {
  return (
    <nav className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
        Finio
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/transactions" className="hover:text-indigo-600">
          Transactions
        </Link>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded bg-slate-200 px-3 py-1">
          Sign out
        </button>
      </div>
    </nav>
  );
}
