import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireSession();
  await prisma.emailConnection.deleteMany({
    where: {
      companyId: session.companyId,
      userId: session.userId,
      provider: "gmail",
    },
  });

  redirect("/import?status=gmail_disconnected");
}
