import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { SeriesForm } from "./SeriesForm";

export const CreateSeriesDialog = () => {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="w-64">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create New Series
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Series</DialogTitle>
                    <DialogDescription>
                        Create a series to group related stories and share lorebook entries.
                    </DialogDescription>
                </DialogHeader>
                <SeriesForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
};
