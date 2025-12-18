import { Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

interface SearchFilterRenderProps<T> {
    filteredItems: T[];
    searchInput: ReactNode;
}

interface SearchFilterProps<T> {
    items: T[];
    predicate: (item: T, term: string) => boolean;
    placeholder?: string;
    inputClassName?: string;
    children: (props: SearchFilterRenderProps<T>) => ReactNode;
}

export const SearchFilter = <T,>({
    items,
    predicate,
    placeholder = "Search...",
    inputClassName,
    children
}: SearchFilterProps<T>) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredItems = useMemo(
        () => (searchTerm ? items.filter(item => predicate(item, searchTerm.toLowerCase())) : items),
        [items, searchTerm, predicate]
    );

    const searchInput = (
        <div className={`relative w-64 ${inputClassName ?? ""}`}>
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder={placeholder}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 border-2 border-gray-300 dark:border-gray-700"
            />
        </div>
    );

    return <>{children({ filteredItems, searchInput })}</>;
};
