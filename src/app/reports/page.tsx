
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
import { 
  FileDown,
  Loader2,
  PieChart as PieChartIcon,
  Users as UsersIcon,
  Package as PackageIcon,
  Calendar as CalendarIcon,
  BarChart3,
  MapPin,
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export default function ReportsPage(props: { params: Promise<any>, searchParams: Promise<any> }) {
  use(props.params);
  use(props.searchParams);

  const [mounted, setMounted] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('Todas');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();

  const zonesQuery = useMemoFirebase(() => collection(db, 'zones'), [db]);
  const { data: zonesData, isLoading: zonesLoading } = useCollection(zonesQuery);
  const zones = zonesData || [];

  const cardsQuery = useMemoFirebase(() => collection(db, 'digitalCards'), [db]);
  const { data: cardsData, isLoading: cardsLoading } = useCollection(cardsQuery);
  const cards = cardsData || [];
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const getFechaStr = (val: any) => {
    if (!val) return '';
    if (val instanceof Timestamp) return val.toDate().toLocaleDateString('es-HN');
    if (typeof val === 'string') return val;
    return String(val);
  };

  const filteredCards = useMemo(() => {
    if (selectedZoneId === 'Todas') return cards;
    return cards.filter(c => c.zoneId === selectedZoneId);
  }, [cards, selectedZoneId]);

  // Modificado: Ahora muestra todas las tarjetas de la zona sin filtrar por año
  const zoneReportData = useMemo(() => {
    return [...filteredCards]
      .sort((a, b) => {
        const claveA = parseInt(a.clave) || 0;
        const claveB = parseInt(b.clave) || 0;
        return claveA - claveB;
      });
  }, [filteredCards]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    // Añadimos el año actual por defecto
    years.add(new Date().getFullYear().toString());
    cards.forEach(card => {
      const fechaStr = getFechaStr(card.fecha);
      const year = fechaStr.split('/')[2];
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [cards]);

  const annualTotals = useMemo(() => {
    const totals: Record<string, { total: number, count: number }> = {};
    filteredCards.forEach(card => {
      const fechaStr = getFechaStr(card.fecha);
      const year = fechaStr.split('/')[2] || 'S/N';
      const amount = Number(card.pendiente) || 0;
      if (!totals[year]) totals[year] = { total: 0, count: 0 };
      totals[year].total += amount;
      totals[year].count += 1;
    });
    return Object.entries(totals).map(([year, data]) => ({ 
      year, 
      ...data 
    })).sort((a, b) => b.year.localeCompare(a.year));
  }, [filteredCards]);

  const sellerStatsByYear = useMemo(() => {
    const stats: Record<string, Record<string, { total: number, count: number }>> = {};
    filteredCards.forEach(card => {
      const fechaStr = getFechaStr(card.fecha);
      const year = fechaStr.split('/')[2] || 'S/N';
      const seller = card.vendedor?.trim().toUpperCase() || 'DESCONOCIDO';
      const amount = Number(card.pendiente) || 0;
      if (!stats[year]) stats[year] = {};
      if (!stats[year][seller]) stats[year][seller] = { total: 0, count: 0 };
      stats[year][seller].total += amount;
      stats[year][seller].count += 1;
    });
    return Object.entries(stats).map(([year, sellers]) => ({
      year,
      sellers: Object.entries(sellers).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total),
      yearTotal: Object.values(sellers).reduce((acc, curr) => acc + curr.total, 0)
    })).sort((a, b) => b.year.localeCompare(a.year));
  }, [filteredCards]);

  const itemStats = useMemo(() => {
    const stats: Record<string, { total: number, count: number }> = {};
    filteredCards.forEach(card => {
      const item = card.articulo?.trim().toUpperCase() || 'SIN ARTÍCULO';
      const amount = Number(card.pendiente) || 0;
      if (!stats[item]) stats[item] = { total: 0, count: 0 };
      stats[item].total += amount;
      stats[item].count += 1;
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
  }, [filteredCards]);

  const handleDownloadZoneReportPDF = () => {
    if (zoneReportData.length === 0) {
      toast({ title: "Atención", description: "No hay datos para la zona seleccionada.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const BLUE_DARK = '#1E3A8A';
      const BORDER_COLOR = '#000000';
      
      const zoneName = zones.find(z => z.id === selectedZoneId)?.name || 'REPORTE GLOBAL';
      const titleText = `${zoneName.toUpperCase()} ${selectedYear}`;

      const tableData = zoneReportData.map(card => [
        card.clave || '',
        card.numeroTarjeta || '',
        `${(Number(card.pendiente) || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`,
        '', '', '', '', '', '', '', '', '', '' 
      ]);

      autoTable(doc, {
        head: [['CLAVE', 'N. TARJETA', 'Pendiente', '', '', '', '', '', '', '', '', '', '']],
        body: tableData,
        theme: 'grid',
        startY: 25,
        margin: { top: 25, left: 10, right: 10, bottom: 15 },
        styles: { 
          fontSize: 9, 
          cellPadding: 2.5, 
          lineColor: BORDER_COLOR, 
          lineWidth: 0.15,
          valign: 'middle',
          textColor: '#000000'
        },
        headStyles: { 
          fillColor: BLUE_DARK, 
          textColor: '#FFFFFF', 
          fontStyle: 'bold', 
          halign: 'center',
          minCellHeight: 12
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 28, halign: 'center' },
          2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 18 },
          6: { cellWidth: 18 }, 7: { cellWidth: 18 }, 8: { cellWidth: 18 },
          9: { cellWidth: 18 }, 10: { cellWidth: 18 }, 11: { cellWidth: 18 },
          12: { cellWidth: 18 }
        },
        didDrawPage: (data) => {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(BLUE_DARK);
          doc.text(titleText, 10, 15);
          
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(`Página ${data.pageNumber} de ${doc.getNumberOfPages()}`, 260, 15, { align: 'right' });
        }
      });

      doc.save(`reporte_${zoneName.replace(/\s+/g, '_').toLowerCase()}_${selectedYear}.pdf`);
      toast({ title: "Éxito", description: "Reporte de zona generado correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el reporte.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadAnnualPDF = async () => {
    if (annualTotals.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const BLUE_MAIN = '#1D4ED8';
      const BLUE_DARK = '#1E3A8A';
      const ZEBRA_GRAY = '#F5F6F7';
      const BORDER_GRAY = '#DDDDDD';
      const MARGIN = 15;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLUE_MAIN);
      doc.text('ESTADO DE LA CARTERA POR AÑO', MARGIN, 20);

      const chartElement = document.getElementById('annual-chart-container');
      if (chartElement) {
        const canvas = await html2canvas(chartElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', MARGIN, 25, 250, 80);
      }

      const totalAmount = annualTotals.reduce((acc, curr) => acc + curr.total, 0);
      const tableData = annualTotals.map(item => [item.year, item.count, `L. ${item.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`]);

      autoTable(doc, {
        startY: 115,
        margin: { left: MARGIN, right: MARGIN },
        head: [['AÑO', 'CANTIDAD DE CUENTAS', 'VALOR TOTAL PENDIENTE (L.)']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: BLUE_DARK, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 12 },
        bodyStyles: { fontSize: 10, minCellHeight: 10, valign: 'middle', lineColor: BORDER_GRAY, lineWidth: 0.1 },
        alternateRowStyles: { fillColor: ZEBRA_GRAY },
        columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        foot: [[`TOTAL CARTERA`, '', `L. ${totalAmount.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` ]],
        footStyles: { fillColor: BLUE_MAIN, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'right' }
      });

      doc.save(`Estado_Cartera_Anual_ReporteHN.pdf`);
      toast({ title: "Éxito", description: "Reporte anual con gráfica generado." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadSellersPDF = async () => {
    if (sellerStatsByYear.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const BLUE_MAIN = '#1D4ED8';
      const BLUE_DARK = '#1E3A8A';
      const ZEBRA_GRAY = '#F5F6F7';
      const BORDER_GRAY = '#DDDDDD';
      const MARGIN = 15;
      
      for (let i = 0; i < sellerStatsByYear.length; i++) {
        const yearData = sellerStatsByYear[i];
        if (i > 0) doc.addPage();

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(BLUE_MAIN);
        doc.text(`RENDIMIENTO DE VENDEDORES ${yearData.year}`, MARGIN, 20);

        const chartElement = document.getElementById(`seller-chart-${yearData.year}`);
        if (chartElement) {
          const canvas = await html2canvas(chartElement, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', MARGIN, 25, 250, 70);
        }

        const tableData = yearData.sellers.map(s => [
          s.name, 
          s.count.toString(), 
          `L. ${s.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
          startY: 105,
          margin: { left: MARGIN, right: MARGIN },
          head: [['VENDEDOR', 'CANTIDAD DE CUENTAS', 'VALOR TOTAL (L.)']],
          body: tableData,
          theme: 'plain',
          headStyles: { fillColor: BLUE_DARK, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 12 },
          bodyStyles: { fontSize: 10, minCellHeight: 10, valign: 'middle', lineColor: BORDER_GRAY, lineWidth: 0.1 },
          alternateRowStyles: { fillColor: ZEBRA_GRAY },
          columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
          foot: [[`TOTAL ${yearData.year}`, '', `L. ${yearData.yearTotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` ]],
          footStyles: { fillColor: BLUE_MAIN, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'right' }
        });

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ReporteHN - Página ${i + 1} de ${sellerStatsByYear.length}`, 139.7, 205, { align: 'center' });
      }

      doc.save(`Rendimiento_Vendedores_ReporteHN.pdf`);
      toast({ title: "Éxito", description: "Reporte de vendedores con gráficas generado." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadArticlesPDF = () => {
    if (itemStats.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const BLUE_MAIN = '#1D4ED8';
      const BLUE_DARK = '#1E3A8A';
      const ZEBRA_GRAY = '#F5F6F7';
      const BORDER_GRAY = '#DDDDDD';
      const MARGIN = 15;
      
      const totalAmount = itemStats.reduce((acc, curr) => acc + curr.total, 0);
      const totalCount = itemStats.reduce((acc, curr) => acc + curr.count, 0);
      const tableData = itemStats.map(item => [item.name, item.count, `L. ${item.total.toLocaleString()}`]);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLUE_MAIN);
      doc.text('RESUMEN DE ARTÍCULOS POR CARTERA', MARGIN, 20);

      autoTable(doc, {
        startY: 30,
        margin: { left: MARGIN, right: MARGIN },
        head: [['ARTÍCULO', 'CANTIDAD', 'VALOR TOTAL (L.)']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: BLUE_DARK, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 12 },
        bodyStyles: { fontSize: 10, minCellHeight: 10, valign: 'middle', lineColor: BORDER_GRAY, lineWidth: 0.1 },
        alternateRowStyles: { fillColor: ZEBRA_GRAY },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        foot: [[`TOTAL GENERAL`, totalCount.toString(), `L. ${totalAmount.toLocaleString()}`]],
        footStyles: { fillColor: BLUE_MAIN, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold', halign: 'right' }
      });

      doc.save(`Resumen_Articulos_ReporteHN.pdf`);
      toast({ title: "Éxito", description: "Reporte de Artículos generado." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!mounted || zonesLoading || cardsLoading) return <div className="flex h-full items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline uppercase">Análisis e Informes</h1>
          <p className="text-muted-foreground text-sm">Informes detallados por año, zona, vendedor y artículo en ReporteHN.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
            <SelectTrigger className="w-full md:w-[250px] bg-white shadow-sm border-slate-200">
              <SelectValue placeholder="Zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Global - Todas las Zonas</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full md:w-[120px] bg-white shadow-sm border-slate-200">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="anual" className="w-full">
        <TabsList className="bg-slate-100 p-1 mb-6 border border-slate-200 overflow-x-auto flex flex-nowrap w-full justify-start md:justify-center">
          <TabsTrigger value="anual" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <CalendarIcon className="size-4 mr-2" /> Estado Anual
          </TabsTrigger>
          <TabsTrigger value="zona" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <MapPin className="size-4 mr-2" /> Reporte por Zona
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <UsersIcon className="size-4 mr-2" /> Vendedores
          </TabsTrigger>
          <TabsTrigger value="articulos" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <PackageIcon className="size-4 mr-2" /> Artículos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zona" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="bg-primary/5 px-4 py-2 rounded-lg border border-primary/10">
              <p className="text-xs font-bold text-primary uppercase">Zona: {zones.find(z => z.id === selectedZoneId)?.name || 'Selecciona una zona específica'}</p>
              <p className="text-sm font-black text-blue-900">{zoneReportData.length} registros cargados de la base de datos</p>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white shadow-lg"
              onClick={handleDownloadZoneReportPDF}
              disabled={isGeneratingPdf || selectedZoneId === 'Todas' || zoneReportData.length === 0}
            >
              {isGeneratingPdf ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
              Descargar PDF Hoja de Control
            </Button>
          </div>

          <Card className="border-none shadow-xl overflow-hidden ring-1 ring-slate-100">
            <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                  <CheckSquare className="size-5" /> Hoja de Control Físico - {selectedYear}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Diseñado para marcaje manual y auditoría en campo.</p>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader className="bg-[#1E3A8A]">
                  <TableRow>
                    <TableHead className="w-[80px] font-bold text-white text-center border border-black/20">CLAVE</TableHead>
                    <TableHead className="w-[120px] font-bold text-white text-center border border-black/20">N. TARJETA</TableHead>
                    <TableHead className="w-[150px] font-bold text-white text-right border border-black/20">Pendiente</TableHead>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableHead key={i} className="w-[45px] border border-black/20 bg-[#1E3A8A]"></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zoneReportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-20 text-muted-foreground">
                        Selecciona una zona específica para cargar las tarjetas de la base de datos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    zoneReportData.map((row) => (
                      <TableRow key={row.id} className="hover:bg-slate-50 transition-colors h-11">
                        <TableCell className="text-center font-bold text-black border border-slate-200">{row.clave}</TableCell>
                        <TableCell className="text-center font-mono text-black border border-slate-200">{row.numeroTarjeta}</TableCell>
                        <TableCell className="text-right font-black text-black border border-slate-200">
                          {Number(row.pendiente || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <TableCell key={i} className="border border-slate-200 p-0">
                            <div className="h-full w-full"></div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anual" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-end">
            <Button variant="outline" className="border-primary text-primary" onClick={handleDownloadAnnualPDF} disabled={isGeneratingPdf || annualTotals.length === 0}>
              {isGeneratingPdf ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />} Descargar PDF Estado Anual
            </Button>
          </div>

          <div className="grid md:grid-cols-7 gap-6">
            <Card className="md:col-span-4 border-none shadow-md overflow-hidden ring-1 ring-slate-100">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-sm font-bold text-primary uppercase flex items-center gap-2">
                  <BarChart3 className="size-4" /> Comparativa de Cartera por Año
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div id="annual-chart-container" className="h-[300px] bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={annualTotals}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="year" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {annualTotals.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#1D4ED8' : '#3B82F6'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3 border-none shadow-md overflow-hidden ring-1 ring-slate-100">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-sm font-bold text-primary uppercase">Resumen Técnico de Cartera</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-primary">AÑO</TableHead>
                      <TableHead className="text-center text-xs font-bold text-primary">CLIENTES</TableHead>
                      <TableHead className="text-right text-xs font-bold text-primary">MONTO (L.)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualTotals.map(row => (
                      <TableRow key={row.year} className="hover:bg-slate-50 border-slate-100">
                        <TableCell className="font-bold text-slate-700">{row.year}</TableCell>
                        <TableCell className="text-center font-mono">{row.count}</TableCell>
                        <TableCell className="text-right font-black text-blue-800">L. {row.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-end">
            <Button variant="outline" className="border-primary text-primary" onClick={handleDownloadSellersPDF} disabled={isGeneratingPdf || sellerStatsByYear.length === 0}>
              {isGeneratingPdf ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />} Descargar PDF Vendedores
            </Button>
          </div>

          {sellerStatsByYear.length === 0 ? (
            <Card className="p-20 text-center text-muted-foreground">No hay datos suficientes para generar estadísticas de vendedores.</Card>
          ) : (
            sellerStatsByYear.map(yearData => (
              <Card key={yearData.year} className="border-none shadow-md overflow-hidden ring-1 ring-slate-100 mb-8">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Rendimiento Vendedores {yearData.year} - Total: L. {yearData.yearTotal.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div id={`seller-chart-${yearData.year}`} className="h-[250px] bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yearData.sellers}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            {yearData.sellers.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#1D4ED8' : '#3B82F6'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200">
                            <TableHead className="text-xs font-bold text-primary uppercase">Vendedor</TableHead>
                            <TableHead className="text-center text-xs font-bold text-primary uppercase">Clientes</TableHead>
                            <TableHead className="text-right text-xs font-bold text-primary uppercase">Total (L.)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearData.sellers.map(s => (
                            <TableRow key={s.name} className="border-slate-100">
                              <TableCell className="text-xs font-bold text-slate-700">{s.name}</TableCell>
                              <TableCell className="text-center text-xs">{s.count}</TableCell>
                              <TableCell className="text-right font-black text-blue-800 text-xs">L. {s.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="articulos" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-end">
            <Button variant="outline" className="border-primary text-primary" onClick={handleDownloadArticlesPDF} disabled={isGeneratingPdf || itemStats.length === 0}>
              {isGeneratingPdf ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />} Descargar PDF Artículos
            </Button>
          </div>
          
          <Card className="border-none shadow-md overflow-hidden ring-1 ring-slate-100">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                <PieChartIcon className="size-5" /> Distribución por Artículos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold text-primary uppercase text-xs">Artículo / Producto</TableHead>
                    <TableHead className="text-center font-bold text-primary uppercase text-xs">Cantidad</TableHead>
                    <TableHead className="text-right font-bold text-primary uppercase text-xs">Valor Total en Cartera (L.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemStats.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No se encontraron artículos.</TableCell></TableRow>
                  ) : (
                    itemStats.map(item => (
                      <TableRow key={item.name} className="hover:bg-slate-50 transition-colors border-slate-100">
                        <TableCell className="font-bold text-xs uppercase text-slate-700">{item.name}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{item.count}</TableCell>
                        <TableCell className="text-right font-black text-blue-800 text-xs">L. {item.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
