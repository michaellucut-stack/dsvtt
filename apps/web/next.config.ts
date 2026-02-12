import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dsvtt/shared', '@dsvtt/events'],
  reactStrictMode: true,

  // Standalone output for Docker production builds
  output: 'standalone',

  experimental: {
    // Tree-shake barrel imports from large packages
    optimizePackageImports: [
      'zustand',
      'socket.io-client',
      'react-konva',
      'konva',
      'lucide-react',
    ],
  },
};

export default nextConfig;
