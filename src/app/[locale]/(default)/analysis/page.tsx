import { getInventoryPointsFromCSV } from "@/lib/data/inventory-csv";
import { auth } from "@/auth";
import { maskInventoryPoints } from "@/lib/security/mask";
import AnalysisLayoutClient from "@/components/amazon-analyst/analysis-layout-client";

export default async function AnalysisPage() {
  const session = await auth();
  const isLoggedIn = !!session;
  const sourceItems = await getInventoryPointsFromCSV();
  const items = maskInventoryPoints(sourceItems, isLoggedIn);

  return (
    <div className="container mx-auto p-6">
      <AnalysisLayoutClient items={items} isLoggedIn={isLoggedIn} />
    </div>
  );
}