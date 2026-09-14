import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { getEvaluationHistory } from "../../../lib/evalHarness";
import { EvaluationBenchmarkView } from "./EvaluationBenchmarkView";

export const dynamic = "force-dynamic";

export default async function EvalPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const history = await getEvaluationHistory(10);

  return (
    <main className="p-8">
      <EvaluationBenchmarkView initialHistory={history} />
    </main>
  );
}
