import type { LucideIcon } from "lucide-react";
import { ExternalLink, Lightbulb, AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export { GuideProvider, mdxComponents } from "./GuideProvider";

// Step component for numbered instructions
export const Step = ({
    number,
    title,
    children
}: {
    number: number;
    title: string;
    children: ReactNode;
}) => (
    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
        <h3 className="text-xl font-semibold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">
                {number}
            </span>
            {title}
        </h3>
        <div className="space-y-4">{children}</div>
    </div>
);

// Alert variants
export const Tip = ({ title = "Tip", children }: { title?: string; children: ReactNode }) => (
    <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
    </Alert>
);

export const Warning = ({ title = "Warning", children }: { title?: string; children: ReactNode }) => (
    <Alert className="bg-destructive/10 border-destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
    </Alert>
);

export const Important = ({ title = "Important", children }: { title?: string; children: ReactNode }) => (
    <Alert className="bg-primary/10 border-primary">
        <Info className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
    </Alert>
);

// Alert with custom icon
export const AlertBox = ({
    icon: Icon,
    title,
    variant = "default",
    children
}: {
    icon?: LucideIcon;
    title: string;
    variant?: "default" | "primary" | "destructive";
    children: ReactNode;
}) => {
    const variantClasses = {
        default: "",
        primary: "bg-primary/10 border-primary",
        destructive: "bg-destructive/10 border-destructive"
    };
    return (
        <Alert className={variantClasses[variant]}>
            {Icon && <Icon className="h-4 w-4" />}
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{children}</AlertDescription>
        </Alert>
    );
};

// Feature card for showcasing features
export const FeatureCard = ({
    icon: Icon,
    title,
    children
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
}) => (
    <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5 text-primary" />
            <h4 className="font-medium">{title}</h4>
        </div>
        <p className="text-sm text-muted-foreground">{children}</p>
    </div>
);

// Feature grid container
export const FeatureGrid = ({
    cols = 3,
    children
}: {
    cols?: 2 | 3;
    children: ReactNode;
}) => {
    const gridCols = cols === 2 ? "md:grid-cols-2" : "sm:grid-cols-2 md:grid-cols-3";
    return <div className={`grid grid-cols-1 ${gridCols} gap-4 mt-4`}>{children}</div>;
};

// Navigation button with link
export const NavButton = ({ to, children }: { to: string; children: ReactNode }) => (
    <Link to={to}>
        <Button variant="outline" className="gap-1">
            {children}
            <ExternalLink className="h-3 w-3" />
        </Button>
    </Link>
);

// Inline navigation buttons container
export const NavButtons = ({ children }: { children: ReactNode }) => (
    <div className="flex items-center gap-4 my-4">{children}</div>
);

// Keyboard shortcut display
export const Key = ({ children }: { children: ReactNode }) => (
    <kbd className="px-2 py-1 bg-background rounded border text-sm">{children}</kbd>
);

// Card with header and content
export const InfoCard = ({
    icon: Icon,
    title,
    children
}: {
    icon?: LucideIcon;
    title: string;
    children: ReactNode;
}) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5 text-primary" />}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

// Two-column card grid
export const CardGrid = ({ children }: { children: ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">{children}</div>
);

// Code example block
export const CodeExample = ({ title, children }: { title?: string; children: ReactNode }) => (
    <div className="bg-muted p-4 rounded-md">
        {title && <h5 className="font-medium text-sm mb-2">{title}</h5>}
        <div className="font-mono text-sm">{children}</div>
    </div>
);

// Summary box at the end of sections
export const Summary = ({ title = "What's Next?", children }: { title?: string; children: ReactNode }) => (
    <div className="mt-8 p-6 border rounded-lg bg-muted/30">
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        <div className="space-y-4">{children}</div>
    </div>
);

// Numbered workflow/process steps
export const ProcessStep = ({
    number,
    title,
    children
}: {
    number: number;
    title: string;
    children: ReactNode;
}) => (
    <div className="relative">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center absolute -left-12">
            {number}
        </div>
        <div className="border rounded-lg p-4 bg-card">
            <h5 className="font-medium">{title}</h5>
            <p className="text-sm text-muted-foreground mt-1">{children}</p>
        </div>
    </div>
);

// Workflow container with vertical line
export const Workflow = ({ children }: { children: ReactNode }) => (
    <div className="relative overflow-hidden mt-4">
        <div className="border-l-2 border-primary absolute h-full left-4 top-0" />
        <div className="space-y-6 ml-10">{children}</div>
    </div>
);

// SubStep for nested instructions
export const SubStep = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
        <h4 className="text-lg font-medium">{title}</h4>
        <div className="space-y-2">{children}</div>
    </div>
);

// Message example for prompt messages
export const MessageExample = ({
    icon: Icon,
    title,
    example,
    description
}: {
    icon: LucideIcon;
    title: string;
    example: string;
    description: string;
}) => (
    <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5 text-primary" />
            <h5 className="font-medium">{title}</h5>
        </div>
        <p className="text-sm">{description}</p>
        <div className="bg-muted p-3 rounded mt-2 text-sm">
            <p className="font-mono">{example}</p>
        </div>
    </div>
);
