import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type PublicClinic = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  imageUrl?: string;
};

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return undefined;
}

export async function GET() {
  try {
    const orgSnap = await db.collection("organizations").limit(80).get();
    const branchSnap = await db.collection("branches").limit(300).get();

    const firstBranchAddressByOrg = new Map<string, string>();
    for (const doc of branchSnap.docs) {
      const b = doc.data() as Record<string, unknown>;
      const orgId = typeof b.org_id === "string" ? b.org_id : "";
      if (!orgId || firstBranchAddressByOrg.has(orgId)) continue;
      const address = pickString(b, ["address", "full_address", "location"]);
      if (address) firstBranchAddressByOrg.set(orgId, address);
    }

    const mapped = orgSnap.docs
      .map((doc): PublicClinic | null => {
        const d = doc.data() as Record<string, unknown>;
        const status = typeof d.status === "string" ? d.status.toLowerCase() : "active";
        if (status === "suspended" || status === "inactive" || status === "deleted") return null;
        const name = pickString(d, ["name", "clinicName", "displayName"]);
        if (!name) return null;
        const description = pickString(d, [
          "description",
          "tagline",
          "short_description",
          "shortDescription",
          "bio",
        ]);
        const address =
          pickString(d, ["address", "main_branch_address", "mainBranchAddress"]) ??
          firstBranchAddressByOrg.get(doc.id);
        const imageUrl = pickString(d, ["logoUrl", "coverImageUrl", "imageUrl"]);
        const item: PublicClinic = { id: doc.id, name };
        if (description) item.description = description;
        if (address) item.address = address;
        if (imageUrl) item.imageUrl = imageUrl;
        return item;
      })
      .filter((x): x is PublicClinic => x !== null);
    const items: PublicClinic[] = mapped.slice(0, 60);

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("GET /api/public/clinics:", err);
    return NextResponse.json({ items: [] as PublicClinic[] }, { status: 200 });
  }
}

