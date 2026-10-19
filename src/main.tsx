import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
// Styles
import "react-toastify/dist/ReactToastify.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { DialogsProvider } from "@/v2/components/Dialogs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { ThemeProvider } from "./lib/theme-provider";

// Lazy loaded pages
const V2App = lazy(() => import("./v2/V2App"));

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
                    <DialogsProvider>
                        <Suspense fallback={<PageLoadingFallback />}>
                            <Routes>
                                {/* The app owns all routing (#81) */}
                                <Route path="/*" element={<V2App />} />
                            </Routes>
                        </Suspense>
                    </DialogsProvider>
                    <ToastContainer />
                </BrowserRouter>
            </ThemeProvider>
        </QueryProvider>
    </ErrorBoundary>
);
