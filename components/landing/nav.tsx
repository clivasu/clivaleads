"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X, Headphones, ArrowRight } from "lucide-react";
import { ClivaLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#modelos", label: "Modelos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "Dúvidas" },
];

export function LandingNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  return (
    <>
      {/* barra de utilidades */}
      <div className="hidden border-b border-emerald-900/5 bg-white/60 backdrop-blur md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 text-xs text-slate-500">
          <a href="mailto:suporte@cliva.app" className="flex items-center gap-1.5 hover:text-emerald-700">
            <Headphones className="h-3.5 w-3.5" /> Suporte ao cliente
          </a>
          <div className="flex items-center gap-4">
            <span>7 dias grátis para testar</span>
            <Link href="/login" className="font-medium text-slate-700 hover:text-emerald-700">Entrar / Criar conta</Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 px-3 pt-3 md:px-6">
        <motion.nav
          animate={{ maxWidth: scrolled ? 1040 : 1280 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "mx-auto flex items-center justify-between rounded-2xl border px-4 transition-[background,box-shadow,border-color,padding] duration-300 md:px-5",
            scrolled
              ? "h-14 border-white/70 bg-white/75 shadow-lg shadow-emerald-950/5 backdrop-blur-xl"
              : "h-16 border-transparent bg-transparent",
          )}
        >
          <Link href="/" aria-label="Cliva — início"><ClivaLogo size={30} wordmarkClassName="font-display text-xl" /></Link>

          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:text-emerald-700 sm:block">Entrar</Link>
            <Link
              href="/login?cadastro=1"
              className="group hidden items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:flex"
            >
              Testar grátis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-700 lg:hidden" aria-label="Abrir menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.nav>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/70 bg-white/95 p-3 shadow-xl backdrop-blur-xl lg:hidden"
            >
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-medium text-slate-700 hover:bg-emerald-50">
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" className="rounded-xl border px-3 py-3 text-center text-sm font-semibold text-slate-700">Entrar</Link>
                <Link href="/login?cadastro=1" className="rounded-xl bg-emerald-600 px-3 py-3 text-center text-sm font-semibold text-white">Testar grátis</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
