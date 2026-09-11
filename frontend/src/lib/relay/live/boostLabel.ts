/**
 * Boost wallet signature is not an on-chain child vault.
 * BOOST COMPLETE only after confirmed + a distinct child address.
 */
export function boostLabel(
  status: string | undefined,
  label: string | undefined,
  failed: boolean,
  complete: boolean,
): string {
  if (complete) return "BOOST COMPLETE";
  if (failed) return "BOOST FAILED";
  if (status === "waiting" || status === "signing") return "SIGNATURE REQUIRED";
  if (status === "submitting" && /provision|creat/i.test(label ?? "")) return "PROVISIONING";
  if (status === "submitting") return "SIGNATURE ACCEPTED";
  if (status === "confirming") return "ON-CHAIN CONFIRMING";
  if (status === "confirmed") return "VERIFYING CHILD";
  if (label) return label.toUpperCase();
  return "BOOST PENDING";
}
