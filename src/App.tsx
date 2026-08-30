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
import { OfflineSyncManager } from "@/components/OfflineSyncManager";

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
const InventoryDashboard = lazy(() => import("./pages/inventory/Dashboard"));
const InventoryLocations = lazy(() => import("./pages/inventory/Locations"));
const InventoryStock = lazy(() => import("./pages/inventory/Stock"));
const InventoryRequests = lazy(() => import("./pages/inventory/Requests"));
const InventoryMaterialRequestReceipt = lazy(() => import("./pages/inventory/MaterialRequestReceipt"));
const InventoryTransfers = lazy(() => import("./pages/inventory/Transfers"));
const InventoryCriticalSpares = lazy(() => import("./pages/inventory/CriticalSpares"));
const InventorySuppliers = lazy(() => import("./pages/inventory/Suppliers"));
const InventoryPurchaseRequests = lazy(() => import("./pages/inventory/PurchaseRequests"));
const InventoryPurchaseOrders = lazy(() => import("./pages/inventory/PurchaseOrders"));
const InventoryQuarantine = lazy(() => import("./pages/inventory/Quarantine"));
const InventoryProductionMaterials = lazy(() => import("./pages/inventory/ProductionMaterials"));
const InventoryStockCounts = lazy(() => import("./pages/inventory/StockCounts"));
const InventoryHistory = lazy(() => import("./pages/inventory/History"));
const InventoryReports = lazy(() => import("./pages/inventory/Reports"));
const InventoryReorder = lazy(() => import("./pages/inventory/Reorder"));
const FuelLogs = lazy(() => import("./pages/FuelLogs"));
const Documents = lazy(() => import("./pages/Documents"));
const PMSchedules = lazy(() => import("./pages/PMSchedules"));
const MeterReadings = lazy(() => import("./pages/MeterReadings"));
const MaintenanceCalendar = lazy(() => import("./pages/MaintenanceCalendar"));
const Downtime = lazy(() => import("./pages/Downtime"));
const ServiceHistory = lazy(() => import("./pages/ServiceHistory"));
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
const InductionPublicRun = lazy(() => import("./pages/induction/InductionPublicRun"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OEE = lazy(() => import("./pages/OEE"));
const Reports = lazy(() => import("./pages/Reports"));
const Safety = lazy(() => import("./pages/Safety"));
const RiskAssessments = lazy(() => import("./pages/safety/RiskAssessments"));
const SafetyInspections = lazy(() => import("./pages/safety/Inspections"));
const CorrectiveActions = lazy(() => import("./pages/safety/CorrectiveActions"));
const PPE = lazy(() => import("./pages/safety/PPE"));
const Contractors = lazy(() => import("./pages/safety/Contractors"));
const ContractorDetail = lazy(() => import("./pages/safety/ContractorDetail"));
const Competency = lazy(() => import("./pages/safety/Competency"));
const SafetyEquipment = lazy(() => import("./pages/safety/SafetyEquipment"));
const Certificates = lazy(() => import("./pages/safety/Certificates"));
const ControlledTools = lazy(() => import("./pages/safety/ControlledTools"));
const SafetyDocuments = lazy(() => import("./pages/safety/SafetyDocuments"));
const SafetyRules = lazy(() => import("./pages/safety/SafetyRules"));
const Quality = lazy(() => import("./pages/Quality"));
const Production = lazy(() => import("./pages/Production"));
const ProductionOverview = lazy(() => import("./pages/production/Overview"));
const ProductionPlanning = lazy(() => import("./pages/production/Planning"));
const ProductionOrders = lazy(() => import("./pages/production/Orders"));
const ProductionDowntime = lazy(() => import("./pages/production/Downtime"));
const ProductionMaterialWaste = lazy(() => import("./pages/production/MaterialWaste"));
const ProductionHistory = lazy(() => import("./pages/production/History"));
const ProductionAnalytics = lazy(() => import("./pages/production/Analytics"));
const MaintenanceKPIs = lazy(() => import("./pages/MaintenanceKPIs"));
const Utilities = lazy(() => import("./pages/Utilities"));
const Live = lazy(() => import("./pages/Live"));
const LiveProduction = lazy(() => import("./pages/LiveProduction"));
const Vendors = lazy(() => import("./pages/Vendors"));
const WorkOrderPrint = lazy(() => import("./pages/WorkOrderPrint"));
const ChecklistTemplatePrint = lazy(() => import("./pages/ChecklistTemplatePrint"));
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
const GarageCustomers = lazy(() => import("./pages/garage/Customers"));
const GarageVehicles = lazy(() => import("./pages/garage/Vehicles"));
const GarageVehicleDetail = lazy(() => import("./pages/garage/VehicleDetail"));
const GarageJobs = lazy(() => import("./pages/garage/Jobs"));
const GarageJobDetail = lazy(() => import("./pages/garage/JobDetail"));
const GarageMechanics = lazy(() => import("./pages/garage/Mechanics"));
const GarageInvoices = lazy(() => import("./pages/garage/Invoices"));
const GaragePayments = lazy(() => import("./pages/garage/Payments"));
const GarageInventory = lazy(() => import("./pages/garage/Inventory"));
const GarageSuppliers = lazy(() => import("./pages/garage/Suppliers"));
const GarageCalendar = lazy(() => import("./pages/garage/Calendar"));
const GarageReminders = lazy(() => import("./pages/garage/Reminders"));
const GarageReports = lazy(() => import("./pages/garage/Reports"));
const GarageEstimates = lazy(() => import("./pages/garage/Estimates"));
const GarageEstimatePrint = lazy(() => import("./pages/garage/EstimatePrint"));
const GarageInvoicePrint = lazy(() => import("./pages/garage/InvoicePrint"));
const GarageJobStatusPublic = lazy(() => import("./pages/garage/JobStatusPublic"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <OfflineSyncManager />
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
                <Route path="/checklist-templates/:id/print" element={<ChecklistTemplatePrint />} />
                <Route path="/induction/run/:recordId" element={<InductionRun />} />
                <Route path="/induction/certificate/:recordId" element={<InductionCertificate />} />
                <Route path="/induction/qr/:programmeId" element={<InductionPublicRun />} />
                <Route path="/g/:jobId" element={<GarageJobStatusPublic />} />
                <Route path="/live" element={<Live />} />
                <Route path="/live/production" element={<LiveProduction />} />
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
                  <Route path="/garage/customers" element={<GarageCustomers />} />
                  <Route path="/garage/vehicles" element={<GarageVehicles />} />
                                    <Route path="/garage/vehicles/:id" element={<GarageVehicleDetail />} />
                  <Route path="/garage/jobs" element={<GarageJobs />} />
                  <Route path="/garage/jobs/:id" element={<GarageJobDetail />} />
                  <Route path="/garage/calendar" element={<GarageCalendar />} />
                  <Route path="/garage/reminders" element={<GarageReminders />} />
                  <Route path="/garage/estimates" element={<GarageEstimates />} />
                  <Route path="/garage/estimates/:id/print" element={<GarageEstimatePrint />} />
                  <Route path="/garage/invoices" element={<GarageInvoices />} />
                  <Route path="/garage/invoices/:id/print" element={<GarageInvoicePrint />} />
                  <Route path="/garage/payments" element={<GaragePayments />} />
                  <Route path="/garage/inventory" element={<GarageInventory />} />
                  <Route path="/garage/suppliers" element={<GarageSuppliers />} />
                  <Route path="/garage/mechanics" element={<GarageMechanics />} />
                  <Route path="/garage/reports" element={<GarageReports />} />
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
                  <Route path="/safety/risk-assessments" element={<RiskAssessments />} />
                  <Route path="/safety/inspections" element={<SafetyInspections />} />
                  <Route path="/safety/corrective-actions" element={<CorrectiveActions />} />
                  <Route path="/safety/ppe" element={<PPE />} />
                  <Route path="/safety/contractors" element={<Contractors />} />
                  <Route path="/safety/contractors/:id" element={<ContractorDetail />} />
                  <Route path="/safety/competency" element={<Competency />} />
                  <Route path="/safety/equipment" element={<SafetyEquipment />} />
                  <Route path="/safety/certificates" element={<Certificates />} />
                  <Route path="/safety/controlled-tools" element={<ControlledTools />} />
                  <Route path="/safety/documents" element={<SafetyDocuments />} />
                  <Route path="/safety/rules" element={<SafetyRules />} />
                  <Route path="/quality" element={<Quality />} />
                  <Route path="/production" element={<Production />} />
                  <Route path="/production/overview" element={<ProductionOverview />} />
                  <Route path="/production/planning" element={<ProductionPlanning />} />
                  <Route path="/production/orders" element={<ProductionOrders />} />
                  <Route path="/production/downtime" element={<ProductionDowntime />} />
                  <Route path="/production/material-waste" element={<ProductionMaterialWaste />} />
                  <Route path="/production/history" element={<ProductionHistory />} />
                  <Route path="/production/analytics" element={<ProductionAnalytics />} />
                  <Route path="/maintenance-kpis" element={<MaintenanceKPIs />} />
                  <Route path="/utilities" element={<Utilities />} />
                  <Route path="/inventory" element={<InventoryDashboard />} />
                  <Route path="/inventory/items" element={<Inventory />} />
                  <Route path="/inventory/stock" element={<InventoryStock />} />
                  <Route path="/inventory/locations" element={<InventoryLocations />} />
                  <Route path="/inventory/requests" element={<InventoryRequests />} />
                  <Route path="/inventory/requests/:id/receipt" element={<InventoryMaterialRequestReceipt />} />
                  <Route path="/inventory/transfers" element={<InventoryTransfers />} />
                  <Route path="/inventory/critical-spares" element={<InventoryCriticalSpares />} />
                  <Route path="/inventory/suppliers" element={<InventorySuppliers />} />
                  <Route path="/inventory/purchase-requests" element={<InventoryPurchaseRequests />} />
                  <Route path="/inventory/purchase-orders" element={<InventoryPurchaseOrders />} />
                  <Route path="/inventory/quarantine" element={<InventoryQuarantine />} />
                  <Route path="/inventory/production-materials" element={<InventoryProductionMaterials />} />
                  <Route path="/inventory/stock-counts" element={<InventoryStockCounts />} />
                  <Route path="/inventory/history" element={<InventoryHistory />} />
                  <Route path="/inventory/reports" element={<InventoryReports />} />
                  <Route path="/inventory/reorder" element={<InventoryReorder />} />
                  <Route path="/fuel" element={<FuelLogs />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/maintenance/schedules" element={<PMSchedules />} />
                  <Route path="/maintenance/meter-readings" element={<MeterReadings />} />
                  <Route path="/maintenance/calendar" element={<MaintenanceCalendar />} />
                  <Route path="/maintenance/downtime" element={<Downtime />} />
                  <Route path="/maintenance/history" element={<ServiceHistory />} />
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
