import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import InsightsClient from "@/components/InsightsClient";
import { authOptions } from "@/lib/auth";

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  return <InsightsClient />;
}
