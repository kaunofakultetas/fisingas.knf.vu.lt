import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Home />} />
      <Route path="/admin/students" element={<StudentsList />} />
      <Route path="/admin/students/:studentID" element={<StudentInformation />} />
      <Route path="/admin/questions" element={<Questions />} />
      <Route path="/admin/questions/:questionID" element={<EditQuestion />} />
      <Route path="/admin/administrators" element={<AdministratorsList />} />
      <Route path="/admin/studentgroups" element={<StudentGroups />} />
      <Route path="/admin/system" element={<SystemPage />} />
      <Route path="/student" element={<TestHome />} />
      <Route path="/student/finish" element={<TestFinish />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/slides" element={<SlidesPage />} />
    </Routes>
  );
}
