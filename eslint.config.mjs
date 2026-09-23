import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/display-name': 'warn',
    },
  },
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
];
