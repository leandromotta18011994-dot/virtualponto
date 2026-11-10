import type { Entry } from "@/lib/time";
import { KIND_LABEL } from "@/lib/time";

export async function exportEntriesPdf(entries: Entry[], nameOf: (id: string) => string, title: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Virtual Ponto — Registros de ponto", 14, 16);
  doc.setFontSize(10);
  doc.text(`${title} · Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 23);
  const rows = [...entries]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((e) => {
      const d = new Date(e.recorded_at);
      return [nameOf(e.user_id), d.toLocaleDateString("pt-BR"), d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), KIND_LABEL[e.kind], e.note ?? ""];
    });
  autoTable(doc, { startY: 28, head: [["Funcionário", "Data", "Hora", "Tipo", "Observação"]], body: rows, styles: { fontSize: 9 } });
  doc.save(`ponto_${new Date().toISOString().slice(0, 10)}.pdf`);
}
