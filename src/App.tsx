import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import AppLayout from "@/components/AppLayout";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const DashboardRouter = lazy(() => import("./pages/DashboardRouter"));
const Machines = lazy(() => import("./pages/Machines"));
const MachineDetail = lazy(() => import("./pages/MachineDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkOrders = lazy(() => import("./pages/WorkOrders"));
const Inventory = lazy(() => import("./pages/Inventory"));
const FuelLogs = lazy(() => import("./pages/FuelLogs"));
const Documents = lazy(() => import("./pages/Documents"));
const Team = lazy(() => import("./pages/Team"));
const MobileMachine = lazy(() => import("./pages/MobileMachine"));
const PreStartInspection = lazy(() => import("./pages/PreStartInspection"));
const InductionProgrammes = lazy(() => import("./pages/induction/InductionProgrammes"));
const InductionProgrammeDetail = lazy(() => import("./pages/induction/InductionProgrammeDetail"));
const InductionQuizEditor = lazy(() => import("./pages/induction/InductionQuizEditor"));
const InductionInductees = lazy(() => import("./pages/induction/InductionInductees"));
const InductionDashboard = lazy(() => import("./pages/induction/InductionDashboard"));
const InductionRun = lazy(() => import("./pages/induction/InductionRun"));
const InductionCertificate = lazy(() => import("./pages/induction/InductionCertificate"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OEE = lazy(() => import("./pages/OEE"));
const Reports = lazy(() => import("./pages/Reports"));
const Safety = lazy(() => import("./pages/Safety"));
const Quality = lazy(() => import("./pages/Quality"));
const Production = lazy(() => import("./pages/Production"));
const MaintenanceKPIs = lazy(() => import("./pages/MaintenanceKPIs"));
const Utilities = lazy(() => import("./pages/Utilities"));
const Live = lazy(() => import("./pages/Live"));
const Vendors = lazy(() => import("./pages/Vendors"));
const WorkOrderPrint = lazy(() => import("./pages/WorkOrderPrint"));
const WorkOrderNew = lazy(() => import("./pages/WorkOrderNew"));
const WorkOrderDetail = lazy(() => import("./pages/WorkOrderDetail"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const ChecklistTemplates = lazy(() => import("./pages/ChecklistTemplates"));
const ChecklistTemplateDetail = lazy(() => import("./pages/ChecklistTemplateDetail"));
const ChecklistExecutionRun = lazy(() => import("./pages/ChecklistExecutionRun"));
const FaultReports = lazy(() => import("./pages/FaultReports"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Vehicles = lazy(() => import("./pages/fleet/Vehicles"));
const Drivers = lazy(() => import("./pages/fleet/Drivers"));
const FleetDocuments = lazy(() => import("./pages/fleet/FleetDocuments"));
const Trips = lazy(() => import("./pages/fleet/Trips"));
const Tyres = lazy(() => import("./pages/fleet/Tyres"));
const FleetInspections = lazy(() => import("./pages/fleet/Inspections"));
const FleetInsights = lazy(() => import("./pages/fleet/FleetInsights"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/accept-invite/:token" element={<AcceptInvite />} />
                <Route path="/m/:id" element={<MobileMachine />} />
                <Route path="/m/:id/inspect" element={<PreStartInspection />} />
                <Route path="/work-orders/:id/print" element={<WorkOrderPrint />} />
                <Route path="/induction/run/:recordId" element={<InductionRun />} />
                <Route path="/induction/certificate/:recordId" element={<InductionCertificate />} />
                <Route path="/live" element={<Live />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardRouter />} />
                  <Route path="/fleet/vehicles" element={<Vehicles />} />
                  <Route path="/fleet/drivers" element={<Drivers />} />
                  <Route path="/fleet/trips" element={<Trips />} />
                  <Route path="/fleet/documents" element={<FleetDocuments />} />
                  <Route path="/fleet/tyres" element={<Tyres />} />
                  <Route path="/fleet/inspections" element={<FleetInspections />} />
                  <Route path="/fleet/insights" element={<FleetInsights />} />
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
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
