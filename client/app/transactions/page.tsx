import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TransactionsClient from "@/components/TransactionsClient";
import { authOptions } from "@/lib/auth";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  return <TransactionsClient />;
}
