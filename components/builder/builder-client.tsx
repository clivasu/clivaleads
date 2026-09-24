"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Flag, Type, Image as ImageIcon, Video, GalleryHorizontal, Images,
  AlertTriangle, Newspaper, ListChecks, CircleDot, Star, ClipboardList,
  Quote, BarChart3, Gauge, TrendingUp, PieChart, HelpCircle, Loader,
  Timer as TimerIcon, Sparkles, MousePointerClick, MessageCircle, Gift,
  Volume2, SquareStack, LayoutGrid, LayoutTemplate,
  GripVertical, Trash2, Copy, Plus, ArrowLeft, ExternalLink, Check, ChevronDown,
  Layers, GitBranch, Palette, Users, Settings,
} from "lucide-react";
import type { FlowStep, PublicFlow, StepType, QuestionOption, ButtonItem } from "@/lib/types";
import { BLOCK_CATALOG, defaultConfig, type BlockDef } from "@/lib/block-catalog";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { FlowCanvas } from "@/components/builder/flow-canvas";
import { DEFAULT_THEME, type FlowTheme, type FontChoice } from "@/lib/theme";
import { saveFlow } from "@/lib/actions/flows";
import { cn } from "@/lib/utils";

const ICONS: Record<StepType, React.ElementType> = {
  start: Flag, text: Type, image: ImageIcon, video: Video, carousel: GalleryHorizontal,
  before_after: Images, alert: AlertTriangle, news: Newspaper, question: CircleDot,
  multi_choice: ListChecks, rating: Star, form: ClipboardList, testimonial: Quote,
  stats: BarChart3, level: Gauge, chart_growth: TrendingUp, chart_gauge: PieChart,
  faq: HelpCircle, loading: Loader, timer: TimerIcon, result: Sparkles,
  cta: MousePointerClick, whatsapp: MessageCircle, spin_wheel: Gift,
  buttons: SquareStack, audio: Volume2, container: LayoutGrid, hero: LayoutTemplate,
};
const ACCEPTS_CHILDREN = (t: StepType) => t === "container" || t === "hero";
// Rótulo canônico por type (ignora presets, que compartilham o mesmo type).
const LABELS = Object.fromEntries(
  BLOCK_CATALOG.filter((b) => !b.id).map((b) => [b.type, b.label]),
) as Record<StepType, string>;

function uid() {
  return "s-" + Math.random().toString(36).slice(2, 9);
}

interface FunnelSettings {
  name: string; slug: string; procedure: string; description: string; status: "draft" | "published";
  whatsapp: string; finalMessage: string; redirectUrl: string; restartOnFinish: boolean; allowBack: boolean; saveProgress: boolean;
  metaPixel: string; ga4: string; gtm: string; tiktokPixel: string; headScripts: string;
  webhookUrl: string; webhookSecret: string; autoSendLead: boolean;
  seoTitle: string; seoDescription: string; ogImage: string; favicon: string; noindex: boolean;
  customDomain: string;
  notifyEmail: string; notifyWhatsapp: string; notifyOnLead: boolean;
  consentText: string; privacyUrl: string; cookieBanner: boolean;
  customCss: string;
}
const DEFAULT_SETTINGS: FunnelSettings = {
  name: "", slug: "", procedure: "", description: "", status: "draft",
  whatsapp: "", finalMessage: "", redirectUrl: "", restartOnFinish: false, allowBack: true, saveProgress: true,
  metaPixel: "", ga4: "", gtm: "", tiktokPixel: "", headScripts: "",
  webhookUrl: "", webhookSecret: "", autoSendLead: false,
  seoTitle: "", seoDescription: "", ogImage: "", favicon: "", noindex: false,
  customDomain: "",
  notifyEmail: "", notifyWhatsapp: "", notifyOnLead: true,
  consentText: "Ao continuar, você concorda em ser contatado. Seus dados estão protegidos (LGPD).", privacyUrl: "", cookieBanner: false,
  customCss: "",
};

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

export function BuilderClient({ flow }: { flow: PublicFlow }) {
  const [steps, setSteps] = useState<FlowStep[]>(flow.steps);
  const [selectedId, setSelectedId] = useState<string>(flow.steps[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<"build" | "design" | "flow" | "settings">("build");
  const [settings, setSettings] = useState<FunnelSettings>(() => ({
    ...DEFAULT_SETTINGS,
    name: flow.name,
    slug: flow.slug,
    procedure: flow.procedure ?? "",
    description: flow.description ?? "",
    status: flow.status,
    whatsapp: flow.whatsapp_number ?? flow.organization.whatsapp_number ?? "",
    finalMessage: flow.final_message ?? "",
    seoTitle: `${flow.procedure ?? flow.name} — ${flow.organization.name}`,
    seoDescription: flow.description ?? "",
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

  const setBranch = (stepId: string, optIndex: number, next: number | undefined) => {
    const node = findNode(steps, stepId);
    if (!node) return;
    update(updateNode(steps, stepId, { config: { ...node.config, options: (node.config.options ?? []).map((o, i) => (i === optIndex ? { ...o, next } : o)) } }));
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
  const toggleCollapse = (id: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ancestor = useMemo(() => topAncestor(steps, selectedId), [steps, selectedId]);
  const previewFlow: PublicFlow = useMemo(() => ({ ...flow, steps: ancestor ? [ancestor] : [] }), [flow, ancestor]);
  const previewKey = ancestor ? JSON.stringify(ancestor) : "empty";

  const grouped = useMemo(() => {
    const g: Record<string, BlockDef[]> = {};
    for (const b of BLOCK_CATALOG) (g[b.group] ??= []).push(b);
    return g;
  }, []);

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-52px)] flex-col bg-white">
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
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Etapas</p>
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

        {tab === "settings" && <SettingsPanel s={settings} setS={setS} slug={flow.slug} />}

        {tab === "flow" && (
          <FlowCanvas
            steps={steps}
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
            {selected ? <Inspector step={selected} onChange={patchConfig} /> : <p className="text-sm text-slate-400">Nenhum bloco selecionado.</p>}
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
      {["text", "alert", "cta", "timer", "whatsapp"].includes(t) && (
        <Field label="Texto">
          <textarea className={inputCls} rows={3} value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
        </Field>
      )}
      {["start", "cta", "whatsapp", "news", "form"].includes(t) && (
        <Field label="Texto do botão">
          <input className={inputCls} value={c.button_label ?? ""} onChange={(e) => onChange({ button_label: e.target.value })} />
        </Field>
      )}

      {/* Opções (question / multi_choice) */}
      {(t === "question" || t === "multi_choice") && (
        <>
          <SizeField label="Tamanho dos botões" value={c.option_size ?? "md"} onChange={(v) => onChange({ option_size: v })} />
          <OptionsEditor options={c.options ?? []} onChange={(options) => onChange({ options })} />
        </>
      )}

      {/* Hero (capa com imagem + degradê) */}
      {t === "hero" && (
        <>
          <Field label="Imagem de fundo (URL)"><input className={inputCls} value={c.image_url ?? ""} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="https://..." /></Field>
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
            Com esta seção selecionada, os blocos da paleta são adicionados <b>dentro</b> dela. Você também pode arrastar blocos para o "soltar aqui".
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
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mínimo"><input type="number" className={inputCls} value={c.min ?? 0} onChange={(e) => onChange({ min: Number(e.target.value) })} /></Field>
          <Field label="Máximo"><input type="number" className={inputCls} value={c.max ?? 10} onChange={(e) => onChange({ max: Number(e.target.value) })} /></Field>
        </div>
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
      {t === "chart_growth" && (
        <>
          <p className="mb-1 text-xs font-medium text-slate-500">Série "Você"</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(c.you_series ?? [0, 0, 0]).map((v, i) => (
              <input key={i} type="number" className={inputCls} value={v} onChange={(e) => {
                const arr = [...(c.you_series ?? [0, 0, 0])]; arr[i] = Number(e.target.value); onChange({ you_series: arr });
              }} />
            ))}
          </div>
          <p className="mb-1 text-xs font-medium text-slate-500">Série "Concorrência"</p>
          <div className="grid grid-cols-3 gap-2">
            {(c.competitor_series ?? [0, 0, 0]).map((v, i) => (
              <input key={i} type="number" className={inputCls} value={v} onChange={(e) => {
                const arr = [...(c.competitor_series ?? [0, 0, 0])]; arr[i] = Number(e.target.value); onChange({ competitor_series: arr });
              }} />
            ))}
          </div>
        </>
      )}

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
          {c.layout === "saude" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Imagem antes"><input className={inputCls} value={c.before_url ?? ""} onChange={(e) => onChange({ before_url: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Imagem depois"><input className={inputCls} value={c.after_url ?? ""} onChange={(e) => onChange({ after_url: e.target.value })} placeholder="https://..." /></Field>
            </div>
          )}
          {c.layout === "buzz" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Visualizações"><input className={inputCls} value={c.views ?? ""} onChange={(e) => onChange({ views: e.target.value })} placeholder="647" /></Field>
              <Field label="Comentários"><input className={inputCls} value={c.comments ?? ""} onChange={(e) => onChange({ comments: e.target.value })} placeholder="0" /></Field>
            </div>
          )}
          {(c.layout === "buzz" || c.layout === "metropoles") && (
            <Field label="Foto do autor (URL)"><input className={inputCls} value={c.columnist?.avatar_url ?? ""} onChange={(e) => onChange({ columnist: { ...(c.columnist ?? { name: c.byline ?? "" }), avatar_url: e.target.value } })} placeholder="https://..." /></Field>
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
            <p className="mt-2 text-[11px] text-slate-400">Ex.: 3 tentativas — 1ª "Não foi dessa vez", 2ª "Brinde", 3ª o prêmio principal.</p>
            {(c.max_attempts ?? 1) > 1 && (
              <Field label="Texto do botão de girar de novo"><input className={inputCls} value={c.retry_label ?? ""} onChange={(e) => onChange({ retry_label: e.target.value })} placeholder="Girar novamente" /></Field>
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
          <ToggleRow label="Colar no topo" desc="Encosta a imagem na linha do cabeçalho (ideal quando não há logo)." on={!!c.flush_top} onChange={(v) => onChange({ flush_top: v })} />
          <ToggleRow label="Largura total" desc="Ocupa toda a largura, sem margens laterais." on={!!c.full_bleed} onChange={(v) => onChange({ full_bleed: v })} />
        </>
      )}
      {t === "video" && (
        <Field label="URL do vídeo (embed)"><input className={inputCls} value={c.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} /></Field>
      )}

      {/* Testimonial */}
      {t === "testimonial" && (
        <>
          <Field label="Depoimento"><textarea className={inputCls} rows={3} value={c.quote ?? ""} onChange={(e) => onChange({ quote: e.target.value })} /></Field>
          <Field label="Autor"><input className={inputCls} value={c.author ?? ""} onChange={(e) => onChange({ author: e.target.value })} /></Field>
          <Field label="Foto do paciente (URL)"><input className={inputCls} value={c.avatar_url ?? ""} onChange={(e) => onChange({ avatar_url: e.target.value })} placeholder="https://..." /></Field>
        </>
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
  const withTitle = ["start", "text", "image", "video", "carousel", "before_after", "question", "multi_choice", "rating", "stats", "level", "chart_growth", "chart_gauge", "faq", "form", "news", "cta", "whatsapp", "timer", "spin_wheel", "buttons", "audio", "container", "hero"];
  return withTitle.includes(t) ? { title: true } : {};
}

function OptionsEditor({ options, onChange }: { options: QuestionOption[]; onChange: (o: QuestionOption[]) => void }) {
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
            <div className="mb-1.5 grid grid-cols-2 gap-1.5">
              <label className="flex items-center gap-1 text-[11px] text-slate-500">
                Pontos
                <input type="number" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={o.score ?? 0} onChange={(e) => setOpt(i, { score: Number(e.target.value) })} />
              </label>
              <select className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600" value={o.image_style ?? ""} onChange={(e) => setOpt(i, { image_style: (e.target.value || undefined) as "cover" | "circle" | undefined })}>
                <option value="">Sem imagem</option>
                <option value="cover">Imagem capa</option>
                <option value="circle">Imagem círculo</option>
              </select>
            </div>
            {o.image_style && (
              <input className="mb-1.5 w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="URL da imagem" value={o.image_url ?? ""} onChange={(e) => setOpt(i, { image_url: e.target.value })} />
            )}
            <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Link externo (opcional)" value={o.href ?? ""} onChange={(e) => setOpt(i, { href: e.target.value || undefined })} />
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
            {b.image_style && <input className="mb-1.5 w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="URL da imagem" value={b.image_url ?? ""} onChange={(e) => set(i, { image_url: e.target.value })} />}
            <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Link externo (opcional)" value={b.href ?? ""} onChange={(e) => set(i, { href: e.target.value || undefined })} />
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

function SettingsPanel({ s, setS, slug }: { s: FunnelSettings; setS: (p: Partial<FunnelSettings>) => void; slug: string }) {
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
              <span className="bg-slate-50 px-3 py-2 text-sm text-slate-400">seudominio.com/f/</span>
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
          <Field label="Scripts no <head> (avançado)"><textarea rows={3} className={ta} value={s.headScripts} onChange={(e) => setS({ headScripts: e.target.value })} placeholder="<script>...</script>" /></Field>
        </Section>

        <Section title="Integrações (Webhook / CRM)" desc="Envie cada lead automaticamente para seu CRM.">
          <Field label="URL do webhook"><input className={inputCls} value={s.webhookUrl} onChange={(e) => setS({ webhookUrl: e.target.value })} placeholder="https://seu-crm.com/webhook" /></Field>
          <Field label="Segredo / token (opcional)"><input className={inputCls} value={s.webhookSecret} onChange={(e) => setS({ webhookSecret: e.target.value })} /></Field>
          <SwitchRow label="Enviar lead automaticamente" desc="Dispara o webhook a cada conclusão." on={s.autoSendLead} onChange={(v) => setS({ autoSendLead: v })} />
          <button className="mt-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Testar webhook</button>
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

        <Section title="Notificações">
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail de notificação"><input className={inputCls} value={s.notifyEmail} onChange={(e) => setS({ notifyEmail: e.target.value })} placeholder="voce@clinica.com" /></Field>
            <Field label="WhatsApp de notificação"><input className={inputCls} value={s.notifyWhatsapp} onChange={(e) => setS({ notifyWhatsapp: e.target.value })} placeholder="5561..." /></Field>
          </div>
          <SwitchRow label="Notificar a cada novo lead" on={s.notifyOnLead} onChange={(v) => setS({ notifyOnLead: v })} />
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
          <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50">Excluir funil</button>
        </div>
      </div>
    </div>
  );
}
