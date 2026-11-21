import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { ConverterPage } from './pages/ConverterPage';
import { ReaderPage } from './pages/ReaderPage';
import { StoriesPage } from './pages/StoriesPage';
import { StoryPage } from './pages/StoryPage';
import { PathPage } from './pages/PathPage';
import { AlphabetPage } from './pages/AlphabetPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReadingPage } from './pages/ReadingPage';
import { ToolsPage } from './pages/ToolsPage';
import { ProfilePage } from './pages/ProfilePage';
import { LessonPage } from './pages/LessonPage';
import { StageTestPage } from './pages/StageTestPage';
import { CheckpointPage } from './pages/CheckpointPage';
import { ExamPage } from './pages/ExamPage';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { useProgress } from './state/progress';
import { useApplySettings } from './state/settings';

/** Like a native app: every new screen starts at the top. */
function useScrollTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
}

/**
 * The app shell. Phones: top bar + bottom tab bar. Desktop (md and up): a sidebar on the
 * right (RTL start) and a wide content area, like a desktop app.
 */
function TabsLayout() {
  const { onboarded } = useProgress();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  useScrollTopOnNavigate();
  if (!onboarded) return <Navigate to="/welcome" replace />;
  // A review session runs full screen, like a lesson, so the tab bar never covers the check button.
  if (pathname === '/review' && params.get('mode')) return <Outlet />;
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_minmax(0,1fr)] lg:grid-cols-[272px_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <TopBar />
        <Outlet />
      </div>
      <BottomNav />
    </div>
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lesson/:id" element={<LessonRoute />} />
      <Route path="/test/:stageId" element={<StageTestPage />} />
      <Route path="/checkpoint/:id" element={<CheckpointPage />} />
      <Route path="/exam" element={<ExamPage />} />
      <Route element={<TabsLayout />}>
        <Route index element={<PathPage />} />
        <Route path="/alphabet" element={<AlphabetPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/reading/:id" element={<ReaderPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/stories/:id" element={<StoryPage />} />
        <Route path="/converter" element={<ConverterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
