"use client";

import { useState, type FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Category,
  Calendar,
  Filter,
  Link21,
  Profile2User,
  Chart2,
  Setting2,
  MessageQuestion,
  Buildings2,
  ArrowLeft2,
  ArrowDown2,
  LogoutCurve,
  ShieldTick,
  type IconProps,
} from "iconsax-reactjs";
import { ClivaLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavIcon = FC<IconProps>;

interface NavItem {
  href: string;
  label: string;
  Icon: NavIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", Icon: Category }] },
  {
    label: "Gestão",
    items: [
      { href: "/schedule", label: "Agenda", Icon: Calendar },
      { href: "/flows", label: "Funis", Icon: Filter },
      { href: "/bio", label: "Link na Bio", Icon: Link21 },
      { href: "/leads", label: "Leads", Icon: Profile2User },
    ],
  },
  {
    label: "Análise",
    items: [{ href: "/analytics", label: "Analytics", Icon: Chart2 }],
  },
];

const BOTTOM: NavItem[] = [
  { href: "/settings", label: "Configurações", Icon: Setting2 },
];

const ACTIVE_COLOR = "#15803d"; // green-700
const IDLE_COLOR = "#64748b"; // slate-500

export interface SidebarProps {
  orgName?: string;
  userName?: string;
  userRole?: string;
  isAdmin?: boolean;
}

export function Sidebar({ orgName, userName, userRole, isAdmin }: SidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const initials = (userName || orgName || "P")
    .split(" ")
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const NavLink = ({ href, label, Icon }: NavItem) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "group flex items-center rounded-lg text-sm font-medium transition-colors",
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? "bg-white/70 text-emerald-700 shadow-sm ring-1 ring-white/70 backdrop-blur"
            : "text-slate-600 hover:bg-white/50 hover:text-slate-900",
        )}
      >
        <Icon
          size={22}
          variant="Bulk"
          color={active ? ACTIVE_COLOR : IDLE_COLOR}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-3 z-30 m-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/55 shadow-xl shadow-emerald-950/5 backdrop-blur-2xl transition-[width] duration-300 md:flex",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-b before:from-white/70 before:to-transparent",
        collapsed ? "w-[80px]" : "w-64",
      )}
    >
      {/* Logo + collapse */}
      <div
        className={cn(
          "flex border-b border-white/50 px-4 py-4",
          collapsed
            ? "flex-col items-center gap-3"
            : "items-center justify-between",
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <ClivaLogo size={32} showWordmark={!collapsed} />
        </Link>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="flex h-7 w-7 items-center justify-center rounded-full border bg-white text-slate-500 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft2
            size={16}
            color="currentColor"
            className={cn("transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Clinic selector */}
      <div className="px-3 pt-4">
        <button
          className={cn(
            "flex w-full items-center rounded-xl border border-white/60 bg-white/50 backdrop-blur transition-colors hover:bg-white/70",
            collapsed ? "justify-center p-2" : "gap-3 p-3",
          )}
          title="Trocar de clínica"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <Buildings2 size={20} variant="Bulk" color={ACTIVE_COLOR} />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {orgName || "Minha Clínica"}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  Pré-atendimento
                </span>
              </span>
              <ArrowDown2 size={16} color={IDLE_COLOR} />
            </>
          )}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {group.label && !collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="mx-auto mb-2 h-px w-6 bg-slate-100" />
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-5">
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Plataforma
              </p>
            )}
            <NavLink href="/admin" label="Admin geral" Icon={ShieldTick} />
          </div>
        )}
      </nav>

      {/* Bottom: settings + support + profile */}
      <div className="border-t border-white/50 px-3 py-3">
        <div className="flex flex-col gap-1">
          {BOTTOM.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <a
            href="mailto:suporte@cliva.app"
            title={collapsed ? "Suporte" : undefined}
            className={cn(
              "group flex items-center rounded-lg text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
            )}
          >
            <MessageQuestion size={22} variant="Bulk" color={IDLE_COLOR} />
            {!collapsed && <span>Suporte</span>}
          </a>
        </div>

        <div
          className={cn(
            "mt-3 flex items-center border-t border-white/50 pt-3",
            collapsed ? "justify-center" : "gap-3 px-1",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            {initials || "P"}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {userName || "Minha conta"}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {userRole || "Proprietário"}
                </span>
              </span>
              <Link
                href="/login"
                aria-label="Sair"
                className="text-slate-400 transition-colors hover:text-red-500"
              >
                <LogoutCurve size={20} color="currentColor" />
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
