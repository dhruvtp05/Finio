import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/SettingsClient";
import { authOptions } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  return <SettingsClient />;
}
