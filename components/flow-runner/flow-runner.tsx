"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Star,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  Heart,
} from "lucide-react";
import type {
  PublicFlow,
  LeadAnswer,
  QuestionOption,
  ButtonItem,
  FlowStep,
  ContactInfo,
} from "@/lib/types";
import { NewsStep, ChartGrowthStep, ChartGaugeStep } from "@/components/flow-runner/advanced-blocks";
import { SpinWheelBlock } from "@/components/flow-runner/spin-wheel";
import { buildLeadMessage, buildWhatsappUrl } from "@/lib/whatsapp";
import { themeVars, type FlowTheme } from "@/lib/theme";
import { totalScore, tierFromScore } from "@/lib/scoring";
import { track, detectBrowser, detectDevice } from "@/lib/tracking";
import { BeforeAfterView } from "@/components/flow-runner/before-after";
import { cn } from "@/lib/utils";
import { EXIT_DEFAULTS, GOTO_EXIT, lastMainIndex, nextLinear, resolveGoto } from "@/lib/flow-logic";

export function FlowRunner({
  flow,
  preview = false,
  theme,
}: {
  flow: PublicFlow;
  preview?: boolean;
  theme?: Partial<FlowTheme>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<LeadAnswer[]>([]);
  const [contact, setContact] = useState<ContactInfo>({});
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null); // prova de posse para o PATCH
  // Identifica este lead em reenvios (retry/refresh) para o servidor não duplicar.
  const clientRefRef = useRef<string>(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");
  const convertedRef = useRef(false);

  const steps = flow.steps;
  const step = steps[index];
  const total = steps.length;
  const mainLast = lastMainIndex(steps);
  const mainTotal = mainLast + 1;
  // Final "sem interesse" chamado sem existir um bloco desses: mostra o padrão.
  const [forcedExit, setForcedExit] = useState(false);
  const onExit = forcedExit || step?.type === "exit";
  const progress = onExit ? 100 : Math.min(100, Math.round(((index + 1) / mainTotal) * 100));
  const brand = theme?.primaryColor || flow.organization.primary_color || "#0F172A";
  const showProgress = theme?.progressBar ?? true;
  const logo = theme?.logoUrl ?? flow.organization.logo_url;
  const score = totalScore(answers);

  const whatsappNumber =
    flow.whatsapp_number || flow.organization.whatsapp_number || "";

  useEffect(() => {
    if (preview) return;
    if (startedRef.current) return;
    startedRef.current = true;
    track("page_view", { flow_id: flow.id, organization_id: flow.organization_id });
    track("flow_started", { flow_id: flow.id, organization_id: flow.organization_id });
    // preview é constante por montagem; fora das deps de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id, flow.organization_id]);

  useEffect(() => {
    if (preview) return;
    if (step?.type === "question" || step?.type === "multi_choice") {
      track("question_viewed", {
        flow_id: flow.id,
        organization_id: flow.organization_id,
        metadata: { key: step.config.key, position: step.position },
      });
    }
  }, [index, step, flow.id, flow.organization_id]);

  // Marca a conversão (clique no botão final) na sessão já registrada.
  const markConverted = () => {
    if (preview || !sessionIdRef.current || sessionIdRef.current === "demo-session") return;
    try {
      void fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionIdRef.current, token: sessionTokenRef.current ?? "", whatsapp_clicked: true }),
        keepalive: true,
      });
    } catch { /* noop */ }
  };

  // Registra a sessão do lead. Insere uma única vez; se `converted`, marca o
  // clique no botão final (whatsapp_clicked) — mesmo que a inserção já tenha
  // acontecido ao chegar no último bloco.
  const persistSession = (finalAnswers: LeadAnswer[], finalContact: ContactInfo, converted = false, disqualified = false) => {
    if (preview) return;
    if (converted) convertedRef.current = true;
    if (completedRef.current) {
      if (converted) markConverted();
      return;
    }
    completedRef.current = true;
    track("flow_completed", { flow_id: flow.id, organization_id: flow.organization_id });
    const wantConvert = convertedRef.current;
    const body = JSON.stringify({
      flow_id: flow.id,
      client_ref: clientRefRef.current || undefined,
      procedure: flow.procedure,
      answers: finalAnswers,
      contact: finalContact,
      whatsapp_clicked: wantConvert,
      disqualified,
      device: detectDevice(),
      browser: detectBrowser(),
      entry_page: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    (async () => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
        const json = await res.json().catch(() => ({}));
        sessionIdRef.current = json?.id ?? null;
        sessionTokenRef.current = json?.token ?? null;
        // Conversão sinalizada enquanto o insert acontecia → aplica agora.
        if (convertedRef.current && !wantConvert) markConverted();
      } catch { /* nunca quebrar a experiência do lead */ }
    })();
  };

  // Vai para uma etapa aplicando o portão de qualificação dela: se a
  // pontuação atual não alcança o mínimo, desvia para o destino do portão.
  const navigate = (target: number, currentScore: number) => {
    let i = Math.max(0, Math.min(target, total - 1));
    const cfg = steps[i]?.config;
    if (cfg && typeof cfg.score_gate_min === "number" && currentScore < cfg.score_gate_min) {
      const r = resolveGoto(steps, cfg.score_gate_goto || GOTO_EXIT);
      if (r === "missing-exit") { setForcedExit(true); return; }
      if (typeof r === "number") i = r;
    }
    setIndex(i);
  };
  // Destino: id/atalho ("@exit", "@whatsapp"), índice legado ou, sem nada,
  // a próxima etapa do caminho principal (pulando finais alternativos).
  const go = (dest?: string | number, currentScore = score) => {
    if (typeof dest === "string" && dest) {
      const r = resolveGoto(steps, dest);
      if (r === "missing-exit") { setForcedExit(true); return; }
      if (typeof r === "number") { navigate(r, currentScore); return; }
    } else if (typeof dest === "number") {
      navigate(dest, currentScore);
      return;
    }
    navigate(nextLinear(steps, index), currentScore);
  };
  const advance = (dest?: string | number) => go(dest);

  // Registra a sessão ao chegar no ÚLTIMO bloco (qualquer tipo) ou no WhatsApp.
  // O formulário é a exceção: ele registra no envio, com o contato preenchido.
  useEffect(() => {
    if (onExit) {
      if (!preview) track("flow_disqualified", { flow_id: flow.id, organization_id: flow.organization_id });
      persistSession(answers, contact, false, true);
      return;
    }
    const isLast = index >= mainLast;
    if (step?.type === "whatsapp" || (isLast && step?.type !== "form")) {
      persistSession(answers, contact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, forcedExit]);

  const pushAnswer = (a: LeadAnswer, dest?: string | number) => {
    const all = [...answers, a];
    setAnswers(all);
    go(dest, totalScore(all));
  };

  const pickOption = (blk: FlowStep, opt: QuestionOption) => {
    track("option_clicked", {
      flow_id: flow.id,
      organization_id: flow.organization_id,
      metadata: { key: blk.config.key, value: opt.value },
    });
    if (opt.href) {
      try { window.open(opt.href, "_blank", "noopener"); } catch { /* noop */ }
    }
    pushAnswer(
      { question_title: blk.config.title || "", answer_value: opt.value, answer_label: opt.label, score: opt.score || 0, phrase: opt.phrase },
      opt.goto || opt.next,
    );
  };

  // Renderiza um bloco (recursivo — o container renderiza seus filhos).
  const renderBlock = (blk: FlowStep): React.ReactNode => {
    switch (blk.type) {
      case "start": return <StartStep step={blk} onStart={() => advance()} />;
      case "question": return <QuestionStep step={blk} brand={brand} onSelect={(opt) => pickOption(blk, opt)} />;
      case "multi_choice": return <MultiChoiceStep step={blk} onSubmit={pushAnswer} />;
      case "rating": return <RatingStep step={blk} onSubmit={pushAnswer} />;
      case "text": return <TextStep step={blk} />;
      case "cta": return <TextStep step={blk} />;
      case "image": return <ImageStep step={blk} />;
      case "before_after": return <BeforeAfterStep step={blk} />;
      case "carousel": return <CarouselStep step={blk} />;
      case "testimonial": return <TestimonialStep step={blk} />;
      case "video": return <VideoStep step={blk} />;
      case "stats": return <StatsStep step={blk} />;
      case "alert": return <AlertStep step={blk} />;
      case "timer": return <TimerStep step={blk} />;
      case "loading": return <LoadingStep step={blk} onDone={() => advance()} />;
      case "level": return <LevelStep step={blk} score={score} />;
      case "faq": return <FaqStep step={blk} />;
      case "news": return <NewsStep step={blk} onNext={() => advance()} />;
      case "chart_growth": return <ChartGrowthStep step={blk} />;
      case "chart_gauge": return <ChartGaugeStep step={blk} />;
      case "audio": return <AudioStep step={blk} />;
      case "result": return <ResultStep step={blk} score={score} />;
      case "container": return <ContainerStep step={blk} render={renderBlock} />;
      case "hero": return <HeroStep step={blk} render={renderBlock} onNext={() => advance()} />;
      case "buttons":
        return (
          <ButtonsStep step={blk} onPick={(b) => {
            if (b.href) { try { window.open(b.href, "_blank", "noopener"); } catch { /* noop */ } }
            const ans: LeadAnswer = { question_title: blk.config.title || "", answer_value: b.label, answer_label: b.label, score: 0 };
            // Bloco de botões como etapa final: registra o clique no botão.
            const dest = b.goto || b.next;
            if (index >= mainLast && dest === undefined) { persistSession([...answers, ans], contact, true); setAnswers((prev) => [...prev, ans]); }
            else pushAnswer(ans, dest);
          }} />
        );
      case "spin_wheel": {
        const isLast = index >= mainLast;
        return (
          <SpinWheelBlock step={blk} onCapture={(cc) => setContact((prev) => ({ ...prev, ...cc }))} onFinish={(prize) => {
            const a: LeadAnswer = { question_title: blk.config.title || "Roleta", answer_value: "wheel", answer_label: prize, score: 0, phrase: `Girei a roleta e ganhei: ${prize}` };
            if (isLast) {
              // Roleta como etapa final: o CTA leva ao destino configurado.
              const all = [...answers, a];
              setAnswers(all);
              persistSession(all, contact, true);
              const cfg = blk.config;
              if (cfg.cta_action === "link" && cfg.cta_href) {
                try { window.open(cfg.cta_href, "_blank", "noopener"); } catch { /* noop */ }
              } else {
                track("whatsapp_clicked", { flow_id: flow.id, organization_id: flow.organization_id });
                const custom = cfg.cta_message?.trim();
                const msg = custom
                  ? custom.replace(/\{nome\}/gi, contact.name ?? "").replace(/\{premio\}/gi, prize)
                  : buildLeadMessage(flow.procedure, all, flow.final_message, contact);
                try { window.open(buildWhatsappUrl(whatsappNumber, msg), "_blank", "noopener"); } catch { /* noop */ }
              }
            } else {
              pushAnswer(a);
            }
          }} />
        );
      }
      case "form": return <FormStep step={blk} onSubmit={(cc) => {
        const merged = { ...contact, ...cc };
        setContact(merged);
        // Formulário como etapa final: registra o lead com o contato preenchido.
        if (index >= mainLast) persistSession(answers, merged, true);
        else advance();
      }} />;
      case "whatsapp": return <WhatsappStep step={blk} message={message} href={waUrl} onClick={onWhatsappClick} />;
      case "exit": return <ExitStep step={blk} />;
      default: return null;
    }
  };

  const message = useMemo(
    () => buildLeadMessage(flow.procedure, answers, flow.final_message, contact),
    [answers, contact, flow.procedure, flow.final_message],
  );
  const waUrl = buildWhatsappUrl(whatsappNumber, message);

  const onWhatsappClick = () => {
    persistSession(answers, contact, true);
    track("whatsapp_clicked", { flow_id: flow.id, organization_id: flow.organization_id });
  };

  const showFooterContinue =
    step &&
    !step.config.hide_continue &&
    [
      "text",
      "image",
      "before_after",
      "carousel",
      "testimonial",
      "video",
      "stats",
      "alert",
      "timer",
      "level",
      "faq",
      "chart_growth",
      "chart_gauge",
      "audio",
      "container",
      "result",
      "cta",
    ].includes(step.type);

  // "Colar no topo": quando o bloco do topo é uma imagem com flush_top,
  // encostamos o conteúdo na linha do cabeçalho (sem centralizar).
  const topHead = step?.type === "container" ? step.children?.[0] : step;
  const flushTop =
    Boolean(topHead && topHead.type === "image" && topHead.config.flush_top) ||
    step?.config.top_align === "top";

  return (
    <div
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 py-6"
      style={themeVars(theme, flow.organization.primary_color)}
    >
      <header className={flushTop ? "mb-2" : "mb-6"}>
        <div className="mb-4 flex items-center justify-between">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={flow.organization.name} className="h-8" />
          ) : (
            <span className="text-sm font-semibold tracking-tight">
              {flow.organization.name}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {onExit ? mainTotal : Math.min(index + 1, mainTotal)}/{mainTotal}
          </span>
        </div>
        {showProgress && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--brand)" }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        )}
      </header>

      <main className={cn("flex flex-1 flex-col", flushTop ? "justify-start" : "justify-center")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={forcedExit ? "forced-exit" : step?.id ?? index}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {forcedExit ? <ExitStep /> : step && renderBlock(step)}
          </motion.div>
        </AnimatePresence>
      </main>

      {showFooterContinue && (
        <footer className="cta-dock mt-4">
          <button
            onClick={() => {
              // No último bloco, o "Continuar" é o botão final: registra a conversão.
              if (index >= mainLast) persistSession(answers, contact, true);
              else advance();
            }}
            className="brand-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg transition-transform active:scale-[0.99]"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      )}

      <p className="pt-6 text-center text-[11px] text-slate-300">Feito com Cliva</p>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function StepTitle({ title, subtitle, center }: { title?: string; subtitle?: string; center?: boolean }) {
  if (!title && !subtitle) return null;
  return (
    <div className={cn("mb-6", center && "text-center")}>
      {title && (
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
      )}
      {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="cta-dock mt-4">
      <button
        onClick={onClick}
        disabled={disabled}
        className="brand-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg transition-transform active:scale-[0.99] disabled:opacity-40"
      >
        {children}
      </button>
    </div>
  );
}

/* ------------------------------ steps ------------------------------ */

function StartStep({ step, onStart }: { step: FlowStep; onStart: () => void }) {
  const c = step.config;
  return (
    <div className="text-center">
      {c.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image_url} alt="" className="mx-auto mb-6 h-40 w-full rounded-2xl object-cover" />
      )}
      <StepTitle title={c.title} subtitle={c.subtitle} center />
      {c.duration_label && (
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
          <Clock className="h-4 w-4" /> {c.duration_label}
        </p>
      )}
      <PrimaryButton onClick={onStart}>
        {c.button_label ?? "Começar"} <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  );
}

function QuestionStep({
  step,
  onSelect,
  brand,
}: {
  step: FlowStep;
  onSelect: (o: QuestionOption) => void;
  brand: string;
}) {
  const c = step.config;
  const options = c.options ?? [];
  const hasCover = options.some((o) => o.image_url && (o.image_style ?? "cover") === "cover");
  const size = c.option_size ?? "md";
  const pad = size === "sm" ? "px-4 py-2.5 text-sm" : size === "lg" ? "px-6 py-5 text-lg" : "px-5 py-4 text-base";

  return (
    <div>
      <StepTitle title={c.title} subtitle={c.subtitle} />
      {c.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image_url} alt="" className="mb-5 w-full rounded-xl object-cover" />
      )}
      {hasCover ? (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt)}
              className="relative overflow-hidden rounded-xl border-2 border-slate-100 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            >
              {opt.href && <ExternalLinkBadge />}
              {opt.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.image_url} alt={opt.label} className={cn("w-full object-cover", size === "lg" ? "h-36" : size === "sm" ? "h-24" : "h-28")} />
              )}
              <div className={cn("font-medium text-slate-800", size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2.5 text-sm")}>{opt.label}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt)}
              className={cn("group flex w-full items-center gap-3 rounded-xl border-2 border-slate-100 bg-white text-left font-medium text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]", pad, opt.image_url && (opt.image_style === "circle" || opt.image_style === "float") && "pl-2")}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = brand)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
            >
              {opt.image_url && opt.image_style === "circle" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.image_url} alt="" className={cn("shrink-0 rounded-full object-cover", size === "lg" ? "h-14 w-14" : "h-11 w-11")} />
              ) : opt.image_url && opt.image_style === "float" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.image_url} alt="" className={cn("shrink-0 object-contain drop-shadow", size === "lg" ? "h-14 w-14" : "h-11 w-11")} />
              ) : opt.emoji ? (
                <span className="text-xl">{opt.emoji}</span>
              ) : null}
              <span className="flex-1">
                {opt.label}
                {opt.description && (
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">{opt.description}</span>
                )}
              </span>
              {opt.href ? (
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
              ) : (
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExternalLinkBadge() {
  return (
    <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow">
      <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
    </span>
  );
}

function MultiChoiceStep({
  step,
  onSubmit,
}: {
  step: FlowStep;
  onSubmit: (a: LeadAnswer, dest?: string | number) => void;
}) {
  const c = step.config;
  const options = c.options ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const max = c.max_select ?? options.length;
  const min = c.min_select ?? 1;

  const toggle = (v: string) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < max ? [...prev, v] : prev,
    );

  const submit = () => {
    const chosen = options.filter((o) => selected.includes(o.value));
    onSubmit({
      question_title: c.title || "",
      answer_value: chosen.map((o) => o.value).join(","),
      answer_label: chosen.map((o) => o.label).join(", "),
      score: chosen.reduce((s, o) => s + (o.score || 0), 0),
      phrase: chosen.map((o) => o.phrase).filter(Boolean).join(" "),
    }, (() => { const o = chosen.find((x) => x.goto || typeof x.next === "number"); return o ? o.goto || o.next : undefined; })());
  };

  return (
    <div>
      <StepTitle title={c.title} subtitle={c.subtitle ?? "Você pode escolher mais de uma opção."} />
      <div className="flex flex-col gap-3">
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left text-base font-medium transition-all active:scale-[0.99]",
                on ? "border-[color:var(--brand)] bg-[color:var(--brand)]/5 text-slate-900" : "border-slate-100 bg-white text-slate-800",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                  on ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-slate-300",
                )}
              >
                {on && <Check className="h-3.5 w-3.5" />}
              </span>
              {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
              <span className="flex-1">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <PrimaryButton onClick={submit} disabled={selected.length < min}>
        Continuar <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  );
}

function RatingStep({
  step,
  onSubmit,
}: {
  step: FlowStep;
  onSubmit: (a: LeadAnswer, dest?: string | number) => void;
}) {
  const c = step.config;
  const mode = c.mode ?? "scale";
  const min = c.min ?? (mode === "stars" ? 1 : 0);
  const max = c.max ?? (mode === "stars" ? 5 : 10);
  const [val, setVal] = useState<number | null>(null);

  const submit = () => {
    if (val === null) return;
    onSubmit({
      question_title: c.title || "",
      answer_value: String(val),
      answer_label: `${val}${mode === "stars" ? " estrelas" : `/${max}`}`,
      score: mode === "scale" ? val * 2 : 0,
      phrase:
        mode === "scale"
          ? `Avaliei esse ponto em ${val} de ${max}.`
          : undefined,
    }, (c.rating_rules ?? []).find((r) => r.goto && (r.op === "lte" ? val <= r.value : val >= r.value))?.goto);
  };

  return (
    <div>
      <StepTitle title={c.title} subtitle={c.subtitle} center />
      {mode === "stars" ? (
        <div className="flex justify-center gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setVal(n)}>
              <Star
                className={cn("h-9 w-9", val && n <= val ? "fill-amber-400 text-amber-400" : "text-slate-300")}
              />
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                onClick={() => setVal(n)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors",
                  val === n
                    ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{c.low_label ?? "Nada"}</span>
            <span>{c.high_label ?? "Muito"}</span>
          </div>
        </div>
      )}
      <PrimaryButton onClick={submit} disabled={val === null}>
        Continuar <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  );
}

function TextStep({ step }: { step: FlowStep }) {
  const c = step.config;
  return (
    <div>
      <StepTitle title={c.title} />
      {c.body && <p className="text-lg leading-relaxed text-slate-600">{c.body}</p>}
    </div>
  );
}

function ImageStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const bleed = Boolean(c.full_bleed);
  const flush = Boolean(c.flush_top);
  const src = c.url ?? c.image_url;
  return (
    <div className={cn(bleed && "-mx-5", flush && "-mt-2")}>
      {c.title && !flush && <StepTitle title={c.title} />}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={c.alt ?? ""}
          className={cn("w-full object-cover", bleed ? "rounded-none" : "rounded-xl")}
        />
      )}
    </div>
  );
}

function BeforeAfterStep({ step }: { step: FlowStep }) {
  const c = step.config;
  return (
    <div>
      <StepTitle title={c.title ?? "Antes e depois"} />
      <BeforeAfterView c={c} />
      {c.caption && <p className="mt-4 text-center text-xs text-slate-400">{c.caption}</p>}
    </div>
  );
}

function CarouselStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const items = c.items ?? [];
  const layout = c.carousel_layout ?? "slider";
  const [i, setI] = useState(0);
  if (items.length === 0) return null;

  const Card = ({ item, className }: { item: (typeof items)[number]; className?: string }) => (
    <figure className={cn("overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="" className="h-40 w-full object-cover" />
      {item.caption && <figcaption className="px-3 py-2 text-sm text-slate-600">{item.caption}</figcaption>}
    </figure>
  );

  if (layout === "grid") {
    return (
      <div>
        <StepTitle title={c.title} />
        <div className="grid grid-cols-2 gap-3">
          {items.map((it, idx) => <Card key={idx} item={it} />)}
        </div>
      </div>
    );
  }
  if (layout === "list") {
    return (
      <div>
        <StepTitle title={c.title} />
        <div className="flex flex-col gap-3">
          {items.map((it, idx) => <Card key={idx} item={it} />)}
        </div>
      </div>
    );
  }
  if (layout === "cards") {
    return (
      <div>
        <StepTitle title={c.title} />
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {items.map((it, idx) => <Card key={idx} item={it} className="w-[70%] shrink-0 snap-center" />)}
        </div>
      </div>
    );
  }

  // slider (padrão)
  const item = items[i];
  return (
    <div>
      <StepTitle title={c.title} />
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image_url} alt="" className="h-64 w-full object-cover" />
        <button onClick={() => setI((v) => (v - 1 + items.length) % items.length)} className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setI((v) => (v + 1) % items.length)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {item.caption && <p className="mt-3 text-center text-sm text-slate-500">{item.caption}</p>}
      <div className="mt-3 flex justify-center gap-1.5">
        {items.map((_, idx) => (
          <span key={idx} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-[color:var(--brand)]" : "w-1.5 bg-slate-200")} />
        ))}
      </div>
    </div>
  );
}

function HeroStep({ step, render, onNext }: { step: FlowStep; render: (b: FlowStep) => React.ReactNode; onNext: () => void }) {
  const c = step.config;
  const light = c.text_light ?? true;
  const align = c.text_align ?? "left";
  const minH = c.hero_height === "sm" ? 280 : c.hero_height === "lg" ? 520 : 400;
  const color = c.overlay_color ?? "#0b1220";
  const op = c.overlay_opacity ?? 55;
  const strong = `color-mix(in srgb, ${color} ${op}%, transparent)`;
  const dir = c.overlay_dir ?? "bottom";
  const grad =
    dir === "full" ? `linear-gradient(${strong}, ${strong})`
    : dir === "top" ? `linear-gradient(to bottom, ${strong} 0%, transparent 65%)`
    : dir === "diagonal" ? `linear-gradient(135deg, ${strong} 0%, transparent 78%)`
    : `linear-gradient(to top, ${strong} 0%, transparent 65%)`;
  const children = step.children ?? [];

  return (
    <div
      className="-mx-5 overflow-hidden rounded-2xl bg-slate-800"
      style={{ backgroundImage: c.image_url ? `url(${c.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="relative flex flex-col justify-end p-6" style={{ minHeight: minH, background: grad, alignItems: align === "center" ? "center" : "flex-start", textAlign: align }}>
        {c.title && (
          <h1 className={cn("text-3xl font-extrabold leading-tight tracking-tight drop-shadow", light ? "text-white" : "text-slate-900")}>{c.title}</h1>
        )}
        {c.subtitle && <p className={cn("mt-2 text-lg leading-snug drop-shadow", light ? "text-white/85" : "text-slate-600")}>{c.subtitle}</p>}
        {children.length > 0 && (
          <div className="mt-4 flex w-full flex-col gap-3">{children.map((ch) => <div key={ch.id}>{render(ch)}</div>)}</div>
        )}
        <button onClick={onNext} className="brand-btn mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-lg transition-transform active:scale-[0.99]">
          {c.button_label ?? "Quero saber mais"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ContainerStep({ step, render }: { step: FlowStep; render: (b: FlowStep) => React.ReactNode }) {
  const c = step.config;
  const children = step.children ?? [];
  const layout = c.container_layout ?? "vertical";
  const gap = c.gap ?? 12;
  const pad = c.pad ?? 0;
  const cols = c.columns ?? 2;
  const cls = layout === "horizontal" ? "flex flex-row" : layout === "grid" ? "grid" : "flex flex-col";
  const style: React.CSSProperties = {
    gap,
    padding: pad || undefined,
    background: c.bg || undefined,
    borderRadius: c.bg || pad ? 16 : undefined,
    alignItems: c.align ?? (layout === "horizontal" ? "stretch" : undefined),
    ...(layout === "grid" ? { gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` } : {}),
  };
  return (
    <div>
      {(c.title || c.subtitle) && <StepTitle title={c.title} subtitle={c.subtitle} />}
      {children.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          Seção vazia — adicione blocos dentro dela.
        </div>
      ) : (
        <div className={cls} style={style}>
          {children.map((child) => (
            <div key={child.id} className={layout === "horizontal" ? "min-w-0 flex-1" : "min-w-0"}>
              {render(child)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ButtonsStep({ step, onPick }: { step: FlowStep; onPick: (b: ButtonItem) => void }) {
  const c = step.config;
  const buttons = c.buttons ?? [];
  const grid = c.buttons_layout === "grid";
  const size = c.size ?? "md";
  const pad = size === "sm" ? "py-2.5 text-sm" : size === "lg" ? "py-5 text-lg" : "py-4 text-base";
  const hasCover = buttons.some((b) => b.image_url && (b.image_style ?? "cover") === "cover");

  return (
    <div>
      <StepTitle title={c.title} subtitle={c.subtitle} />
      <div className={cn(grid || hasCover ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3")}>
        {buttons.map((b, idx) => {
          const outline = b.variant === "outline";
          if (b.image_url && (b.image_style ?? "cover") === "cover") {
            return (
              <button key={idx} onClick={() => onPick(b)} className="relative overflow-hidden rounded-xl border-2 border-slate-100 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">
                {b.href && <ExternalLinkBadge />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image_url} alt="" className="h-28 w-full object-cover" />
                <div className="px-3 py-2.5 text-sm font-semibold text-slate-800">{b.label}</div>
              </button>
            );
          }
          return (
            <button
              key={idx}
              onClick={() => onPick(b)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl font-semibold shadow-sm transition-transform active:scale-[0.99]",
                pad,
                outline ? "border-2 border-[color:var(--brand)] bg-white text-[color:var(--brand)]" : "brand-btn",
              )}
            >
              {b.image_url && b.image_style === "circle" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              )}
              {b.label}
              {b.href ? <ArrowUpRight className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudioStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (c.autoplay && ref.current) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };
  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (ref.current) ref.current.playbackRate = next;
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div>
      <StepTitle title={c.title} subtitle={c.subtitle} />
      <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <button onClick={toggle} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand)] text-white">
          {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-slate-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{fmt(time)} / {fmt(dur)}</span>
            <button onClick={cycleRate} className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{rate}x</button>
          </div>
        </div>
      </div>
      {c.audio_url ? (
        <audio
          ref={ref}
          src={c.audio_url}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setTime(a.currentTime);
            setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
          }}
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <p className="mt-2 text-center text-xs text-slate-400">Adicione a URL do áudio no editor.</p>
      )}
    </div>
  );
}

function TestimonialStep({ step }: { step: FlowStep }) {
  const c = step.config;
  return (
    <div className="rounded-2xl bg-slate-50 p-6">
      <div className="mb-3 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-lg leading-relaxed text-slate-700">“{c.quote}”</p>
      {(c.author || c.avatar_url) && (
        <div className="mt-4 flex items-center gap-3">
          {c.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar_url} alt={c.author ?? ""} className="h-10 w-10 rounded-full object-cover" />
          )}
          <p className="text-sm font-semibold text-slate-600">
            {c.author}
            {c.role && <span className="block text-xs font-normal text-slate-400">{c.role}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function inferProvider(url: string): NonNullable<FlowStep["config"]["video_provider"]> {
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/drive\.google/i.test(url)) return "drive";
  if (/vimeo/i.test(url)) return "vimeo";
  if (/\.mp4($|\?)/i.test(url)) return "mp4";
  return "youtube";
}

// Monta a URL de embed conforme o provedor, escondendo os controles/botões
// nativos quando pedido (pra manter a pessoa dentro do funil).
function buildVideoEmbed(url: string, provider: NonNullable<FlowStep["config"]["video_provider"]>, hide?: boolean): string {
  if (!url) return "";
  if (provider === "youtube") {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);
    const id = m?.[1] ?? url;
    const base = `https://www.youtube.com/embed/${id}`;
    const params = ["rel=0", "modestbranding=1", "playsinline=1", "iv_load_policy=3"];
    if (hide) params.push("controls=0", "disablekb=1", "fs=0");
    return `${base}?${params.join("&")}`;
  }
  if (provider === "drive") {
    const m = url.match(/\/d\/([\w-]+)/) ?? url.match(/id=([\w-]+)/);
    const id = m?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : url;
  }
  if (provider === "vimeo") {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    const id = m?.[1] ?? url;
    const params = ["playsinline=1", "dnt=1"];
    if (hide) params.push("controls=0", "title=0", "byline=0", "portrait=0");
    return `https://player.vimeo.com/video/${id}?${params.join("&")}`;
  }
  // vturb / outros: usa a URL como veio (embed próprio do provedor)
  return url;
}

function VideoStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const url = c.url ?? c.video_url ?? "";
  const provider = c.video_provider ?? inferProvider(url);
  const hide = c.video_hide_controls;
  const src = buildVideoEmbed(url, provider, hide);
  const isMp4 = provider === "mp4";

  return (
    <div>
      <StepTitle title={c.title} />
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {url && isMp4 ? (
          <VideoMp4 url={url} hide={hide} fake={c.video_fake_bar} speed={c.video_fake_speed} />
        ) : url ? (
          <>
            <iframe
              src={src}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {c.video_fake_bar && <FakeBar duration={c.video_fake_duration ?? 120} speed={c.video_fake_speed ?? 0.5} />}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Adicione a URL do vídeo</div>
        )}
      </div>
    </div>
  );
}

// Player MP4 com barra de progresso falsa sincronizada ao tempo real do vídeo.
function VideoMp4({ url, hide, fake, speed }: { url: string; hide?: boolean; fake?: boolean; speed?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [pct, setPct] = useState(0);
  const exp = speed ?? 0.5;
  return (
    <>
      <video
        ref={ref}
        src={url}
        className="h-full w-full"
        controls={!hide}
        playsInline
        onContextMenu={(e) => hide && e.preventDefault()}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setPct(Math.pow(Math.min(1, v.currentTime / v.duration), exp) * 100);
        }}
      />
      {fake && <BarOverlay pct={pct} />}
    </>
  );
}

// Barra falsa por tempo estimado (players em iframe, sem acesso ao tempo real).
function FakeBar({ duration, speed }: { duration: number; speed: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / 1000 / Math.max(5, duration));
      setPct(Math.pow(t, speed) * 100); // rápido no início, desacelera no fim
      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [duration, speed]);
  return <BarOverlay pct={pct} />;
}

function BarOverlay({ pct }: { pct: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
      <div className="h-full rounded-r-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: "var(--brand)" }} />
    </div>
  );
}

function StatsStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const stats = c.stats ?? [];
  return (
    <div className="text-center">
      <StepTitle title={c.title} subtitle={c.subtitle} center />
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-bold text-[color:var(--brand)]">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const variant = c.variant ?? "info";
  const styles = {
    info: { box: "bg-sky-50 text-sky-800", Icon: Info },
    warning: { box: "bg-amber-50 text-amber-800", Icon: AlertTriangle },
    success: { box: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  }[variant];
  const Icon = styles.Icon;
  return (
    <div>
      <StepTitle title={c.title} />
      <div className={cn("flex items-start gap-3 rounded-xl p-4", styles.box)}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">{c.body}</p>
      </div>
    </div>
  );
}

function TimerStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const [left, setLeft] = useState((c.minutes ?? 15) * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="text-center">
      <StepTitle title={c.title} subtitle={c.subtitle} center />
      <div className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-6 py-4 text-3xl font-bold tabular-nums text-rose-600">
        <Clock className="h-6 w-6" /> {mm}:{ss}
      </div>
      {c.body && <p className="mt-4 text-slate-500">{c.body}</p>}
    </div>
  );
}

function LoadingStep({ step, onDone }: { step: FlowStep; onDone: () => void }) {
  const c = step.config;
  const messages = c.messages ?? ["Analisando suas respostas...", "Montando seu perfil...", "Quase lá..."];
  const duration = c.duration_ms ?? 2800;
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    const step = duration / messages.length;
    const t1 = setInterval(() => setMsg((m) => Math.min(m + 1, messages.length - 1)), step);
    const t2 = setTimeout(onDone, duration);
    return () => {
      clearInterval(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <Loader2 className="mb-6 h-12 w-12 animate-spin text-[color:var(--brand)]" />
      <p className="text-lg font-medium text-slate-700">{messages[msg]}</p>
      <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full bg-[color:var(--brand)]"
          initial={{ width: "8%" }}
          animate={{ width: "100%" }}
          transition={{ duration: duration / 1000, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function LevelStep({ step, score }: { step: FlowStep; score: number }) {
  const c = step.config;
  const value = Math.max(0, Math.min(100, c.value ?? score));
  const tier = tierFromScore(value);
  const label = c.level_label ?? { cold: "Inicial", warm: "Bom", hot: "Alto" }[tier];
  const color = { cold: "#94a3b8", warm: "#f59e0b", hot: "var(--brand)" }[tier];
  const R = 70;
  const C = Math.PI * R; // semicírculo
  return (
    <div className="text-center">
      <StepTitle title={c.title} subtitle={c.subtitle} center />
      <div className="relative mx-auto h-28 w-56">
        <svg viewBox="0 0 160 90" className="w-full">
          <path d="M10 85 A70 70 0 0 1 150 85" fill="none" stroke="#f1f5f9" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M10 85 A70 70 0 0 1 150 85"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (value / 100) * C}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-3xl font-bold text-slate-900">{value}%</p>
          <p className="text-sm font-medium" style={{ color }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function FaqStep({ step }: { step: FlowStep }) {
  const c = step.config;
  const faqs = c.faqs ?? [];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      <StepTitle title={c.title ?? "Perguntas frequentes"} />
      <div className="flex flex-col gap-2">
        {faqs.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800"
            >
              {f.q}
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="px-4 pb-4 text-sm text-slate-500">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormStep({ step, onSubmit }: { step: FlowStep; onSubmit: (c: ContactInfo) => void }) {
  const c = step.config;
  const fields = c.fields ?? [
    { name: "name", label: "Nome", type: "text", required: true, placeholder: "Seu nome" },
    { name: "phone", label: "WhatsApp", type: "tel", required: true, placeholder: "(00) 00000-0000" },
  ];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);

  const valid = fields.every((f) => !f.required || (vals[f.name] && vals[f.name].trim().length > 1));

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit({ name: vals.name, phone: vals.phone, email: vals.email });
  };

  return (
    <div>
      <StepTitle title={c.title ?? "Falta pouco!"} subtitle={c.subtitle ?? "Preencha para receber seu resultado."} />
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={vals[f.name] ?? ""}
              onChange={(e) => setVals((p) => ({ ...p, [f.name]: e.target.value }))}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base focus:border-[color:var(--brand)] focus:outline-none"
            />
            {touched && f.required && !vals[f.name] && (
              <p className="mt-1 text-xs text-rose-500">Campo obrigatório</p>
            )}
          </div>
        ))}
      </div>
      {c.consent && <p className="mt-3 text-xs text-slate-400">{c.consent}</p>}
      <PrimaryButton onClick={submit} disabled={!valid}>
        Continuar <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  );
}

// Final alternativo: encerra com carinho quem não tem interesse ou não é o
// perfil, sem empurrar para o WhatsApp. O lead é registrado como "perdido".
function ExitStep({ step }: { step?: FlowStep }) {
  const c = { ...EXIT_DEFAULTS, ...(step?.config ?? {}) };
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--brand)]/10">
        <Heart className="h-8 w-8 text-[color:var(--brand)]" />
      </div>
      <StepTitle title={c.title} center />
      {c.body && <p className="leading-relaxed text-slate-600">{c.body}</p>}
      {c.button_label && c.cta_href && (
        <a
          href={c.cta_href}
          target="_blank"
          rel="noopener noreferrer"
          className="brand-btn mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold shadow-sm"
        >
          {c.button_label} <ArrowRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function ResultStep({ step, score }: { step: FlowStep; score: number }) {
  const c = step.config;
  const tiers = (c.tiers ?? []).slice().sort((a, b) => b.min - a.min);
  const match = tiers.find((t) => score >= t.min);
  const title = match?.title ?? c.title ?? "Seu resultado";
  const body = match?.body ?? c.body;
  const badge = match?.badge ?? c.badge;
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--brand)]/10">
        <Sparkles className="h-8 w-8 text-[color:var(--brand)]" />
      </div>
      {badge && (
        <span className="mb-3 inline-block rounded-full bg-[color:var(--brand)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--brand)]">
          {badge}
        </span>
      )}
      <StepTitle title={title} center />
      {body && <p className="text-slate-600">{body}</p>}
    </div>
  );
}

// Glifo oficial do WhatsApp (bolha + telefone) para o botão ficar mais real.
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.882 11.882 0 005.71 1.454h.005c6.585 0 11.946-5.359 11.949-11.945a11.821 11.821 0 00-3.48-8.418z" />
    </svg>
  );
}

function WhatsappStep({
  step,
  message,
  href,
  onClick,
}: {
  step: FlowStep;
  message: string;
  href: string;
  onClick: () => void;
}) {
  const c = step.config;
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <WhatsAppGlyph className="h-8 w-8 text-emerald-500" />
      </div>
      <StepTitle title={c.title ?? "Tudo certo!"} center />
      {c.body && <p className="mb-6 text-slate-500">{c.body}</p>}
      <div className="mb-3 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4" /> Atendimento humano e sem compromisso
      </div>
      <div className="mb-6 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-500">{message}</div>
      <div className="cta-dock">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg transition-transform hover:bg-emerald-600 active:scale-[0.99]"
        >
          <WhatsAppGlyph className="h-5 w-5" />
          {c.button_label ?? "Falar no WhatsApp"}
        </a>
      </div>
    </div>
  );
}
