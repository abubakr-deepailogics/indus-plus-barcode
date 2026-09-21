import type { CreateUserInput, ManagedUser, UpdateUserInput } from "@/features/auth/types";

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const res = await fetch("/api/users", { cache: "no-store" });
  return parseJsonOrThrow(res);
}

export async function createUserRequest(input: CreateUserInput): Promise<ManagedUser> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function updateUserRequest(userId: number, input: UpdateUserInput): Promise<ManagedUser> {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function resetUserPasswordRequest(userId: number): Promise<{ temporaryPassword: string }> {
  const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
  return parseJsonOrThrow(res);
}
