import type { CategoryBreakdown, MonthTotals } from "@/lib/types";
import { categoryFromEmbedded } from "@/lib/utils";

export type TransactionSummaryRow = {
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  categories: { name: string }[] | { name: string } | null;
};

export type PriorBalanceRow = {
  amount: number;
  type: "income" | "expense";
};

export function summarizeMonth(
  rows: TransactionSummaryRow[],
  priorRows: PriorBalanceRow[],
): { totals: MonthTotals; breakdown: CategoryBreakdown[] } {
  let income = 0;
  let expense = 0;
  const byCategory = new Map<string, CategoryBreakdown>();

  for (const row of rows) {
    const amount = Number(row.amount);
    if (row.type === "income") income += amount;
    else expense += amount;

    const name =
      categoryFromEmbedded(row.categories)?.name ?? "Tanpa kategori";
    const key = row.category_id ?? "none";
    const current = byCategory.get(key);
    if (current) {
      current.total += amount;
    } else {
      byCategory.set(key, { name, type: row.type, total: amount });
    }
  }

  let openingBalance = 0;
  for (const row of priorRows) {
    if (row.type === "income") openingBalance += Number(row.amount);
    else openingBalance -= Number(row.amount);
  }

  const net = income - expense;
  return {
    totals: {
      income,
      expense,
      net,
      openingBalance,
      closingBalance: openingBalance + net,
    },
    breakdown: [...byCategory.values()].sort((a, b) => b.total - a.total),
  };
}
