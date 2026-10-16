import { useEffect } from "react";
import Layout from "./components/Layout";
import InspectionsPage from "./pages/InspectionsPage";
import ViewerPage from "./pages/ViewerPage";
import TemporalPage from "./pages/TemporalPage";
import ReportPage from "./pages/ReportPage";
import { StoreProvider, useStore } from "./store";
import { viewportApi } from "./lib/viewportApi";

function Shell() {
  const { page, setPage, setSelectedId } = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "1") setPage("inspections");
      else if (e.key === "2") setPage("viewer");
      else if (e.key === "3") setPage("temporal");
      else if (e.key === "4") setPage("report");
      else if (e.key === "Escape") {
        viewportApi.clearMeasure?.();
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPage, setSelectedId]);

  return (
    <Layout>
      {page === "inspections" && <InspectionsPage />}
      {page === "viewer" && <ViewerPage />}
      {page === "temporal" && <TemporalPage />}
      {page === "report" && <ReportPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
