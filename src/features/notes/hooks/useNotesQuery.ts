import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { notesApi } from "@/services/api/client";
import type { Note } from "@/types/story";

// Query keys
const notesKeys = {
    all: ["notes"] as const,
    byStory: (storyId: string) => ["notes", "story", storyId] as const,
    detail: (id: string) => ["notes", id] as const
};

// Fetch notes by story
export const useNotesByStoryQuery = (storyId: string) =>
    useQuery({
        queryKey: notesKeys.byStory(storyId),
        queryFn: () => notesApi.getByStory(storyId),
        enabled: !!storyId
    });

// Fetch single note
export const useNoteQuery = (id: string) =>
    useQuery({
        queryKey: notesKeys.detail(id),
        queryFn: () => notesApi.getById(id),
        enabled: !!id
    });

// Create note mutation
export const useCreateNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: notesApi.create,
        onSuccess: newNote => {
            queryClient.invalidateQueries({ queryKey: notesKeys.byStory(newNote.storyId) });
            toast.success("Note created successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to create note: ${error.message}`);
        }
    });
};

// Update note mutation
export const useUpdateNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Note> }) => notesApi.update(id, data),
        onSuccess: (updatedNote, variables) => {
            queryClient.setQueryData(notesKeys.detail(variables.id), updatedNote);
            queryClient.setQueryData<Note[]>(notesKeys.byStory(updatedNote.storyId), old =>
                old?.map(n => (n.id === updatedNote.id ? updatedNote : n))
            );
            toast.success("Note saved successfully");
        },
        onError: () => {
            toast.error("Failed to save note");
        }
    });
};

// Delete note mutation
export const useDeleteNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: notesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notesKeys.all });
            toast.success("Note deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete note: ${error.message}`);
        }
    });
};
