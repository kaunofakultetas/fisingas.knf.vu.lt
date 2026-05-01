import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Providers from '@/providers';

import Login from '@/systemPages/login/Login';
import Home from '@/systemPages/admin/home/Home';
import StudentsList from '@/systemPages/admin/students/StudentsList/StudentsList';
import StudentInformation from '@/systemPages/admin/students/StudentInformation/StudentInformation';
import Questions from '@/systemPages/admin/questions/Questions/Questions';
import EditQuestion from '@/systemPages/admin/questions/Questions/QuestionsList/EditQuestion/EditQuestion';
import AdministratorsList from '@/systemPages/admin/administrators/AdministratorsList/AdministratorsList';
import StudentGroups from '@/systemPages/admin/studentgroups/StudentGroups/StudentGroups';
import SystemPage from '@/systemPages/admin/system/SystemPage/SystemPage';
import TestHome from '@/systemPages/student/TestHome/TestHome';
import TestFinish from '@/systemPages/student/TestFinish/TestFinish';
import LeaderboardPage from '@/systemPages/leaderboard/LeaderboardPage';
import SlidesPage from '@/systemPages/slides/SlidesPage';

function AuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/checkauth', { withCredentials: true })
      .then((response) => {
        if (response.data.admin === 1) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/student', { replace: true });
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  return null;
}

function AdminGuard({ children }) {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    axios.get('/api/checkauth', { withCredentials: true })
      .then((response) => {
        if (response.data.admin === 1) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => {
        setAuthorized(false);
      });
  }, []);

  if (authorized === null) return null;
  if (!authorized) return <Navigate to="/student" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthRedirect />} />
      <Route path="/admin" element={<AdminGuard><Home /></AdminGuard>} />
      <Route path="/admin/students" element={<AdminGuard><StudentsList /></AdminGuard>} />
      <Route path="/admin/students/:studentID" element={<AdminGuard><StudentInformation /></AdminGuard>} />
      <Route path="/admin/questions" element={<AdminGuard><Questions /></AdminGuard>} />
      <Route path="/admin/questions/:questionID" element={<AdminGuard><EditQuestion /></AdminGuard>} />
      <Route path="/admin/administrators" element={<AdminGuard><AdministratorsList /></AdminGuard>} />
      <Route path="/admin/studentgroups" element={<AdminGuard><StudentGroups /></AdminGuard>} />
      <Route path="/admin/system" element={<AdminGuard><SystemPage /></AdminGuard>} />
      <Route path="/student" element={<TestHome />} />
      <Route path="/student/finish" element={<TestFinish />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/slides" element={<SlidesPage />} />
    </Routes>
  );
}

export default function App() {
  const { pathname } = useLocation();

  if (pathname === '/login') {
    return <Login />;
  }

  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}
