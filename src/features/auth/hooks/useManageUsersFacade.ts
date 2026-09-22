"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateUserInput, ManagedUser } from "@/features/auth/types";
import {
  createUserRequest,
  deleteUserRequest,
  fetchUsers,
  resetUserPasswordRequest,
  updateUserRequest,
} from "@/features/auth/services/users-client.service";

export function useManageUsersFacade() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = useCallback(
    async (input: CreateUserInput) => {
      const user = await createUserRequest(input);
      setUsers((prev) => [user, ...prev]);
      return user;
    },
    [],
  );

  const toggleAdmin = useCallback(async (user: ManagedUser) => {
    const updated = await updateUserRequest(user.id, { isAdmin: !user.isAdmin });
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }, []);

  const toggleActive = useCallback(async (user: ManagedUser) => {
    const updated = await updateUserRequest(user.id, { isActive: !user.isActive });
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }, []);

  const resetPassword = useCallback(async (user: ManagedUser) => {
    return resetUserPasswordRequest(user.id);
  }, []);

  const deleteUser = useCallback(async (user: ManagedUser) => {
    await deleteUserRequest(user.id);
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
  }, []);

  return {
    users,
    loading,
    error,
    createUser,
    toggleAdmin,
    toggleActive,
    resetPassword,
    deleteUser,
    reload: load,
  };
}
