import { CustomersPageClient } from "./CustomersPageClient";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; select?: string }>;
}) {
  const params = await searchParams;
  const tabParam = params.tab ?? null;
  const selectCustomerId = params.select ?? null;
  return <CustomersPageClient tabParam={tabParam} selectCustomerId={selectCustomerId} />;
}
