import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LorebookEntry } from "@/types/story";

type POVType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface CreateChapterForm {
    title: string;
    povCharacter?: string;
    povType?: POVType;
}

interface CreateChapterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    characterEntries: LorebookEntry[];
    onSubmit: (data: CreateChapterForm) => void;
}

export const CreateChapterDialog = ({ open, onOpenChange, characterEntries, onSubmit }: CreateChapterDialogProps) => {
    const form = useForm<CreateChapterForm>({
        defaultValues: {
            povType: "Third Person Omniscient"
        }
    });

    const povType = form.watch("povType");

    const handlePovTypeChange = (value: string) => {
        form.setValue("povType", value as POVType);
        if (value === "Third Person Omniscient") form.setValue("povCharacter", undefined);
    };

    const handleSubmit = (data: CreateChapterForm) => {
        onSubmit(data);
        form.reset({
            title: "",
            povType: "Third Person Omniscient",
            povCharacter: undefined
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Chapter
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <DialogHeader>
                        <DialogTitle>Create New Chapter</DialogTitle>
                        <DialogDescription>
                            Add a new chapter to your story. You can edit the content after creating it.
                        </DialogDescription>
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
                            <Select defaultValue="Third Person Omniscient" onValueChange={handlePovTypeChange}>
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
                                <Select onValueChange={value => form.setValue("povCharacter", value)}>
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
                        <Button type="submit">Create Chapter</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export type { CreateChapterForm, POVType };
