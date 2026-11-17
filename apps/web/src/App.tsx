import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { PathPage } from './pages/PathPage';
import { AlphabetPage } from './pages/AlphabetPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReadingPage } from './pages/ReadingPage';
import { ToolsPage } from './pages/ToolsPage';
import { LessonPage } from './pages/LessonPage';
import { StageTestPage } from './pages/StageTestPage';
import { WelcomePage } from './pages/WelcomePage';
import { useProgress } from './state/progress';
import { useApplySettings } from './state/settings';

function TabsLayout() {
  const { onboarded } = useProgress();
  if (!onboarded) return <Navigate to="/welcome" replace />;
  return (
    <>
      <TopBar />
      <BottomNav />
      <Outlet />
    </>
  );
}

/** Remount the lesson when the same lesson is replayed at the next level. */
function LessonRoute() {
  const location = useLocation();
  return <LessonPage key={location.key} />;
}

export function App() {
  useApplySettings();
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/lesson/:id" element={<LessonRoute />} />
      <Route path="/test/:stageId" element={<StageTestPage />} />
      <Route element={<TabsLayout />}>
        <Route index element={<PathPage />} />
        <Route path="/alphabet" element={<AlphabetPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/tools" element={<ToolsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
