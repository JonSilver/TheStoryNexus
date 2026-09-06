import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
// Styles
import "react-toastify/dist/ReactToastify.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MainLayout } from "./components/MainLayout";
import "./index.css";
import { ThemeProvider } from "./lib/theme-provider";

// Lazy loaded pages
const StoryReader = lazy(() => import("./features/stories/pages/StoryReader").then(m => ({ default: m.StoryReader })));
const V2App = lazy(() => import("./v2/V2App"));
const SeriesListPage = lazy(() => import("./features/series/pages/SeriesListPage"));
const SettingsPage = lazy(() => import("./features/ai/pages/SettingsPage"));
const GuidePage = lazy(() => import("./features/guide/pages/GuidePage"));

// Loading fallback component
const PageLoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
);
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
        <QueryProvider>
            <ThemeProvider defaultTheme="dark" storageKey="app-theme">
                <BrowserRouter>
                    <Suspense fallback={<PageLoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<V2App />} />
                            {/* Old bookmarks and links land somewhere real, never a blank page */}
                            <Route path="/v2" element={<Navigate to="/" replace />} />
                            <Route path="/stories" element={<Navigate to="/" replace />} />
                            <Route path="/series/:seriesId" element={<Navigate to="/series" replace />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                            <Route element={<MainLayout />}>
                                <Route path="/stories/:storyId/read" element={<StoryReader />} />
                                <Route path="/series" element={<SeriesListPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="/guide" element={<GuidePage />} />
                            </Route>
                        </Routes>
                    </Suspense>
                    <ToastContainer />
                </BrowserRouter>
            </ThemeProvider>
        </QueryProvider>
    </ErrorBoundary>
);
