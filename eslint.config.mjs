import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

// eslint-config-next 15 ships eslintrc-style configs, so FlatCompat bridges it into flat config.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'coverage/**', 'out/**', 'laya/**'],
  },
  ...compat.extends('next/core-web-vitals'),
  // Must stay last: disables rules that conflict with Prettier formatting.
  prettier,
];

export default eslintConfig;
