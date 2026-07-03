import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import MyTeam from './pages/MyTeam';
import Leaderboard from './pages/Leaderboard';
import Leagues from './pages/Leagues';
import GameweekStats from './pages/GameweekStats';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';
import { getToken, getUser } from './utils/api';

// Route protection component
function ProtectedRoute({ children, requireAdmin = false }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/team-builder" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected User Routes */}
        <Route 
          path="/team-builder" 
          element={
            <ProtectedRoute>
              <MyTeam />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leaderboard" 
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leaderboard/:leagueId" 
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leagues" 
          element={
            <ProtectedRoute>
              <Leagues />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leagues/:leagueId" 
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/stats" 
          element={
            <ProtectedRoute>
              <GameweekStats />
            </ProtectedRoute>
          } 
        />

        {/* Protected Admin Routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
