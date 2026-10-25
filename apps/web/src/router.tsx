import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { WorkflowEditor } from './features/editor/WorkflowEditor';
import { LandingPage } from './features/landing/LandingPage';
import { WikiPage } from './features/wiki/WikiPage';

function Root() {
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: Root });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: WorkflowEditor,
});
const wikiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wiki',
  component: WikiPage,
});
const routeTree = rootRoute.addChildren([indexRoute, appRoute, wikiRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
