"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Bell,
  Package,
  Users,
  UserCircle,
  FileSpreadsheet,
  BarChart3,
  Zap,
  Megaphone,
  Target,
  Settings,
  X,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: "Operaciones",
    items: [
      { href: "/backoffice", label: "Dashboard", icon: LayoutDashboard },
      { href: "/backoffice/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/backoffice/citas", label: "Citas", icon: ClipboardList },
      { href: "/backoffice/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/backoffice/recordatorios", label: "Recordatorios", icon: Bell },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/backoffice/servicios", label: "Servicios", icon: Package },
      { href: "/backoffice/profesionales", label: "Profesionales", icon: Users },
      { href: "/backoffice/clientes", label: "Clientes", icon: UserCircle },
    ],
  },
  {
    label: "Negocio",
    items: [
      { href: "/backoffice/sesiones", label: "Sesiones", icon: FileSpreadsheet },
      { href: "/backoffice/metricas/depilacion", label: "Depilación", icon: Zap },
      { href: "/backoffice/metricas", label: "Métricas", icon: BarChart3 },
      { href: "/backoffice/segmentacion", label: "Segmentación", icon: Target },
      { href: "/backoffice/automatizaciones", label: "Campañas", icon: Megaphone },
    ],
  },
  {
    label: "Config",
    items: [
      { href: "/backoffice/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
  email?: string;
  inboxUnreadCount?: number;
}

export default function Sidebar({ collapsed = false, onClose, email, inboxUnreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full h-full bg-brand flex flex-col overflow-hidden">
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-white/10 h-[53px]",
        collapsed ? "justify-center px-0" : "justify-between px-4"
      )}>
        {collapsed ? (
          <span className="text-xl font-bold text-white">V</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-tight">VAIG</span>
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Studio</span>
          </div>
        )}
        {onClose && !collapsed && (
          <button
            type="button"
            className="md:hidden rounded-lg p-1.5 text-white/70 hover:bg-white/10 transition-colors"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {section.label}
                </span>
              </div>
            )}
            <div className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
              {section.items.map((item) => {
                const isActive =
                  item.href === "/backoffice" || item.href === "/backoffice/metricas"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                const Icon = item.icon;

                const showBadge = item.href === "/backoffice/inbox" && inboxUnreadCount > 0;

                const linkEl = (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      isActive
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="relative shrink-0">
                      <Icon className="h-5 w-5" />
                      {showBadge && collapsed && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                          {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                        </span>
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href} content={item.label} side="right">
                      {linkEl}
                    </Tooltip>
                  );
                }

                return <div key={item.href}>{linkEl}</div>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info at bottom */}
      {email && (
        <div className={cn(
          "border-t border-white/10 py-3",
          collapsed ? "px-1.5 flex justify-center" : "px-4"
        )}>
          {collapsed ? (
            <Tooltip content={email} side="right">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                {email.charAt(0).toUpperCase()}
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                {email.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs text-white/60">{email}</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
