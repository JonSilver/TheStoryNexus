import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "react-toastify";

declare module "@tanstack/react-query" {
    interface Register {
        mutationMeta: {
            /**
             * What failed, in the writer's words — reported once, here, with the
             * cause. `false` when the caller reports failures itself (batches,
             * partial outcomes). Omitted, a failure still surfaces generically.
             */
            failure?: string | false;
        };
    }
}

const mutationCache = new MutationCache({
    onError: (error, _variables, _result, mutation) => {
        const failure = mutation.meta?.failure;
        if (failure === false) return;
        const what = failure ?? "Something went wrong";
        toast.error(error.message ? `${what}: ${error.message}` : what);
    }
});

const queryClient = new QueryClient({
    mutationCache,
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
