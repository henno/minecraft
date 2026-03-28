import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'minecraft';
const base = process.env.GITHUB_PAGES === 'true' ? `/${repositoryName}/` : '/';

export default defineConfig({
  base,
});
