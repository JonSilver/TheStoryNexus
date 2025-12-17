import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
    <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        description={`This will permanently delete Chapter ${chapterOrder}: ${chapterTitle}. This action cannot be undone.`}
        onConfirm={onDelete}
        confirmLabel="Delete"
    />
);
