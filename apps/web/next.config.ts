import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dsvtt/shared', '@dsvtt/events'],
  reactStrictMode: true,
};

export default nextConfig;
