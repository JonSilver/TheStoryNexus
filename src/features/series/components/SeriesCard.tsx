import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Series } from "@/types/story";

interface SeriesCardProps {
    series: Series;
    onDelete: () => void;
    onClick: () => void;
}

export const SeriesCard = ({ series, onDelete, onClick }: SeriesCardProps) => (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        {series.name}
                    </CardTitle>
                    {series.description && <CardDescription className="mt-2">{series.description}</CardDescription>}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </CardHeader>
    </Card>
);
