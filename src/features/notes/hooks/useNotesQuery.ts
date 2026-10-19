import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi } from "@/services/api/client";
import { notesKeys } from "@/services/api/queryKeys";
import type { Note } from "@/types/story";

export const useNotesByStoryQuery = (storyId: string) =>
    useQuery({
        queryKey: notesKeys.byStory(storyId),
        queryFn: () => notesApi.getByStory(storyId),
        enabled: !!storyId
    });

/** Text kept from elsewhere in the app (a brainstorm reply, a quick jot) as an idea, titled by its first line. */
export const ideaNote = (storyId: string, text: string) => ({
    storyId,
    title: text.trim().split("\n")[0].slice(0, 60),
    content: text,
    type: "idea" as const
});

export const useCreateNoteMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: notesApi.create,
        onSuccess: note => queryClient.invalidateQueries({ queryKey: notesKeys.byStory(note.storyId) }),
        meta: { failure: "Couldn't save the note" }
    });
};

export const useUpdateNoteMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Note> }) => notesApi.update(id, data),
        onSuccess: note =>
            queryClient.setQueryData<Note[]>(notesKeys.byStory(note.storyId), old =>
                old?.map(n => (n.id === note.id ? note : n))
            ),
        meta: { failure: "Couldn't save the note" }
    });
};

export const useDeleteNoteMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: notesApi.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKeys.all }),
        meta: { failure: "Couldn't delete the note" }
    });
};
