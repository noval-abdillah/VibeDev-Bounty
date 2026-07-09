import XLSX from "xlsx-js-style";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  title: string;
  fileName: string;
  sheets: ExportSheet[];
}

export interface ExportSheet {
  name: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  summaryRows?: { label: string; value: string }[];
}

const THEME = {
  primary: "D48C88",
  primaryDark: "3A1E1C",
  bg: "FDF6F5",
  white: "FFFFFF",
  success: "2E613D",
  danger: "A3362F",
  border: "EAD5D3",
};

function buildSheetData(sheet: ExportSheet) {
  const headerRow = sheet.columns.map((c) => c.header);
  const dataRows = sheet.rows.map((row) =>
    sheet.columns.map((c) => String(row[c.key] ?? ""))
  );
  return { headerRow, dataRows };
}

function applyCellStyle(
  ws: XLSX.WorkSheet,
  headerRow: string[],
  dataRows: string[][],
  columns: ExportColumn[],
  summaryRowCount: number
) {
  const totalRows = dataRows.length;

  // Column widths
  ws["!cols"] = columns.map((col) => ({
    wch: Math.min(Math.max(col.width || 15, 12), 50),
  }));

  // Apply header style (Row 0)
  headerRow.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: THEME.primary } },
      font: { bold: true, color: { rgb: THEME.white }, sz: 11, name: "Inter" },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: THEME.primaryDark } },
        bottom: { style: "thin", color: { rgb: THEME.primaryDark } },
        left: { style: "thin", color: { rgb: THEME.white } },
        right: { style: "thin", color: { rgb: THEME.white } },
      },
    };
  });

  // Summary rows if any (before data, after header)
  if (summaryRowCount > 0) {
    for (let r = 1; r <= summaryRowCount; r++) {
      for (let c = 0; c < columns.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: THEME.bg } },
            font: { bold: c === 0, color: { rgb: THEME.primaryDark }, sz: 10, name: "Inter" },
            alignment: { vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: THEME.border } } },
          };
        }
      }
    }
  }

  // Apply data row styles
  const dataStartRow = 1 + summaryRowCount;
  for (let i = 0; i < totalRows; i++) {
    const rowIdx = dataStartRow + i;
    const isEven = i % 2 === 0;
    for (let c = 0; c < columns.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: isEven ? THEME.white : THEME.bg } },
          font: {
            color: { rgb: THEME.primaryDark },
            sz: 10,
            name: "IBM Plex Mono",
          },
          alignment: { vertical: "center" },
          border: { bottom: { style: "thin", color: { rgb: THEME.border } } },
        };
      }
    }
  }
}

function autoFilterData(
  ws: XLSX.WorkSheet,
  columns: ExportColumn[],
  totalRows: number
) {
  const lastRow = totalRows;
  const lastColLetter = XLSX.utils.encode_col(columns.length - 1);
  ws["!autofilter"] = { ref: `A1:${lastColLetter}${lastRow + 1}` };
}

export function exportToXlsx(options: ExportOptions) {
  const wb = XLSX.utils.book_new();

  options.sheets.forEach((sheet) => {
    let summaryData: { label: string; value: string }[] = [];

    // Build summary rows
    if (sheet.summaryRows && sheet.summaryRows.length > 0) {
      summaryData = sheet.summaryRows;
    }

    const rows = [...summaryData.map((s) => ({ label: s.label, value: s.value })), ...sheet.rows];

    const { headerRow, dataRows } = buildSheetData({ ...sheet, rows });

    // Build full AOA: summary rows use only first 2 columns, data rows use all columns
    const aoa: string[][] = [];
    // Header
    aoa.push(headerRow);
    // Summary rows (fill first 2 columns only)
    summaryData.forEach((s) => {
      const row = Array(headerRow.length).fill("");
      row[0] = s.label;
      row[1] = s.value;
      aoa.push(row);
    });
    // Data rows
    dataRows.slice(summaryData.length).forEach((row) => {
      aoa.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    applyCellStyle(ws, headerRow, dataRows.slice(summaryData.length), sheet.columns, summaryData.length);
    autoFilterData(ws, sheet.columns, dataRows.slice(summaryData.length).length);

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  // Write and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    saldo_awal: "Saldo Awal Produk",
    masuk_maklon: "Barang Masuk Maklon",
    penjualan_offline: "Penjualan Offline",
    bonus: "Keluar Bonus",
    promo: "Keluar Promo",
    sampel: "Keluar Sampel",
    rusak: "Barang Rusak",
    kedaluwarsa: "Barang Kedaluwarsa",
    pesanan_shopee: "Pesanan Shopee",
    pesanan_tiktok: "Pesanan TikTok",
    retur_shopee: "Retur Shopee",
    retur_tiktok: "Retur TikTok",
    opname_koreksi: "Koreksi Stok Opname",
  };
  return map[reason] || reason;
}

export function getChannelLabel(channel: string): string {
  const map: Record<string, string> = {
    shopee: "Shopee",
    tiktok: "TikTok Shop",
    manual: "Input Manual",
    system: "System",
  };
  return map[channel] || channel;
}

export function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
