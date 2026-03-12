import { Routes, Route } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import WallBuilderPage from './pages/WallBuilderPage.jsx';
import FloorBuilderPage from './pages/FloorBuilderPage.jsx';
import H1Page from './pages/H1Page.jsx';
import PrintWatermark from './components/PrintWatermark.jsx';

function App() {
  return (
    <>
      <PrintWatermark />
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
        <Route path="/project/:projectId/wall/:wallId" element={<WallBuilderPage />} />
        <Route path="/project/:projectId/floor/:floorId" element={<FloorBuilderPage />} />
        <Route path="/project/:projectId/h1" element={<H1Page />} />
      </Routes>
    </>
  );
}

export default App;
