# Issue #64 Research: Making the Guide Maintainable

## Problem Statement

The current Guide feature contains ~3,300 lines of JSX documentation spread across 5 component files:
- `PromptGuide.tsx` - 1,062 lines
- `AdvancedGuide.tsx` - 855 lines
- `LorebookGuide.tsx` - 826 lines
- `BasicsGuide.tsx` - 293 lines
- `BrainstormGuide.tsx` - 259 lines

**Pain points:**
1. Writing documentation in JSX creates friction for content authors
2. Verbose syntax for simple text content
3. Mix of presentation and content hinders editing
4. Requires React/JSX knowledge to update docs
5. Changes require recompilation

**Goal:** Write documentation in Markdown files, transform to JSX at build time, whilst preserving custom component aesthetics.

---

## Current Guide Patterns

The existing guides use these UI patterns:

| Pattern | Components | Usage |
|---------|------------|-------|
| Alerts | `<Alert>`, `<AlertTitle>`, `<AlertDescription>` | Tips, warnings, important notes |
| Cards | `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>` | Feature boxes, grouped content |
| Numbered steps | Custom badge + border-l styling | Sequential instructions |
| Tabs | `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` | Nested content sections (PromptGuide) |
| Feature grids | Grid layouts with icon + title + description | Feature showcases |
| Keyboard shortcuts | `<kbd>` elements | Key combinations |
| Route links | `<Link to="/path">` + `<Button>` | Navigation buttons |
| Icons | lucide-react icons | Visual indicators |
| Tables | Standard HTML tables | Variable documentation |
| Code blocks | `<pre>` / monospace divs | Examples, templates |

---

## Solution Options

### Option A: MDX via `@mdx-js/rollup` (Recommended)

**What it is:** MDX is Markdown + JSX. Write prose in Markdown, embed React components inline.

**Installation:**
```bash
npm install @mdx-js/rollup
```

**Vite Configuration:**
```typescript
import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx() },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ })
  ]
})
```

**Sample MDX file:**
```mdx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

# The Absolute Basics

Welcome to The Story Nexus! This guide will walk you through the essential steps...

<Alert className="bg-primary/10 border-primary">
  <Sparkles className="h-4 w-4" />
  <AlertTitle>Quick Start (5 Minutes)</AlertTitle>
  <AlertDescription>
    1. Go to AI Settings → Add an API key
    2. Go to Stories → Create New Story
    3. Click "Write" button → Start typing
  </AlertDescription>
</Alert>

## Step 1: Set Up Your AI Connection

Before you can use AI features, you'll need to connect to an AI provider.

<Link to="/ai-settings">
  <Button variant="outline">Go to AI Settings</Button>
</Link>
```

**Pros:**
- Industry standard for React + Markdown
- Project already uses remark/rehype plugins (natural fit)
- Full React component support inline
- Excellent tooling, syntax highlighting, IDE support
- Frontmatter support for metadata
- Hot Module Replacement works

**Cons:**
- Still requires knowing which components to import
- Some JSX verbosity remains for complex layouts

---

### Option B: `vite-plugin-react-markdown`

**What it is:** Compiles Markdown to React components using markdown-it.

**Installation:**
```bash
npm install vite-plugin-react-markdown
```

**Pros:**
- Simpler than MDX for basic Markdown
- Can inject wrapper components

**Cons:**
- Less mature than MDX ecosystem
- Limited component embedding compared to MDX
- Fewer IDE tools

---

### Option C: Custom Component Shortcodes in MDX

Extend Option A with custom shortcode components to reduce boilerplate.

**Create shorthand components:**
```tsx
// src/features/guide/components/mdx/index.tsx
export const Tip = ({ children, title = "Tip" }) => (
  <Alert>
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
)

export const Step = ({ number, title, children }) => (
  <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
    <h3 className="text-xl font-semibold flex items-center gap-2">
      <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
        {number}
      </span>
      {title}
    </h3>
    {children}
  </div>
)

export const FeatureCard = ({ icon: Icon, title, children }) => (
  <div className="border rounded-lg p-4 bg-card">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h4 className="font-medium">{title}</h4>
    </div>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
)

export const NavButton = ({ to, children }) => (
  <Link to={to}>
    <Button variant="outline" className="gap-1">
      {children}
      <ExternalLink className="h-3 w-3" />
    </Button>
  </Link>
)
```

**Resulting MDX becomes much cleaner:**
```mdx
import { Tip, Step, FeatureCard, NavButton } from './mdx'
import { Bot, BookOpen, PenLine } from 'lucide-react'

# The Absolute Basics

Welcome to The Story Nexus!

<Tip title="Quick Start (5 Minutes)">
  1. Go to AI Settings → Add an API key
  2. Create a new story
  3. Start writing!
</Tip>

<Step number={1} title="Set Up Your AI Connection">
  Before you can use AI features, connect to an AI provider.

  <NavButton to="/ai-settings">Go to AI Settings</NavButton>

  <div className="grid grid-cols-3 gap-4 mt-4">
    <FeatureCard icon={Bot} title="OpenRouter">
      Access a variety of models from different providers.
    </FeatureCard>
    <FeatureCard icon={Bot} title="OpenAI">
      Access models like GPT-4 and GPT-3.5.
    </FeatureCard>
    <FeatureCard icon={Bot} title="Local">
      Connect to a locally hosted model.
    </FeatureCard>
  </div>
</Step>
```

**Pros:**
- Dramatically reduces verbosity
- Consistent styling enforced by components
- Writers focus on content, not markup
- Components can evolve without touching content

**Cons:**
- Initial investment to build shortcode library
- Writers must know available shortcodes

---

### Option D: MDX Provider for Global Component Mapping

Use `MDXProvider` to automatically map standard Markdown elements to custom components.

```tsx
// src/features/guide/components/MDXProvider.tsx
import { MDXProvider } from '@mdx-js/react'

const components = {
  // Map standard elements to custom versions
  h1: (props) => <h1 className="text-2xl font-bold mb-4" {...props} />,
  h2: (props) => <h2 className="text-xl font-semibold mt-8 mb-4" {...props} />,
  p: (props) => <p className="text-muted-foreground mb-4" {...props} />,
  ul: (props) => <ul className="list-disc list-inside space-y-1 ml-4" {...props} />,
  ol: (props) => <ol className="list-decimal list-inside space-y-2 ml-4" {...props} />,
  blockquote: (props) => <Alert {...props} />,
  table: (props) => <table className="w-full border-collapse" {...props} />,
  th: (props) => <th className="border p-2 text-left bg-muted" {...props} />,
  td: (props) => <td className="border p-2" {...props} />,
  code: (props) => <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono" {...props} />,
  kbd: (props) => <kbd className="px-2 py-1 bg-background rounded border" {...props} />,
}

export const GuideProvider = ({ children }) => (
  <MDXProvider components={components}>
    <div className="space-y-8">{children}</div>
  </MDXProvider>
)
```

**This allows pure Markdown for basic content:**
```mdx
## Step 1: Set Up Your AI Connection

Before you can use AI features, you'll need to connect to an AI provider.

| Provider | Description |
|----------|-------------|
| OpenRouter | Access various models |
| OpenAI | GPT-4, GPT-3.5 |
| Local | Local models via API |

Press `Alt + S` to insert a Scene Beat.
```

---

## Recommended Approach

**Combine Options A, C, and D:**

1. **Use MDX via `@mdx-js/rollup`** for the foundation
2. **Create shortcode components** for repeated patterns (Step, Tip, FeatureCard, etc.)
3. **Use MDXProvider** to style standard Markdown elements consistently
4. **Keep complex layouts** (like nested Tabs in PromptGuide) as React components imported into MDX

**File Structure:**
```
src/features/guide/
├── components/
│   ├── mdx/
│   │   ├── index.tsx          # Shortcode exports
│   │   ├── Step.tsx
│   │   ├── Tip.tsx
│   │   ├── Warning.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── NavButton.tsx
│   │   └── GuideProvider.tsx  # MDXProvider wrapper
│   └── GuideTabs.tsx          # For PromptGuide nested tabs
├── content/
│   ├── basics.mdx
│   ├── advanced.mdx
│   ├── lorebook.mdx
│   ├── prompts.mdx
│   └── brainstorm.mdx
├── pages/
│   └── GuidePage.tsx          # Imports MDX files
└── types/
    └── mdx.d.ts               # TypeScript declarations
```

---

## Implementation Plan

### Phase 1: Setup Infrastructure
1. Install `@mdx-js/rollup`
2. Configure Vite for MDX
3. Add TypeScript declarations for `.mdx` files
4. Create `GuideProvider` with element mappings

### Phase 2: Build Shortcode Library
1. Create `Step` component (numbered steps with border)
2. Create `Tip`, `Warning`, `Important` alert variants
3. Create `FeatureCard` and `FeatureGrid` components
4. Create `NavButton` for route links
5. Create `KeyCombo` for keyboard shortcuts
6. Export all from `mdx/index.tsx`

### Phase 3: Migrate Content (per guide)
1. Start with `BasicsGuide` (smallest, 293 lines)
2. Extract content to `basics.mdx`
3. Replace JSX with shortcodes + Markdown
4. Test thoroughly
5. Repeat for remaining guides

### Phase 4: Cleanup
1. Remove old `.tsx` guide components
2. Update `GuidePage.tsx` to import MDX
3. Run Knip to find any orphaned code
4. Update any documentation

---

## Estimated Complexity

| Phase | Effort |
|-------|--------|
| Phase 1: Infrastructure | Low - standard Vite plugin setup |
| Phase 2: Shortcode Library | Medium - ~10 components to build |
| Phase 3: Content Migration | High - 3,300 lines to convert |
| Phase 4: Cleanup | Low - delete old files |

**Risk Factors:**
- Nested Tabs in PromptGuide may need special handling
- Some complex grid layouts may remain verbose in MDX
- TypeScript types for MDX imports need care

---

## References

- [MDX Official Documentation](https://mdxjs.com/)
- [@mdx-js/rollup Package](https://mdxjs.com/packages/rollup/)
- [Vite Plugin MDX](https://github.com/brillout/vite-plugin-mdx)
- [vite-plugin-react-markdown](https://github.com/geekris1/vite-plugin-react-markdown)
