import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/client";
import { demoKeys } from "@/services/api/queryKeys";

export const useDemoExistsQuery = () =>
    useQuery({ queryKey: demoKeys.exists, queryFn: async () => (await adminApi.checkDemoExists()).exists });

/** The sample story touches stories, chapters, bible and series: everything refreshes. */
const useDemoWrite = <TResult>(mutationFn: () => Promise<TResult>, failure: string) => {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries(), meta: { failure } });
};

export const useRestoreDemoMutation = () => useDemoWrite(adminApi.importDemoData, "Couldn't restore the sample story");

export const useDeleteDemoDataMutation = () => useDemoWrite(adminApi.deleteDemoData, "Couldn't delete the demo data");
