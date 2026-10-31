import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AlertsPage } from "./pages/AlertsPage";
import { AnalyzePage } from "./pages/AnalyzePage";
import { CopilotPage } from "./pages/CopilotPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { EntitiesPage } from "./pages/EntitiesPage";
import { InvestigationDetailPage } from "./pages/InvestigationDetailPage";
import { InvestigationsPage } from "./pages/InvestigationsPage";
import { ModelPage } from "./pages/ModelPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PatternsPage } from "./pages/PatternsPage";
import { StreamPage } from "./pages/StreamPage";
import { TransactionDetailPage } from "./pages/TransactionDetailPage";
import { TransactionsPage } from "./pages/TransactionsPage";

const CampaignsPage = lazy(() =>
  import("./pages/CampaignsPage").then((module) => ({ default: module.CampaignsPage }))
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Core UPI Anomaly & Transaction Routes */}
        <Route path="/" element={<OverviewPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:transactionId" element={<TransactionDetailPage />} />
        <Route path="/stream" element={<StreamPage />} />
        <Route path="/patterns" element={<PatternsPage />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/entities/:entityId" element={<EntitiesPage />} />
        <Route path="/model" element={<ModelPage />} />
        <Route path="/alerts" element={<AlertsPage />} />

        {/* Preserved Evidence / Campaign / Investigation Routes */}
        <Route path="/investigations" element={<InvestigationsPage />} />
        <Route path="/investigations/:adId" element={<InvestigationDetailPage />} />
        <Route
          path="/campaigns"
          element={
            <Suspense fallback={<div className="dossier-panel p-6 text-sm text-sub">Preparing evidence field…</div>}>
              <CampaignsPage />
            </Suspense>
          }
        />
        <Route
          path="/campaigns/:campaignId"
          element={
            <Suspense fallback={<div className="dossier-panel p-6 text-sm text-sub">Preparing evidence field…</div>}>
              <CampaignsPage />
            </Suspense>
          }
        />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/discovery" element={<DiscoveryPage />} />
        <Route path="/copilot" element={<CopilotPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
