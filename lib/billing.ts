import { apiFetch } from "@/lib/api";

export type BillingStatus = {
  paymentsLive: boolean;
  sparkBalance: number;
  membershipTier: "free" | "plus" | "ultra" | "supreme";
  membershipRenewsAt: string | null;
};

/** Reads the server-owned billing state used by the wallet and membership UI. */
export async function fetchBillingStatus(signal?: AbortSignal): Promise<BillingStatus | null> {
  const res = await apiFetch("/api/billing/me", { signal });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Couldn't load billing status.");
  }
  return data as BillingStatus;
}
