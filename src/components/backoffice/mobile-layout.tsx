"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeft, Plus, LogOut, ChevronRight } from "lucide-react";
import Sidebar from "./sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface MobileLayoutProps {
  email: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}

const COLLAPSED_KEY = "sidebar_collapsed";

const BREADCRUMB_MAP: Record<string, string> = {
  backoffice: "Dashboard",
  agenda: "Agenda",
  citas: "Citas",
  nueva: "Nueva",
  editar: "Editar",
  servicios: "Servicios",
  profesionales: "Profesionales",
  clientes: "Clientes",
  sesiones: "Sesiones",
  metricas: "Métricas",
  configuracion: "Configuración",
  paquetes: "Paquetes",
  pagos: "Pagos",
  templates: "Templates",
  automatizaciones: "Campañas",
  inbox: "Inbox",
  horario: "Horario",
};

export default function MobileLayout({ email, logoutAction, children }: MobileLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      const timeout = setTimeout(() => setMobileOpen(false), 0);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  // Build breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.slice(1).map((seg) => BREADCRUMB_MAP[seg] || seg);

  return (
    <div className="flex h-screen" style={{ background: "var(--surface-subtle)" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-all duration-200 md:relative md:translate-x-0 md:flex-shrink-0 ${
          mobileOpen ? "translate-x-0 w-60" : "-translate-x-full w-60"
        } ${collapsed ? "md:w-[52px]" : "md:w-60"}`}
      >
        <Sidebar
          collapsed={collapsed}
          onClose={() => setMobileOpen(false)}
          email={email}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between bg-white px-4 py-3 md:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              type="button"
              className="hidden md:flex rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                    <span className={i === breadcrumbs.length - 1 ? "font-medium text-foreground" : ""}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick action */}
            <Link
              href="/backoffice/citas/nueva"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva cita</span>
            </Link>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
                {email.charAt(0).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
