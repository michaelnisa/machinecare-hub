import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import MachineDetail from "./pages/MachineDetail";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import WorkOrders from "./pages/WorkOrders";
import Inventory from "./pages/Inventory";
import FuelLogs from "./pages/FuelLogs";
import Documents from "./pages/Documents";
import Team from "./pages/Team";
import MobileMachine from "./pages/MobileMachine";
import InductionProgrammes from "./pages/induction/InductionProgrammes";
import InductionProgrammeDetail from "./pages/induction/InductionProgrammeDetail";
import InductionQuizEditor from "./pages/induction/InductionQuizEditor";
import InductionInductees from "./pages/induction/InductionInductees";
import InductionDashboard from "./pages/induction/InductionDashboard";
import InductionRun from "./pages/induction/InductionRun";
import InductionCertificate from "./pages/induction/InductionCertificate";
import Notifications from "./pages/Notifications";
import OEE from "./pages/OEE";
import Reports from "./pages/Reports";
import Safety from "./pages/Safety";
import Quality from "./pages/Quality";
import Production from "./pages/Production";
import MaintenanceKPIs from "./pages/MaintenanceKPIs";
import Utilities from "./pages/Utilities";
import Live from "./pages/Live";
import Vendors from "./pages/Vendors";
import WorkOrderPrint from "./pages/WorkOrderPrint";
import WorkOrderNew from "./pages/WorkOrderNew";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import VendorDetail from "./pages/VendorDetail";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import ChecklistTemplateDetail from "./pages/ChecklistTemplateDetail";
import ChecklistExecutionRun from "./pages/ChecklistExecutionRun";
import FaultReports from "./pages/FaultReports";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />
            <Route path="/m/:id" element={<MobileMachine />} />
            <Route path="/work-orders/:id/print" element={<WorkOrderPrint />} />
            <Route path="/induction/run/:recordId" element={<InductionRun />} />
            <Route path="/induction/certificate/:recordId" element={<InductionCertificate />} />
            <Route path="/live" element={<Live />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/work-orders/new" element={<WorkOrderNew />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
              <Route path="/fault-reports" element={<FaultReports />} />
              <Route path="/checklist-templates" element={<ChecklistTemplates />} />
              <Route path="/checklist-templates/:id" element={<ChecklistTemplateDetail />} />
              <Route path="/inspections/:id" element={<ChecklistExecutionRun />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/vendors/:id" element={<VendorDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/oee" element={<OEE />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/quality" element={<Quality />} />
              <Route path="/production" element={<Production />} />
              <Route path="/maintenance-kpis" element={<MaintenanceKPIs />} />
              <Route path="/utilities" element={<Utilities />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/fuel" element={<FuelLogs />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/team" element={<Team />} />
              <Route path="/induction/dashboard" element={<InductionDashboard />} />
              <Route path="/induction/programmes" element={<InductionProgrammes />} />
              <Route path="/induction/programmes/:id" element={<InductionProgrammeDetail />} />
              <Route path="/induction/programmes/:id/modules/:moduleId/quiz" element={<InductionQuizEditor />} />
              <Route path="/induction/inductees" element={<InductionInductees />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
