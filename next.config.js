/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      dirs: ['app', 'components', 'lib'],
      ignoreDuringBuilds: false, // Set to true to skip ESLint during builds if needed
    },
  };
  
  export default nextConfig;