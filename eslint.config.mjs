import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const nextConfig = compat.extends("next/core-web-vitals", "next/typescript");

export default [
  ...nextConfig,
  {
    files: [
      "src/app/(clinic)/**/*.{ts,tsx}",
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/layout/**/*.{ts,tsx}",
      "src/components/clinic/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use var(--ent-*) tokens; no hex in clinic UI.",
        },
      ],
    },
  },
];
