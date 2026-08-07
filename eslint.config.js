import eslint from "@eslint/js";
import globals from "globals";

const userscriptGlobals = {
  ...globals.browser,
  ...globals.jquery,
  GM_addStyle: "readonly",
  GM_download: "readonly",
  GM_getResourceText: "readonly",
  GM_getValue: "readonly",
  GM_info: "readonly",
  GM_notification: "readonly",
  GM_openInTab: "readonly",
  GM_registerMenuCommand: "readonly",
  GM_setValue: "readonly",
  GM_unregisterMenuCommand: "readonly",
  GM_xmlhttpRequest: "readonly",
  Mediabunny: "readonly",
};

export default [
  {
    ignores: [
      "insta-loader.user.js",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: userscriptGlobals,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/legacy/**/*.js"],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      "no-unreachable": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
