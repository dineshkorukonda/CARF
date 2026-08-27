import { redirect } from "next/navigation";

const DASHBOARD_URL = "https://dashboard.carf.indevs.in";

export default function IntegratePage() {
  redirect(DASHBOARD_URL);
}
