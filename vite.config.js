import { defineConfig } from 'vite';
import { cpSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const outDir = resolve(root, 'dist');

function githubPagesPath(req, res, next) {
  if (req.url === '/' || req.url?.startsWith('/?')) {
    res.statusCode = 302;
    res.setHeader('Location', '/letniy-teatr/');
    res.end();
    return;
  }
  if (req.url?.startsWith('/letniy-teatr/')) req.url = req.url.slice('/letniy-teatr'.length);
  next();
}

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        organizers: resolve(root, 'organizers.html'),
        tickets: resolve(root, 'tickets.html'),
        certificates: resolve(root, 'certificates.html'),
        news: resolve(root, 'news.html'),
        faq: resolve(root, 'faq.html'),
        rules: resolve(root, 'rules.html'),
        accessibility: resolve(root, 'accessibility.html'),
        policy: resolve(root, 'policy.html'),
        accreditation: resolve(root, 'accreditation.html'),
        partners: resolve(root, 'partners.html'),
        equipment: resolve(root, 'equipment.html'),
        archive: resolve(root, 'archive.html'),
        brand: resolve(root, 'brand.html'),
      },
    },
  },
  plugins: [{
    name: 'serve-github-pages-path-in-development',
    configureServer(server) {
      server.middlewares.use(githubPagesPath);
    },
    configurePreviewServer(server) {
      server.middlewares.use(githubPagesPath);
    },
  }, {
    name: 'copy-theatre-static-assets',
    closeBundle() {
      for (const directory of ['img', 'fonts', 'vendor']) {
        cpSync(resolve(root, directory), resolve(outDir, directory), { recursive: true });
      }
      for (const file of ['events2026.json', 'review-notes.js', '.nojekyll']) {
        copyFileSync(resolve(root, file), resolve(outDir, file));
      }
    },
  }],
});
