/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: false, // disables built-in parser, we stream instead
  },
};
export default nextConfig;
