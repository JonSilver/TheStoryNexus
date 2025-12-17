import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";

interface DeleteChapterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chapterOrder: number;
    chapterTitle: string;
    onDelete: () => void;
}

export const DeleteChapterDialog = ({
    open,
    onOpenChange,
    chapterOrder,
    chapterTitle,
    onDelete
}: DeleteChapterDialogProps) => (
    <ConfirmDeleteDialog
        open={open}
        onOpenChange={onOpenChange}
        description={`This will permanently delete Chapter ${chapterOrder}: ${chapterTitle}. This action cannot be undone.`}
        onConfirm={onDelete}
    />
);
