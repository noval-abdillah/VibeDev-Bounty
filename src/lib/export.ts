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
  return { headerRow, dataRows: [...dataRows] };
}

const CELL_STYLES = {
  header: {
    fill: { fgColor: { rgb: THEME.primary } },
    font: { bold: true, color: { rgb: THEME.white }, sz: 11, name: "Inter" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: THEME.primaryDark } },
      bottom: { style: "thin", color: { rgb: THEME.primaryDark } },
      left: { style: "thin", color: { rgb: THEME.white } },
      right: { style: "thin", color: { rgb: THEME.white } },
    },
  },
  summary: {
    fill: { fgColor: { rgb: THEME.bg } },
    font: { color: { rgb: THEME.primaryDark }, sz: 10, name: "Inter" },
    alignment: { vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: THEME.border } } },
  },
  dataEven: {
    fill: { fgColor: { rgb: THEME.white } },
    font: { color: { rgb: THEME.primaryDark }, sz: 10, name: "IBM Plex Mono" },
    alignment: { vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: THEME.border } } },
  },
  dataOdd: {
    fill: { fgColor: { rgb: THEME.bg } },
    font: { color: { rgb: THEME.primaryDark }, sz: 10, name: "IBM Plex Mono" },
    alignment: { vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: THEME.border } } },
  },
};

export async function exportToXlsx(options: ExportOptions) {
  const XLSX = await import("xlsx-js-style");

  const wb = XLSX.utils.book_new();

  for (const sheet of options.sheets) {
    const summaryData = sheet.summaryRows || [];
    const rows = [...summaryData.map((s) => ({ label: s.label, value: s.value })), ...sheet.rows];

    const { headerRow, dataRows } = buildSheetData({ ...sheet, rows });

    const aoa: string[][] = [];
    aoa.push(headerRow);
    summaryData.forEach((s) => {
      const row = Array(headerRow.length).fill("");
      row[0] = s.label;
      row[1] = s.value;
      aoa.push(row);
    });
    dataRows.slice(summaryData.length).forEach((row) => aoa.push(row));

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = sheet.columns.map((col) => ({
      wch: Math.min(Math.max(col.width || 15, 12), 50),
    }));

    // Style header
    headerRow.forEach((_, colIdx) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[ref]) ws[ref].s = CELL_STYLES.header;
    });

    // Style summary rows
    const dataStartRow = 1 + summaryData.length;
    for (let r = 1; r < dataStartRow; r++) {
      for (let c = 0; c < sheet.columns.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) ws[ref].s = CELL_STYLES.summary;
      }
    }

    // Style data rows
    for (let i = 0; i < dataRows.slice(summaryData.length).length; i++) {
      const rowIdx = dataStartRow + i;
      const style = i % 2 === 0 ? CELL_STYLES.dataEven : CELL_STYLES.dataOdd;
      for (let c = 0; c < sheet.columns.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[ref]) ws[ref].s = style;
      }
    }

    // Auto-filter
    const totalDataRows = dataRows.slice(summaryData.length).length;
    const lastColLetter = XLSX.utils.encode_col(sheet.columns.length - 1);
    ws["!autofilter"] = { ref: `A1:${lastColLetter}${totalDataRows + dataStartRow}` };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
