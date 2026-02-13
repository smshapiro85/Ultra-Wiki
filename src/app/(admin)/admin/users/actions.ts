"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function promoteUser(userId: string) {
  await requireAdmin();
  const db = getDb();

  await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function demoteUser(userId: string) {
  const session = await requireAdmin();
  const db = getDb();

  if (userId === session.user.id) {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users).set({ role: "user" }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function getUsers() {
  await requireAdmin();
  const db = getDb();

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
}
