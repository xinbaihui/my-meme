import EvaluationsPage from "./pages/EvaluationsPage";
import OverviewPage from "./pages/OverviewPage";

export default function App({ pathname = "/" }: { pathname?: string }) {
  if (pathname === "/evals" || pathname === "/evals/") {
    return <EvaluationsPage />;
  }

  return <OverviewPage />;
}
