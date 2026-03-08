import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: () => apiFetch("/api/auth/user"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
