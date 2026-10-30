export function money(n: number | string, symbol = "₱"): string {
  const v = Number(n);
  return `${symbol}${v.toLocaleString("en-PH", { maximumFractionDigits: v % 1 ? 2 : 0 })}`;
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending Review",
  confirmed: "Confirmed",
  balance_due: "Balance Due",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const STATUS_TONE: Record<string, string> = {
  awaiting_payment: "amber",
  pending: "amber",
  confirmed: "green",
  balance_due: "gold",
  declined: "red",
  cancelled: "grey",
  expired: "grey",
};
