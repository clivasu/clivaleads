import { cn } from "@/lib/utils";

// Marca oficial da Cliva: squircle esmeralda→teal com o "C" de traço contínuo,
// a ponta que sobe como broto e o ponto de vitalidade (public/brand/cliva-mark.png).
export function ClivaMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/cliva-mark.png"
      width={size}
      height={size}
      alt="Cliva"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export function ClivaLogo({
  size = 32,
  showWordmark = true,
  className,
  wordmarkClassName,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <ClivaMark size={size} />
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight text-slate-900", wordmarkClassName)}>
          Cliva
        </span>
      )}
    </span>
  );
}
