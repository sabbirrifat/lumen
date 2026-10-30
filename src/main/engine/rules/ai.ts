import { envPath } from '../context';
import { joinAll, list, tilde } from '../fsutil';
import { contentsRule, homePath } from './helpers';
import type { CleanupRule } from './types';

const huggingFace: CleanupRule = {
  id: 'huggingface',
  name: 'Hugging Face models',
  category: 'ai',
  safety: 'review',
  explain: 'Models and datasets downloaded from Hugging Face. They download again the next time code asks for them. Your login token is kept.',
  roots: (ctx) => [envPath(ctx, 'HF_HOME') ?? homePath(ctx, '.cache', 'huggingface')],
  async scan(ctx) {
    const dir = envPath(ctx, 'HF_HOME') ?? homePath(ctx, '.cache', 'huggingface');
    const targets = joinAll(dir, (await list(dir)).filter((f) => !['token', 'stored_tokens'].includes(f)));
    return { targets, detail: tilde(ctx.home, dir) };
  },
};

const antigravity: CleanupRule = {
  id: 'antigravity',
  name: 'Antigravity data',
  category: 'ai',
  safety: 'review',
  explain: 'Antigravity’s local data, including its chat history and settings. Your Gemini CLI sign-in is kept.',
  roots: (ctx) => [homePath(ctx, '.gemini')],
  async scan(ctx) {
    const dir = homePath(ctx, '.gemini');
    const targets = joinAll(dir, (await list(dir)).filter((f) => f.startsWith('antigravity')));
    const running = ctx.processes.commands.some((c) => /antigravity/i.test(c));
    return { targets, detail: tilde(ctx.home, dir), blocked: running ? 'Quit Antigravity to clean' : undefined };
  },
};

export const aiRules: CleanupRule[] = [
  huggingFace,
  antigravity,
  contentsRule({
    id: 'ollama',
    name: 'Ollama models',
    category: 'ai',
    safety: 'review',
    app: 'Ollama',
    explain: 'Every model Ollama has pulled. Run ollama pull to get one back.',
    dirs: (ctx) => [homePath(ctx, '.ollama', 'models')],
  }),
];
