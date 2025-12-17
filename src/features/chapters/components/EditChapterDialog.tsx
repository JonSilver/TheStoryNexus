import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LorebookEntry } from "@/types/story";

type POVType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface EditChapterForm {
    title: string;
    povCharacter?: string;
    povType?: POVType;
}

interface EditChapterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chapter: {
        title: string;
        povCharacter?: string;
        povType?: POVType;
    };
    characterEntries: LorebookEntry[];
    onSubmit: (data: EditChapterForm) => void;
}

export const EditChapterDialog = ({
    open,
    onOpenChange,
    chapter,
    characterEntries,
    onSubmit
}: EditChapterDialogProps) => {
    const form = useForm<EditChapterForm>();
    const povType = form.watch("povType");

    // Reset form when dialog opens
    useEffect(() => {
        if (open)
            form.reset({
                title: chapter.title,
                povCharacter: chapter.povCharacter,
                povType: chapter.povType || "Third Person Omniscient"
            });
    }, [open, chapter, form]);

    const handleSubmit = (data: EditChapterForm) => {
        const povCharacter = data.povType !== "Third Person Omniscient" ? data.povCharacter : undefined;
        onSubmit({ ...data, povCharacter });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <DialogHeader>
                        <DialogTitle>Edit Chapter</DialogTitle>
                        <DialogDescription>Make changes to your chapter details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                placeholder="Enter chapter title"
                                {...form.register("title", { required: true })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="povType">POV Type</Label>
                            <Select
                                defaultValue={chapter.povType || "Third Person Omniscient"}
                                onValueChange={value => {
                                    form.setValue("povType", value as POVType);
                                    if (value === "Third Person Omniscient") form.setValue("povCharacter", undefined);
                                }}
                            >
                                <SelectTrigger id="povType">
                                    <SelectValue placeholder="Select POV type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="First Person">First Person</SelectItem>
                                    <SelectItem value="Third Person Limited">Third Person Limited</SelectItem>
                                    <SelectItem value="Third Person Omniscient">Third Person Omniscient</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {povType && povType !== "Third Person Omniscient" && (
                            <div className="grid gap-2">
                                <Label htmlFor="povCharacter">POV Character</Label>
                                <Select
                                    value={form.getValues("povCharacter")}
                                    onValueChange={value => form.setValue("povCharacter", value)}
                                >
                                    <SelectTrigger id="povCharacter">
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characterEntries.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                No characters available
                                            </SelectItem>
                                        ) : (
                                            characterEntries.map(character => (
                                                <SelectItem key={character.id} value={character.name}>
                                                    {character.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
