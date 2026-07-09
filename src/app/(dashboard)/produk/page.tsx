import { createServerClient } from "@/lib/supabase/server";
import { ProdukClient } from "./ProdukClient";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const supabase = createServerClient();

  const [prodsResult, bundsResult, compsResult] = await Promise.all([
    supabase.from("product_stock_summary").select("*").order("name", { ascending: true }),
    supabase.from("bundles").select("*"),
    supabase.from("bundle_components").select("*"),
  ]);

  const products = prodsResult.data || [];
  const bundles = bundsResult.data || [];
  const bundleComponents = compsResult.data || [];

  return (
    <ProdukClient
      serverProducts={products}
      serverBundles={bundles}
      serverBundleComponents={bundleComponents}
    />
  );
}
