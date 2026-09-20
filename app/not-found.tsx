import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="text-5xl font-bold text-slate-900">404</p>
      <p className="text-slate-500">Funil ou página não encontrada.</p>
      <Link href="/">
        <Button variant="outline">Voltar ao início</Button>
      </Link>
    </div>
  );
}
