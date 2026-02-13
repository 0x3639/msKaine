import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        BigInt: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off", // TypeScript handles this
      "no-undef": "off", // TypeScript handles this
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "tests/**", "*.config.*"],
  },
];
