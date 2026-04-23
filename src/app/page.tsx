"use client"

import { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  MapPin,
  TrendingUp,
  CreditCard,
  Loader2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function Dashboard(props: { params: Promise<any>, searchParams: Promise<any> }) {
  use(props.params);
  use(props.searchParams);

  const [mounted, setMounted] = useState(false);
  const db = useFirestore();

  const zonesQuery = useMemoFirebase(() => collection(db, 'zones'), [db]);
  const { data: zonesData, isLoading: zonesLoading } = useCollection(zonesQuery);

  const cardsQuery = useMemoFirebase(() => collection(db, 'digitalCards'), [db]);
  const { data: cardsData, isLoading: cardsLoading } = useCollection(cardsQuery);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || zonesLoading || cardsLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  const cards = cardsData || [];
  const zonesList = zonesData || [];

  const zoneStats = zonesList.map(z => ({
    name: z.name,
    count: cards.filter(r => r.zoneId === z.id).length
  }));

  const totalPending = cards.reduce((acc, curr) => acc + (curr.pendiente || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-blue-900 font-headline">ReporteHN Panel</h1>
        <p className="text-muted-foreground text-sm">Resumen de carteras y deudores.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#1D4ED8] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-gray-500">Clientes</CardTitle><Users className="size-4 text-[#1D4ED8]" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-blue-900">{cards.length}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#3B82F6] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-gray-500">Pendiente</CardTitle><CreditCard className="size-4 text-[#3B82F6]" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-blue-900">L. {totalPending.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#2563EB] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-gray-500">Zonas</CardTitle><MapPin className="size-4 text-[#2563EB]" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-blue-900">{zonesList.length}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#1E3A8A] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-gray-500">Sincro</CardTitle><TrendingUp className="size-4 text-[#1E3A8A]" /></CardHeader>
          <CardContent><div className="text-2xl font-black text-blue-900">100%</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 p-6 bg-white">
          <CardTitle className="text-sm font-bold uppercase text-blue-900 mb-6">Clientes por Zona</CardTitle>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {zoneStats.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#1D4ED8' : '#3B82F6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="md:col-span-3 p-6 bg-white">
          <CardTitle className="text-sm font-bold uppercase text-blue-900 mb-6">Actividad Reciente</CardTitle>
          <div className="space-y-4">
            {cards.slice(-5).reverse().map(record => (
              <div key={record.id} className="flex items-center gap-3 border-b pb-3 border-gray-50">
                <div className="size-2 rounded-full bg-[#1D4ED8]" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-900 uppercase">{record.cliente}</p>
                  <p className="text-[10px] text-muted-foreground">L. {record.pendiente?.toLocaleString()} — {record.articulo}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}