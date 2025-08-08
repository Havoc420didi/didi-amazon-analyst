/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开启构建时的图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 开启构建时的性能优化
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  // 配置webpack以支持xlsx
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      stream: false,
      crypto: false,
    };
    return config;
  },
}

module.exports = nextConfig 