/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable specific rules during builds
    ignoreDuringBuilds: false, // Set to true to skip ESLint entirely, or customize below
    dirs: ['app', 'components', 'lib'], // Specify directories to lint
  },
  // Custom ESLint overrides
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Disable no-explicit-any
        '@typescript-eslint/no-unused-vars': 'off', // Disable no-unused-vars for TS
        'no-unused-vars': 'off', // Disable no-unused-vars for JS
        'react-hooks/exhaustive-deps': 'warn', // Downgrade to warning (or 'off' to disable)
        '@next/next/no-img-element': 'off', // Disable no-img-element
      },
    },
  ],
};

module.exports = nextConfig;