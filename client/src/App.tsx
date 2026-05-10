// ===== AI 日记小助理 — 主应用 =====
// 设计：暖橙流光主题，4页路由 + 固定底部导航

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import PlansPage from "./pages/PlansPage";
import ReviewPage from "./pages/ReviewPage";
import NotFound from "./pages/NotFound";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/timeline" component={TimelinePage} />
      <Route path="/plans" component={PlansPage} />
      <Route path="/review" component={ReviewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-[#FFF8F0]">
            {/* 顶部渐变装饰条 */}
            <div className="top-gradient-bar fixed top-0 left-0 right-0 z-50" />

            {/* 主内容区域 */}
            <div className="pb-20 pt-[3px]">
              <Router />
            </div>

            {/* 固定底部导航 */}
            <BottomNav />
          </div>
          <Toaster position="top-center" />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
