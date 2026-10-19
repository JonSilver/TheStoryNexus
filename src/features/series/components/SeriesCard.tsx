import { BookOpen, Download, Trash2 } from "lucide-react";
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
                <a
                    href={`/api/series/${series.id}/export`}
                    download
                    aria-label={`Export ${series.name}`}
                    title="Download a JSON backup of the whole series"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
                    onClick={e => e.stopPropagation()}
                >
                    <Download className="w-4 h-4" />
                </a>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${series.name}`}
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
