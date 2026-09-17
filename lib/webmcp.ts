import { validateBrief, type Job } from './proofdesk';
type DraftInput = {
  title: string;
  requirements: string[];
  researcher?: string;
  days?: number;
  bounty?: string;
};
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: Tool,
        options?: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}
export function registerDeskTools(actions: {
  read: () => Job[];
  create: (input: DraftInput) => Job;
}) {
  const context =
    typeof document === 'undefined' ? undefined : document.modelContext;
  if (!context?.registerTool) return;
  const controller = new AbortController();
  const tools: Tool[] = [
    {
      name: 'list_proofdesk_briefs',
      description:
        'Read the briefs currently loaded in this research desk. Local drafts and network records are labeled.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () =>
        actions.read().map((j) => ({
          id: j.id,
          title: j.title,
          origin: j.origin,
          status: j.status,
        })),
    },
    {
      name: 'create_proofdesk_local_draft',
      description:
        'Create a research brief draft on this device. Does not post to GenLayer, sign a transaction, or move funds.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 8, maxLength: 160 },
          requirements: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 6,
          },
          researcher: { type: 'string' },
          days: { type: 'integer', minimum: 1, maximum: 30 },
          bounty: { type: 'string' },
        },
        required: ['title', 'requirements'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        const p = input as DraftInput;
        if (
          !p ||
          typeof p.title !== 'string' ||
          !Array.isArray(p.requirements) ||
          !p.requirements.every((x) => typeof x === 'string')
        )
          throw new Error('A title and acceptance criteria are required.');
        validateBrief(p.title, p.requirements, p.researcher ?? '', p.days ?? 7);
        const job = actions.create(p);
        return { id: job.id, status: job.status, origin: job.origin };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: controller.signal }),
      ).catch(() => {});
    } catch {
      /* Browser support is optional. */
    }
  }
  return () => controller.abort();
}
