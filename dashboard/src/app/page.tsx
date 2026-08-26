import { redirect } from "next/navigation";
import { getCurrentAccount } from "../lib/auth";

export default async function HomePage() {
  const account = await getCurrentAccount();
  redirect(account ? "/dashboard" : "/login");
}
