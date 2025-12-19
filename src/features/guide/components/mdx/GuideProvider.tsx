import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Children, isValidElement, type JSX, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ElementProps<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

// Map GitHub alert types to our Alert component styling
const alertConfig: Record<string, { icon: typeof Info; className: string; title: string }> = {
    tip: { icon: Lightbulb, className: "", title: "Tip" },
    warning: { icon: AlertTriangle, className: "bg-destructive/10 border-destructive", title: "Warning" },
    important: { icon: Info, className: "bg-primary/10 border-primary", title: "Important" },
    note: { icon: Info, className: "", title: "Note" },
    caution: { icon: AlertTriangle, className: "bg-destructive/10 border-destructive", title: "Caution" }
};

// Filter out the plugin's title element (p.markdown-alert-title) from children
const filterAlertChildren = (children: ReactNode): ReactNode[] =>
    Children.toArray(children).filter(child => {
        if (!isValidElement(child)) return true;
        const className = (child.props as { className?: string }).className;
        return !className?.includes("markdown-alert-title");
    });

/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */
const mdxComponents = {
    h1: (props: ElementProps<"h1">) => <h1 className="text-2xl font-bold mb-4" {...props} />,
    h2: (props: ElementProps<"h2">) => <h2 className="text-xl font-semibold mt-8 mb-4" {...props} />,
    h3: (props: ElementProps<"h3">) => <h3 className="text-lg font-medium mt-6 mb-3" {...props} />,
    h4: (props: ElementProps<"h4">) => <h4 className="font-medium mt-4 mb-2" {...props} />,
    p: (props: ElementProps<"p">) => <p className="text-muted-foreground mb-4" {...props} />,
    ul: (props: ElementProps<"ul">) => <ul className="list-disc list-outside space-y-1 ml-6 mb-4" {...props} />,
    ol: (props: ElementProps<"ol">) => <ol className="list-decimal list-outside space-y-2 ml-6 mb-4" {...props} />,
    li: (props: ElementProps<"li">) => <li className="pl-2" {...props} />,
    table: (props: ElementProps<"table">) => (
        <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse" {...props} />
        </div>
    ),
    thead: (props: ElementProps<"thead">) => <thead className="bg-muted" {...props} />,
    th: (props: ElementProps<"th">) => <th className="border p-2 text-left" {...props} />,
    td: (props: ElementProps<"td">) => <td className="border p-2" {...props} />,
    code: (props: ElementProps<"code">) => (
        <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono" {...props} />
    ),
    pre: (props: ElementProps<"pre">) => (
        <pre className="bg-muted p-4 rounded-md overflow-x-auto mb-4 text-sm" {...props} />
    ),
    blockquote: (props: ElementProps<"blockquote">) => (
        <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 text-muted-foreground" {...props} />
    ),
    strong: (props: ElementProps<"strong">) => <strong className="font-semibold" {...props} />,
    a: (props: ElementProps<"a">) => <a className="text-primary underline hover:no-underline" {...props} />,
    // Handle GitHub alert divs from remark-github-blockquote-alert
    div: ({ className, children, ...props }: ElementProps<"div">) => {
        // Check for markdown-alert classes
        const alertType = Object.keys(alertConfig).find(type =>
            className?.includes(`markdown-alert-${type}`)
        );

        if (alertType && className?.includes("markdown-alert")) {
            const config = alertConfig[alertType];
            const Icon = config.icon;
            const filteredChildren = filterAlertChildren(children);
            return (
                <Alert className={config.className}>
                    <Icon className="h-4 w-4" />
                    <AlertTitle>{config.title}</AlertTitle>
                    <AlertDescription>{filteredChildren}</AlertDescription>
                </Alert>
            );
        }

        return <div className={className} {...props}>{children}</div>;
    }
};
/* eslint-enable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

export const GuideProvider = ({ children }: { children: ReactNode }) => (
    <div className="space-y-6">{children}</div>
);

export { mdxComponents };
