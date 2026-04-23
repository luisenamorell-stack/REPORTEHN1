
"use client"

import { 
  Database, 
  LayoutDashboard, 
  RefreshCcw, 
  FileText, 
  Calculator,
  CreditCard
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { title: "Panel de Control", url: "/", icon: LayoutDashboard },
  { title: "Base de Datos", url: "/digital-cards", icon: Database },
  { title: "Reconciliación", url: "/reconcile", icon: RefreshCcw },
  { title: "Cuadre de Tarjetas", url: "/cuadre", icon: Calculator },
  { title: "Informes de Zona", url: "/reports", icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-primary/10">
        <div className="flex items-center gap-2">
          {/* Ícono de tarjeta azul */}
          <CreditCard className="size-5 text-[#1D4ED8] shrink-0" />
          
          {/* Grupo de marca - Visible solo cuando está expandido */}
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <span className="text-xl font-[800] text-[#1E3A8A] tracking-tight">Reporte</span>
            <div className="bg-[#1D4ED8] px-2 py-0.5 rounded-[6px] flex items-center justify-center">
              <span className="text-white text-lg font-[800] leading-none">HN</span>
            </div>
          </div>

          {/* Estado compacto para sidebar colapsada */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
            <div className="bg-[#1D4ED8] size-8 flex items-center justify-center rounded-[6px]">
              <span className="text-white text-xs font-[800]">HN</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Navegación Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="size-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
