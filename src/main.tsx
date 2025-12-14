import { StoryProvider } from "@/features/stories/context/StoryContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Workspace } from "./components/workspace/Workspace";
import { ThemeProvider } from "./lib/theme-provider";
// Styles
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

import { MainLayout } from "./components/MainLayout";

// Lazy loaded pages
const StoryReader = lazy(() => import("./features/stories/pages/StoryReader").then(m => ({ default: m.StoryReader })));
const SeriesListPage = lazy(() => import("./features/series/pages/SeriesListPage"));
const SettingsPage = lazy(() => import("./features/ai/pages/SettingsPage"));
const GuidePage = lazy(() => import("./features/guide/pages/GuidePage"));

// Loading fallback component
const PageLoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
);
// biome-ignore lint/style/noNonNullAssertion: <explanation>

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <QueryProvider>
            <ThemeProvider defaultTheme="dark" storageKey="app-theme">
                <BrowserRouter>
                    <StoryProvider>
                        <Suspense fallback={<PageLoadingFallback />}>
                            <Routes>
                                <Route path="/" element={<Workspace />} />
                                <Route element={<MainLayout />}>
                                    <Route path="/stories/:storyId/read" element={<StoryReader />} />
                                    <Route path="/series" element={<SeriesListPage />} />
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="/guide" element={<GuidePage />} />
                                </Route>
                            </Routes>
                        </Suspense>
                    </StoryProvider>
                    <ToastContainer />
                </BrowserRouter>
            </ThemeProvider>
        </QueryProvider>
    </ErrorBoundary>
);
