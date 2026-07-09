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
