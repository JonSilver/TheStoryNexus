import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            refetchOnWindowFocus: false,
            // A 4xx is a definite answer (not found, invalid) — retrying only
            // delays the error the writer needs to see. Network/5xx get two
            // quick retries.
            retry: (failureCount, error) => {
                const status = (error as { status?: number }).status;
                if (status !== undefined && status >= 400 && status < 500) return false;
                return failureCount < 2;
            }
        }
    }
});

export const QueryProvider = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
