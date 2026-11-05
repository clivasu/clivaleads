"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar, Category, Chart2, Filter, HamburgerMenu, Link21, LogoutCurve, MessageQuestion,
  Profile, Profile2User, Setting2, ShieldTick, type IconProps,
} from "iconsax-reactjs";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

// Navegação do celular (o menu lateral só aparece a partir de telas médias).
type Item = { href: string; label: string; Icon: React.FC<IconProps> };

const TABS: Item[] = [
  { href: "/dashboard", label: "Início", Icon: Category },
  { href: "/schedule", label: "Agenda", Icon: Calendar },
  { href: "/patients", label: "Pacientes", Icon: Profile },
  { href: "/leads", label: "Leads", Icon: Profile2User },
];
const MORE: Item[] = [
  { href: "/flows", label: "Funis", Icon: Filter },
  { href: "/bio", label: "Link na Bio", Icon: Link21 },
  { href: "/analytics", label: "Analytics", Icon: Chart2 },
  { href: "/settings", label: "Configurações", Icon: Setting2 },
];

const ACTIVE = "#15803d";
const IDLE = "#64748b";

export function MobileNav({ orgName, userName, isAdmin }: { orgName?: string; userName?: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const items = isAdmin ? [...MORE, { href: "/admin", label: "Admin geral", Icon: ShieldTick }] : MORE;
  const moreActive = items.some((i) => isActive(i.href));

  // Fecha a folha ao trocar de página e com a tecla Esc.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reação à navegação
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Mais opções"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pt-4 shadow-2xl pb-[calc(4.75rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{orgName || "Sua clínica"}</p>
                {userName && <p className="truncate text-xs text-slate-500">{userName}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {items.map(({ href, label, Icon }) => {
                const on = isActive(href);
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
                    className={cn("flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium", on ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700")}>
                    <Icon size={20} variant="Bulk" color={on ? ACTIVE : IDLE} /> {label}
                  </Link>
                );
              })}
              <a href="mailto:suporte@cliva.app" className="flex min-h-12 items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                <MessageQuestion size={20} variant="Bulk" color={IDLE} /> Suporte
              </a>
              <SignOutButton className="flex min-h-12 items-center gap-2.5 rounded-xl bg-rose-50 px-3 py-3 text-left text-sm font-medium text-rose-700 disabled:opacity-50">
                <LogoutCurve size={20} color="currentColor" /> Sair
              </SignOutButton>
            </nav>
          </div>
        </div>
      )}

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid h-[60px] grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const on = isActive(href) && !open;
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
                className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", on ? "text-emerald-700" : "text-slate-500")}>
                <Icon size={22} variant="Bulk" color={on ? ACTIVE : IDLE} />
                {label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", open || moreActive ? "text-emerald-700" : "text-slate-500")}>
            <HamburgerMenu size={22} color={open || moreActive ? ACTIVE : IDLE} />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
