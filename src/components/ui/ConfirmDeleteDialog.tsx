import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description: string;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

export const ConfirmDeleteDialog = ({
    open,
    onOpenChange,
    title = "Are you sure?",
    description,
    onConfirm,
    confirmLabel = "Delete",
    cancelLabel = "Cancel"
}: ConfirmDeleteDialogProps) => (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);
