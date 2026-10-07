const fs = require('fs');

const path = 'next.config.ts';
let source = fs.readFileSync(path, 'utf8');
if (!source.includes('output:')) {
  source = source.replace(
    'const nextConfig: NextConfig = {',
    'const nextConfig: NextConfig = {\n  output: "standalone",'
  );
  fs.writeFileSync(path, source);
}
