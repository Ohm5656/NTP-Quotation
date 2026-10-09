import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Filters intentionally synchronize router props with editable local state.
  // Keep this performance recommendation visible without treating it as a
  // functional failure; the browser tests cover those interactions.
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  globalIgnores([".next/**", "reports/**", "test-results/**", "playwright-report/**", ".agents/**", "next-env.d.ts", ".production-visual.spec.ts"]),
]);
