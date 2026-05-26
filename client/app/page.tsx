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
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold text-slate-900">Finio</h1>
        <p className="mt-4 text-lg text-slate-600">Your money, made clear.</p>
        <div className="mt-8">
          <LandingLoginButton />
        </div>
      </div>
    </main>
  );
}
