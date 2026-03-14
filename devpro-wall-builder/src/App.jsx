import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import PrintWatermark from './components/PrintWatermark.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/ToastContext.jsx';
import { SkeletonPage } from './components/Skeleton.jsx';

const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'));
const ProjectPage = lazy(() => import('./pages/ProjectPage.jsx'));
const WallBuilderPage = lazy(() => import('./pages/WallBuilderPage.jsx'));
const FloorBuilderPage = lazy(() => import('./pages/FloorBuilderPage.jsx'));
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

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <PrintWatermark />
        <RouteFocusManager />
        <Suspense fallback={<SkeletonPage />}>
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/project/:projectId" element={<ProjectPage />} />
            <Route path="/project/:projectId/wall/:wallId" element={<WallBuilderPage />} />
            <Route path="/project/:projectId/floor/:floorId" element={<FloorBuilderPage />} />
            <Route path="/project/:projectId/h1" element={<H1Page />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
