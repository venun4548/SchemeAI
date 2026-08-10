import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/public/Home'
import Features from './pages/public/Features'
import HowItWorks from './pages/public/HowItWorks'
import Schemes from './pages/public/Schemes'
import About from './pages/public/About'
import Contact from './pages/public/Contact'
import Help from './pages/public/Help'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import Dashboard from './pages/app/Dashboard'
import Questionnaire from './pages/app/Questionnaire'
import Eligibility from './pages/app/Eligibility'
import Recommendations from './pages/app/Recommendations'
import Compare from './pages/app/Compare'
import Documents from './pages/app/Documents'
import Applications from './pages/app/Applications'
import ApplicationDetail from './pages/app/ApplicationDetail'
import Offices from './pages/app/Offices'
import Profile from './pages/app/Profile'
import ProfileSecurity from './pages/app/ProfileSecurity'
import Family from './pages/app/Family'
import News from './pages/app/News'
import Notifications from './pages/app/Notifications'
import Reports from './pages/app/Reports'
import Support from './pages/app/Support'

import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminProfile from './pages/admin/Profile'
import AdminProfileActivity from './pages/admin/ProfileActivity'
import AdminUsers from './pages/admin/Users'
import AdminApplications from './pages/admin/Applications'
import AdminDocuments from './pages/admin/Documents'
import AdminCases from './pages/admin/Cases'
import AdminSchemes from './pages/admin/Schemes'
import AdminPublications from './pages/admin/Publications'
import AdminAgents from './pages/admin/Agents'
import AdminIncidents from './pages/admin/Incidents'
import AdminRoles from './pages/admin/Roles'
import AdminAudit from './pages/admin/Audit'
import AdminSecurity from './pages/admin/Security'
import AdminReports from './pages/admin/Reports'
import AdminKnowledge from './pages/admin/Knowledge'
import AdminAnalytics from './pages/admin/Analytics'
import AIOperations from './pages/admin/AIOperations'

import NotFound from './pages/NotFound'
import ChatWidget from './components/ChatWidget'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/eligibility" element={<Eligibility />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
            <Route path="/offices" element={<Offices />} />
            <Route path="/family" element={<Family />} />
            <Route path="/news" element={<News />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/support" element={<Support />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/security" element={<ProfileSecurity />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute admin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={<AdminProfile />} />
            <Route path="/admin/profile/activity" element={<AdminProfileActivity />} />
            <Route path="/admin/applications" element={<AdminApplications />} />
            <Route path="/admin/documents" element={<AdminDocuments />} />
            <Route path="/admin/cases" element={<AdminCases />} />
            <Route path="/admin/schemes" element={<AdminSchemes />} />
            <Route path="/admin/publications" element={<AdminPublications />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/incidents" element={<AdminIncidents />} />
            <Route path="/admin/roles" element={<AdminRoles />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/knowledge" element={<AdminKnowledge />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/runs" element={<AIOperations />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <ChatWidget />
    </>
  )
}
