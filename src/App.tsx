import * as React from "react";
import HeroSection from "@/components/sections/hero-section";
import LiveMetricsFeed from "@/components/sections/live-metrics-feed";
import ViewModeToggle from "@/components/sections/view-mode-toggle";
import AgentStackGrid from "@/components/sections/agent-stack-grid";
import ProtocolMatrix from "@/components/sections/protocol-matrix";
import AgentPlayground from "@/components/sections/agent-playground";
import SafetyShields from "@/components/sections/safety-shields";
import PricingMatrix from "@/components/sections/pricing-matrix";
import KnowledgeBase from "@/components/sections/knowledge-base";
import SiteFooter from "@/components/sections/site-footer";
import InfinityScrollerNav from "@/components/ui/infinity-scroller-nav";
import LoginPage from "@/pages/login-page";
import StudioPage from "@/pages/studio-page";

function useRoute() {
  const [path, setPath] = React.useState(() => window.location.pathname);
  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export default function App() {
  const path = useRoute();
  const isAuthPage = path === "/login" || path === "/signup";
  const isStudio = path.startsWith("/studio");

  if (isStudio) {
    return <StudioPage />;
  }

  if (isAuthPage) {
    return <LoginPage />;
  }

  return (
    <div id="top" className="relative min-h-screen w-full overflow-x-clip">
      <InfinityScrollerNav />
      <main>
        <HeroSection />
        <LiveMetricsFeed />
        <ViewModeToggle />
        <AgentStackGrid />
        <ProtocolMatrix />
        <AgentPlayground />
        <SafetyShields />
        <PricingMatrix />
        <KnowledgeBase />
      </main>
      <SiteFooter />
    </div>
  );
}