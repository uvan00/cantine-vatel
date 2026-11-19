import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Kit du tableau de bord recopié TEL QUEL de LinkAfr (~/maboutique-espace-pub, 16/11/2026) : la règle du propriétaire
  // veut les kits à l'identique, on ne les retouche donc pas pour le lint. Les mêmes avertissements existent dans LinkAfr.
  {
    files: ["src/components/sneat.tsx", "src/components/fenetre.tsx", "src/components/icons.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
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
