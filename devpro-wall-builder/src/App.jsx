import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';
import PrintWatermark from './components/PrintWatermark.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/ToastContext.jsx';
import { SkeletonPage } from './components/Skeleton.jsx';

const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'));
const ProjectPage = lazy(() => import('./pages/ProjectPage.jsx'));
const WallBuilderPage = lazy(() => import('./pages/WallBuilderPage.jsx'));
const FloorBuilderPage = lazy(() => import('./pages/FloorBuilderPage.jsx'));
const RoofBuilderPage = lazy(() => import('./pages/RoofBuilderPage.jsx'));
const H1Page = lazy(() => import('./pages/H1Page.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function RouteFocusManager() {
  const location = useLocation();
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) main.focus({ preventScroll: true });
  }, [location.pathname]);
  return null;
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <PrintWatermark />
        <RouteFocusManager />
        <Suspense fallback={<SkeletonPage />}>
          <Outlet />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      { path: '/project/:projectId', element: <ProjectPage /> },
      { path: '/project/:projectId/wall/:wallId', element: <WallBuilderPage /> },
      { path: '/project/:projectId/floor/:floorId', element: <FloorBuilderPage /> },
      { path: '/project/:projectId/roof/:roofId', element: <RoofBuilderPage /> },
      { path: '/project/:projectId/h1', element: <H1Page /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
