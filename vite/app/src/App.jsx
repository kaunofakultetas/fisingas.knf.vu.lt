// -----------------------------------------------------------
//  [*] App — routing and global providers
//
//  The root of the React app: sets up the router, auth and
//  theme providers, and declares every route.
//
//  Route groups:
//    - public pages  — login, leaderboard, slides
//    - student pages — the phishing test, behind the
//                      `securedStudent` guard (session
//                      required; admins go to /admin)
//    - admin pages   — behind the `securedAdmin` guard
//                      (admin session required; students go
//                      to /student, anonymous to /login)
//
//  Split into (root component last):
//
//    RootRedirect — "/" → the user's home by role
//    AppRoutes    — the <Routes> table + guards
//    App          — provider stack (default export)
// -----------------------------------------------------------

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Providers from './providers';

// Public pages
import LoginPage from '@/systemPages/PublicPages/Login/Login';
import LeaderboardPage from '@/systemPages/PublicPages/Leaderboard/Leaderboard';
import SlidesPage from '@/systemPages/PublicPages/Slides/Slides';

// Student pages (the phishing test)
import TestHomePage from '@/systemPages/StudentPages/TestHome/TestHome';
import TestFinishPage from '@/systemPages/StudentPages/TestFinish/TestFinish';

// Admin pages
import AdminHomePage from '@/systemPages/AdminPages/Home/Home';
import StudentsListPage from '@/systemPages/AdminPages/StudentsList/StudentsList';
import StudentInformationPage from '@/systemPages/AdminPages/StudentInformation/StudentInformation';
import QuestionsPage from '@/systemPages/AdminPages/Questions/Questions';
import EditQuestionPage from '@/systemPages/AdminPages/Questions/QuestionsList/EditQuestion/EditQuestion';
import AdministratorsListPage from '@/systemPages/AdminPages/AdministratorsList/AdministratorsList';
import StudentGroupsPage from '@/systemPages/AdminPages/StudentGroups/StudentGroups';
import SystemPage from '@/systemPages/AdminPages/SystemPage/SystemPage';







// -----------------------------------------------------------
// RootRedirect
// -----------------------------------------------------------
//
// Sends "/" to the right place by role: admins to /admin,
// students to their test (or straight to the results when
// they already finished), anonymous visitors to /login.
//
// Used by:
//   - AppRoutes (below) — route /
// -----------------------------------------------------------

function RootRedirect() {
  const { authData, loading } = useAuth();

  if (loading) return null;
  if (!authData) return <Navigate to="/login" replace />;
  if (authData.admin === 1) return <Navigate to="/admin" replace />;
  if (authData.phishingtestfinished === 1) return <Navigate to="/student/finish" replace />;
  return <Navigate to="/student" replace />;
}







// -----------------------------------------------------------
// AppRoutes
// -----------------------------------------------------------
//
// The route table. Both guards render nothing while the
// session check is still running (so a logged-in user isn't
// bounced to /login before the check finishes) and pass
// authData on to the page.
//
// Used by:
//   - App (below)
// -----------------------------------------------------------

function AppRoutes() {

  const { authData, loading } = useAuth();

  // Admin route guard
  const securedAdmin = (Component) => {
    if (loading) return null;
    if (!authData) return <Navigate to="/login" replace />;
    if (authData.admin !== 1) return <Navigate to="/student" replace />;
    return <Component authData={authData} />;
  };

  // Student route guard — admins are sent to their own home
  const securedStudent = (Component) => {
    if (loading) return null;
    if (!authData) return <Navigate to="/login" replace />;
    if (authData.admin === 1) return <Navigate to="/admin" replace />;
    return <Component authData={authData} />;
  };

  // The test itself — students who already finished only get
  // their results page (matches the old Next.js behavior)
  const securedTest = () => {
    if (!loading && authData?.phishingtestfinished === 1) {
      return <Navigate to="/student/finish" replace />;
    }
    return securedStudent(TestHomePage);
  };


  return (
    <Routes>

      {/* Login page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Role-based home */}
      <Route path="/" element={<RootRedirect />} />

      {/* Student pages — session required */}
      <Route path="/student" element={securedTest()} />
      <Route path="/student/finish" element={securedStudent(TestFinishPage)} />

      {/* Admin pages — admin session required */}
      <Route path="/admin" element={securedAdmin(AdminHomePage)} />
      <Route path="/admin/students" element={securedAdmin(StudentsListPage)} />
      <Route path="/admin/students/:studentID" element={securedAdmin(StudentInformationPage)} />
      <Route path="/admin/questions" element={securedAdmin(QuestionsPage)} />
      <Route path="/admin/questions/:questionID" element={securedAdmin(EditQuestionPage)} />
      <Route path="/admin/administrators" element={securedAdmin(AdministratorsListPage)} />
      <Route path="/admin/studentgroups" element={securedAdmin(StudentGroupsPage)} />
      <Route path="/admin/system" element={securedAdmin(SystemPage)} />

      {/* Presentation pages — public, shown on the projector */}
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/slides" element={<SlidesPage />} />

    </Routes>
  );
}







// -----------------------------------------------------------
// App (default export)
// -----------------------------------------------------------
//
// The provider stack, outermost first: router → auth → theme
// (Providers skips theming on /login, which styles itself).
//
// Used by:
//   - main.jsx — mounted into #root
// -----------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Providers excludedPaths={['/login']}>
          <AppRoutes />
        </Providers>
      </AuthProvider>
    </BrowserRouter>
  );
}
