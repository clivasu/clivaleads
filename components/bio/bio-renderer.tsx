"use client";

import { useState } from "react";
import {
  Calendar, Sparkles, Heart, MessageCircle, MapPin, Instagram, Facebook,
  Youtube, Linkedin, Target, Building2, Lightbulb, Star, Gift, Leaf, Phone,
  Link as LinkIcon, Globe, Mail, Music2, ChevronRight, ChevronDown,
} from "lucide-react";
import type { BioConfig, BioLinkIcon, BioSocialType, FaqItem } from "@/lib/types";
import { bioFont } from "@/lib/bio-fonts";
import { cn } from "@/lib/utils";

const LINK_ICONS: Record<BioLinkIcon, React.ElementType> = {
  calendar: Calendar, sparkles: Sparkles, heart: Heart, chat: MessageCircle, map: MapPin,
  instagram: Instagram, facebook: Facebook, whatsapp: MessageCircle, target: Target,
  building: Building2, bulb: Lightbulb, star: Star, gift: Gift, leaf: Leaf, phone: Phone, link: LinkIcon,
};
const SOCIAL_ICONS: Record<BioSocialType, React.ElementType> = {
  instagram: Instagram, whatsapp: MessageCircle, facebook: Facebook, youtube: Youtube,
  tiktok: Music2, linkedin: Linkedin, map: MapPin, site: Globe, email: Mail,
};

// Enquadramento da foto de capa: posição (x/y em % da sobra) + zoom.
// object-position e transform-origin no mesmo ponto = arrastar/zoom consistentes
// em qualquer largura de tela.
export function coverImgStyle(x = 50, y = 50, zoom = 1): React.CSSProperties {
  return {
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}

// Fundo da página conforme o "papel de parede" escolhido.
function wallpaperBg(t: BioConfig["theme"]): React.CSSProperties {
  const w = t.wallpaper ?? "fill";
  if (w === "gradient") return { background: `linear-gradient(180deg, ${t.bg}, ${t.bg2 || "color-mix(in srgb, " + t.bg + " 55%, #000)"})` };
  if ((w === "image" || w === "blur") && t.wallpaperImage) {
    return {
      backgroundColor: t.bg,
      backgroundImage: `url(${t.wallpaperImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      ...(w === "blur" ? {} : {}),
    };
  }
  return { background: t.bg };
}

export function BioRenderer({
  config,
  pageId,
  preview = false,
}: {
  config: BioConfig;
  pageId?: string;
  preview?: boolean;
}) {
  const t = config.theme;
  const hFont = bioFont(t.heading) ?? "var(--font-playfair)";
  const bodyFont = bioFont(t.font);
  const isBlur = t.wallpaper === "blur" && !!t.wallpaperImage;

  const track = (label: string, url: string) => {
    if (preview || !pageId) return;
    try {
      const body = JSON.stringify({ bio_page_id: pageId, label, url });
      navigator.sendBeacon?.("/api/bio-click", new Blob([body], { type: "application/json" }));
    } catch { /* noop */ }
  };

  const shadowFor = (fallback: string) => {
    switch (t.buttonShadow) {
      case "none": return "none";
      case "soft": return "0 6px 18px rgba(0,0,0,.12)";
      case "strong": return "0 16px 36px rgba(0,0,0,.24)";
      default: return fallback;
    }
  };
  const buttonStyle = (highlight?: boolean): React.CSSProperties => {
    const radius = t.buttonRadius;
    if (t.buttonStyle === "gradient")
      return { background: `linear-gradient(135deg, ${t.primary}, color-mix(in srgb, ${t.primary} 60%, #000))`, color: t.cardText, borderRadius: radius, boxShadow: shadowFor("0 10px 24px rgba(0,0,0,.14)") };
    if (t.buttonStyle === "glass")
      return { background: `linear-gradient(180deg, ${t.card}, color-mix(in srgb, ${t.card} 80%, #000 6%))`, color: t.cardText, borderRadius: radius, boxShadow: shadowFor("0 8px 22px rgba(0,0,0,.3)") };
    if (t.buttonStyle === "outline")
      return { background: "transparent", color: t.primary, border: `1.5px solid ${t.primary}`, borderRadius: radius, boxShadow: shadowFor("none") };
    return { background: t.card, color: t.cardText, borderRadius: radius, boxShadow: shadowFor(highlight ? `0 10px 24px color-mix(in srgb, ${t.primary} 30%, transparent)` : "0 4px 14px rgba(0,0,0,.06)") };
  };

  return (
    <div className="relative min-h-[100dvh] w-full" style={{ ...(isBlur ? { background: t.bg } : wallpaperBg(t)), color: t.text, fontFamily: bodyFont }}>
      {isBlur && (
        <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: `url(${t.wallpaperImage})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(22px)", transform: "scale(1.15)" }} />
      )}
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        {/* Capa / foto */}
        {config.cover_url && (config.cover_shape ?? "cover") === "circle" ? (
          <div className="flex justify-center px-5 pt-8">
            <span
              className="block overflow-hidden rounded-full"
              style={{
                width: config.cover_size ?? 140,
                height: config.cover_size ?? 140,
                boxShadow: `0 8px 30px rgba(0,0,0,.12), 0 0 0 4px ${t.card}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.cover_url} alt={config.name} className="h-full w-full object-cover" style={coverImgStyle(config.cover_x, config.cover_y, config.cover_zoom)} />
            </span>
          </div>
        ) : config.cover_url ? (
          <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.cover_url} alt={config.name} className="h-64 w-full object-cover" style={coverImgStyle(config.cover_x, config.cover_y, config.cover_zoom)} />
            {(config.cover_fade ?? 0) > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  height: `${Math.min(100, config.cover_fade ?? 0)}%`,
                  background: `linear-gradient(to bottom, transparent, ${t.bg})`,
                }}
              />
            )}
          </div>
        ) : null}

        <div className={cn("flex-1 px-5 pb-10", (config.cover_shape ?? "cover") === "circle" ? "pt-4 text-center" : "pt-6")}>
          {/* Nome + tagline */}
          <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: hFont }}>{config.name}</h1>
          {config.tagline && <p className="mt-1.5 text-sm" style={{ color: t.muted }}>{config.tagline}</p>}

          {/* Sociais */}
          {config.socials.filter((s) => s.url || preview).length > 0 && (
            <div className={cn("mt-4 flex flex-wrap items-center gap-2.5", (config.cover_shape ?? "cover") === "circle" && "justify-center")}>
              {config.socials.map((s, i) => {
                const Icon = SOCIAL_ICONS[s.type];
                return (
                  <a key={i} href={s.url || undefined} target="_blank" rel="noopener noreferrer"
                    onClick={() => track(`social:${s.type}`, s.url)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:-translate-y-0.5"
                    style={{ background: t.card, color: t.cardText }}>
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          )}

          {config.headline && (
            <p className="mt-6 text-center text-xl italic" style={{ fontFamily: hFont, color: t.text }}>{config.headline}</p>
          )}

          {/* Blocos */}
          <div className="mt-6 flex flex-col gap-3">
            {config.blocks.map((b, i) => {
              if (b.type === "link") {
                const Icon = b.icon ? LINK_ICONS[b.icon] : null;
                const inner = b.image_url ? (
                  <span className="flex items-center gap-3.5 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-lg font-semibold" style={{ fontFamily: hFont }}>{b.label}</span>
                      {b.sublabel && <span className="mt-0.5 block text-xs leading-snug" style={{ color: t.muted }}>{b.sublabel}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
                  </span>
                ) : (
                  <span className="flex items-center gap-3.5 px-4 py-3.5">
                    {Icon && (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${t.primary} 16%, #fff)`, color: t.primary }}>
                        <Icon className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-base font-semibold leading-tight">{b.label}</span>
                      {b.sublabel && <span className="mt-0.5 block text-xs leading-snug opacity-70">{b.sublabel}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 opacity-40" />
                  </span>
                );
                return (
                  <a key={i} href={b.url || undefined} target="_blank" rel="noopener noreferrer"
                    onClick={() => track(b.label, b.url)}
                    className="block overflow-hidden transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
                    style={buttonStyle(b.highlight)}>
                    {inner}
                  </a>
                );
              }
              if (b.type === "stats") {
                return (
                  <div key={i} className="my-2 grid grid-cols-3 gap-2 rounded-2xl py-4" style={{ background: `color-mix(in srgb, ${t.primary} 8%, transparent)` }}>
                    {b.items.map((s, k) => (
                      <div key={k} className="text-center">
                        <p className="text-lg font-bold" style={{ color: t.primary }}>{s.value}</p>
                        <p className="text-[11px] uppercase tracking-wide" style={{ color: t.muted }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                );
              }
              if (b.type === "about") {
                return (
                  <div key={i} className="my-2 rounded-2xl p-5" style={{ background: t.card, color: t.cardText }}>
                    {b.title && <h2 className="mb-1.5 text-xl" style={{ fontFamily: hFont }}>{b.title}</h2>}
                    {b.body && <p className="text-sm leading-relaxed opacity-80">{b.body}</p>}
                  </div>
                );
              }
              if (b.type === "faq") {
                return <BioFaq key={i} title={b.title} items={b.items} hFont={hFont} color={t.text} muted={t.muted} />;
              }
              if (b.type === "heading") {
                return <h2 key={i} className="mt-4 text-center text-2xl" style={{ fontFamily: hFont }}>{b.text}</h2>;
              }
              return null;
            })}
          </div>

          {config.footer && <p className="mt-10 text-center text-xs" style={{ color: t.muted }}>{config.footer}</p>}
          <p className="mt-3 text-center text-[10px]" style={{ color: t.muted, opacity: 0.6 }}>Feito com Cliva</p>
        </div>
      </div>
    </div>
  );
}

function BioFaq({ title, items, hFont, color, muted }: { title?: string; items: FaqItem[]; hFont: string; color: string; muted: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="my-2">
      {title && <h2 className="mb-2 text-xl" style={{ fontFamily: hFont }}>{title}</h2>}
      <div className="flex flex-col gap-1.5">
        {items.map((f, i) => (
          <div key={i} className="rounded-xl border" style={{ borderColor: `color-mix(in srgb, ${muted} 30%, transparent)` }}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium" style={{ color }}>
              {f.q}
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="px-4 pb-3 text-sm leading-relaxed" style={{ color: muted }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
