"use client";

import { signIn } from "next-auth/react";

export default function LandingLoginButton() {
  return (
    <button
      onClick={() => signIn("google")}
      className="rounded-lg bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-500"
    >
      Sign in with Google
    </button>
  );
}
