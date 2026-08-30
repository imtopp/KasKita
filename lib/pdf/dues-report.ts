import pdfmake from "pdfmake";
import type {
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import "./fonts";
import { LOGO_DATA_URL } from "./fonts";
import { formatDateID, formatRupiah, todayISO } from "@/lib/utils";

export type DuesReportPayer = {
  id: string;
  name: string;
};

export type DuesReportCategory = {
  id: string;
  name: string;
  dues_default_amount: number | null;
};

export type DuesReportTx = {
  payer_id: string | null;
  category_id: string | null;
  dues_period: string | null;
  amount: number;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const FULL_COLOR = "#059669";
const PARTIAL_COLOR = "#d97706";
const MUTED_COLOR = "#9ca3af";

function compactAmount(value: number): string {
  return value.toLocaleString("id-ID");
}

export async function generateDuesReportPdf(params: {
  orgName: string;
  entityLabel: string;
  year: number;
  payers: DuesReportPayer[];
  duesCategories: DuesReportCategory[];
  transactions: DuesReportTx[];
}): Promise<Buffer> {
  const { orgName, entityLabel, year, payers, duesCategories, transactions } =
    params;

  const categoriesWithTarget = duesCategories.filter(
    (category) => (category.dues_default_amount ?? 0) > 0,
  );
  const monthlyTarget = categoriesWithTarget.reduce(
    (sum, category) => sum + (category.dues_default_amount ?? 0),
    0,
  );

  const paidMonth = new Map<string, number[]>();
  const paidTotal = new Map<string, number>();
  const paidByCategory = new Map<string, number>();
  for (const payer of payers) {
    paidMonth.set(payer.id, Array(12).fill(0));
    paidTotal.set(payer.id, 0);
  }
  for (const category of duesCategories) paidByCategory.set(category.id, 0);

  for (const tx of transactions) {
    if (!tx.payer_id || !tx.dues_period) continue;
    const parts = tx.dues_period.split("-").map(Number);
    if (parts.length < 2 || parts[0] !== year) continue;
    const monthIndex = parts[1] - 1;
    const monthArr = paidMonth.get(tx.payer_id);
    if (!monthArr) continue;
    monthArr[monthIndex] += Number(tx.amount);
    paidTotal.set(
      tx.payer_id,
      (paidTotal.get(tx.payer_id) ?? 0) + Number(tx.amount),
    );
    if (tx.category_id) {
      paidByCategory.set(
        tx.category_id,
        (paidByCategory.get(tx.category_id) ?? 0) + Number(tx.amount),
      );
    }
  }

  let collectedYear = 0;
  let lunasYear = 0;
  for (const payer of payers) {
    collectedYear += paidTotal.get(payer.id) ?? 0;
    const monthArr = paidMonth.get(payer.id);
    const lunasAll =
      monthArr !== undefined &&
      monthArr.every((amount) =>
        monthlyTarget > 0 ? amount >= monthlyTarget : amount > 0,
      );
    if (lunasAll) lunasYear += 1;
  }

  const targetYear = monthlyTarget * 12 * payers.length;
  const remainingYear = Math.max(0, targetYear - collectedYear);

  const matrixBody: TableCell[][] = [
    [
      { text: entityLabel, style: "tableHeader" },
      ...MONTH_SHORT.map<TableCell>((label) => ({
        text: label,
        style: "tableHeader",
        alignment: "right",
      })),
      {
        text: "Total",
        style: "tableHeader",
        alignment: "right",
      },
    ],
    ...payers.map((payer) => {
      const monthArr = paidMonth.get(payer.id) ?? [];
      return [
        { text: payer.name },
        ...Array.from({ length: 12 }, (_, index) => {
          const amount = monthArr[index] ?? 0;
          if (amount <= 0) {
            return {
              text: "—",
              alignment: "right" as const,
              color: MUTED_COLOR,
            };
          }
          if (monthlyTarget > 0 && amount >= monthlyTarget) {
            return {
              text: compactAmount(amount),
              alignment: "right" as const,
              color: FULL_COLOR,
              bold: true,
            };
          }
          if (monthlyTarget > 0) {
            return {
              text: `${compactAmount(amount)}*`,
              alignment: "right" as const,
              color: PARTIAL_COLOR,
            };
          }
          return {
            text: compactAmount(amount),
            alignment: "right" as const,
          };
        }),
        {
          text: compactAmount(paidTotal.get(payer.id) ?? 0),
          alignment: "right" as const,
          bold: true,
        },
      ];
    }),
  ];

  const categoryBody: TableCell[][] = [
    [
      { text: "Kategori", style: "tableHeader" },
      { text: "Target / bln", style: "tableHeader", alignment: "right" },
      { text: "Target / thn", style: "tableHeader", alignment: "right" },
      { text: "Terkumpul", style: "tableHeader", alignment: "right" },
      { text: "Sisa", style: "tableHeader", alignment: "right" },
    ],
    ...categoriesWithTarget.map((category) => {
      const perMonth = (category.dues_default_amount ?? 0) * payers.length;
      const perYear = perMonth * 12;
      const collected = paidByCategory.get(category.id) ?? 0;
      return [
        category.name,
        { text: formatRupiah(perMonth), alignment: "right" as const },
        { text: formatRupiah(perYear), alignment: "right" as const },
        {
          text: formatRupiah(collected),
          alignment: "right" as const,
          bold: true,
        },
        {
          text: formatRupiah(Math.max(0, perYear - collected)),
          alignment: "right" as const,
          color: perYear - collected > 0 ? PARTIAL_COLOR : FULL_COLOR,
        },
      ];
    }),
  ];

  const outstanding: Array<{ name: string; detail: string }> = [];
  if (monthlyTarget > 0) {
    for (const payer of payers) {
      const monthArr = paidMonth.get(payer.id) ?? [];
      const parts: string[] = [];
      for (let index = 0; index < 12; index += 1) {
        const amount = monthArr[index] ?? 0;
        if (amount >= monthlyTarget) continue;
        parts.push(
          amount > 0
            ? `${MONTH_SHORT[index]} (cicil ${formatRupiah(amount)}, sisa ${formatRupiah(monthlyTarget - amount)})`
            : `${MONTH_SHORT[index]} ${formatRupiah(monthlyTarget)}`,
        );
      }
      if (parts.length > 0) {
        outstanding.push({ name: payer.name, detail: parts.join(", ") });
      }
    }
  }

  const summaryBody: TableCell[][] = [
    [`Jumlah ${entityLabel.toLowerCase()} aktif`, { text: String(payers.length), alignment: "right" }],
    [
      `${entityLabel} lunas sepanjang tahun`,
      { text: String(lunasYear), alignment: "right" },
    ],
    ...(monthlyTarget > 0
      ? ([
          ["Target iuran tahunan", { text: formatRupiah(targetYear), alignment: "right" }],
          ["Total iuran diterima", { text: formatRupiah(collectedYear), alignment: "right", bold: true, color: FULL_COLOR }],
          [`Sisa belum terkumpul`, { text: formatRupiah(remainingYear), alignment: "right", color: remainingYear > 0 ? PARTIAL_COLOR : FULL_COLOR }],
        ] as TableCell[][])
      : []),
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 40, 40, 60],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    info: {
      title: `Laporan Iuran ${entityLabel} ${orgName} - ${year}`,
      author: "KasKita",
    },
    images: {
      logo: LOGO_DATA_URL,
    },
    content: [
      {
        columns: [
          { image: "logo", width: 56, height: 56, margin: [0, 3, 0, 0] },
          {
            stack: [
              { text: "Laporan Iuran", style: "title" },
              { text: entityLabel, style: "orgName" },
              { text: `${orgName} - tahun ${year}`, style: "period" },
              { text: `Dibuat ${formatDateID(todayISO())}`, style: "muted" },
            ],
            margin: [16, 0, 0, 0],
          },
        ],
      },

      { text: "Ringkasan Tahunan", style: "section" },
      {
        table: { widths: ["*", "auto"], body: summaryBody },
        layout: "lightHorizontalLines",
      },

      ...(categoriesWithTarget.length > 0
        ? [
            {
              text: "Rekap per Kategori Iuran",
              style: "section" as const,
            },
            {
              table: {
                headerRows: 1,
                widths: ["*", "auto", "auto", "auto", "auto"],
                body: categoryBody,
              },
              layout: "lightHorizontalLines",
            },
          ]
        : []),

      { text: "Pembayaran per Bulan", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: [90, ...Array(12).fill("*"), "auto"],
          body: matrixBody,
        },
        fontSize: 8,
        layout: "lightHorizontalLines",
      },
      {
        text: monthlyTarget > 0
          ? `Angka hijau = lunas bulan itu; angka oranye ber-* = baru cicil (target ${formatRupiah(monthlyTarget)}/bulan); — = belum ada pembayaran.`
          : "Angka = nominal iuran yang masuk; — = belum ada pembayaran.",
        style: "muted",
        margin: [0, 6, 0, 0],
      },

      ...(outstanding.length > 0
        ? [
            {
              text: "Belum Lunas per " + entityLabel,
              style: "section" as const,
            },
            {
              ul: outstanding.map(
                (item) => ({
                  text: [
                    { text: item.name, bold: true },
                    { text: ` — ${item.detail}` },
                  ],
                }),
              ),
            },
          ]
        : [{ text: `Semua ${entityLabel.toLowerCase()} aktif sudah lunas tahun ${year}.`, style: "muted" }]),
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