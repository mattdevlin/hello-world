import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import PrintWatermark from './components/PrintWatermark.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'));
const ProjectPage = lazy(() => import('./pages/ProjectPage.jsx'));
const WallBuilderPage = lazy(() => import('./pages/WallBuilderPage.jsx'));
const FloorBuilderPage = lazy(() => import('./pages/FloorBuilderPage.jsx'));
const H1Page = lazy(() => import('./pages/H1Page.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function App() {
  return (
    <ErrorBoundary>
      <PrintWatermark />
      <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#999' }}>Loading...</div>}>
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
    </ErrorBoundary>
  );
}

export default App;
