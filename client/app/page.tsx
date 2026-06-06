import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LandingLoginButton from "@/components/LandingLoginButton";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              Personal finance MVP
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">Finio</h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">Your money, made clear. Connect Plaid sandbox, track budgets, spot subscriptions, and hit savings goals in one dashboard.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingLoginButton />
            </div>
          </div>

          <div className="finio-card grid gap-4 bg-gradient-to-br from-white to-indigo-50">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Spent this month</p>
              <p className="text-3xl font-bold text-slate-900">$2,340.50</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Top category</p>
                <p className="font-semibold">Food & Drink</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Budgets</p>
                <p className="font-semibold">3 tracked</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">Demo preview — sign in to connect your sandbox bank.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
