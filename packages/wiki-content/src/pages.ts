import buildAWorkflow from '../pages/build-a-workflow.md?raw';
import quickStart from '../pages/quick-start.md?raw';
import troubleshootRuns from '../pages/troubleshoot-runs.md?raw';

export const wikiPages = [
  { slug: 'quick-start', title: 'Quick start', category: 'Getting started', markdown: quickStart },
  {
    slug: 'build-a-workflow',
    title: 'Build a workflow',
    category: 'Workflows',
    markdown: buildAWorkflow,
  },
  {
    slug: 'troubleshoot-runs',
    title: 'Troubleshoot runs',
    category: 'Runs',
    markdown: troubleshootRuns,
  },
] as const;
