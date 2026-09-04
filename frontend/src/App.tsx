import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminLogin from "./pages/AdminLogin";
import ProtectedRoute from "./routes/ProtectedRoute";
import HRLayout from "./pages/hr/HRLayout";
import VacanciesPage from "./pages/hr/VacanciesPage";
import CandidatesPage from "./pages/hr/CandidatesPage";
import CandidateDetailPage from "./pages/hr/CandidateDetailPage";
import InterviewsPage from "./pages/hr/InterviewsPage";
import FollowUpsPage from "./pages/hr/FollowUpsPage";
import HMLayout from "./pages/hiringManager/HMLayout";
import HMDashboardPage from "./pages/hiringManager/DashboardPage";
import HMVacanciesPage from "./pages/hiringManager/VacanciesPage";
import PendingDecisionsPage from "./pages/hiringManager/PendingDecisionsPage";
import DecisionHistoryPage from "./pages/hiringManager/DecisionHistoryPage";
import CandidateComparisonPage from "./pages/hiringManager/CandidateComparisonPage";
import VacancyCandidatesPage from "./pages/hiringManager/VacancyCandidatesPage";
import CandidateDecisionPage from "./pages/hiringManager/CandidateDecisionPage";
import MgmtLayout from "./pages/management/MgmtLayout";
import MgmtDashboardPage from "./pages/management/DashboardPage";
import DepartmentVacanciesPage from "./pages/management/DepartmentVacanciesPage";
import CandidateProgressPage from "./pages/management/CandidateProgressPage";
import MgmtMyInterviewsPage from "./pages/management/MyInterviewsPage";
import ReportsPage from "./pages/management/ReportsPage";
import LeadershipLayout from "./pages/leadership/LeadershipLayout";
import RecruitmentOverviewPage from "./pages/leadership/RecruitmentOverviewPage";
import DepartmentPerformancePage from "./pages/leadership/DepartmentPerformancePage";
import HiringTrendsPage from "./pages/leadership/HiringTrendsPage";
import ExportReportsPage from "./pages/leadership/ExportReportsPage";
import InterviewerLayout from "./pages/interviewer/InterviewerLayout";
import MyInterviewsPage from "./pages/interviewer/MyInterviewsPage";
import FeedbackPage from "./pages/interviewer/FeedbackPage";
import MyCandidatesPage from "./pages/interviewer/MyCandidatesPage";
import ITAdminLayout from "./pages/admin/ITAdminLayout";
import UsersPage from "./pages/admin/UsersPage";
import CreateUserPage from "./pages/admin/CreateUserPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import SystemPage from "./pages/admin/SystemPage";
import NotificationTemplatesPage from "./pages/admin/NotificationTemplatesPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin" element={<AdminLogin />} />

      <Route element={<ProtectedRoute allowedRoles={["HR"]} />}>
        <Route element={<HRLayout />}>
          <Route path="/hr/vacancies" element={<VacanciesPage />} />
          <Route path="/hr/candidates" element={<CandidatesPage />} />
          <Route path="/hr/candidates/:applicationId" element={<CandidateDetailPage />} />
          <Route path="/hr/interviews" element={<InterviewsPage />} />
          <Route path="/hr/follow-ups" element={<FollowUpsPage />} />
          <Route path="/hr/dashboard" element={<Navigate to="/hr/vacancies" replace />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["HIRING_MANAGER"]} />}>
        <Route element={<HMLayout />}>
          <Route path="/hiring-manager/dashboard" element={<HMDashboardPage />} />
          <Route path="/hiring-manager/vacancies" element={<HMVacanciesPage />} />
          <Route path="/hiring-manager/vacancies/:vacancyId/candidates" element={<VacancyCandidatesPage />} />
          <Route path="/hiring-manager/applications/:applicationId" element={<CandidateDecisionPage />} />
          <Route path="/hiring-manager/candidate-comparison" element={<CandidateComparisonPage />} />
          {/* My Interviews removed -- HM isn't an interviewer/panelist (corrections doc). */}
          <Route path="/hiring-manager/pending-decisions" element={<PendingDecisionsPage />} />
          <Route path="/hiring-manager/decision-history" element={<DecisionHistoryPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["MANAGEMENT"]} />}>
        <Route element={<MgmtLayout />}>
          <Route path="/management/dashboard" element={<MgmtDashboardPage />} />
          <Route path="/management/vacancies" element={<DepartmentVacanciesPage />} />
          <Route path="/management/candidate-progress" element={<CandidateProgressPage />} />
          <Route path="/management/my-interviews" element={<MgmtMyInterviewsPage />} />
          {/* My Candidates merged into CandidateProgressPage above (corrections
              doc) -- kept as a redirect rather than removed outright in case
              anything still links to the old path. */}
          <Route path="/management/candidates" element={<Navigate to="/management/candidate-progress" replace />} />
          <Route path="/management/candidates/:id/feedback" element={<FeedbackPage />} />
          <Route path="/management/reports" element={<ReportsPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["LEADERSHIP_MANAGEMENT"]} />}>
        <Route element={<LeadershipLayout />}>
          <Route path="/leadership-management/recruitment-overview" element={<RecruitmentOverviewPage />} />
          <Route path="/leadership-management/department-performance" element={<DepartmentPerformancePage />} />
          <Route path="/leadership-management/hiring-trends" element={<HiringTrendsPage />} />
          <Route path="/leadership-management/reports" element={<ExportReportsPage />} />
          <Route path="/leadership-management/dashboard" element={<Navigate to="/leadership-management/recruitment-overview" replace />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["INTERVIEWER"]} />}>
        <Route element={<InterviewerLayout />}>
          <Route path="/interviewer/interviews" element={<MyInterviewsPage />} />
          <Route path="/interviewer/candidates/:id/feedback" element={<FeedbackPage />} />
          <Route path="/interviewer/candidates" element={<MyCandidatesPage />} />
          <Route path="/interviewer/dashboard" element={<Navigate to="/interviewer/interviews" replace />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["IT_ADMIN"]} />}>
        <Route element={<ITAdminLayout />}>
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/users/create" element={<CreateUserPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          <Route path="/admin/system" element={<SystemPage />} />
          <Route path="/admin/notification-templates" element={<NotificationTemplatesPage />} />
          <Route path="/admin/dashboard" element={<Navigate to="/admin/users" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
