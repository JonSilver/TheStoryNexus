import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown rendering for AI output and notes. Styled explicitly per element
 * (no typography plugin in the build) so it follows the theme tokens.
 */
export const MarkdownView = ({ children }: { children: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            h1: props => <h1 className="mb-2 mt-3 text-lg font-bold first:mt-0" {...props} />,
            h2: props => <h2 className="mb-1.5 mt-3 text-base font-bold first:mt-0" {...props} />,
            h3: props => <h3 className="mb-1 mt-2 font-semibold first:mt-0" {...props} />,
            p: props => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props} />,
            ul: props => <ul className="my-1.5 list-disc pl-5" {...props} />,
            ol: props => <ol className="my-1.5 list-decimal pl-5" {...props} />,
            li: props => <li className="my-0.5" {...props} />,
            blockquote: props => (
                <blockquote className="my-1.5 border-l-2 border-muted-foreground/40 pl-3 italic" {...props} />
            ),
            code: props => <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...props} />,
            a: props => <a className="underline" target="_blank" rel="noreferrer" {...props} />,
            hr: () => <hr className="my-2 border-t" />
        }}
    >
        {children}
    </ReactMarkdown>
);
