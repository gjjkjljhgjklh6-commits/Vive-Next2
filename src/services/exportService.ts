import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[]
): void {
  const formattedRows = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      out[col.header] = row[col.key] ?? '';
    }
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  // Header bar in Vive Next Crimson (#8B1E24)
  doc.setFillColor(139, 30, 36);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`VIVE NEXT · ${title}`, 36, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${subtitle} · Emitido: ${new Date().toLocaleDateString('es-BO')}`, 36, 48);

  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) => columns.map((c) => String(r[c.key] ?? '')));

  autoTable(doc, {
    startY: 82,
    head,
    body,
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 36, right: 36 },
  });

  doc.save(`${filename}.pdf`);
}
