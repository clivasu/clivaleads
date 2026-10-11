import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Configuração oficial do Next.js 16 (flat config). `next lint` foi removido no 16.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Regras novas do React Compiler: o código atual tem ocorrências antigas
    // (efeitos que atualizam estado, componentes definidos dentro de outros).
    // Ficam como aviso até serem tratadas uma a uma, sem mudar comportamento
    // às cegas. Ver docs/audit/BASELINE.md (dívida técnica).
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "supabase/**"]),
]);
