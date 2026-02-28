import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchCommandCenterData } from "@/lib/command-center/fetch-data";
import { CommandCenterClient } from "./CommandCenterClient";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await fetchCommandCenterData();
  return <CommandCenterClient initialData={data} />;
}
