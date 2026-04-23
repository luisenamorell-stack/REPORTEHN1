"use client"

import { useState, useEffect, useMemo, use } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  Calculator, 
  Loader2, 
  FileDown, 
  CheckCircle2
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, serverTimestamp, query, where, doc } from 'firebase/firestore';
import jspdf from 'jspdf';
import html2canvas from 'html2canvas';

export default function CuadrePage(props: { params: Promise<any>, searchParams: Promise<any> }) {
  use(props.params);
  use(props.searchParams);

  const [mounted, setMounted] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();

  const zonesQuery = useMemoFirebase(() => collection(db, 'zones'), [db]);
  const { data: zonesData, isLoading: zonesLoading } = useCollection(zonesQuery);
  const zones = zonesData || [];

  const cardsQuery = useMemoFirebase(() => {
    if (!selectedZoneId) return null;
    return query(collection(db, 'digitalCards'), where('zoneId', '==', selectedZoneId));
  }, [db, selectedZoneId]);
  const { data: cardsData } = useCollection(cardsQuery);
  const realSystemCount = cardsData?.length || 0;

  const cuadreRowsQuery = useMemoFirebase(() => {
    if (!selectedZoneId) return null;
    return query(collection(db, 'cuadreRows'), where('zoneId', '==', selectedZoneId));
  }, [db, selectedZoneId]);
  const { data: cuadreRows, isLoading: cuadreLoading } = useCollection(cuadreRowsQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedRows = useMemo(() => {
    return [...(cuadreRows || [])].sort((a, b) => (Number(a.pagina) || 0) - (Number(b.pagina) || 0));
  }, [cuadreRows]);

  const totals = useMemo(() => {
    return sortedRows.reduce((acc, curr) => ({
      digital: acc.digital + (Number(curr.digitalTotal) || 0),
      recogidas: acc.recogidas + (Number(curr.recogidas) || 0),
      pasadas: acc.pasadas + (Number(curr.pasadas) || 0),
      canceladas: acc.canceladas + (Number(curr.canceladas) || 0),
      total: acc.total + (Number(curr.digitalTotal) || 0) + (Number(curr.recogidas) || 0) + (Number(curr.pasadas) || 0) + (Number(curr.canceladas) || 0)
    }), { digital: 0, recogidas: 0, pasadas: 0, canceladas: 0, total: 0 });
  }, [sortedRows]);

  const diff = totals.digital - realSystemCount;

  const handleAddRow = () => {
    if (!selectedZoneId) return;
    const nextPagina = sortedRows.length > 0 ? Math.max(...sortedRows.map(r => Number(r.pagina) || 0)) + 1 : 1;
    addDocumentNonBlocking(collection(db, 'cuadreRows'), {
      zoneId: selectedZoneId,
      pagina: nextPagina,
      digitalTotal: 0,
      recogidas: 0,
      pasadas: 0,
      canceladas: 0,
      createdAt: serverTimestamp()
    });
  };

  const handleUpdateField = (rowId: string, field: string, value: string) => {
    updateDocumentNonBlocking(doc(db, 'cuadreRows', rowId), { [field]: Number(value) || 0 });
  };

  const handleDeleteRow = (id: string) => {
    deleteDocumentNonBlocking(doc(db, 'cuadreRows', id));
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('cuadre-print-area');
    if (!element) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = new jspdf({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = 265;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 7.2, 7.2, imgWidth, imgHeight);
      pdf.save(`Cuadre_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: "Éxito", description: "Reporte generado." });
    } catch (e) {
      toast({ title: "Error", description: "Error al generar PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!mounted || zonesLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline uppercase">Conciliación de Cuadre</h1>
          <p className="text-muted-foreground text-sm">Auditoría de carteras físicas vs base de datos digital.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-primary text-primary" onClick={handleDownloadPDF} disabled={!selectedZoneId || isGeneratingPdf}>
            <FileDown className="mr-2 size-4" /> Exportar Cuadre
          </Button>
          <Button onClick={handleAddRow} disabled={!selectedZoneId} className="bg-primary text-white">
            <Plus className="mr-2 size-4" /> Nueva Página
          </Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-[300px] space-y-2">
              <Label className="font-bold text-primary uppercase text-xs">Zona de Auditoría</Label>
              <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar Zona" /></SelectTrigger>
                <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedZoneId ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50 border-primary/10">
          <Calculator className="size-16 mx-auto mb-4 text-primary/20" />
          <h3 className="text-lg font-bold text-primary/60 uppercase">Esperando Selección</h3>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[100px] font-bold text-primary">Página</TableHead>
                <TableHead className="text-center font-bold text-primary">Sistema</TableHead>
                <TableHead className="text-center font-bold text-blue-600">Recogidas</TableHead>
                <TableHead className="text-center font-bold text-blue-400">Pasadas</TableHead>
                <TableHead className="text-center font-bold text-destructive">Canceladas</TableHead>
                <TableHead className="text-right font-bold text-primary">Total</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Input type="number" value={row.pagina} className="h-8 font-bold text-center" onChange={(e) => handleUpdateField(row.id, 'pagina', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.digitalTotal} className="h-8 text-center" onChange={(e) => handleUpdateField(row.id, 'digitalTotal', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.recogidas} className="h-8 text-center text-blue-600 font-bold" onChange={(e) => handleUpdateField(row.id, 'recogidas', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.pasadas} className="h-8 text-center text-blue-400 font-bold" onChange={(e) => handleUpdateField(row.id, 'pasadas', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.canceladas} className="h-8 text-center text-destructive font-bold" onChange={(e) => handleUpdateField(row.id, 'canceladas', e.target.value)} /></TableCell>
                  <TableCell className="text-right font-black text-primary">{Number(row.digitalTotal) + Number(row.recogidas) + Number(row.pasadas) + Number(row.canceladas)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="text-destructive/30 hover:text-destructive" onClick={() => handleDeleteRow(row.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-primary/5">
              <TableRow className="h-14">
                <TableCell className="font-bold text-primary uppercase text-xs">Totales</TableCell>
                <TableCell className="text-center font-bold text-lg">{totals.digital}</TableCell>
                <TableCell className="text-center font-bold text-lg text-blue-600">{totals.recogidas}</TableCell>
                <TableCell className="text-center font-bold text-lg text-blue-400">{totals.pasadas}</TableCell>
                <TableCell className="text-center font-bold text-lg text-destructive">{totals.canceladas}</TableCell>
                <TableCell className="text-right font-black text-primary text-xl">L. {totals.total.toLocaleString()}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* ÁREA DE IMPRESIÓN (OCULTA) */}
      <div id="cuadre-print-area" className="fixed left-[-9999px] top-0 bg-white w-[270mm] p-[10mm] space-y-6">
        <div className="border-b-2 border-[#1D4ED8] pb-4 flex justify-between items-end">
          <h2 className="text-2xl font-black text-[#1D4ED8] uppercase">Conciliación de Cuadre HN</h2>
          <p className="text-sm font-bold text-gray-500 uppercase">{new Date().toLocaleDateString('es-HN')}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#EFF6FF] p-4 rounded-lg border border-[#DBEAFE]">
            <p className="text-xs font-bold text-gray-500 uppercase">Cartera Sistema</p>
            <p className="text-xl font-black text-[#1D4ED8]">{realSystemCount}</p>
          </div>
          <div className="bg-[#EFF6FF] p-4 rounded-lg border border-[#DBEAFE]">
            <p className="text-xs font-bold text-gray-500 uppercase">Conciliado Físico</p>
            <p className="text-xl font-black text-[#1D4ED8]">{totals.digital}</p>
          </div>
          <div className="bg-[#EFF6FF] p-4 rounded-lg border border-[#DBEAFE]">
            <p className="text-xs font-bold text-gray-500 uppercase">Estado</p>
            <p className={`text-xl font-black uppercase ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>{diff === 0 ? 'Cuadrado' : `Dif: ${Math.abs(diff)}`}</p>
          </div>
        </div>
        <table className="w-full border-collapse border border-[#eeeeee]">
          <thead>
            <tr className="bg-[#EFF6FF]">
              <th className="border p-2 text-xs font-black text-[#1E3A8A] uppercase">Pág.</th>
              <th className="border p-2 text-xs font-black text-[#1E3A8A] uppercase text-center">Sistema</th>
              <th className="border p-2 text-xs font-black text-blue-600 uppercase text-center">Recog.</th>
              <th className="border p-2 text-xs font-black text-blue-400 uppercase text-center">Pasadas</th>
              <th className="border p-2 text-xs font-black text-red-600 uppercase text-center">Canc.</th>
              <th className="border p-2 text-xs font-black text-[#1D4ED8] uppercase text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr key={row.id} className="border-b">
                <td className="p-2 text-center text-sm font-bold">{row.pagina}</td>
                <td className="p-2 text-center text-sm">{row.digitalTotal}</td>
                <td className="p-2 text-center text-sm text-blue-600">{row.recogidas}</td>
                <td className="p-2 text-center text-sm text-blue-400">{row.pasadas}</td>
                <td className="p-2 text-center text-sm text-red-600">{row.canceladas}</td>
                <td className="p-2 text-right text-sm font-black text-[#1D4ED8]">{Number(row.digitalTotal) + Number(row.recogidas) + Number(row.pasadas) + Number(row.canceladas)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1D4ED8]">
              <td className="p-3 text-xs font-black text-white uppercase">Totales</td>
              <td className="p-3 text-center text-sm font-black text-white">{totals.digital}</td>
              <td className="p-3 text-center text-sm font-black text-white">{totals.recogidas}</td>
              <td className="p-3 text-center text-sm font-black text-white">{totals.pasadas}</td>
              <td className="p-3 text-center text-sm font-black text-white">{totals.canceladas}</td>
              <td className="p-3 text-right text-lg font-black text-white">L. {totals.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}