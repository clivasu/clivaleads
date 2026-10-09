"use client";

import { useEffect, useState } from "react";
import { formatToday, greetingFor } from "@/lib/greeting";

// O servidor (Vercel, em UTC) manda a saudação no fuso de Brasília; no
// navegador ela é recalculada pela hora local e atualizada a cada minuto.
export function Greeting({ name, initialGreeting }: { name: string; initialGreeting: string }) {
  const [greeting, setGreeting] = useState(initialGreeting);
  useEffect(() => {
    const tick = () => setGreeting(greetingFor(new Date().getHours()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
      {greeting}, <span className="font-serif italic">{name}</span>
    </h1>
  );
}

export function TodayLabel({ initial }: { initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    const tick = () => setLabel(formatToday(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return <>{label}</>;
}
