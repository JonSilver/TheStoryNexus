# Task 12: Story Form - Series Selection

## Objective

Add series dropdown to story creation and editing forms.

## Context

- Allow users to assign stories to a series (optional)
- Display "None" option for stories without series
- Update story mutations to include seriesId field

## Dependencies

- **Task 02**: Updated Story type with seriesId
- **Task 07**: Series query hooks
- **Existing**: Story form components

## File Locations

- **Modify**: `src/features/stories/components/StoryForm.tsx` (or wherever story create/edit form lives)

## Implementation Steps

### 1. Update StoryForm Component

Add series selection dropdown:

```typescript
// In src/features/stories/components/StoryForm.tsx
import { useSeriesQuery } from '@/features/series/hooks/useSeriesQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface StoryFormProps {
    story?: Story;  // For editing
    onSuccess?: () => void;
}

export const StoryForm = ({ story, onSuccess }: StoryFormProps) => {
    const { data: seriesList } = useSeriesQuery();
    const createMutation = useCreateStoryMutation();
    const updateMutation = useUpdateStoryMutation();

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StoryFormData>({
        defaultValues: {
            title: story?.title || '',
            author: story?.author || '',
            language: story?.language || 'en',
            synopsis: story?.synopsis || '',
            seriesId: story?.seriesId || undefined,  // NEW
        },
    });

    const selectedSeriesId = watch('seriesId');

    const onSubmit = async (data: StoryFormData) => {
        if (story) {
            await updateMutation.mutateAsync({ id: story.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
        onSuccess?.();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Existing fields: title, author, language, synopsis */}
            <div>
                <Label htmlFor="title">Title</Label>
                <Input
                    id="title"
                    {...register('title', { required: 'Title is required' })}
                    placeholder="Story title"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div>
                <Label htmlFor="author">Author</Label>
                <Input
                    id="author"
                    {...register('author', { required: 'Author is required' })}
                    placeholder="Author name"
                />
                {errors.author && <p className="text-sm text-destructive">{errors.author.message}</p>}
            </div>

            <div>
                <Label htmlFor="language">Language</Label>
                <Input
                    id="language"
                    {...register('language')}
                    placeholder="Language code (e.g., en)"
                />
            </div>

            {/* NEW: Series selection */}
            <div>
                <Label htmlFor="series">Series (optional)</Label>
                <Select
                    value={selectedSeriesId || 'none'}
                    onValueChange={(value) => setValue('seriesId', value === 'none' ? undefined : value)}
                >
                    <SelectTrigger id="series">
                        <SelectValue placeholder="Select series" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {seriesList?.map((series) => (
                            <SelectItem key={series.id} value={series.id}>
                                {series.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                    Assign this story to a series to share lorebook entries
                </p>
            </div>

            <div>
                <Label htmlFor="synopsis">Synopsis (optional)</Label>
                <Textarea
                    id="synopsis"
                    {...register('synopsis')}
                    placeholder="Brief story synopsis"
                    rows={4}
                />
            </div>

            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {story ? 'Update' : 'Create'} Story
            </Button>
        </form>
    );
};
```

### 2. Update StoryFormData Type

```typescript
// In same file or types file
interface StoryFormData {
    title: string;
    author: string;
    language: string;
    synopsis?: string;
    seriesId?: string; // NEW
}
```

### 3. Update Story Mutations (if needed)

Ensure mutations handle seriesId field:

```typescript
// In src/features/stories/hooks/useStoriesQuery.ts

export const useCreateStoryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Omit<Story, "id" | "createdAt">) => storiesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stories"] });
        }
    });
};

export const useUpdateStoryMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Story> }) => storiesApi.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["stories", variables.id] });
            queryClient.invalidateQueries({ queryKey: ["stories"] });
            // Also invalidate series queries if seriesId changed
            if (variables.data.seriesId) {
                queryClient.invalidateQueries({ queryKey: ["series", variables.data.seriesId, "stories"] });
            }
        }
    });
};
```

### 4. Display Series in Story List/Card (Optional Enhancement)

```typescript
// In src/features/stories/components/StoryCard.tsx

export const StoryCard = ({ story }: { story: Story }) => {
    const { data: series } = useSingleSeriesQuery(story.seriesId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{story.title}</CardTitle>
                <CardDescription>
                    {series && (
                        <Badge variant="secondary" className="mb-2">
                            Series: {series.name}
                        </Badge>
                    )}
                    {story.synopsis}
                </CardDescription>
            </CardHeader>
        </Card>
    );
};
```

### 5. Add Series Filter to Story List (Optional Enhancement)

```typescript
// In src/features/stories/pages/StoryListPage.tsx

export const StoryListPage = () => {
    const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string | 'all'>('all');
    const { data: stories } = useStoriesQuery();
    const { data: seriesList } = useSeriesQuery();

    const filteredStories = stories?.filter((story) => {
        if (selectedSeriesFilter === 'all') return true;
        if (selectedSeriesFilter === 'none') return !story.seriesId;
        return story.seriesId === selectedSeriesFilter;
    });

    return (
        <div>
            {/* Series filter dropdown */}
            <Select value={selectedSeriesFilter} onValueChange={setSelectedSeriesFilter}>
                <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by series" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Stories</SelectItem>
                    <SelectItem value="none">No Series</SelectItem>
                    {seriesList?.map((series) => (
                        <SelectItem key={series.id} value={series.id}>
                            {series.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Story cards */}
            {filteredStories?.map((story) => (
                <StoryCard key={story.id} story={story} />
            ))}
        </div>
    );
};
```

## Component Summary

After implementation:

**Modified Components:**

- `StoryForm` - Series dropdown selection

**Optional Enhancements:**

- `StoryCard` - Display series badge
- `StoryListPage` - Filter stories by series

## Validation

- Story form displays series dropdown with all available series
- "None" option deselects series
- Creating story with series sets seriesId correctly
- Editing story preserves existing series selection
- Changing story series updates series stories list
- Form validation allows series to be optional

## Notes

- Series selection is optional (stories can exist without series)
- Series dropdown loads all available series
- Consider adding "Create New Series" quick action in dropdown (advanced)
- Changing story series updates multiple query caches
