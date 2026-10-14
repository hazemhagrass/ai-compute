import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/components/*.rules.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "react-dom/*", "next/*"],
              message: "rules modules are pure: no React/Next imports (docs/MVVM.md)" },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "rules modules are pure and node-runnable" },
        { name: "document", message: "rules modules are pure and node-runnable" },
        { name: "localStorage", message: "rules modules are pure and node-runnable" },
      ],
    },
  },
  {
    files: ["src/components/*Panel.tsx", "src/components/AppShell.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='fetch']",
          message:
            "Views must not fetch: move the call into use-<feature>-view-model.ts via api() (docs/MVVM.md)",
        },
      ],
    },
  },
]);

export default eslintConfig;
