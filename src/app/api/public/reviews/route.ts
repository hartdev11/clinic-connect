import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type PublicReview = {
  id: string;
  author?: string;
  content: string;
  rating?: number;
  createdAt?: string;
};

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

export async function GET() {
  try {
    const directPublicSnap = await db
      .collection("public_reviews")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get()
      .catch(() => null);

    const directMapped =
      directPublicSnap?.docs
        .map((doc): PublicReview | null => {
          const d = doc.data() as Record<string, unknown>;
          const content =
            (typeof d.content === "string" && d.content.trim()) ||
            (typeof d.review === "string" && d.review.trim()) ||
            "";
          if (!content) return null;
          const rating = typeof d.rating === "number" ? d.rating : undefined;
          const item: PublicReview = {
            id: doc.id,
            content,
          };
          if (typeof d.author === "string" && d.author.trim()) item.author = d.author.trim();
          if (typeof rating === "number") item.rating = rating;
          const createdAt = toIso(d.createdAt);
          if (createdAt) item.createdAt = createdAt;
          return item;
        })
        .filter((x): x is PublicReview => x !== null) ?? [];
    const directItems: PublicReview[] = directMapped;

    if (directItems.length > 0) {
      return NextResponse.json(
        { items: directItems },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
      );
    }

    const feedbackSnap = await db
      .collection("conversation_feedback")
      .where("adminLabel", "==", "success")
      .orderBy("createdAt", "desc")
      .limit(40)
      .get();

    const mapped = feedbackSnap.docs
      .map((doc): PublicReview | null => {
        const d = doc.data() as Record<string, unknown>;
        const content = typeof d.userMessage === "string" ? d.userMessage.trim() : "";
        if (!content || content.length < 8) return null;
        const item: PublicReview = {
          id: doc.id,
          author: "ลูกค้าคลินิก",
          content,
        };
        const createdAt = toIso(d.createdAt);
        if (createdAt) item.createdAt = createdAt;
        return item;
      })
      .filter((x): x is PublicReview => x !== null);
    const items: PublicReview[] = mapped.slice(0, 24);

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("GET /api/public/reviews:", err);
    return NextResponse.json({ items: [] as PublicReview[] }, { status: 200 });
  }
}

