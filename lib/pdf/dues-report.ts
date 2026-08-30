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
  active: boolean;
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

  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const elapsedMonths = isCurrentYear ? now.getMonth() + 1 : 12;

  const categoriesWithTarget = duesCategories.filter(
    (category) => (category.dues_default_amount ?? 0) > 0,
  );
  const monthlyTarget = categoriesWithTarget.reduce(
    (sum, category) => sum + (category.dues_default_amount ?? 0),
    0,
  );

  // Roster laporan: semua warga AKTIF (termasuk yang belum pernah bayar,
  // supaya yang menunggak tetap ketahuan) + warga nonaktif yang pernah punya
  // transaksi iuran di tahun ini. Warga nonaktif tanpa transaksi tahun ini
  // tidak dimunculkan (sudah tidak aktif sepanjang tahun).
  const yearTxCount = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.payer_id || !tx.dues_period) continue;
    if (!tx.dues_period.startsWith(`${year}-`)) continue;
    yearTxCount.set(tx.payer_id, (yearTxCount.get(tx.payer_id) ?? 0) + 1);
  }
  const roster = payers.filter(
    (payer) => payer.active || (yearTxCount.get(payer.id) ?? 0) > 0,
  );
  const activeCount = roster.filter((payer) => payer.active).length;
  const displayName = (payer: DuesReportPayer): string =>
    payer.active ? payer.name : `${payer.name} (nonaktif)`;

  const paidMonth = new Map<string, number[]>();
  const paidTotal = new Map<string, number>();
  const paidByCategory = new Map<string, number>();
  for (const payer of roster) {
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

  const OTHER_BUCKET = "__other__";

  const paidMonthPerCat = new Map<string, Map<string, number[]>>();
  for (const payer of roster) {
    const catMap = new Map<string, number[]>();
    for (const category of categoriesWithTarget) {
      catMap.set(category.id, Array(12).fill(0));
    }
    paidMonthPerCat.set(payer.id, catMap);
  }

  for (const tx of transactions) {
    if (!tx.payer_id || !tx.dues_period) continue;
    const parts = tx.dues_period.split("-").map(Number);
    if (parts.length < 2 || parts[0] !== year) continue;
    const monthIndex = parts[1] - 1;
    const catMap = paidMonthPerCat.get(tx.payer_id);
    if (!catMap) continue;
    const bucket =
      tx.category_id && catMap.has(tx.category_id) ? tx.category_id : OTHER_BUCKET;
    let bucketArr = catMap.get(bucket);
    if (!bucketArr) {
      bucketArr = Array(12).fill(0);
      catMap.set(bucket, bucketArr);
    }
    bucketArr[monthIndex] += Number(tx.amount);
  }

  let collectedYear = 0;
  let lunasYear = 0;
  for (const payer of roster) {
    collectedYear += paidTotal.get(payer.id) ?? 0;
    const catMap = paidMonthPerCat.get(payer.id) ?? new Map();
    let lunasAll: boolean;
    if (categoriesWithTarget.length === 0) {
      const monthArr = paidMonth.get(payer.id) ?? Array(12).fill(0);
      lunasAll = true;
      for (let index = 0; index < elapsedMonths; index += 1) {
        if ((monthArr[index] ?? 0) <= 0) {
          lunasAll = false;
          break;
        }
      }
    } else {
      lunasAll = true;
      for (const category of categoriesWithTarget) {
        const target = category.dues_default_amount ?? 0;
        const monthArr = catMap.get(category.id) ?? Array(12).fill(0);
        let catLunas = true;
        for (let index = 0; index < elapsedMonths; index += 1) {
          if ((monthArr[index] ?? 0) < target) {
            catLunas = false;
            break;
          }
        }
        if (!catLunas) {
          lunasAll = false;
          break;
        }
      }
    }
    if (lunasAll) lunasYear += 1;
  }

  const targetYear = monthlyTarget * 12 * activeCount;
  const remainingYear = Math.max(0, targetYear - collectedYear);

  const COLUMN_COUNT = 14; // nama + 12 bulan + total
  const matrixRows: TableCell[][] = [];
  for (const payer of roster) {
    const catMap: Map<string, number[]> =
      paidMonthPerCat.get(payer.id) ?? new Map();
    matrixRows.push([
      {
        text: displayName(payer),
        bold: true,
        fillColor: "#f3f4f6",
        margin: [0, 3, 0, 3],
        colSpan: COLUMN_COUNT,
      },
      ...Array(COLUMN_COUNT - 1).fill({} as TableCell),
    ]);
    const rows: Array<[string, number[], number]> = [];
    for (const category of categoriesWithTarget) {
      const arr = catMap.get(category.id) ?? Array(12).fill(0);
      rows.push([category.name, arr, category.dues_default_amount ?? 0]);
    }
    const otherArr = catMap.get(OTHER_BUCKET);
    if (otherArr && otherArr.some((value: number) => value > 0)) {
      rows.push(["Iuran lain (tanpa target)", otherArr, 0]);
    }
    for (const [label, monthArr, target] of rows) {
      const rowTotal = monthArr.reduce((sum, value) => sum + value, 0);
      matrixRows.push([
        { text: label, margin: [10, 0, 0, 0] },
        ...Array.from({ length: 12 }, (_, index) => {
          const amount = monthArr[index] ?? 0;
          if (amount <= 0) {
            return {
              text: "—",
              alignment: "right" as const,
              color: MUTED_COLOR,
            };
          }
          if (target > 0 && amount >= target) {
            return {
              text: compactAmount(amount),
              alignment: "right" as const,
              color: FULL_COLOR,
              bold: true,
            };
          }
          if (target > 0) {
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
          text: compactAmount(rowTotal),
          alignment: "right" as const,
          bold: true,
        },
      ]);
    }
  }

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
    ...matrixRows,
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
      const perMonth = (category.dues_default_amount ?? 0) * activeCount;
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

  const outstanding: Array<{ name: string; lines: string[] }> = [];
  for (const payer of roster) {
    const catMap = paidMonthPerCat.get(payer.id) ?? new Map();
    const lines: string[] = [];
    for (const category of categoriesWithTarget) {
      const target = category.dues_default_amount ?? 0;
      const monthArr = catMap.get(category.id) ?? Array(12).fill(0);
      const parts: string[] = [];
      for (let index = 0; index < elapsedMonths; index += 1) {
        const amount = monthArr[index] ?? 0;
        if (amount >= target) continue;
        parts.push(
          amount > 0
            ? `${MONTH_SHORT[index]} (cicil ${formatRupiah(amount)}, sisa ${formatRupiah(target - amount)})`
            : `${MONTH_SHORT[index]} ${formatRupiah(target)}`,
        );
      }
      if (parts.length > 0) {
        lines.push(`${category.name}: ${parts.join(", ")}`);
      }
    }
    if (lines.length > 0) {
      outstanding.push({ name: displayName(payer), lines });
    }
  }

  const summaryBody: TableCell[][] = [
    [`Jumlah ${entityLabel.toLowerCase()} aktif`, { text: String(activeCount), alignment: "right" }],
    [
      isCurrentYear
        ? `${entityLabel} lunas s.d. bulan berjalan`
        : `${entityLabel} lunas sepanjang tahun`,
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

      { text: "Matriks Pembayaran per Bulan (per Kategori)", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: [110, ...Array(12).fill("*"), "auto"],
          body: matrixBody,
        },
        fontSize: 8,
        layout: "lightHorizontalLines",
      },
      {
        text: monthlyTarget > 0
          ? `Satu baris = satu kategori iuran per warga. Angka hijau = kategori itu lunas di bulan tersebut; oranye ber-* = baru cicil; — = belum ada pembayaran. Target tiap kategori per bulan ada di tabel Rekap di atas. Nama berlabel (nonaktif) = sudah dinonaktifkan, riwayat tetap disertakan.`
          : "Angka = nominal iuran yang masuk; — = belum ada pembayaran.",
        style: "muted",
        margin: [0, 6, 0, 0],
      },

      ...(outstanding.length > 0
        ? [
            {
              text: `Belum Lunas per ${entityLabel} (per Kategori)`,
              style: "section" as const,
            },
            {
              ul: outstanding.map(
                (item) => ({
                  stack: [
                    { text: item.name, bold: true },
                    ...item.lines.map((line) => ({ text: `  ${line}` })),
                  ],
                  margin: [0, 0, 0, 3] as [number, number, number, number],
                }),
              ),
            },
          ]
        : [
            {
              text: isCurrentYear
                ? `Semua ${entityLabel.toLowerCase()} aktif sudah lunas untuk semua bulan yang sudah berjalan di tahun ${year}.`
                : `Semua ${entityLabel.toLowerCase()} aktif sudah lunas tahun ${year}.`,
              style: "muted",
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