import tseslint from "@typescript-eslint/eslint-plugin"
import prettierPlugin from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"
import tsparser from "@typescript-eslint/parser"

export default [
    {
        files: ["**/*.ts"],

        languageOptions: {
            parser: tsparser,
            sourceType: "module",
        },

        plugins: {
            "@typescript-eslint": tseslint,
            prettier: prettierPlugin,
        },

        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettierConfig.rules,
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-unsafe-declaration-merging": "off",
            semi: ["error", "never"],
            quotes: ["error", "double"],
            "prettier/prettier": "error",
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
]
