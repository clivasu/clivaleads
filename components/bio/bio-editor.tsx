"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Check, Plus, Trash2, ArrowUp, ArrowDown, Copy, BarChart3, Image as ImageIcon, Square, Type, Palette, AlignLeft, ChevronDown } from "lucide-react";
import type { BioConfig, BioPage, BioTemplateId, BioBlock, BioLinkIcon, BioSocialType } from "@/lib/types";
import { BIO_TEMPLATES, defaultBioConfig } from "@/lib/bio-templates";
import { BIO_FONTS } from "@/lib/bio-fonts";
import { BioRenderer } from "@/components/bio/bio-renderer";
import { UploadButton } from "@/components/bio/upload-button";
import { saveBio } from "@/lib/actions/bio";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400";
const LINK_ICONS: BioLinkIcon[] = ["calendar", "sparkles", "heart", "chat", "map", "whatsapp", "instagram", "facebook", "target", "building", "bulb", "star", "gift", "leaf", "phone", "link"];
const SOCIALS: BioSocialType[] = ["instagram", "whatsapp", "facebook", "youtube", "tiktok", "linkedin", "map", "site", "email"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1.5 text-sm text-slate-600">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-24 rounded border border-slate-200 px-2 py-1 text-xs" />
      </span>
    </label>
  );
}

export function BioEditor({
  bio,
  baseUrl,
  handle,
  clicks,
}: {
  bio: BioPage;
  baseUrl: string;
  handle: string;
  clicks: { total: number; byLabel: Record<string, number> };
}) {
  const [template, setTemplate] = useState<BioTemplateId>(bio.template);
  const [config, setConfig] = useState<BioConfig>(bio.config);
  const [status, setStatus] = useState<"draft" | "published">(bio.status);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const publicUrl = `${baseUrl}/${handle}`;
  const set = (patch: Partial<BioConfig>) => { setConfig((p) => ({ ...p, ...patch })); setSaved(false); };
  const setTheme = (patch: Partial<BioConfig["theme"]>) => set({ theme: { ...config.theme, ...patch } });

  const applyTemplate = (id: BioTemplateId) => {
    if (!confirm("Trocar o modelo substitui o conteúdo atual por este design. Continuar?")) return;
    setTemplate(id);
    setConfig(defaultBioConfig(id));
    setSaved(false);
  };

  const setBlock = (i: number, patch: Partial<BioBlock>) =>
    set({ blocks: config.blocks.map((b, k) => (k === i ? ({ ...b, ...patch } as BioBlock) : b)) });
  const removeBlock = (i: number) => set({ blocks: config.blocks.filter((_, k) => k !== i) });
  const moveBlock = (i: number, dir: -1 | 1) => {
    const arr = [...config.blocks];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ blocks: arr });
  };
  const addLink = () => set({ blocks: [...config.blocks, { type: "link", label: "Novo botão", url: "", icon: "link" }] });

  function save(nextStatus?: "draft" | "published") {
    const st = nextStatus ?? status;
    setStatus(st);
    startTransition(async () => {
      const res = await saveBio({ template, config, status: st });
      if (res.ok) setSaved(true);
      else alert(res.error ?? "Falha ao salvar.");
    });
  }

  return (
    <div>
      {/* Barra superior */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Link na Bio</h1>
          <button
            onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="mt-1 flex items-center gap-1.5 text-sm text-emerald-600 hover:underline"
          >
            {publicUrl.replace(/^https?:\/\//, "")} <Copy className="h-3.5 w-3.5" /> {copied && <span className="text-xs text-slate-400">copiado!</span>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${handle}`} target="_blank" className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <ExternalLink className="h-3.5 w-3.5" /> Ver
          </Link>
          <button onClick={() => save()} disabled={pending} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {pending ? "..." : saved ? <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Salvo</span> : "Salvar"}
          </button>
          <button onClick={() => save(status === "published" ? "draft" : "published")} disabled={pending}
            className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold text-white", status === "published" ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-500 hover:bg-emerald-600")}>
            {status === "published" ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Controles */}
        <div>
          {/* Modelos */}
          <Section title="Modelo (design)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.values(BIO_TEMPLATES).map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className={cn("rounded-xl border-2 p-2 text-left transition-colors", template === t.id ? "border-emerald-400 bg-emerald-50" : "border-slate-100 hover:border-slate-300")}>
                  <span className="mb-1.5 flex gap-1">
                    {t.swatch.map((c, i) => <span key={i} className="h-5 flex-1 rounded" style={{ background: c }} />)}
                  </span>
                  <span className="block text-xs font-semibold text-slate-800">{t.name}</span>
                  <span className="block text-[10px] leading-tight text-slate-400">{t.vibe}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Perfil */}
          <Section title="Perfil">
            <Field label="Foto de capa">
              <div className="flex gap-2">
                <input className={input} value={config.cover_url ?? ""} onChange={(e) => set({ cover_url: e.target.value })} placeholder="Cole uma URL ou envie um arquivo" />
                <UploadButton onUploaded={(url) => set({ cover_url: url })} />
              </div>
              {config.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.cover_url} alt="" className={cn("mt-2 border object-cover", (config.cover_shape ?? "cover") === "circle" ? "h-16 w-16 rounded-full" : "h-16 w-full rounded-lg")} />
              )}
            </Field>
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              <Field label="Formato da foto">
                <select className={input} value={config.cover_shape ?? "cover"} onChange={(e) => set({ cover_shape: e.target.value as "cover" | "circle" })}>
                  <option value="cover">Capa (largura total)</option>
                  <option value="circle">Círculo (avatar)</option>
                </select>
              </Field>
              {(config.cover_shape ?? "cover") === "circle" ? (
                <Field label={`Tamanho do círculo: ${config.cover_size ?? 140}px`}>
                  <input type="range" min={80} max={220} value={config.cover_size ?? 140} onChange={(e) => set({ cover_size: Number(e.target.value) })} className="w-full accent-emerald-500" />
                </Field>
              ) : (
                <Field label={`Degradê (funde no site): ${config.cover_fade ?? 0}%`}>
                  <input type="range" min={0} max={100} value={config.cover_fade ?? 0} onChange={(e) => set({ cover_fade: Number(e.target.value) })} className="w-full accent-emerald-500" />
                </Field>
              )}
            </div>
            <Field label="Nome"><input className={input} value={config.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Frase (tagline)"><input className={input} value={config.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} /></Field>
            <Field label="Chamada em destaque (opcional)"><input className={input} value={config.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} /></Field>
            <Field label="Rodapé"><input className={input} value={config.footer ?? ""} onChange={(e) => set({ footer: e.target.value })} /></Field>
          </Section>

          {/* Redes sociais */}
          <Section title="Redes sociais">
            <div className="flex flex-col gap-2">
              {config.socials.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={s.type}
                    onChange={(e) => set({ socials: config.socials.map((x, k) => k === i ? { ...x, type: e.target.value as BioSocialType } : x) })}>
                    {SOCIALS.map((so) => <option key={so} value={so}>{so}</option>)}
                  </select>
                  <input className={input} placeholder="https:// ou nº do WhatsApp" value={s.url}
                    onChange={(e) => set({ socials: config.socials.map((x, k) => k === i ? { ...x, url: e.target.value } : x) })} />
                  <button onClick={() => set({ socials: config.socials.filter((_, k) => k !== i) })} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => set({ socials: [...config.socials, { type: "instagram", url: "" }] })} className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600"><Plus className="h-4 w-4" /> Adicionar rede</button>
          </Section>

          {/* Blocos */}
          <Section title="Links e seções">
            <div className="flex flex-col gap-3">
              {config.blocks.map((b, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      {b.type === "link" ? "Botão" : b.type === "about" ? "Sobre" : b.type === "faq" ? "FAQ" : b.type === "stats" ? "Números" : "Título"}
                    </span>
                    <span className="flex items-center gap-1">
                      <button onClick={() => moveBlock(i, -1)} className="text-slate-300 hover:text-slate-600"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => moveBlock(i, 1)} className="text-slate-300 hover:text-slate-600"><ArrowDown className="h-4 w-4" /></button>
                      <button onClick={() => removeBlock(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </span>
                  </div>

                  {b.type === "link" && (
                    <div className="flex flex-col gap-2">
                      <input className={input} placeholder="Título do botão" value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} />
                      <input className={input} placeholder="Descrição (opcional)" value={b.sublabel ?? ""} onChange={(e) => setBlock(i, { sublabel: e.target.value })} />
                      <input className={input} placeholder="Link (https://... ou WhatsApp)" value={b.url} onChange={(e) => setBlock(i, { url: e.target.value })} />
                      <div className="flex items-center gap-2">
                        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={b.icon ?? "link"} onChange={(e) => setBlock(i, { icon: e.target.value as BioLinkIcon })}>
                          {LINK_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                        <input className={input} placeholder="Imagem/miniatura (opcional)" value={b.image_url ?? ""} onChange={(e) => setBlock(i, { image_url: e.target.value })} />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={!!b.highlight} onChange={(e) => setBlock(i, { highlight: e.target.checked })} /> Destacar este botão
                      </label>
                    </div>
                  )}
                  {b.type === "about" && (
                    <div className="flex flex-col gap-2">
                      <input className={input} placeholder="Título" value={b.title ?? ""} onChange={(e) => setBlock(i, { title: e.target.value })} />
                      <textarea className={input} rows={3} placeholder="Texto" value={b.body ?? ""} onChange={(e) => setBlock(i, { body: e.target.value })} />
                    </div>
                  )}
                  {b.type === "heading" && (
                    <input className={input} placeholder="Título" value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} />
                  )}
                  {b.type === "faq" && (
                    <div className="flex flex-col gap-2">
                      <input className={input} placeholder="Título da seção" value={b.title ?? ""} onChange={(e) => setBlock(i, { title: e.target.value })} />
                      {b.items.map((f, k) => (
                        <div key={k} className="rounded-lg bg-slate-50 p-2">
                          <input className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Pergunta" value={f.q} onChange={(e) => setBlock(i, { items: b.items.map((x, ki) => ki === k ? { ...x, q: e.target.value } : x) })} />
                          <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Resposta" value={f.a} onChange={(e) => setBlock(i, { items: b.items.map((x, ki) => ki === k ? { ...x, a: e.target.value } : x) })} />
                        </div>
                      ))}
                      <button onClick={() => setBlock(i, { items: [...b.items, { q: "Nova pergunta?", a: "Resposta." }] })} className="text-xs font-medium text-emerald-600">+ pergunta</button>
                    </div>
                  )}
                  {b.type === "stats" && (
                    <div className="flex flex-col gap-2">
                      {b.items.map((s, k) => (
                        <div key={k} className="flex gap-2">
                          <input className="w-24 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="+1000" value={s.value} onChange={(e) => setBlock(i, { items: b.items.map((x, ki) => ki === k ? { ...x, value: e.target.value } : x) })} />
                          <input className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="alunas" value={s.label} onChange={(e) => setBlock(i, { items: b.items.map((x, ki) => ki === k ? { ...x, label: e.target.value } : x) })} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={addLink} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"><Plus className="h-4 w-4" /> Botão</button>
              <button onClick={() => set({ blocks: [...config.blocks, { type: "about", title: "Sobre mim", body: "" }] })} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">+ Sobre</button>
              <button onClick={() => set({ blocks: [...config.blocks, { type: "faq", title: "Dúvidas", items: [{ q: "Pergunta?", a: "Resposta." }] }] })} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">+ FAQ</button>
              <button onClick={() => set({ blocks: [...config.blocks, { type: "stats", items: [{ value: "+1000", label: "clientes" }] }] })} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">+ Números</button>
            </div>
          </Section>

          {/* DESIGN — organizado no padrão Linktree (linhas que expandem) */}
          <Section title="Personalizar o design">
            <div className="flex flex-col gap-2">
              {/* Papel de parede */}
              <DesignRow icon={ImageIcon} title="Papel de parede" value={WP_LABEL[config.theme.wallpaper ?? "fill"]} open={openRow === "wp"} onToggle={() => setOpenRow(openRow === "wp" ? null : "wp")}>
                <Seg options={[["fill", "Preenchimento"], ["gradient", "Degradê"], ["blur", "Desfoque"], ["image", "Imagem"]]} value={config.theme.wallpaper ?? "fill"} onChange={(v) => setTheme({ wallpaper: v as BioConfig["theme"]["wallpaper"] })} />
                {(config.theme.wallpaper ?? "fill") === "fill" && <Color label="Cor de fundo" value={config.theme.bg} onChange={(v) => setTheme({ bg: v })} />}
                {config.theme.wallpaper === "gradient" && (<><Color label="Cor de cima" value={config.theme.bg} onChange={(v) => setTheme({ bg: v })} /><Color label="Cor de baixo" value={config.theme.bg2 ?? "#0d9488"} onChange={(v) => setTheme({ bg2: v })} /></>)}
                {(config.theme.wallpaper === "image" || config.theme.wallpaper === "blur") && (
                  <div className="mt-1 flex gap-2">
                    <input className={input} placeholder="URL da imagem de fundo" value={config.theme.wallpaperImage ?? ""} onChange={(e) => setTheme({ wallpaperImage: e.target.value })} />
                    <UploadButton label="Enviar" onUploaded={(url) => setTheme({ wallpaperImage: url })} />
                  </div>
                )}
              </DesignRow>

              {/* Botões */}
              <DesignRow icon={Square} title="Botões" value={BTN_LABEL[config.theme.buttonStyle]} open={openRow === "btn"} onToggle={() => setOpenRow(openRow === "btn" ? null : "btn")}>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Estilo</p>
                <Seg options={[["solid", "Sólido"], ["glass", "Vidro"], ["gradient", "Degradê"], ["outline", "Contorno"]]} value={config.theme.buttonStyle} onChange={(v) => setTheme({ buttonStyle: v as BioConfig["theme"]["buttonStyle"] })} />
                <p className="mb-1.5 text-xs font-medium text-slate-500">Sombra</p>
                <Seg options={[["none", "Nenhuma"], ["soft", "Suave"], ["strong", "Forte"]]} value={config.theme.buttonShadow ?? "soft"} onChange={(v) => setTheme({ buttonShadow: v as BioConfig["theme"]["buttonShadow"] })} />
                <Field label={`Arredondamento das pontas: ${config.theme.buttonRadius}px`}>
                  <input type="range" min={0} max={28} value={config.theme.buttonRadius} onChange={(e) => setTheme({ buttonRadius: Number(e.target.value) })} className="w-full accent-emerald-500" />
                </Field>
                <div className="mt-1"><Color label="Cor do botão" value={config.theme.card} onChange={(v) => setTheme({ card: v })} /><Color label="Cor do texto" value={config.theme.cardText} onChange={(v) => setTheme({ cardText: v })} /></div>
              </DesignRow>

              {/* Texto */}
              <DesignRow icon={Type} title="Texto" value={fontLabel(config.theme.font ?? "inter")} open={openRow === "txt"} onToggle={() => setOpenRow(openRow === "txt" ? null : "txt")}>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Fonte da página</p>
                <FontPicker value={normFont(config.theme.font ?? "inter")} onChange={(v) => setTheme({ font: v })} />
                <p className="mb-1.5 mt-3 text-xs font-medium text-slate-500">Fonte dos títulos</p>
                <FontPicker value={normFont(config.theme.heading)} onChange={(v) => setTheme({ heading: v })} />
                <div className="mt-3"><Color label="Cor do texto" value={config.theme.text} onChange={(v) => setTheme({ text: v })} /></div>
              </DesignRow>

              {/* Cores */}
              <DesignRow icon={Palette} title="Cores" value="" open={openRow === "col"} onToggle={() => setOpenRow(openRow === "col" ? null : "col")}>
                <Color label="Fundo" value={config.theme.bg} onChange={(v) => setTheme({ bg: v })} />
                <Color label="Destaque" value={config.theme.primary} onChange={(v) => setTheme({ primary: v })} />
                <Color label="Texto" value={config.theme.text} onChange={(v) => setTheme({ text: v })} />
                <Color label="Botão (fundo)" value={config.theme.card} onChange={(v) => setTheme({ card: v })} />
                <Color label="Botão (texto)" value={config.theme.cardText} onChange={(v) => setTheme({ cardText: v })} />
              </DesignRow>

              {/* Rodapé */}
              <DesignRow icon={AlignLeft} title="Rodapé" value={config.footer ? "Preenchido" : "Vazio"} open={openRow === "ftr"} onToggle={() => setOpenRow(openRow === "ftr" ? null : "ftr")}>
                <input className={input} value={config.footer ?? ""} onChange={(e) => set({ footer: e.target.value })} placeholder="Texto do rodapé (ex.: sua marca)" />
              </DesignRow>
            </div>
          </Section>

          {/* Cliques */}
          <Section title="Cliques (rastreio)">
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-600"><BarChart3 className="h-4 w-4 text-emerald-500" /> {clicks.total} clique(s) no total</p>
            {Object.keys(clicks.byLabel).length === 0 ? (
              <p className="text-xs text-slate-400">Os cliques em cada botão aparecem aqui após a publicação.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(clicks.byLabel).sort((a, b) => b[1] - a[1]).map(([label, n]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-900">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Preview — celular realista (estilo Linktree) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="rounded-[2.9rem] bg-white p-2.5 shadow-[0_35px_80px_-24px_rgba(15,23,42,.4)] ring-1 ring-slate-200/70">
              <div className="relative overflow-hidden rounded-[2.35rem] bg-white">
                {/* alto-falante */}
                <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-900/10" />
                <div className="h-[78vh] max-h-[720px] min-h-[520px] overflow-y-auto">
                  <BioRenderer config={config} preview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- helpers do Design (padrão Linktree) ---- */
const WP_LABEL: Record<string, string> = { fill: "Preenchimento", gradient: "Degradê", blur: "Desfoque", image: "Imagem" };
const BTN_LABEL: Record<string, string> = { solid: "Sólido", glass: "Vidro", gradient: "Degradê", outline: "Contorno" };
function normFont(k?: string) { if (k === "serif") return "playfair"; if (k === "sans") return "poppins"; return k ?? "inter"; }
function fontLabel(k?: string) { const n = normFont(k); return BIO_FONTS.find((f) => f.key === n)?.label ?? "Moderna"; }

function DesignRow({ icon: Icon, title, value, open, onToggle, children }: { icon: React.ElementType; title: string; value?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        {value ? <span className="text-xs text-slate-400">{value}</span> : null}
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-slate-100 px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}

function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0,1fr))` }}>
      {options.map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)} className={cn("rounded-lg border py-2 text-xs font-medium transition-colors", value === val ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{label}</button>
      ))}
    </div>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {BIO_FONTS.map((f) => (
        <button key={f.key} onClick={() => onChange(f.key)} className={cn("rounded-lg border py-2 text-center transition-colors", value === f.key ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50")}>
          <span className="block text-lg leading-none text-slate-800" style={{ fontFamily: f.css }}>Aa</span>
          <span className="mt-0.5 block text-[10px] text-slate-500">{f.label}</span>
        </button>
      ))}
    </div>
  );
}
