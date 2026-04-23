
"use client"

import { useState, useEffect, useMemo, use } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Upload,
  AlertTriangle,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  FileDown,
  Users
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  useFirestore, 
  useUser, 
  useCollection, 
  useMemoFirebase,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { 
  collection, 
  doc, 
  serverTimestamp, 
  Timestamp, 
  writeBatch, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortKey = 'clave' | 'cliente' | 'pendiente' | 'numeroTarjeta' | 'fecha';

export default function DatabasePage(props: { params: Promise<any>, searchParams: Promise<any> }) {
  use(props.params);
  use(props.searchParams);

  const [mounted, setMounted] = useState(false);
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('Todas');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isVaciarDialogOpen, setIsVaciarDialogOpen] = useState(false);
  const [bulkZoneId, setBulkZoneId] = useState<string>('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isVaciarLoading, setIsVaciarLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ 
    key: 'clave', 
    direction: 'asc' 
  });

  const [newRecord, setNewRecord] = useState({
    fecha: '',
    clave: '',
    numeroTarjeta: '',
    cliente: '',
    articulo: '',
    vendedor: '',
    pendiente: 0,
    zoneId: ''
  });

  const zonesQuery = useMemoFirebase(() => collection(db, 'zones'), [db]);
  const { data: zones, isLoading: zonesLoading } = useCollection(zonesQuery);

  const cardsQuery = useMemoFirebase(() => collection(db, 'digitalCards'), [db]);
  const { data: cards, isLoading: cardsLoading } = useCollection(cardsQuery);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    setNewRecord(prev => ({ ...prev, fecha: formattedDate, zoneId: '' }));
  }, []);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderFecha = (val: any) => {
    if (!val) return '';
    if (val instanceof Timestamp) return val.toDate().toLocaleDateString('es-HN');
    if (typeof val === 'string') return val;
    return String(val);
  };

  const processedRecords = useMemo(() => {
    if (!mounted) return [];
    let filtered = (cards || []).filter(record => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        record.cliente?.toLowerCase().includes(s) ||
        record.clave?.toString().toLowerCase().includes(s) ||
        record.numeroTarjeta?.toString().toLowerCase().includes(s);
      const matchesZone = selectedZone === 'Todas' || record.zoneId === selectedZone;
      return matchesSearch && matchesZone;
    });

    filtered.sort((a, b) => {
      const valA = a[sortConfig.key as keyof typeof a];
      const valB = b[sortConfig.key as keyof typeof b];
      if (sortConfig.key === 'pendiente') return sortConfig.direction === 'asc' ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return filtered;
  }, [cards, searchTerm, selectedZone, mounted, sortConfig]);

  const totalSum = useMemo(() => {
    return processedRecords.reduce((acc, curr) => acc + (Number(curr.pendiente) || 0), 0);
  }, [processedRecords]);

  const handleDownloadPDF = async () => {
    if (processedRecords.length === 0) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const zoneName = selectedZone === 'Todas' ? 'GLOBAL' : zones?.find(z => z.id === selectedZone)?.name || 'N/A';
      const dateStr = new Date().toLocaleDateString('es-HN');

      const BLUE_MAIN = '#1D4ED8';
      const BLUE_DARK = '#1E3A8A';
      const BLUE_SOFT = '#EFF6FF';
      const BORDER_COLOR = '#eeeeee';

      const tableData = processedRecords.map(r => [
        renderFecha(r.fecha),
        r.clave || '',
        String(r.numeroTarjeta || ''),
        String(r.cliente || '').toUpperCase(),
        String(r.articulo || '').toUpperCase(),
        `L. ${(Number(r.pendiente) || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: 55,
        margin: { left: 7.2, right: 7.2, bottom: 15, top: 30 },
        head: [['FECHA', 'CLAVE', 'N. TARJETA', 'CLIENTE', 'ARTÍCULO', 'PENDIENTE']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, lineColor: BORDER_COLOR, lineWidth: 0.1, valign: 'middle', font: 'helvetica' },
        headStyles: { fillColor: BLUE_SOFT, textColor: BLUE_DARK, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: BLUE_MAIN },
          3: { cellWidth: 'auto', fontStyle: 'bold', textColor: [0, 0, 0] },
          4: { cellWidth: 50 },
          5: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data) => {
          doc.setTextColor(BLUE_MAIN);
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text('REPORTE DE CUENTAS - CLIENTES', 7.2, 16);

          doc.setFontSize(9);
          doc.text(`ZONA: ${zoneName.toUpperCase()}`, 7.2, 22);

          doc.setDrawColor(29, 78, 216);
          doc.setLineWidth(0.5);
          doc.line(7.2, 25, 272.2, 25);

          if (data.pageNumber === 1) {
            doc.setFillColor(BLUE_SOFT);
            doc.rect(7.2, 28, 265, 18, 'F');
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN DE CARTERA', 12, 34);
            doc.setTextColor(BLUE_MAIN);
            doc.setFontSize(16);
            doc.text(`TOTAL PENDIENTE: L. ${totalSum.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`, 12, 42);
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(8);
            doc.text('CLIENTES ACTIVOS', 265, 34, { align: 'right' });
            doc.setTextColor(BLUE_MAIN);
            doc.setFontSize(16);
            doc.text(`${processedRecords.length}`, 265, 42, { align: 'right' });
          }

          doc.setFontSize(7);
          doc.setTextColor(180, 180, 180);
          doc.text(`ReporteHN © 2026 | Página ${data.pageNumber} de ${doc.getNumberOfPages()}`, 139.7, 208.7, { align: 'center' });
          doc.text(`Fecha: ${dateStr}`, 272.2, 16, { align: 'right' });
        }
      });

      doc.save(`Reporte_Cuentas_${zoneName}_${dateStr}.pdf`);
      toast({ title: "Éxito", description: "Reporte PDF generado." });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  function parsearFecha(valor: any) {
    if (!valor) return '';
    
    if (valor instanceof Date) {
      const dia = String(valor.getDate()).padStart(2, '0');
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const anio = valor.getFullYear();
      return `${dia}/${mes}/${anio}`;
    }
    
    if (typeof valor === 'number') {
      const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000));
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const anio = fecha.getUTCFullYear();
      return `${dia}/${mes}/${anio}`;
    }
    
    if (typeof valor === 'string' && valor.trim() !== '') {
      return valor.trim();
    }
    
    return '';
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bulkZoneId) {
      toast({ title: "Atención", description: "Selecciona una zona antes de cargar.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) throw new Error("Archivo vacío.");
      
      const total = jsonData.length;
      for (let i = 0; i < total; i++) {
        const fila = jsonData[i];
        
        const findVal = (keys: string[]) => {
          const foundKey = Object.keys(fila).find(k => 
            keys.some(searchKey => k.toLowerCase().trim() === searchKey.toLowerCase() || k.toLowerCase().includes(searchKey.toLowerCase()))
          );
          return foundKey ? fila[foundKey] : undefined;
        };

        const fechaValor = findVal(['fecha', 'date', 'fec']);
        const tarjetaValor = findVal(['tarjeta', 'card', 'n. tarjeta', 'no. tarjeta', 'n.tarjeta', 'no.tarjeta', 'numero', 'n.']);
        const claveValor = findVal(['clave', 'id', 'codigo', 'cod']);
        const clienteValor = findVal(['cliente', 'nombre', 'customer', 'tercero']);
        const articuloValor = findVal(['articulo', 'item', 'producto']);
        const vendedorValor = findVal(['vendedor', 'vende', 'seller']);
        const pendienteValor = findVal(['pendiente', 'saldo', 'balance', 'monto']);
        
        const record = {
          fecha: parsearFecha(fechaValor),
          clave: String(claveValor ?? '').trim(),
          numeroTarjeta: String(tarjetaValor ?? '').trim(),
          cliente: String(clienteValor ?? '').toUpperCase().trim(),
          articulo: String(articuloValor ?? '').toUpperCase().trim(),
          vendedor: String(vendedorValor ?? '').toUpperCase().trim(),
          pendiente: Number(pendienteValor ?? 0),
          zoneId: bulkZoneId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (record.cliente) {
          addDocumentNonBlocking(collection(db, 'digitalCards'), record);
        }
        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }
      toast({ title: "Éxito", description: `${total} clientes importados.` });
      setIsBulkOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleVaciarZonaConfirmado = async () => {
    if (!selectedZone || selectedZone === 'Todas' || selectedZone === '') {
      toast({ title: "Atención", description: "Debes seleccionar una zona específica para vaciar.", variant: "destructive" });
      return;
    }
    setIsVaciarLoading(true);
    setIsVaciarDialogOpen(false);
    try {
      const q = query(collection(db, 'digitalCards'), where('zoneId', '==', selectedZone));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast({ title: "Información", description: "No hay registros en esta zona." });
        setIsVaciarLoading(false);
        return;
      }
      const batchSize = 500;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      toast({ title: "Éxito", description: `Zona vaciada correctamente.` });
    } catch (error: any) {
      toast({ title: "Error", description: "Error al vaciar la zona.", variant: "destructive" });
    } finally {
      setIsVaciarLoading(false);
    }
  };

  if (!mounted || zonesLoading || cardsLoading || isUserLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="size-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline tracking-tight uppercase">Base de Datos de Cuentas</h1>
          <p className="text-muted-foreground">Gestión profesional de carteras y reportes de zona en ReporteHN.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedZone !== 'Todas' && (
            <Button variant="destructive" size="sm" onClick={() => setIsVaciarDialogOpen(true)} disabled={isVaciarLoading}>
              {isVaciarLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <AlertTriangle className="mr-2 size-4" />} Vaciar Zona
            </Button>
          )}
          <Button variant="outline" className="border-primary text-primary" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />} Descargar PDF
          </Button>
          <Button variant="outline" className="border-accent text-accent" onClick={() => setIsBulkOpen(true)}>
            <Upload className="mr-2 size-4" /> Carga Masiva
          </Button>
          <Button className="bg-primary" onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 size-4" /> Nuevo Registro
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#1E3A8A] border-none text-white shadow-xl overflow-hidden">
        <CardContent className="p-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-white/20 backdrop-blur-xl rounded-2xl shadow-inner border border-white/40">
                  <CreditCard className="size-12 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-white/80 font-bold uppercase text-xs tracking-[0.25em]">Monto Total de Cartera</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white/90">L.</span>
                    <h2 className="text-5xl font-black tracking-tighter">
                      {totalSum.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="hidden md:block h-16 w-px bg-white/20" />

              <div className="flex items-center gap-6">
                <div className="p-5 bg-white/20 backdrop-blur-xl rounded-2xl shadow-inner border border-white/40">
                  <Users className="size-12 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-white/80 font-bold uppercase text-xs tracking-[0.25em]">Cantidad de Clientes</p>
                  <h2 className="text-5xl font-black tracking-tighter">
                    {processedRecords.length}
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex-1 space-y-2">
          <Label className="font-bold text-primary uppercase text-xs">Buscar Cliente</Label>
          <Input placeholder="Nombre, clave o tarjeta..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-50 border-slate-200" />
        </div>
        <div className="w-full md:w-[250px] space-y-2">
          <Label className="font-bold text-primary uppercase text-xs">Filtrar por Zona</Label>
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las Zonas</SelectItem>
              {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden ring-1 ring-primary/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-primary cursor-pointer hover:bg-primary/5" onClick={() => handleSort('fecha')}><div className="flex items-center gap-1">FECHA <SortIcon column="fecha" /></div></TableHead>
                <TableHead className="font-bold text-primary cursor-pointer hover:bg-primary/5" onClick={() => handleSort('clave')}><div className="flex items-center gap-1">CLAVE <SortIcon column="clave" /></div></TableHead>
                <TableHead className="font-bold text-primary text-center cursor-pointer hover:bg-primary/5" onClick={() => handleSort('numeroTarjeta')}><div className="flex items-center justify-center gap-1">N. TARJETA <SortIcon column="numeroTarjeta" /></div></TableHead>
                <TableHead className="font-bold text-primary cursor-pointer hover:bg-primary/5" onClick={() => handleSort('cliente')}><div className="flex items-center gap-1">CLIENTE <SortIcon column="cliente" /></div></TableHead>
                <TableHead className="font-bold text-primary">ARTÍCULO</TableHead>
                <TableHead className="text-right font-bold text-primary cursor-pointer hover:bg-primary/5" onClick={() => handleSort('pendiente')}><div className="flex items-center justify-end gap-1">PENDIENTE (L.) <SortIcon column="pendiente" /></div></TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRecords.map((record) => (
                <TableRow key={record.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="text-xs font-mono">{renderFecha(record.fecha)}</TableCell>
                  <TableCell className="text-xs font-mono">{record.clave}</TableCell>
                  <TableCell className="font-bold text-center text-primary">{String(record.numeroTarjeta || '')}</TableCell>
                  <TableCell className="font-black text-slate-900 uppercase">{record.cliente}</TableCell>
                  <TableCell className="text-xs text-muted-foreground uppercase italic">{record.articulo}</TableCell>
                  <TableCell className="text-right font-black text-blue-800">L. {Number(record.pendiente || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><div className="flex justify-end"><Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'digitalCards', record.id))}><Trash2 className="size-4" /></Button></div></TableCell>
                </TableRow>
              ))}
              {processedRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">No se encontraron registros.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Nuevo Registro de Cuenta</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha (DD/MM/YYYY)</Label><Input value={newRecord.fecha} onChange={(e) => setNewRecord({...newRecord, fecha: e.target.value})} /></div>
              <div className="space-y-2"><Label>Clave</Label><Input value={newRecord.clave} onChange={(e) => setNewRecord({...newRecord, clave: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label>Zona</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRecord.zoneId} onChange={(e) => setNewRecord({...newRecord, zoneId: e.target.value})}>
                <option value="">Seleccionar Zona</option>
                {zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Cliente</Label><Input value={newRecord.cliente} onChange={(e) => setNewRecord({...newRecord, cliente: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>N. Tarjeta</Label><Input value={newRecord.numeroTarjeta} onChange={(e) => setNewRecord({...newRecord, numeroTarjeta: e.target.value})} /></div>
              <div className="space-y-2"><Label>Pendiente</Label><Input type="number" value={newRecord.pendiente} onChange={(e) => setNewRecord({...newRecord, pendiente: Number(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!newRecord.cliente || !newRecord.zoneId) return;
              addDocumentNonBlocking(collection(db, 'digitalCards'), { ...newRecord, cliente: newRecord.cliente.toUpperCase(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
              setIsAddOpen(false);
            }}>Guardar Cuenta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Carga Masiva de Cuentas</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Zona de Destino</Label>
              <Select value={bulkZoneId} onValueChange={setBulkZoneId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar Zona" /></SelectTrigger>
                <SelectContent>{zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archivo Excel (.xlsx)</Label>
              <Input type="file" accept=".xlsx" onChange={handleBulkUpload} disabled={!bulkZoneId || isUploading} />
            </div>
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center text-primary font-bold">Importando Cuentas... {uploadProgress}%</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isVaciarDialogOpen} onOpenChange={setIsVaciarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación masiva?</AlertDialogTitle>
            <AlertDialogDescription>¿Estás seguro que deseas vaciar todos los registros de la zona seleccionada? Esta acción eliminará permanentemente todas las cuentas de esta zona.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVaciarZonaConfirmado} className="bg-destructive">Confirmar Vaciado</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
