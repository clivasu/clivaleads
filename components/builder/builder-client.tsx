"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Flag, Type, Image as ImageIcon, Video, GalleryHorizontal, Images,
  AlertTriangle, Newspaper, ListChecks, CircleDot, Star, ClipboardList,
  Quote, BarChart3, Gauge, TrendingUp, PieChart, HelpCircle, Loader,
  Timer as TimerIcon, Sparkles, MousePointerClick, MessageCircle, Gift,
  Volume2, SquareStack, LayoutGrid, LayoutTemplate,
  GripVertical, Trash2, Copy, Plus, ArrowLeft, ExternalLink, Check, ChevronDown,
  Layers, GitBranch, Palette, Users, Settings, HeartOff, Wand2, Route,
} from "lucide-react";
import type { FlowStep, PublicFlow, StepType, QuestionOption, ButtonItem, FormField, RatingRule } from "@/lib/types";
import { BLOCK_CATALOG, defaultConfig, type BlockDef } from "@/lib/block-catalog";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { FlowCanvas } from "@/components/builder/flow-canvas";
import type { JourneyLead } from "@/lib/flow-journeys";
import type { FlowPrivateSettingsView } from "@/lib/data/flows";
import { GOTO_EXIT, GOTO_WHATSAPP, applySmartLogic, isNegativeAnswer } from "@/lib/flow-logic";
import { DEFAULT_THEME, type FlowTheme, type FontChoice } from "@/lib/theme";
import { saveFlow } from "@/lib/actions/flows";
import { applyIdMap } from "@/lib/flow-persistence";
import { DEFAULT_SETTINGS, pickPersistedSettings, type FunnelSettings } from "@/lib/flow-settings";
import { UploadButton } from "@/components/bio/upload-button";
import { DeleteFlowButton } from "@/components/flows/delete-flow-button";
import { beforeAfterFrames } from "@/components/flow-runner/before-after";
import { cn } from "@/lib/utils";

// Emojis rápidos para as opções de pergunta.
const QUICK_EMOJIS = ["😊", "😍", "🔥", "✨", "💚", "👍", "❤️", "📸", "💔", "🔁", "🗓️", "🎁", "💉", "👃", "🌟", "🙌", "💪", "🦷", "👀", "😮‍💨"];

const ICONS: Record<StepType, React.ElementType> = {
  start: Flag, text: Type, image: ImageIcon, video: Video, carousel: GalleryHorizontal,
  before_after: Images, alert: AlertTriangle, news: Newspaper, question: CircleDot,
  multi_choice: ListChecks, rating: Star, form: ClipboardList, testimonial: Quote,
  stats: BarChart3, level: Gauge, chart_growth: TrendingUp, chart_gauge: PieChart,
  faq: HelpCircle, loading: Loader, timer: TimerIcon, result: Sparkles,
  cta: MousePointerClick, whatsapp: MessageCircle, spin_wheel: Gift,
  buttons: SquareStack, audio: Volume2, container: LayoutGrid, hero: LayoutTemplate, exit: HeartOff,
};
const ACCEPTS_CHILDREN = (t: StepType) => t === "container" || t === "hero";
// Rótulo canônico por type (ignora presets, que compartilham o mesmo type).
const LABELS = Object.fromEntries(
  BLOCK_CATALOG.filter((b) => !b.id).map((b) => [b.type, b.label]),
) as Record<StepType, string>;

function uid() {
  return "s-" + Math.random().toString(36).slice(2, 9);
}

/* ---- helpers de árvore (blocos aninhados via children) ---- */
function regenIds(s: FlowStep): FlowStep {
  return { ...s, id: uid(), config: structuredClone(s.config), children: s.children?.map(regenIds) };
}
function findNode(list: FlowStep[], id: string): FlowStep | null {
  for (const s of list) {
    if (s.id === id) return s;
    if (s.children) { const f = findNode(s.children, id); if (f) return f; }
  }
  return null;
}
function updateNode(list: FlowStep[], id: string, patch: Partial<FlowStep>): FlowStep[] {
  return list.map((s) => (s.id === id ? { ...s, ...patch } : s.children ? { ...s, children: updateNode(s.children, id, patch) } : s));
}
function removeNode(list: FlowStep[], id: string): { tree: FlowStep[]; removed: FlowStep | null } {
  let removed: FlowStep | null = null;
  const walk = (arr: FlowStep[]): FlowStep[] => {
    const out: FlowStep[] = [];
    for (const s of arr) {
      if (s.id === id) { removed = s; continue; }
      out.push(s.children ? { ...s, children: walk(s.children) } : s);
    }
    return out;
  };
  return { tree: walk(list), removed };
}
function insertAfterId(list: FlowStep[], id: string, block: FlowStep): FlowStep[] {
  const walk = (arr: FlowStep[]): FlowStep[] => {
    const out: FlowStep[] = [];
    for (const s of arr) {
      out.push(s.children ? { ...s, children: walk(s.children) } : s);
      if (s.id === id) out.push(block);
    }
    return out;
  };
  return walk(list);
}
function insertIntoId(list: FlowStep[], containerId: string, block: FlowStep): FlowStep[] {
  return list.map((s) =>
    s.id === containerId ? { ...s, children: [...(s.children ?? []), block] } : s.children ? { ...s, children: insertIntoId(s.children, containerId, block) } : s,
  );
}
function topAncestor(list: FlowStep[], id: string): FlowStep | null {
  for (const s of list) {
    if (s.id === id) return s;
    if (s.children && findNode(s.children, id)) return s;
  }
  return null;
}
function isInSubtree(node: FlowStep, id: string): boolean {
  if (node.id === id) return true;
  return (node.children ?? []).some((c) => isInSubtree(c, id));
}

export function BuilderClient({ flow, leads = [], privateSettings }: { flow: PublicFlow; leads?: JourneyLead[]; privateSettings?: FlowPrivateSettingsView }) {
  const [steps, setSteps] = useState<FlowStep[]>(flow.steps);
  const [selectedId, setSelectedId] = useState<string>(flow.steps[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<"build" | "design" | "flow" | "settings">("build");
  // Começa pelo que já foi salvo (flows.settings), depois as colunas do funil
  // (fonte da verdade) e as integrações privadas (sem o segredo).
  const [settings, setSettings] = useState<FunnelSettings>(() => ({
    ...DEFAULT_SETTINGS,
    seoTitle: `${flow.procedure ?? flow.name} — ${flow.organization.name}`,
    seoDescription: flow.description ?? "",
    ...pickPersistedSettings(flow.settings),
    ...(privateSettings
      ? {
          webhookUrl: privateSettings.webhookUrl,
          autoSendLead: privateSettings.autoSendLead,
          notifyEmail: privateSettings.notifyEmail,
          notifyWhatsapp: privateSettings.notifyWhatsapp,
          notifyOnLead: privateSettings.notifyOnLead,
        }
      : {}),
    webhookSecret: "", // nunca vem do servidor; preencher = trocar
    headScripts: "",
    name: flow.name,
    slug: flow.slug,
    procedure: flow.procedure ?? "",
    description: flow.description ?? "",
    status: flow.status,
    whatsapp: flow.whatsapp_number ?? flow.organization.whatsapp_number ?? "",
    finalMessage: flow.final_message ?? "",
  }));
  const setS = (patch: Partial<FunnelSettings>) => { setSettings((prev) => ({ ...prev, ...patch })); setSaved(false); };

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveFlow({
        id: flow.id,
        name: settings.name,
        slug: settings.slug,
        procedure: settings.procedure,
        description: settings.description,
        status: settings.status,
        whatsapp: settings.whatsapp,
        finalMessage: settings.finalMessage,
        coverImageUrl: settings.ogImage || flow.cover_image_url,
        settings: settings as unknown as Record<string, unknown>,
        steps,
      });
      if (res.ok) {
        setSaved(true);
        // Etapas novas ganharam id definitivo no servidor: aplica aqui também.
        const map = res.idMap;
        if (map && Object.keys(map).length > 0) {
          setSteps((prev) => applyIdMap(prev, map));
          setSelectedId((cur) => map[cur] ?? cur);
        }
      } else {
        setSaveError(res.error ?? "Falha ao salvar.");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  const [theme, setTheme] = useState<FlowTheme>({
    ...DEFAULT_THEME,
    primaryColor: flow.organization.primary_color ?? DEFAULT_THEME.primaryColor,
    logoUrl: flow.organization.logo_url ?? undefined,
  });
  const setT = (patch: Partial<FlowTheme>) => {
    setTheme((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const dragId = useRef<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const selected = useMemo(() => findNode(steps, selectedId), [steps, selectedId]);

  const update = (next: FlowStep[]) => {
    setSteps(next.map((s, i) => ({ ...s, position: i })));
    setSaved(false);
  };

  // Ligação feita no canvas (arrastando a bolinha da opção): guarda o id da
  // etapa de destino, que não quebra quando as etapas são reordenadas.
  const setBranch = (stepId: string, optIndex: number, next: number | undefined) => {
    const node = findNode(steps, stepId);
    if (!node) return;
    const goto = typeof next === "number" ? steps[next]?.id : undefined;
    update(updateNode(steps, stepId, { config: { ...node.config, options: (node.config.options ?? []).map((o, i) => (i === optIndex ? { ...o, next: undefined, goto } : o)) } }));
  };

  const makeExitStep = (): FlowStep => ({ id: uid(), flow_id: flow.id, position: 0, type: "exit", config: defaultConfig("exit") });
  // Garante que exista um final "sem interesse" (cria no fim, se faltar).
  const ensureExit = () => {
    setSteps((prev) => (prev.some((s) => s.type === "exit") ? prev : [...prev, makeExitStep()].map((s, i) => ({ ...s, position: i }))));
    setSaved(false);
  };
  const [smartMsg, setSmartMsg] = useState<string | null>(null);
  // Lógica inteligente: liga respostas negativas ao final "sem interesse".
  const runSmartLogic = () => {
    const r = applySmartLogic(steps, makeExitStep);
    if (r.linked === 0) setSmartMsg("Nenhuma resposta negativa sem destino. Sua lógica já está em ordem ✓");
    else {
      update(r.steps);
      setSmartMsg(`${r.linked} resposta${r.linked > 1 ? "s" : ""} negativa${r.linked > 1 ? "s" : ""} agora leva${r.linked > 1 ? "m" : ""} ao final “sem interesse”${r.createdExit ? ". Criei esse bloco no fim do funil para você" : ""}.`);
    }
    setTimeout(() => setSmartMsg(null), 7000);
  };

  const addBlock = (type: StepType, preset?: Partial<FlowStep["config"]>) => {
    const config = preset ? { ...defaultConfig(type), ...preset } : defaultConfig(type);
    const block: FlowStep = { id: uid(), flow_id: flow.id, position: 0, type, config, ...(ACCEPTS_CHILDREN(type) ? { children: [] } : {}) };
    const sel = findNode(steps, selectedId);
    const next = sel && ACCEPTS_CHILDREN(sel.type) ? insertIntoId(steps, selectedId, block) : sel ? insertAfterId(steps, selectedId, block) : [...steps, block];
    update(next);
    setSelectedId(block.id);
  };

  const addStepAtEnd = () => {
    const step: FlowStep = { id: uid(), flow_id: flow.id, position: steps.length, type: "question", config: defaultConfig("question") };
    update([...steps, step]);
    setSelectedId(step.id);
  };

  const removeStep = (id: string) => {
    const { tree } = removeNode(steps, id);
    update(tree);
    if (id === selectedId) setSelectedId(tree[0]?.id ?? "");
  };

  const duplicateStep = (id: string) => {
    const node = findNode(steps, id);
    if (!node) return;
    const clone = regenIds(node);
    update(insertAfterId(steps, id, clone));
    setSelectedId(clone.id);
  };

  const patchConfig = (patch: Partial<FlowStep["config"]>) => {
    if (!selected) return;
    update(updateNode(steps, selectedId, { config: { ...selected.config, ...patch } }));
  };

  const moveAfter = (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const fromNode = findNode(steps, from);
    if (fromNode && isInSubtree(fromNode, targetId)) return;
    const { tree, removed } = removeNode(steps, from);
    if (removed) update(insertAfterId(tree, targetId, removed));
  };
  const moveInto = (containerId: string) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === containerId) return;
    const fromNode = findNode(steps, from);
    if (fromNode && isInSubtree(fromNode, containerId)) return;
    const { tree, removed } = removeNode(steps, from);
    if (removed) update(insertIntoId(tree, containerId, removed));
  };
  const toggleCollapse = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const ancestor = useMemo(() => topAncestor(steps, selectedId), [steps, selectedId]);
  const previewFlow: PublicFlow = useMemo(() => ({ ...flow, steps: ancestor ? [ancestor] : [] }), [flow, ancestor]);
  const previewKey = ancestor ? JSON.stringify(ancestor) : "empty";

  const grouped = useMemo(() => {
    const g: Record<string, BlockDef[]> = {};
    for (const b of BLOCK_CATALOG) (g[b.group] ??= []).push(b);
    return g;
  }, []);

  // Ocupa exatamente o espaço até o fim da tela, descontando topo e avisos.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const bottomGap = window.innerWidth >= 768 ? 17 : 13; // margem do painel + borda
      el.style.height = `${Math.max(480, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - bottomGap)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={rootRef} className="-mx-6 -my-6 flex h-[calc(100vh-84px)] flex-col bg-white md:-mx-8 md:-my-7">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b px-5 py-3">
        <Link href="/flows" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <nav className="mx-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          {[
            { label: "Construtor", icon: Layers, key: "build" as const },
            { label: "Fluxo", icon: GitBranch, key: "flow" as const },
            { label: "Design", icon: Palette, key: "design" as const },
            { label: "Leads", icon: Users },
            { label: "Configurações", icon: Settings, key: "settings" as const },
          ].map((it) => {
            const key = "key" in it ? it.key : undefined;
            const active = key === tab;
            return (
              <button
                key={it.label}
                onClick={() => key && setTab(key)}
                disabled={!key}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5",
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                  !key && "cursor-not-allowed opacity-50",
                )}
              >
                <it.icon className="h-4 w-4" /> {it.label}
              </button>
            );
          })}
        </nav>
        <Link href={`/${flow.organization.slug}/${flow.slug}`} target="_blank" className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          <ExternalLink className="h-3.5 w-3.5" /> Ver
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          title={saveError ?? undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white",
            saveError ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600",
            saving && "opacity-60",
          )}
        >
          {saving ? "Salvando..." : saveError ? "Erro — tentar de novo" : saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {tab === "build" && (
          <>
        {/* Etapas */}
        <div className="flex w-52 shrink-0 flex-col border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Etapas</p>
            <button
              onClick={runSmartLogic}
              title="Lógica inteligente: envia respostas negativas para o final “sem interesse”"
              className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Wand2 className="h-3.5 w-3.5" /> Lógica
            </button>
          </div>
          {smartMsg && <p className="mx-2 mb-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] leading-snug text-emerald-800">{smartMsg}</p>}
          <div className="flex-1 overflow-y-auto px-2">
            <TreeRows
              list={steps}
              depth={0}
              selectedId={selectedId}
              collapsed={collapsed}
              onSelect={setSelectedId}
              onToggle={toggleCollapse}
              onDuplicate={duplicateStep}
              onRemove={removeStep}
              onDragStart={(id) => (dragId.current = id)}
              onDropAfter={moveAfter}
              onDropInto={moveInto}
            />
          </div>
        </div>

        {/* Paleta de blocos */}
        <div className="w-56 shrink-0 overflow-y-auto border-r p-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Blocos</p>
          {Object.entries(grouped).map(([group, blocks]) => (
            <div key={group} className="mb-3">
              <p className="mb-1 px-1 text-[11px] font-medium text-slate-400">{group}</p>
              <div className="flex flex-col gap-1">
                {blocks.map((b) => {
                  const Icon = ICONS[b.type];
                  return (
                    <button
                      key={b.id ?? b.type}
                      onClick={() => addBlock(b.type, b.preset)}
                      className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="flex-1">{b.label}</span>
                      {b.isNew && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">novo</span>}
                      <Plus className="h-3.5 w-3.5 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
          </>
        )}

        {tab === "design" && <DesignPanel theme={theme} setT={setT} />}

        {tab === "settings" && <SettingsPanel s={settings} setS={setS} slug={flow.slug} flowId={flow.id} handle={flow.organization.slug} hasWebhookSecret={privateSettings?.hasWebhookSecret} hasHeadScripts={privateSettings?.hasHeadScripts} />}

        {tab === "flow" && (
          <FlowCanvas
            steps={steps}
            leads={leads}
            selectedId={selectedId}
            positions={positions}
            onSelect={setSelectedId}
            onEdit={() => setTab("build")}
            onAddStep={addStepAtEnd}
            onMoveNode={(id, x, y) => setPositions((p) => ({ ...p, [id]: { x, y } }))}
            onResetLayout={() => setPositions({})}
            onSetBranch={setBranch}
          />
        )}

        {/* Preview */}
        {tab !== "flow" && tab !== "settings" && (
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-6">
          {selected ? (
            <div className="mx-auto h-[680px] w-[380px] overflow-hidden rounded-[2rem] border-4 border-slate-800 bg-white shadow-xl">
              <div className="h-full overflow-y-auto" key={previewKey}>
                <FlowRunner flow={previewFlow} preview theme={theme} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Adicione um bloco para começar.</p>
          )}
        </div>
        )}

        {/* Inspetor */}
        {tab === "build" && (
          <div className="w-72 shrink-0 overflow-y-auto border-l p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Editar bloco</p>
            {selected ? (
              <LogicCtx.Provider value={{ steps, currentId: selected.id, ensureExit }}>
                <Inspector step={selected} onChange={patchConfig} />
              </LogicCtx.Provider>
            ) : <p className="text-sm text-slate-400">Nenhum bloco selecionado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Design ------------------------------ */

const COLOR_PRESETS = ["#7C3AED", "#16A34A", "#0EA5E9", "#EC4899", "#F59E0B", "#0F172A", "#EF4444", "#14B8A6"];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase focus:border-emerald-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-slate-300")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

// Linha com rótulo/descrição + interruptor (usada no Inspector).
function ToggleRow({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {desc && <span className="block text-xs text-slate-400">{desc}</span>}
      </span>
      <span className="shrink-0"><Toggle on={on} onChange={onChange} /></span>
    </div>
  );
}

// Campos possíveis no "cofre" da roleta (revelar prêmio após preencher).
const GATE_FIELDS: FormField[] = [
  { name: "name", label: "Nome", type: "text", placeholder: "Seu nome" },
  { name: "phone", label: "WhatsApp / Telefone", type: "tel", placeholder: "(00) 00000-0000" },
  { name: "email", label: "E-mail", type: "email", placeholder: "voce@email.com" },
];

// Blocos que exibem o botão automático "Continuar" (podem ocultá-lo).
const HAS_CONTINUE = new Set<StepType>([
  "text", "image", "before_after", "carousel", "testimonial", "video", "stats",
  "alert", "timer", "level", "faq", "chart_growth", "chart_gauge", "audio", "container", "result", "cta",
]);

function DesignPanel({ theme, setT }: { theme: FlowTheme; setT: (p: Partial<FlowTheme>) => void }) {
  const fonts: { key: FontChoice; label: string }[] = [
    { key: "sans", label: "Padrão" },
    { key: "serif", label: "Serifada" },
    { key: "rounded", label: "Arredondada" },
  ];
  return (
    <div className="w-72 shrink-0 overflow-y-auto border-r p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Design do funil</p>

      <p className="mb-2 text-sm font-semibold text-slate-700">Cores</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => setT({ primaryColor: c })}
            className={cn("h-7 w-7 rounded-full border-2", theme.primaryColor.toLowerCase() === c.toLowerCase() ? "border-slate-900" : "border-transparent")}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>
      <ColorRow label="Cor principal" value={theme.primaryColor} onChange={(v) => setT({ primaryColor: v })} />
      <ColorRow label="Cor de fundo" value={theme.backgroundColor} onChange={(v) => setT({ backgroundColor: v })} />
      <ColorRow label="Cor do texto" value={theme.textColor} onChange={(v) => setT({ textColor: v })} />

      <p className="mb-2 mt-5 text-sm font-semibold text-slate-700">Tipografia</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {fonts.map((f) => (
          <button
            key={f.key}
            onClick={() => setT({ fontFamily: f.key })}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-medium",
              theme.fontFamily === f.key ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold text-slate-700">Botões</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["solid", "soft"] as const).map((fill) => (
          <button
            key={fill}
            onClick={() => setT({ buttonFill: fill })}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              theme.buttonFill === fill ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600",
            )}
          >
            {fill === "solid" ? "Sólido" : "Suave"}
          </button>
        ))}
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Cantos do botão: {theme.buttonRadius}px</span>
        <input
          type="range" min={0} max={28} value={theme.buttonRadius}
          onChange={(e) => setT({ buttonRadius: Number(e.target.value) })}
          className="w-full accent-emerald-500"
        />
      </label>

      <p className="mb-2 mt-5 text-sm font-semibold text-slate-700">Layout</p>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-600">Barra de progresso</span>
        <Toggle on={theme.progressBar} onChange={(v) => setT({ progressBar: v })} />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Logo (URL)</span>
        <input
          value={theme.logoUrl ?? ""}
          onChange={(e) => setT({ logoUrl: e.target.value || undefined })}
          placeholder="https://..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
      </label>
    </div>
  );
}

/* ------------------------------ Inspector ------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

function Inspector({ step, onChange }: { step: FlowStep; onChange: (p: Partial<FlowStep["config"]>) => void }) {
  const c = step.config;
  const t = step.type;

  return (
    <div>
      <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        {LABELS[t]}
      </div>

      {"title" in defaultAllowed(t) && (
        <Field label="Título">
          <input className={inputCls} value={c.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
      )}
      {["start", "question", "multi_choice", "rating", "stats", "level", "chart_growth", "chart_gauge", "form", "news", "spin_wheel", "container", "hero"].includes(t) && (
        <Field label="Subtítulo">
          <input className={inputCls} value={c.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value })} />
        </Field>
      )}
      {["text", "alert", "cta", "timer", "whatsapp", "exit"].includes(t) && (
        <Field label="Texto">
          <textarea className={inputCls} rows={3} value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
        </Field>
      )}
      {["start", "cta", "whatsapp", "news", "form", "exit"].includes(t) && (
        <Field label="Texto do botão">
          <input className={inputCls} value={c.button_label ?? ""} onChange={(e) => onChange({ button_label: e.target.value })} />
        </Field>
      )}

      {/* Alinhamento vertical do conteúdo — disponível em todos os blocos */}
      <Field label="Posição do conteúdo">
        <div className="grid grid-cols-2 gap-1.5">
          {([["center", "Centralizado"], ["top", "Colado no topo"]] as const).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => onChange({ top_align: v })}
              className={cn("rounded-lg border py-1.5 text-xs font-medium", (c.top_align ?? "center") === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}
            >
              {lbl}
            </button>
          ))}
        </div>
      </Field>

      {/* Opções (question / multi_choice) */}
      {(t === "question" || t === "multi_choice") && (
        <>
          <SizeField label="Tamanho dos botões" value={c.option_size ?? "md"} onChange={(v) => onChange({ option_size: v })} />
          <OptionsEditor options={c.options ?? []} question={c.title ?? ""} onChange={(options) => onChange({ options })} />
        </>
      )}

      {/* Antes e depois */}
      {t === "before_after" && <BeforeAfterEditor c={c} onChange={onChange} />}

      {/* Hero (capa com imagem + degradê) */}
      {t === "hero" && (
        <>
          <Field label="Imagem de fundo (URL)"><input className={inputCls} value={c.image_url ?? ""} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="https://..." /></Field>
          <div className="-mt-2 mb-3"><UploadButton label="Enviar imagem" maxSizeMB={5} onUploaded={(url) => onChange({ image_url: url })} /></div>
          <Field label="Texto do botão (CTA)"><input className={inputCls} value={c.button_label ?? ""} onChange={(e) => onChange({ button_label: e.target.value })} placeholder="Quero saber mais" /></Field>
          <p className="mb-2 mt-1 text-sm font-semibold text-slate-700">Degradê</p>
          <ColorRow label="Cor" value={c.overlay_color ?? "#0b1220"} onChange={(v) => onChange({ overlay_color: v })} />
          <Field label={`Opacidade: ${c.overlay_opacity ?? 60}%`}>
            <input type="range" min={0} max={100} value={c.overlay_opacity ?? 60} onChange={(e) => onChange({ overlay_opacity: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </Field>
          <Field label="Direção do degradê">
            <select className={inputCls} value={c.overlay_dir ?? "bottom"} onChange={(e) => onChange({ overlay_dir: e.target.value as "bottom" | "top" | "full" | "diagonal" })}>
              <option value="bottom">De baixo (escuro embaixo)</option>
              <option value="top">De cima</option>
              <option value="diagonal">Diagonal</option>
              <option value="full">Uniforme (escurece tudo)</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Altura">
              <select className={inputCls} value={c.hero_height ?? "md"} onChange={(e) => onChange({ hero_height: e.target.value as "sm" | "md" | "lg" })}>
                <option value="sm">Baixa</option><option value="md">Média</option><option value="lg">Alta</option>
              </select>
            </Field>
            <Field label="Alinhamento">
              <select className={inputCls} value={c.text_align ?? "left"} onChange={(e) => onChange({ text_align: e.target.value as "left" | "center" })}>
                <option value="left">Esquerda</option><option value="center">Centro</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-slate-700">Texto claro (sobre imagem escura)</span>
            <button onClick={() => onChange({ text_light: !(c.text_light ?? true) })} className={cn("relative h-6 w-11 rounded-full transition-colors", (c.text_light ?? true) ? "bg-emerald-500" : "bg-slate-300")}>
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", (c.text_light ?? true) ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-700">Com o Hero selecionado, os blocos da paleta entram <b>dentro</b> dele (sobre a imagem).</p>
        </>
      )}

      {/* Seção / Grupo (container) */}
      {t === "container" && (
        <>
          <Field label="Layout">
            <select className={inputCls} value={c.container_layout ?? "vertical"} onChange={(e) => onChange({ container_layout: e.target.value as "vertical" | "horizontal" | "grid" })}>
              <option value="vertical">Vertical (empilhado)</option>
              <option value="horizontal">Horizontal (lado a lado)</option>
              <option value="grid">Grade (colunas)</option>
            </select>
          </Field>
          {c.container_layout === "grid" && (
            <Field label="Colunas"><input type="number" min={1} max={4} className={inputCls} value={c.columns ?? 2} onChange={(e) => onChange({ columns: Number(e.target.value) })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Espaçamento (px)"><input type="number" min={0} className={inputCls} value={c.gap ?? 12} onChange={(e) => onChange({ gap: Number(e.target.value) })} /></Field>
            <Field label="Padding (px)"><input type="number" min={0} className={inputCls} value={c.pad ?? 0} onChange={(e) => onChange({ pad: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Alinhamento">
            <select className={inputCls} value={c.align ?? "start"} onChange={(e) => onChange({ align: e.target.value as "start" | "center" | "end" })}>
              <option value="start">Início</option>
              <option value="center">Centro</option>
              <option value="end">Fim</option>
            </select>
          </Field>
          <ColorRow label="Cor de fundo" value={c.bg ?? "#ffffff"} onChange={(v) => onChange({ bg: v })} />
          <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-700">
            Com esta seção selecionada, os blocos da paleta são adicionados <b>dentro</b> dela. Você também pode arrastar blocos para o “soltar aqui”.
          </p>
        </>
      )}

      {/* Botões (personalizado) */}
      {t === "buttons" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-500">Layout</span>
              <select className={inputCls} value={c.buttons_layout ?? "stack"} onChange={(e) => onChange({ buttons_layout: e.target.value as "stack" | "grid" })}>
                <option value="stack">Empilhado</option>
                <option value="grid">Lado a lado</option>
              </select>
            </div>
            <SizeField label="Tamanho" value={c.size ?? "md"} onChange={(v) => onChange({ size: v })} />
          </div>
          <ButtonsEditor buttons={c.buttons ?? []} onChange={(buttons) => onChange({ buttons })} />
        </>
      )}

      {/* Áudio */}
      {t === "audio" && (
        <>
          <Field label="URL do áudio (mp3)"><input className={inputCls} value={c.audio_url ?? ""} onChange={(e) => onChange({ audio_url: e.target.value })} placeholder="https://.../audio.mp3" /></Field>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-slate-700">Tocar automaticamente</span>
            <button onClick={() => onChange({ autoplay: !c.autoplay })} className={cn("relative h-6 w-11 rounded-full transition-colors", c.autoplay ? "bg-emerald-500" : "bg-slate-300")}>
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", c.autoplay ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Velocidades 1x / 1,5x / 2x já ficam disponíveis no player.</p>
        </>
      )}

      {/* Carrossel */}
      {t === "carousel" && (
        <>
          <Field label="Layout">
            <select className={inputCls} value={c.carousel_layout ?? "slider"} onChange={(e) => onChange({ carousel_layout: e.target.value as "slider" | "cards" | "grid" | "list" })}>
              <option value="slider">Slider (um por vez)</option>
              <option value="cards">Cards lado a lado (horizontal)</option>
              <option value="grid">Grade (2 colunas)</option>
              <option value="list">Lista vertical</option>
            </select>
          </Field>
          <CarouselEditor items={c.items ?? []} onChange={(items) => onChange({ items })} />
        </>
      )}

      {/* Rating */}
      {t === "rating" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mínimo"><input type="number" className={inputCls} value={c.min ?? 0} onChange={(e) => onChange({ min: Number(e.target.value) })} /></Field>
            <Field label="Máximo"><input type="number" className={inputCls} value={c.max ?? 10} onChange={(e) => onChange({ max: Number(e.target.value) })} /></Field>
          </div>
          <RatingRulesEditor rules={c.rating_rules ?? []} max={c.max ?? 10} onChange={(rating_rules) => onChange({ rating_rules })} />
        </>
      )}

      {/* Final "sem interesse" */}
      {t === "exit" && (
        <>
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-relaxed text-rose-800">
            Este bloco <b>só aparece quando uma resposta, regra ou portão envia a pessoa para cá</b>. No caminho normal ele é pulado. O lead fica registrado como <b>perdido</b>.
          </div>
          <Field label="Link do botão (opcional)">
            <input className={inputCls} value={c.cta_href ?? ""} onChange={(e) => onChange({ cta_href: e.target.value })} placeholder="https://instagram.com/suaclinica" />
          </Field>
          <Field label="Motivo (etiqueta do lead)">
            <input className={inputCls} value={c.exit_reason ?? ""} onChange={(e) => onChange({ exit_reason: e.target.value })} placeholder="Sem interesse" />
          </Field>
        </>
      )}

      {/* Timer */}
      {t === "timer" && (
        <Field label="Minutos"><input type="number" className={inputCls} value={c.minutes ?? 15} onChange={(e) => onChange({ minutes: Number(e.target.value) })} /></Field>
      )}

      {/* Gauge — slider que anima o preview */}
      {t === "chart_gauge" && (
        <>
          <Field label={`Valor: ${c.gauge_value ?? 76}%`}>
            <input type="range" min={0} max={100} value={c.gauge_value ?? 76} onChange={(e) => onChange({ gauge_value: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </Field>
          <Field label="Legenda"><input className={inputCls} value={c.gauge_caption ?? ""} onChange={(e) => onChange({ gauge_caption: e.target.value })} /></Field>
        </>
      )}

      {/* Growth — séries que animam o preview */}
      {t === "chart_growth" && <ChartGrowthEditor c={c} onChange={onChange} />}

      {/* News */}
      {t === "news" && (
        <>
          <Field label="Modelo">
            <select className={inputCls} value={c.layout ?? "metropoles"} onChange={(e) => onChange({ layout: e.target.value as "metropoles" | "g1" | "buzz" | "portalg11" | "saude" | "atarde" })}>
              <option value="metropoles">Metrópoles (colunista)</option>
              <option value="g1">g1 (notícia)</option>
              <option value="buzz">BuzzNews (negócios/copy)</option>
              <option value="portalg11">Portal G11 (advertorial)</option>
              <option value="saude">Ciência e Saúde (antes/depois)</option>
              <option value="atarde">A Tarde (jornal serifado)</option>
            </select>
          </Field>
          <Field label="Fonte / marca (topo)"><input className={inputCls} value={c.source ?? ""} onChange={(e) => onChange({ source: e.target.value })} placeholder="BUZZ, PORTALG11, A TARDE..." /></Field>
          {(c.layout === "saude" || c.layout === "atarde") && (
            <Field label="Seção do jornal"><input className={inputCls} value={c.section ?? ""} onChange={(e) => onChange({ section: e.target.value })} placeholder="CIÊNCIA E SAÚDE / CREMAÇÃO" /></Field>
          )}
          <Field label="Autor / assinatura"><input className={inputCls} value={c.byline ?? ""} onChange={(e) => onChange({ byline: e.target.value })} placeholder="Por Sandro Pedroso, G11" /></Field>
          <Field label="Data"><input className={inputCls} value={c.date ?? ""} onChange={(e) => onChange({ date: e.target.value })} placeholder="17/01/2023 – Atualizado há duas horas" /></Field>
          {(c.layout === "saude" || c.layout === "metropoles") && (
            <Field label="Palavra em destaque (vermelho)"><input className={inputCls} value={c.highlight_word ?? ""} onChange={(e) => onChange({ highlight_word: e.target.value })} placeholder="VARIZES" /></Field>
          )}
          <Field label="Imagem principal (URL)"><input className={inputCls} value={c.image_url ?? ""} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="https://..." /></Field>
          <div className="-mt-2 mb-3"><UploadButton label="Enviar imagem" maxSizeMB={5} onUploaded={(url) => onChange({ image_url: url })} /></div>
          {c.layout === "saude" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Field label="Imagem antes"><input className={inputCls} value={c.before_url ?? ""} onChange={(e) => onChange({ before_url: e.target.value })} placeholder="https://..." /></Field>
                <div className="-mt-2 mb-3"><UploadButton label="Enviar" maxSizeMB={5} onUploaded={(url) => onChange({ before_url: url })} /></div>
              </div>
              <div>
                <Field label="Imagem depois"><input className={inputCls} value={c.after_url ?? ""} onChange={(e) => onChange({ after_url: e.target.value })} placeholder="https://..." /></Field>
                <div className="-mt-2 mb-3"><UploadButton label="Enviar" maxSizeMB={5} onUploaded={(url) => onChange({ after_url: url })} /></div>
              </div>
            </div>
          )}
          {c.layout === "buzz" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Visualizações"><input className={inputCls} value={c.views ?? ""} onChange={(e) => onChange({ views: e.target.value })} placeholder="647" /></Field>
              <Field label="Comentários"><input className={inputCls} value={c.comments ?? ""} onChange={(e) => onChange({ comments: e.target.value })} placeholder="0" /></Field>
            </div>
          )}
          {(c.layout === "buzz" || c.layout === "metropoles") && (
            <>
              <Field label="Foto do autor (URL)"><input className={inputCls} value={c.columnist?.avatar_url ?? ""} onChange={(e) => onChange({ columnist: { ...(c.columnist ?? { name: c.byline ?? "" }), avatar_url: e.target.value } })} placeholder="https://..." /></Field>
              <div className="-mt-2 mb-3"><UploadButton label="Enviar foto" maxSizeMB={5} onUploaded={(url) => onChange({ columnist: { ...(c.columnist ?? { name: c.byline ?? "" }), avatar_url: url } })} /></div>
            </>
          )}
          <Field label="Vídeo (YouTube embed)"><input className={inputCls} value={c.video_url ?? ""} onChange={(e) => onChange({ video_url: e.target.value })} /></Field>
          <Field label={c.layout === "atarde" ? "Parágrafos (um por linha; use \"- \" para lista)" : "Parágrafos (um por linha)"}>
            <textarea className={inputCls} rows={4} value={(c.paragraphs ?? []).join("\n")} onChange={(e) => onChange({ paragraphs: e.target.value.split("\n") })} />
          </Field>
        </>
      )}

      {/* Roleta */}
      {t === "spin_wheel" && (
        <>
          <div className="mb-3 flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-slate-700">Roleta gira</span>
            <button
              onClick={() => onChange({ spin_enabled: !(c.spin_enabled ?? true) })}
              className={cn("relative h-6 w-11 rounded-full transition-colors", (c.spin_enabled ?? true) ? "bg-emerald-500" : "bg-slate-300")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", (c.spin_enabled ?? true) ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
          <Field label="Texto do botão central"><input className={inputCls} value={c.button_label ?? ""} onChange={(e) => onChange({ button_label: e.target.value })} placeholder="GIRE!" /></Field>
          <Field label="Texto do CTA (após ganhar)"><input className={inputCls} value={c.cta_label ?? ""} onChange={(e) => onChange({ cta_label: e.target.value })} placeholder="Resgatar no WhatsApp" /></Field>
          <Field label="Ação do botão">
            <select className={inputCls} value={c.cta_action ?? "whatsapp"} onChange={(e) => onChange({ cta_action: e.target.value as "whatsapp" | "link" })}>
              <option value="whatsapp">WhatsApp (mensagem automática)</option>
              <option value="link">Meu próprio link</option>
            </select>
          </Field>
          {(c.cta_action ?? "whatsapp") === "link" ? (
            <Field label="Link de destino (URL)"><input className={inputCls} value={c.cta_href ?? ""} onChange={(e) => onChange({ cta_href: e.target.value })} placeholder="https://..." /></Field>
          ) : (
            <Field label="Mensagem personalizada (opcional)">
              <textarea className={inputCls} rows={3} value={c.cta_message ?? ""} onChange={(e) => onChange({ cta_message: e.target.value })} placeholder="Ex.: Olá! Ganhei {premio} e quero agendar. — deixe vazio para usar a mensagem automática com as respostas." />
              <p className="mt-1 text-[11px] text-slate-400">Vai para o número cadastrado. Use <b>{"{nome}"}</b> e <b>{"{premio}"}</b> — são substituídos automaticamente.</p>
            </Field>
          )}
          <p className="mb-1 mt-1 text-xs font-medium text-slate-500">Prêmios (fatias)</p>
          <div className="flex flex-col gap-2">
            {(c.wheel_segments ?? []).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls} value={s.label} onChange={(e) => {
                  const arr = [...(c.wheel_segments ?? [])]; arr[i] = { ...arr[i], label: e.target.value }; onChange({ wheel_segments: arr });
                }} />
                <button onClick={() => onChange({ wheel_segments: (c.wheel_segments ?? []).filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ wheel_segments: [...(c.wheel_segments ?? []), { label: "Novo prêmio!" }] })} className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Plus className="h-4 w-4" /> Adicionar prêmio
          </button>

          {/* Lógica de ganhos por tentativa */}
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Ganhos por tentativa</p>
            <Field label="Nº de tentativas (giros)">
              <input type="number" min={1} max={6} className={inputCls} value={c.max_attempts ?? 1}
                onChange={(e) => {
                  const m = Math.max(1, Math.min(6, Number(e.target.value) || 1));
                  const arr = Array.from({ length: m }, (_, i) => c.attempt_outcomes?.[i] ?? -1);
                  onChange({ max_attempts: m, attempt_outcomes: arr });
                }} />
            </Field>
            <div className="flex flex-col gap-2">
              {Array.from({ length: c.max_attempts ?? 1 }).map((_, i) => (
                <label key={i} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="shrink-0">Tentativa {i + 1} ganha:</span>
                  <select className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={c.attempt_outcomes?.[i] ?? -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const m = c.max_attempts ?? 1;
                      const arr = Array.from({ length: m }, (_, k) => (k === i ? v : c.attempt_outcomes?.[k] ?? -1));
                      onChange({ attempt_outcomes: arr });
                    }}>
                    <option value={-1}>Aleatório</option>
                    {(c.wheel_segments ?? []).map((s, idx) => <option key={idx} value={idx}>{idx + 1}. {s.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Ex.: 3 tentativas — 1ª “Não foi dessa vez”, 2ª “Brinde”, 3ª o prêmio principal.</p>
            {(c.max_attempts ?? 1) > 1 && (
              <Field label="Texto do botão de girar de novo"><input className={inputCls} value={c.retry_label ?? ""} onChange={(e) => onChange({ retry_label: e.target.value })} placeholder="Girar novamente" /></Field>
            )}
          </div>

          {/* Cofre: revelar prêmio só após preencher dados */}
          <div className="mt-5 border-t pt-4">
            <ToggleRow
              label="Bloquear prêmio até preencher (borrado)"
              desc="A pessoa gira, o prêmio fica desfocado e só aparece depois de enviar os dados."
              on={!!c.gate_enabled}
              onChange={(v) => onChange({ gate_enabled: v })}
            />
            {c.gate_enabled && (
              <div className="mt-1 flex flex-col gap-1.5">
                <p className="text-xs text-slate-400">Escolha o que pedir e o que é obrigatório:</p>
                {GATE_FIELDS.map((gf) => {
                  const cur = (c.gate_fields ?? []).find((x) => x.name === gf.name);
                  const included = !!cur;
                  const setField = (patch: Partial<FormField> | null) => {
                    const rest = (c.gate_fields ?? []).filter((x) => x.name !== gf.name);
                    if (patch === null) { onChange({ gate_fields: rest }); return; }
                    onChange({ gate_fields: [...rest, { ...(cur ?? gf), ...patch }] });
                  };
                  return (
                    <div key={gf.name} className="rounded-lg border p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">{gf.label}</span>
                        <Toggle on={included} onChange={(v) => setField(v ? {} : null)} />
                      </div>
                      {included && (
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Obrigatório</span>
                          <Toggle on={!!cur?.required} onChange={(v) => setField({ required: v })} />
                        </div>
                      )}
                    </div>
                  );
                })}
                <Field label="Texto LGPD (opcional)"><input className={inputCls} value={c.gate_consent ?? ""} onChange={(e) => onChange({ gate_consent: e.target.value })} placeholder="Seus dados estão protegidos (LGPD)." /></Field>
              </div>
            )}
          </div>

          {/* Cores do bloco */}
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Cores da roleta</p>
            <ColorRow label="Fundo" value={c.wheel_bg ?? "#1e3a8a"} onChange={(v) => onChange({ wheel_bg: v })} />
            <ColorRow label="Fatia A" value={c.wheel_color_a ?? "#f59e0b"} onChange={(v) => onChange({ wheel_color_a: v })} />
            <ColorRow label="Fatia B" value={c.wheel_color_b ?? "#1d4ed8"} onChange={(v) => onChange({ wheel_color_b: v })} />
            <ColorRow label="Aro / luzes" value={c.wheel_ring ?? "#d4a017"} onChange={(v) => onChange({ wheel_ring: v })} />
            <ColorRow label="Destaque (título/GIRE)" value={c.wheel_accent ?? "#ffcf3f"} onChange={(v) => onChange({ wheel_accent: v })} />
          </div>
        </>
      )}

      {/* Image */}
      {t === "image" && (
        <>
          <Field label="URL da imagem"><input className={inputCls} value={c.image_url ?? ""} onChange={(e) => onChange({ image_url: e.target.value })} /></Field>
          <div className="-mt-2 mb-3"><UploadButton label="Enviar imagem" maxSizeMB={5} onUploaded={(url) => onChange({ image_url: url })} /></div>
          <ToggleRow label="Colar no topo" desc="Encosta a imagem na linha do cabeçalho (ideal quando não há logo)." on={!!c.flush_top} onChange={(v) => onChange({ flush_top: v })} />
          <ToggleRow label="Largura total" desc="Ocupa toda a largura, sem margens laterais." on={!!c.full_bleed} onChange={(v) => onChange({ full_bleed: v })} />
        </>
      )}
      {t === "video" && (
        <>
          <Field label="Onde está o vídeo?">
            <div className="grid grid-cols-3 gap-1.5">
              {([["youtube", "YouTube"], ["drive", "Google Drive"], ["vturb", "VTurb"], ["vimeo", "Vimeo"], ["mp4", "MP4 / Upload"]] as const).map(([v, lbl]) => (
                <button key={v} onClick={() => onChange({ video_provider: v })}
                  className={cn("rounded-lg border py-1.5 text-[11px] font-medium", (c.video_provider ?? "youtube") === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label={(c.video_provider ?? "youtube") === "vturb" ? "URL do embed VTurb" : (c.video_provider === "mp4" ? "URL do MP4 (ou envie abaixo)" : "URL / link do vídeo")}>
            <input className={inputCls} value={c.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://..." />
          </Field>
          {c.video_provider === "mp4" && (
            <div className="-mt-2 mb-3"><UploadButton label="Enviar vídeo (até 40 MB)" accept="video/*" maxSizeMB={40} onUploaded={(url) => onChange({ url })} /></div>
          )}
          <ToggleRow label="Ocultar controles do player" desc="Esconde os botões que vêm do YouTube/Drive/etc. pra pessoa não sair do funil. Controle total só com MP4." on={!!c.video_hide_controls} onChange={(v) => onChange({ video_hide_controls: v })} />
          <ToggleRow label="Barra de progresso falsa" desc="Uma linha que corre rápido no começo e desacelera perto do fim, dando a sensação de que o vídeo está quase acabando." on={!!c.video_fake_bar} onChange={(v) => onChange({ video_fake_bar: v })} />
          {c.video_fake_bar && (
            <>
              <Field label={`Velocidade da barra: ${c.video_fake_speed ?? 0.5}`}>
                <input type="range" min={0.2} max={0.8} step={0.05} value={c.video_fake_speed ?? 0.5} onChange={(e) => onChange({ video_fake_speed: Number(e.target.value) })} className="w-full accent-emerald-500" />
                <p className="mt-1 text-[11px] text-slate-400">Menor = corre mais rápido no início e desacelera mais no fim.</p>
              </Field>
              {c.video_provider !== "mp4" && (
                <Field label={`Duração estimada do vídeo: ${c.video_fake_duration ?? 120}s`}>
                  <input type="range" min={15} max={1200} step={15} value={c.video_fake_duration ?? 120} onChange={(e) => onChange({ video_fake_duration: Number(e.target.value) })} className="w-full accent-emerald-500" />
                  <p className="mt-1 text-[11px] text-slate-400">Usada só quando o player não é MP4 (não dá pra ler o tempo real).</p>
                </Field>
              )}
            </>
          )}
        </>
      )}

      {/* Testimonial */}
      {t === "testimonial" && (
        <>
          <Field label="Depoimento"><textarea className={inputCls} rows={3} value={c.quote ?? ""} onChange={(e) => onChange({ quote: e.target.value })} /></Field>
          <Field label="Autor"><input className={inputCls} value={c.author ?? ""} onChange={(e) => onChange({ author: e.target.value })} /></Field>
          <Field label="Foto do paciente (URL)"><input className={inputCls} value={c.avatar_url ?? ""} onChange={(e) => onChange({ avatar_url: e.target.value })} placeholder="https://..." /></Field>
          <div className="-mt-2 mb-3"><UploadButton label="Enviar foto" maxSizeMB={5} onUploaded={(url) => onChange({ avatar_url: url })} /></div>
        </>
      )}

      {/* Portão de qualificação por pontuação */}
      {t !== "exit" && t !== "start" && t !== "hero" && (
        <div className="mt-4 border-t pt-4">
          <ToggleRow
            label="Portão de qualificação"
            desc="Só mostra este bloco para quem atingiu a pontuação mínima. Quem não atingir segue para outro destino."
            on={typeof c.score_gate_min === "number"}
            onChange={(v) => onChange(v ? { score_gate_min: 40, score_gate_goto: c.score_gate_goto ?? GOTO_EXIT } : { score_gate_min: undefined, score_gate_goto: undefined })}
          />
          {typeof c.score_gate_min === "number" && (
            <>
              <Field label={`Pontuação mínima: ${c.score_gate_min}`}>
                <input type="range" min={0} max={100} step={5} value={c.score_gate_min} onChange={(e) => onChange({ score_gate_min: Number(e.target.value) })} className="w-full accent-emerald-500" />
              </Field>
              <Field label="Quem não atingir vai para">
                <GotoSelect value={c.score_gate_goto ?? GOTO_EXIT} onChange={(v) => onChange({ score_gate_goto: v ?? GOTO_EXIT })} />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Botão automático "Continuar" (evita 2 botões na mesma tela) */}
      {HAS_CONTINUE.has(t) && (
        <div className="mt-4 border-t pt-4">
          <ToggleRow
            label="Mostrar botão “Continuar”"
            desc="Desligue quando o bloco já tem o próprio botão, pra não ficar dois."
            on={!c.hide_continue}
            onChange={(v) => onChange({ hide_continue: !v })}
          />
        </div>
      )}
    </div>
  );
}

// Editor do "Gráfico crescimento": estilo, animação em tempo real, marcadores,
// pontos, textos e cores.
function ChartGrowthEditor({ c, onChange }: { c: FlowStep["config"]; onChange: (p: Partial<FlowStep["config"]>) => void }) {
  const style = c.growth_style ?? "compare";
  const speed = c.chart_speed ?? (style === "compare" ? 1.2 : 4);
  const base = c.chart_colors && c.chart_colors.length >= 2
    ? c.chart_colors
    : style === "points" ? ["#c0392b", "#f0b23a", "#4caf50"] : ["#d23c2f", "#efcb45", "#4db6a0"];
  const three = [base[0], base[Math.floor(base.length / 2)], base[base.length - 1]];
  const setColor = (i: number, v: string) => { const next = [...three]; next[i] = v; onChange({ chart_colors: next }); };
  const pts = c.chart_points ?? [{ label: "Ontem", value: 75 }, { label: "Hoje", value: 60 }, { label: "Amanhã", value: 40 }];
  const setPt = (i: number, patch: Partial<{ label: string; value: number }>) =>
    onChange({ chart_points: pts.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const axis = c.chart_axis_labels ?? ["0%", "Precisa começar", "> 75%", "100%"];
  const setAxis = (i: number, v: string) => { const next = [...axis]; while (next.length < 4) next.push(""); next[i] = v; onChange({ chart_axis_labels: next }); };

  // Ao trocar de estilo, completa os campos que ainda não existem com os padrões.
  const pickStyle = (v: "curve" | "points" | "compare") => {
    const d = defaultConfig("chart_growth") as Record<string, unknown>;
    const cur = c as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(d)) if (cur[k] === undefined && k !== "title") patch[k] = d[k];
    onChange({ ...patch, growth_style: v } as Partial<FlowStep["config"]>);
  };
  const section = "mb-2 mt-4 border-t pt-3 text-sm font-semibold text-slate-700";

  return (
    <>
      <Field label="Estilo do gráfico">
        <div className="grid grid-cols-3 gap-1.5">
          {([["curve", "Diagnóstico"], ["points", "Evolução"], ["compare", "Comparação"]] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => pickStyle(v)}
              className={cn("rounded-lg border py-1.5 text-xs font-medium", style === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
              {lbl}
            </button>
          ))}
        </div>
      </Field>

      <p className={section}>Animação em tempo real</p>
      <Field label={`Velocidade: ${speed}s${speed <= 2 ? " (rápida)" : speed >= 7 ? " (lenta)" : ""}`}>
        <input type="range" min={1} max={12} step={0.5} value={speed} onChange={(e) => onChange({ chart_speed: Number(e.target.value) })} className="w-full accent-emerald-500" />
        <p className="mt-1 text-[11px] text-slate-400">Tempo que o gráfico leva para ser desenhado na tela.</p>
      </Field>
      {style !== "compare" && (
        <ToggleRow label="Mostrar a análise acontecendo" desc="“Analisando suas respostas…” com uma varredura correndo pelo gráfico e o valor subindo ao vivo." on={c.chart_live ?? true} onChange={(v) => onChange({ chart_live: v })} />
      )}
      <ToggleRow label="Repetir animação" desc="O gráfico se redesenha em loop enquanto a pessoa está na tela." on={!!c.chart_loop} onChange={(v) => onChange({ chart_loop: v })} />

      {style === "curve" && (
        <>
          <p className={section}>Marcadores</p>
          <Field label={`Posição do “Você”: ${c.chart_you_value ?? 33}%`}>
            <input type="range" min={0} max={100} value={c.chart_you_value ?? 33} onChange={(e) => onChange({ chart_you_value: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </Field>
          <Field label="Texto do “Você”"><input className={inputCls} value={c.chart_you_text ?? "VOCÊ"} onChange={(e) => onChange({ chart_you_text: e.target.value })} /></Field>
          <Field label={`Posição do “Ideal”: ${c.chart_ideal_value ?? 66}%`}>
            <input type="range" min={0} max={100} value={c.chart_ideal_value ?? 66} onChange={(e) => onChange({ chart_ideal_value: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </Field>
          <Field label="Texto do “Ideal”"><input className={inputCls} value={c.chart_ideal_text ?? "IDEAL"} onChange={(e) => onChange({ chart_ideal_text: e.target.value })} /></Field>
          <p className="mb-1 text-xs font-medium text-slate-500">Legendas do eixo</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {["Início", "Sob o Você", "Sob o Ideal", "Fim"].map((ph, i) => (
              <input key={ph} className={inputCls} placeholder={ph} value={axis[i] ?? ""} onChange={(e) => setAxis(i, e.target.value)} />
            ))}
          </div>
        </>
      )}

      {style === "points" && (
        <>
          <p className={section}>Pontos do gráfico</p>
          <div className="mb-2 flex flex-col gap-2">
            {pts.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls} placeholder="Rótulo" value={q.label} onChange={(e) => setPt(i, { label: e.target.value })} />
                <input type="number" className={cn(inputCls, "w-20")} value={q.value} onChange={(e) => setPt(i, { value: Number(e.target.value) })} />
                <button onClick={() => pts.length > 2 && onChange({ chart_points: pts.filter((_, k) => k !== i) })} disabled={pts.length <= 2} className="text-slate-400 hover:text-rose-500 disabled:opacity-30" aria-label="Remover ponto">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {pts.length < 6 && (
            <button onClick={() => onChange({ chart_points: [...pts, { label: "Novo", value: 50 }] })} className="mb-3 flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Plus className="h-4 w-4" /> Adicionar ponto
            </button>
          )}
          <Field label="“Você” fica no ponto">
            <select className={inputCls} value={c.chart_you_index ?? Math.floor((pts.length - 1) / 2)} onChange={(e) => onChange({ chart_you_index: Number(e.target.value) })}>
              {pts.map((q, i) => <option key={i} value={i}>{q.label || `Ponto ${i + 1}`}</option>)}
            </select>
          </Field>
          <Field label="Texto do marcador"><input className={inputCls} value={c.chart_you_text ?? "Você"} onChange={(e) => onChange({ chart_you_text: e.target.value })} /></Field>
          <Field label="Topo do eixo (vazio = automático)">
            <input type="number" className={inputCls} value={c.chart_y_max ?? ""} placeholder="80" onChange={(e) => onChange({ chart_y_max: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Field>
        </>
      )}

      {style !== "compare" && (
        <>
          <p className={section}>Textos (use **negrito**)</p>
          <Field label="Caixa de atenção (acima do gráfico)"><textarea className={inputCls} rows={2} value={c.chart_callout ?? ""} onChange={(e) => onChange({ chart_callout: e.target.value })} /></Field>
          <Field label="Caixa de alerta (abaixo)"><textarea className={inputCls} rows={2} value={c.chart_warning ?? ""} onChange={(e) => onChange({ chart_warning: e.target.value })} /></Field>
          <Field label="Mensagem final"><textarea className={inputCls} rows={2} value={c.chart_message ?? ""} onChange={(e) => onChange({ chart_message: e.target.value })} /></Field>

          <p className={section}>Cores</p>
          <ColorRow label="Início da linha" value={three[0]} onChange={(v) => setColor(0, v)} />
          <ColorRow label="Meio da linha" value={three[1]} onChange={(v) => setColor(1, v)} />
          <ColorRow label="Fim da linha" value={three[2]} onChange={(v) => setColor(2, v)} />
          <ColorRow
            label="Cor do título"
            value={c.chart_title_color ?? (style === "curve" ? c.chart_accent ?? "#e573b5" : "#0f172a")}
            onChange={(v) => onChange({ chart_title_color: v })}
          />
          <ColorRow label="Cor de destaque (Ideal / mensagem final)" value={c.chart_accent ?? "#e573b5"} onChange={(v) => onChange({ chart_accent: v })} />
        </>
      )}

      {style === "compare" && (
        <>
          <p className="mb-1 mt-3 text-xs font-medium text-slate-500">Série “Você”</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(c.you_series ?? [0, 0, 0]).map((v, i) => (
              <input key={i} type="number" className={inputCls} value={v} onChange={(e) => {
                const arr = [...(c.you_series ?? [0, 0, 0])]; arr[i] = Number(e.target.value); onChange({ you_series: arr });
              }} />
            ))}
          </div>
          <p className="mb-1 text-xs font-medium text-slate-500">Série “Concorrência”</p>
          <div className="grid grid-cols-3 gap-2">
            {(c.competitor_series ?? [0, 0, 0]).map((v, i) => (
              <input key={i} type="number" className={inputCls} value={v} onChange={(e) => {
                const arr = [...(c.competitor_series ?? [0, 0, 0])]; arr[i] = Number(e.target.value); onChange({ competitor_series: arr });
              }} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SizeField({ label, value, onChange }: { label: string; value: string; onChange: (v: "sm" | "md" | "lg") => void }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-3 gap-1.5">
        {(["sm", "md", "lg"] as const).map((s) => (
          <button key={s} onClick={() => onChange(s)} className={cn("rounded-lg border py-1.5 text-xs font-medium", value === s ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
            {s === "sm" ? "Pequeno" : s === "md" ? "Médio" : "Grande"}
          </button>
        ))}
      </div>
    </Field>
  );
}

function defaultAllowed(t: StepType) {
  const withTitle = ["start", "text", "image", "video", "carousel", "before_after", "question", "multi_choice", "rating", "stats", "level", "chart_growth", "chart_gauge", "faq", "form", "news", "cta", "whatsapp", "timer", "spin_wheel", "buttons", "audio", "container", "hero", "exit"];
  return withTitle.includes(t) ? { title: true } : {};
}

// Contexto da lógica: etapas disponíveis como destino e criação do final.
const LogicCtx = createContext<{ steps: FlowStep[]; currentId: string; ensureExit: () => void }>({
  steps: [], currentId: "", ensureExit: () => {},
});

// "Ir para…": próxima etapa, final sem interesse, WhatsApp ou qualquer etapa.
function GotoSelect({ value, legacyNext, onChange }: { value?: string; legacyNext?: number; onChange: (v: string | undefined) => void }) {
  const { steps, currentId, ensureExit } = useContext(LogicCtx);
  const current = value ?? (typeof legacyNext === "number" ? steps[legacyNext]?.id : undefined) ?? "";
  return (
    <select
      className={cn(
        "w-full rounded border px-2 py-1 text-xs",
        current === GOTO_EXIT ? "border-rose-200 bg-rose-50 text-rose-700" : current ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600",
      )}
      value={current}
      onChange={(e) => {
        const v = e.target.value || undefined;
        onChange(v);
        if (v === GOTO_EXIT) ensureExit(); // depois do onChange, para não perder a edição
      }}
    >
      <option value="">→ Seguir para a próxima etapa</option>
      <option value={GOTO_EXIT}>⛔ Final: sem interesse</option>
      <option value={GOTO_WHATSAPP}>💬 Direto para o WhatsApp</option>
      <optgroup label="Pular para a etapa">
        {steps.map((st, i) => (st.id === currentId ? null : (
          <option key={st.id} value={st.id}>
            {i + 1}. {LABELS[st.type]}{st.config.title ? ` — ${st.config.title.slice(0, 26)}` : ""}
          </option>
        )))}
      </optgroup>
    </select>
  );
}

function RatingRulesEditor({ rules, max, onChange }: { rules: RatingRule[]; max: number; onChange: (r: RatingRule[]) => void }) {
  const set = (i: number, patch: Partial<RatingRule>) => onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="mb-3 mt-1 rounded-lg border border-slate-200 p-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Route className="h-3.5 w-3.5 text-emerald-600" /> Regras pela nota</p>
      {rules.length === 0 && <p className="mb-2 text-[11px] leading-snug text-slate-400">Ex.: nota até 3 → final sem interesse; a partir de 8 → direto para o WhatsApp.</p>}
      <div className="flex flex-col gap-2">
        {rules.map((r, i) => (
          <div key={i} className="rounded-md bg-slate-50 p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <select className="rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-600" value={r.op} onChange={(e) => set(i, { op: e.target.value as "lte" | "gte" })}>
                <option value="lte">Se a nota for até</option>
                <option value="gte">Se a nota for a partir de</option>
              </select>
              <input type="number" min={0} max={max} className="w-14 rounded border border-slate-200 px-2 py-1 text-xs" value={r.value} onChange={(e) => set(i, { value: Number(e.target.value) })} />
              <button onClick={() => onChange(rules.filter((_, k) => k !== i))} className="ml-auto text-slate-400 hover:text-rose-500" aria-label="Remover regra"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <GotoSelect value={r.goto} onChange={(v) => set(i, { goto: v ?? "" })} />
          </div>
        ))}
      </div>
      {rules.length < 3 && (
        <button
          onClick={() => onChange([...rules, rules.length === 0 ? { op: "lte", value: 3, goto: GOTO_EXIT } : { op: "gte", value: Math.max(1, max - 2), goto: GOTO_WHATSAPP }])}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar regra
        </button>
      )}
    </div>
  );
}

function OptionsEditor({ options, question = "", onChange }: { options: QuestionOption[]; question?: string; onChange: (o: QuestionOption[]) => void }) {
  const { ensureExit } = useContext(LogicCtx);
  const setOpt = (i: number, patch: Partial<QuestionOption>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const add = () => onChange([...options, { label: "Nova opção", value: "opt" + (options.length + 1), score: 0 }]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-slate-500">Opções</p>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="mb-1.5 flex items-center gap-2">
              <input className={inputCls} value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
              <button onClick={() => remove(i)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            {/* Emoji */}
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-slate-400">Emoji</span>
              <input className="w-12 rounded border border-slate-200 px-2 py-1 text-center text-sm" placeholder="😊" value={o.emoji ?? ""} onChange={(e) => setOpt(i, { emoji: e.target.value || undefined })} />
              {QUICK_EMOJIS.map((em) => (
                <button key={em} onClick={() => setOpt(i, { emoji: em })} className={cn("rounded px-1 text-base leading-none hover:bg-slate-100", o.emoji === em && "bg-emerald-100 ring-1 ring-emerald-300")}>{em}</button>
              ))}
              {o.emoji && <button onClick={() => setOpt(i, { emoji: undefined })} className="text-[11px] text-slate-400 hover:text-rose-500">limpar</button>}
            </div>
            <div className="mb-1.5 grid grid-cols-2 gap-1.5">
              <label className="flex items-center gap-1 text-[11px] text-slate-500">
                Pontos
                <input type="number" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={o.score ?? 0} onChange={(e) => setOpt(i, { score: Number(e.target.value) })} />
              </label>
              <select className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600" value={o.image_style ?? ""} onChange={(e) => setOpt(i, { image_style: (e.target.value || undefined) as "cover" | "circle" | "float" | undefined })}>
                <option value="">Sem imagem</option>
                <option value="cover">Imagem capa</option>
                <option value="circle">Imagem círculo</option>
                <option value="float">Imagem flutuante (sem fundo)</option>
              </select>
            </div>
            {o.image_style && (
              <div className="mb-1.5 flex gap-1.5">
                <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="URL da imagem" value={o.image_url ?? ""} onChange={(e) => setOpt(i, { image_url: e.target.value })} />
                <UploadButton label="Enviar" onUploaded={(url) => setOpt(i, { image_url: url })} />
              </div>
            )}
            {o.image_style === "float" && <p className="mb-1.5 text-[10px] text-slate-400">Dica: use um PNG com fundo transparente — ele flutua no botão, sem moldura.</p>}
            <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Link externo (opcional)" value={o.href ?? ""} onChange={(e) => setOpt(i, { href: e.target.value || undefined })} />
            <div className="mt-1.5 flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <GotoSelect value={o.goto} legacyNext={o.next} onChange={(v) => setOpt(i, { goto: v, next: undefined })} />
            </div>
            {!o.goto && typeof o.next !== "number" && isNegativeAnswer(o.label, question) && (
              <button
                onClick={() => { setOpt(i, { goto: GOTO_EXIT, next: undefined }); ensureExit(); }}
                className="mt-1.5 flex w-full items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left text-[11px] leading-snug text-amber-800 hover:bg-amber-100"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0" /> Parece uma resposta negativa. Enviar para o final “sem interesse”?
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
        <Plus className="h-4 w-4" /> Adicionar opção
      </button>
    </div>
  );
}

function ButtonsEditor({ buttons, onChange }: { buttons: ButtonItem[]; onChange: (b: ButtonItem[]) => void }) {
  const set = (i: number, patch: Partial<ButtonItem>) => onChange(buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const add = () => onChange([...buttons, { label: "Novo botão", variant: "solid" }]);
  const remove = (i: number) => onChange(buttons.filter((_, idx) => idx !== i));
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-slate-500">Botões</p>
      <div className="flex flex-col gap-2">
        {buttons.map((b, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="mb-1.5 flex items-center gap-2">
              <input className={inputCls} value={b.label} onChange={(e) => set(i, { label: e.target.value })} />
              <button onClick={() => remove(i)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mb-1.5 grid grid-cols-2 gap-1.5">
              <select className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600" value={b.variant ?? "solid"} onChange={(e) => set(i, { variant: e.target.value as "solid" | "outline" })}>
                <option value="solid">Sólido</option>
                <option value="outline">Contorno</option>
              </select>
              <select className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600" value={b.image_style ?? ""} onChange={(e) => set(i, { image_style: (e.target.value || undefined) as "cover" | "circle" | undefined })}>
                <option value="">Sem imagem</option>
                <option value="cover">Imagem capa</option>
                <option value="circle">Imagem círculo</option>
              </select>
            </div>
            {b.image_style && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="URL da imagem" value={b.image_url ?? ""} onChange={(e) => set(i, { image_url: e.target.value })} />
                <UploadButton label="Enviar" maxSizeMB={5} onUploaded={(url) => set(i, { image_url: url })} />
              </div>
            )}
            <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Link externo (opcional)" value={b.href ?? ""} onChange={(e) => set(i, { href: e.target.value || undefined })} />
            <div className="mt-1.5 flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <GotoSelect value={b.goto} legacyNext={b.next} onChange={(v) => set(i, { goto: v, next: undefined })} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
        <Plus className="h-4 w-4" /> Adicionar botão
      </button>
    </div>
  );
}

function CarouselEditor({ items, onChange }: { items: { image_url: string; caption?: string }[]; onChange: (it: { image_url: string; caption?: string }[]) => void }) {
  const set = (i: number, patch: Partial<{ image_url: string; caption?: string }>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { image_url: "https://placehold.co/600x400/E2E8F0/475569/png?text=Nova", caption: "" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-slate-500">Imagens</p>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="mb-1.5 flex items-center gap-2">
              <input className={inputCls} placeholder="URL da imagem" value={it.image_url} onChange={(e) => set(i, { image_url: e.target.value })} />
              <UploadButton label="Enviar" maxSizeMB={5} onUploaded={(url) => set(i, { image_url: url })} />
              <button onClick={() => remove(i)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Legenda / texto" value={it.caption ?? ""} onChange={(e) => set(i, { caption: e.target.value })} />
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
        <Plus className="h-4 w-4" /> Adicionar imagem
      </button>
    </div>
  );
}

interface TreeProps {
  list: FlowStep[];
  depth: number;
  selectedId: string;
  collapsed: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropAfter: (id: string) => void;
  onDropInto: (id: string) => void;
}

function TreeRows(p: TreeProps) {
  return (
    <>
      {p.list.map((s) => {
        const Icon = ICONS[s.type];
        const isContainer = ACCEPTS_CHILDREN(s.type);
        const open = !p.collapsed.has(s.id);
        return (
          <div key={s.id}>
            <div
              draggable
              onDragStart={(e) => { e.stopPropagation(); p.onDragStart(s.id); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); p.onDropAfter(s.id); }}
              onClick={() => p.onSelect(s.id)}
              style={{ paddingLeft: 6 + p.depth * 14 }}
              className={cn(
                "group mb-1 flex cursor-pointer items-center gap-1.5 rounded-lg py-2 pr-2 text-sm",
                s.id === p.selectedId ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />
              {isContainer ? (
                <button onClick={(e) => { e.stopPropagation(); p.onToggle(s.id); }} className="shrink-0 text-slate-400">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                </button>
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {LABELS[s.type]}
                {isContainer && s.children?.length ? ` (${s.children.length})` : ""}
              </span>
              <button onClick={(e) => { e.stopPropagation(); p.onDuplicate(s.id); }} className="hidden text-slate-400 hover:text-slate-700 group-hover:block"><Copy className="h-3.5 w-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); p.onRemove(s.id); }} className="hidden text-slate-400 hover:text-rose-500 group-hover:block"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {isContainer && open && (
              <>
                <TreeRows {...p} list={s.children ?? []} depth={p.depth + 1} />
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); p.onDropInto(s.id); }}
                  style={{ marginLeft: 6 + (p.depth + 1) * 14 }}
                  className="mb-1 mr-1 rounded-lg border border-dashed border-slate-200 py-1.5 text-center text-[11px] text-slate-400 hover:border-emerald-300 hover:text-emerald-600"
                >
                  + soltar bloco aqui
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------ Configurações ------------------------------ */

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {desc && <p className="mb-1 text-xs text-slate-400">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
function SwitchRow({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t py-2.5 first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function SettingsPanel({ s, setS, flowId, handle, hasWebhookSecret = false, hasHeadScripts = false }: { s: FunnelSettings; setS: (p: Partial<FunnelSettings>) => void; slug?: string; flowId: string; handle: string; hasWebhookSecret?: boolean; hasHeadScripts?: boolean }) {
  const ta = "w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-emerald-400 focus:outline-none";
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Configurações do funil</h2>
          <p className="text-sm text-slate-500">Tudo pronto para publicar e escalar com tráfego pago.</p>
        </div>

        <Section title="Geral">
          <Field label="Nome do funil"><input className={inputCls} value={s.name} onChange={(e) => setS({ name: e.target.value })} /></Field>
          <Field label="URL pública">
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
              <span className="bg-slate-50 px-3 py-2 text-sm text-slate-400">{typeof window !== "undefined" ? window.location.host : "cliva.me"}/{handle}/</span>
              <input className="min-w-0 flex-1 px-2 py-2 text-sm focus:outline-none" value={s.slug} onChange={(e) => setS({ slug: e.target.value })} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Procedimento"><input className={inputCls} value={s.procedure} onChange={(e) => setS({ procedure: e.target.value })} /></Field>
            <Field label="Status">
              <div className="grid grid-cols-2 gap-1.5">
                {(["draft", "published"] as const).map((st) => (
                  <button key={st} onClick={() => setS({ status: st })} className={cn("rounded-lg border py-2 text-xs font-medium", s.status === st ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
                    {st === "draft" ? "Rascunho" : "Publicado"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Descrição"><textarea rows={2} className={inputCls} value={s.description} onChange={(e) => setS({ description: e.target.value })} /></Field>
        </Section>

        <Section title="WhatsApp & Conversão">
          <Field label="Número de WhatsApp (destino)"><input className={inputCls} value={s.whatsapp} onChange={(e) => setS({ whatsapp: e.target.value })} placeholder="5561999999999" /></Field>
          <Field label="Mensagem final (complemento)"><input className={inputCls} value={s.finalMessage} onChange={(e) => setS({ finalMessage: e.target.value })} /></Field>
          <Field label="Redirecionar após conversão (URL, opcional)"><input className={inputCls} value={s.redirectUrl} onChange={(e) => setS({ redirectUrl: e.target.value })} placeholder="https://..." /></Field>
          <div className="mt-1">
            <SwitchRow label="Reiniciar ao concluir" desc="Volta ao início após o WhatsApp." on={s.restartOnFinish} onChange={(v) => setS({ restartOnFinish: v })} />
            <SwitchRow label="Permitir voltar" desc="Mostra botão de voltar nas etapas." on={s.allowBack} onChange={(v) => setS({ allowBack: v })} />
            <SwitchRow label="Salvar progresso" desc="Retoma de onde parou se recarregar." on={s.saveProgress} onChange={(v) => setS({ saveProgress: v })} />
          </div>
        </Section>

        <Section title="Rastreamento (Pixels & Scripts)" desc="Para campanhas de tráfego pago.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta Pixel ID"><input className={inputCls} value={s.metaPixel} onChange={(e) => setS({ metaPixel: e.target.value })} placeholder="000000000000000" /></Field>
            <Field label="Google Analytics (GA4)"><input className={inputCls} value={s.ga4} onChange={(e) => setS({ ga4: e.target.value })} placeholder="G-XXXXXXX" /></Field>
            <Field label="Google Tag Manager"><input className={inputCls} value={s.gtm} onChange={(e) => setS({ gtm: e.target.value })} placeholder="GTM-XXXXXX" /></Field>
            <Field label="TikTok Pixel"><input className={inputCls} value={s.tiktokPixel} onChange={(e) => setS({ tiktokPixel: e.target.value })} placeholder="CXXXXXXXXXXXX" /></Field>
          </div>
          <Field label="Scripts no <head> (avançado)">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Desativado por segurança: scripts livres podem roubar dados dos pacientes (LGPD). Use os campos de pixel acima.
              {hasHeadScripts && " O script salvo antes foi guardado e não é mais executado."}
            </p>
          </Field>
        </Section>

        <Section title="Integrações (Webhook / CRM)" desc="Envie cada lead automaticamente para seu CRM.">
          <Field label="URL do webhook"><input className={inputCls} value={s.webhookUrl} onChange={(e) => setS({ webhookUrl: e.target.value })} placeholder="https://seu-crm.com/webhook" /></Field>
          <Field label="Segredo / token (opcional)">
            <input className={inputCls} type="password" autoComplete="off" value={s.webhookSecret} onChange={(e) => setS({ webhookSecret: e.target.value })}
              placeholder={hasWebhookSecret ? "•••••••• configurado (digite para trocar)" : "Opcional"} />
          </Field>
          <SwitchRow label="Enviar lead automaticamente" desc="Dispara o webhook a cada conclusão." on={s.autoSendLead} onChange={(v) => setS({ autoSendLead: v })} />
          <button disabled title="Disponível quando o envio de webhooks for ativado" className="mt-2 cursor-not-allowed rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-400">Testar webhook (em breve)</button>
        </Section>

        <Section title="SEO & Compartilhamento">
          <Field label="Título (meta)"><input className={inputCls} value={s.seoTitle} onChange={(e) => setS({ seoTitle: e.target.value })} /></Field>
          <Field label="Descrição (meta)"><textarea rows={2} className={inputCls} value={s.seoDescription} onChange={(e) => setS({ seoDescription: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Imagem de compartilhamento (OG, URL)"><input className={inputCls} value={s.ogImage} onChange={(e) => setS({ ogImage: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Favicon (URL ou emoji)"><input className={inputCls} value={s.favicon} onChange={(e) => setS({ favicon: e.target.value })} /></Field>
          </div>
          <SwitchRow label="Ocultar dos buscadores (noindex)" on={s.noindex} onChange={(v) => setS({ noindex: v })} />
        </Section>

        <Section title="Domínio personalizado">
          <div className="flex items-center gap-2">
            <input className={inputCls} value={s.customDomain} onChange={(e) => setS({ customDomain: e.target.value })} placeholder="funil.suaclinica.com.br" />
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">em breve</span>
          </div>
        </Section>

        <Section title="Privacidade (LGPD)">
          <Field label="Texto de consentimento"><textarea rows={2} className={inputCls} value={s.consentText} onChange={(e) => setS({ consentText: e.target.value })} /></Field>
          <Field label="URL da política de privacidade"><input className={inputCls} value={s.privacyUrl} onChange={(e) => setS({ privacyUrl: e.target.value })} placeholder="https://..." /></Field>
          <SwitchRow label="Mostrar banner de cookies" on={s.cookieBanner} onChange={(v) => setS({ cookieBanner: v })} />
        </Section>

        <Section title="Avançado">
          <Field label="CSS personalizado"><textarea rows={4} className={ta} value={s.customCss} onChange={(e) => setS({ customCss: e.target.value })} placeholder=".brand-btn { ... }" /></Field>
        </Section>

        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-rose-600">Zona de perigo</h3>
          <p className="mb-3 text-xs text-slate-400">Ações irreversíveis.</p>
          <DeleteFlowButton flowId={flowId} flowName={s.name} variant="button" redirectTo="/flows" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Antes e depois: editor ------------------------- */
type BAConfig = FlowStep["config"];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, lbl]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("rounded-lg border py-1.5 text-xs font-medium", value === v ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

function BeforeAfterEditor({ c, onChange }: { c: BAConfig; onChange: (p: Partial<BAConfig>) => void }) {
  const mode = c.ba_mode ?? "slider";
  return (
    <>
      <Field label="Exibição">
        <Seg value={mode} options={[["slider", "Deslizar para revelar"], ["static", "Lado a lado"]]} onChange={(v) => onChange({ ba_mode: v })} />
      </Field>
      {mode === "slider" && (
        <Field label="Transição">
          <Seg value={c.ba_transition ?? "wipe"} options={[["wipe", "Cortina suave"], ["fade", "Dissolver"]]} onChange={(v) => onChange({ ba_transition: v })} />
        </Field>
      )}
      <Field label="Formato das fotos">
        <Seg value={c.ba_aspect ?? "4:5"} options={[["4:5", "4:5"], ["1:1", "1:1"], ["3:4", "3:4"], ["16:9", "16:9"]]} onChange={(v) => onChange({ ba_aspect: v })} />
      </Field>

      <Field label="Imagem antes (link)">
        <input className={inputCls} value={c.before_url ?? ""} onChange={(e) => onChange({ before_url: e.target.value })} placeholder="https://..." />
      </Field>
      <div className="-mt-2 mb-3"><UploadButton label="Enviar foto do antes" maxSizeMB={5} onUploaded={(url) => onChange({ before_url: url })} /></div>
      <Field label="Imagem depois (link)">
        <input className={inputCls} value={c.after_url ?? ""} onChange={(e) => onChange({ after_url: e.target.value })} placeholder="https://..." />
      </Field>
      <div className="-mt-2 mb-3"><UploadButton label="Enviar foto do depois" maxSizeMB={5} onUploaded={(url) => onChange({ after_url: url })} /></div>

      {c.before_url && c.after_url && <BeforeAfterAligner c={c} onChange={onChange} />}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Rótulo antes"><input className={inputCls} value={c.ba_before_label ?? ""} onChange={(e) => onChange({ ba_before_label: e.target.value })} placeholder="Antes" /></Field>
        <Field label="Rótulo depois"><input className={inputCls} value={c.ba_after_label ?? ""} onChange={(e) => onChange({ ba_after_label: e.target.value })} placeholder="Depois" /></Field>
      </div>
      {mode === "slider" && (
        <Field label="Dica sobre a foto (vazio = sem dica)">
          <input className={inputCls} value={c.ba_hint ?? "Arraste para ver o resultado"} onChange={(e) => onChange({ ba_hint: e.target.value })} />
        </Field>
      )}
      <Field label="Legenda"><input className={inputCls} value={c.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Resultados podem variar." /></Field>
    </>
  );
}

// Sobrepõe as duas fotos (o depois semitransparente por cima do antes) para
// a pessoa arrastar e dar zoom até os contornos coincidirem. Assim a
// transição no funil fica sem "pulo" entre uma imagem e outra.
function BeforeAfterAligner({ c, onChange }: { c: BAConfig; onChange: (p: Partial<BAConfig>) => void }) {
  const [target, setTarget] = useState<"after" | "before">("after");
  const [ghost, setGhost] = useState(50);
  const frame = useRef<HTMLDivElement>(null);
  const natural = useRef<Record<"before" | "after", { w: number; h: number } | null>>({ before: null, after: null });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const key = target === "after" ? "ba_after" : "ba_before";
  const x = (c[`${key}_x` as const] as number | undefined) ?? 50;
  const y = (c[`${key}_y` as const] as number | undefined) ?? 50;
  const zoom = (c[`${key}_zoom` as const] as number | undefined) ?? 1;
  const set = (p: { x?: number; y?: number; zoom?: number }) =>
    onChange({
      ...(p.x !== undefined ? { [`${key}_x`]: p.x } : {}),
      ...(p.y !== undefined ? { [`${key}_y`]: p.y } : {}),
      ...(p.zoom !== undefined ? { [`${key}_zoom`]: p.zoom } : {}),
    } as Partial<BAConfig>);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x, y };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = frame.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const n = natural.current[target] ?? { w: r.width, h: r.height };
    // Quanto a foto (com zoom) sobra além do quadro em cada eixo.
    const s = Math.max(r.width / n.w, r.height / n.h);
    const overX = Math.max(1, zoom * n.w * s - r.width);
    const overY = Math.max(1, zoom * n.h * s - r.height);
    set({
      x: Math.round(clamp(d.x - ((e.clientX - d.px) / overX) * 100) * 10) / 10,
      y: Math.round(clamp(d.y - ((e.clientY - d.py) / overY) * 100) * 10) / 10,
    });
  };
  const onUp = () => { drag.current = null; };

  const f = beforeAfterFrames(c);
  return (
    <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <p className="text-sm font-semibold text-slate-800">Encaixar as fotos</p>
      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        O depois aparece transparente por cima do antes. Arraste e use o zoom até rosto, olhos e contorno coincidirem: a transição fica imperceptível.
      </p>
      <Seg value={target} options={[["after", "Ajustar depois"], ["before", "Ajustar antes"]]} onChange={setTarget} />
      <div
        ref={frame}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative mt-2 cursor-grab touch-none select-none overflow-hidden rounded-lg bg-slate-200 active:cursor-grabbing"
        style={{ aspectRatio: f.aspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.before_url} alt="" draggable={false}
          onLoad={(e) => { natural.current.before = { w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 }; }}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={f.before} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.after_url} alt="" draggable={false}
          onLoad={(e) => { natural.current.after = { w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 }; }}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ ...f.after, opacity: ghost / 100 }} />
        {/* grade de referência */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.35)_1px,transparent_1px)] bg-[size:33.33%_33.33%]" />
      </div>
      <Field label={`Zoom do ${target === "after" ? "depois" : "antes"}: ${zoom.toFixed(2)}x`}>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => set({ zoom: Number(e.target.value) })} className="w-full accent-emerald-500" />
      </Field>
      <Field label={`Transparência do depois: ${ghost}%`}>
        <input type="range" min={0} max={100} value={ghost} onChange={(e) => setGhost(Number(e.target.value))} className="w-full accent-emerald-500" />
      </Field>
      <button onClick={() => set({ x: 50, y: 50, zoom: 1 })} className="text-xs font-medium text-slate-500 underline hover:text-slate-700">
        Recentralizar {target === "after" ? "depois" : "antes"}
      </button>
    </div>
  );
}
