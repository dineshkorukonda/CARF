import { getCurrentAccount } from "../../../lib/auth";
import { AccountSettingsView } from "./AccountSettingsView";

export default async function AccountPage() {
  // middleware/layout already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;

  return <AccountSettingsView initialAccount={account} />;
}
