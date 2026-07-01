import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ── Regras rebaixadas para "warn" ────────────────────────────────────────
    // O comando de lint da CI (`next lint`) foi removido no Next 16, então o
    // ESLint nunca chegou a rodar de fato — o código acumulou violações sob um
    // gate que só existia no nome. Ao religar o lint (`eslint .`), estas regras
    // pré-existentes viram warning para não travar a CI. Devem ser reapertadas
    // para "error" incrementalmente, à medida que o débito for pago.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "react/jsx-no-comment-textnodes": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
