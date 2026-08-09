import pdfmake from "pdfmake";
import type {
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import "./fonts";
import { LOGO_DATA_URL } from "./fonts";
import type { CategoryBreakdown, MonthTotals } from "@/lib/types";
import {
  MONTH_NAMES,
  categoryFromEmbedded,
  formatDateID,
  formatRupiah,
  todayISO,
} from "@/lib/utils";

export type PdfTransaction = {
  transaction_date: string;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  categories: { name: string }[] | { name: string } | null;
};

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#dc2626";

export async function generateReportPdf(params: {
  orgName: string;
  month: number;
  year: number;
  totals: MonthTotals;
  breakdown: CategoryBreakdown[];
  transactions: PdfTransaction[];
}): Promise<Buffer> {
  const { orgName, month, year, totals, breakdown, transactions } = params;
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const transactionRows: TableCell[][] = transactions.map((transaction) => [
    formatDateID(transaction.transaction_date),
    categoryFromEmbedded(transaction.categories)?.name ?? "Tanpa kategori",
    transaction.description || "-",
    {
      text: transaction.type === "income" ? formatRupiah(transaction.amount) : "",
      alignment: "right",
      color: transaction.type === "income" ? INCOME_COLOR : undefined,
    },
    {
      text: transaction.type === "expense" ? formatRupiah(transaction.amount) : "",
      alignment: "right",
      color: transaction.type === "expense" ? EXPENSE_COLOR : undefined,
    },
  ]);

  const summaryBody: TableCell[][] = [
    ["Saldo awal bulan", { text: formatRupiah(totals.openingBalance), alignment: "right" }],
    [
      "Total pemasukan",
      {
        text: formatRupiah(totals.income),
        alignment: "right",
        color: INCOME_COLOR,
      },
    ],
    [
      "Total pengeluaran",
      {
        text: formatRupiah(totals.expense),
        alignment: "right",
        color: EXPENSE_COLOR,
      },
    ],
    ["Selisih bulan ini", { text: formatRupiah(totals.net), alignment: "right" }],
    [
      { text: "Saldo akhir bulan", bold: true },
      {
        text: formatRupiah(totals.closingBalance),
        alignment: "right",
        bold: true,
      },
    ],
  ];

  const breakdownBody: TableCell[][] = breakdown.map((item) => [
    item.name,
    item.type === "income" ? "Pemasukan" : "Pengeluaran",
    { text: formatRupiah(item.total), alignment: "right" },
  ]);

  const transactionTable: TableCell[][] = [
    [
      { text: "Tanggal", style: "tableHeader" },
      { text: "Kategori", style: "tableHeader" },
      { text: "Keterangan", style: "tableHeader" },
      { text: "Pemasukan", style: "tableHeader", alignment: "right" },
      { text: "Pengeluaran", style: "tableHeader", alignment: "right" },
    ],
    ...transactionRows,
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 60],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    info: {
      title: `Laporan Kas ${orgName} - ${periodLabel}`,
      author: "KasKita",
    },
    images: {
      logo: LOGO_DATA_URL,
    },
    content: [
      {
        columns: [
          { image: "logo", width: 64, height: 64, margin: [0, 0, 12, 0] },
          {
            stack: [
              { text: "Laporan Kas", style: "title" },
              { text: orgName, style: "orgName" },
              { text: periodLabel, style: "period" },
              { text: `Dibuat ${formatDateID(todayISO())}`, style: "muted" },
            ],
          },
        ],
      },

      { text: "Ringkasan", style: "section" },
      {
        table: {
          widths: ["*", "auto"],
          body: summaryBody,
        },
        layout: "lightHorizontalLines",
      },

      { text: "Rincian per Kategori", style: "section" },
      {
        table: {
          widths: ["*", "auto", "auto"],
          body: [
            [
              { text: "Kategori", style: "tableHeader" },
              { text: "Jenis", style: "tableHeader" },
              { text: "Jumlah", style: "tableHeader", alignment: "right" },
            ],
            ...breakdownBody,
          ],
        },
        layout: "lightHorizontalLines",
      },

      { text: "Rincian Transaksi", style: "section" },
      ...(transactions.length === 0
        ? [{ text: "Tidak ada transaksi pada periode ini.", style: "muted" }]
        : [
            {
              table: {
                headerRows: 1,
                widths: [58, 70, "*", 70, 70],
                body: transactionTable,
              },
              layout: "lightHorizontalLines",
            },
          ]),
    ],
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
      orgName: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      period: { fontSize: 12, margin: [0, 0, 0, 4] },
      muted: { fontSize: 9, color: "#6b7280", margin: [0, 0, 0, 6] },
      section: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
      tableHeader: { bold: true, fillColor: "#f3f4f6" },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Halaman ${currentPage} dari ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#9ca3af",
    }),
  };

  const pdf = pdfmake.createPdf(docDefinition);
  return pdf.getBuffer();
}
