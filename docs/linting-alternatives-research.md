# Linting Alternatives Research

## Current Setup

- **ESLint 9** with flat config
- **Prettier** via `eslint-plugin-prettier`
- **TypeScript-eslint** for TS rules (`no-explicit-any`, `no-unused-vars`)
- **react-hooks** plugin for `rules-of-hooks`, `exhaustive-deps`
- **react-hooks-addons** for `no-unused-deps`

Key pain point: ESLint is slow (single-threaded JS, massive plugin ecosystem overhead).

---

## Alternatives Comparison

| Feature | ESLint | Biome | Oxlint |
|---------|--------|-------|--------|
| **Speed** | Baseline | 10-25x faster | 50-100x faster |
| **Rules** | 1000+ via plugins | 200+ built-in | 520+ built-in |
| **Formatting** | Needs Prettier | Built-in | No (linting only) |
| **Type-aware** | Full (typescript-eslint) | ~85% coverage | Planned via tsgo |
| **Autofix** | Comprehensive | Good, but gaps | Good, but gaps |
| **React hooks** | Full support | Has differences | Good support |
| **Config** | JS (flexible) | JSON only | JSON |

---

## Option 1: Full Biome Migration

**Pros:**
- 10-25x faster than ESLint+Prettier
- Single tool replaces both linting and formatting
- One config file (`biome.json`) instead of multiple
- Single binary (no node_modules sprawl)
- Built-in migration commands: `biome migrate eslint`, `biome migrate prettier`
- Next.js 15.5+ officially recommends Biome

**Cons:**
- `useExhaustiveDependencies` has no quick-fix autofix in VS Code (confirmed issue)
- Stricter than ESLint's `exhaustive-deps` - flags "unnecessary" deps that ESLint allows
- ~85% type-aware rule coverage vs typescript-eslint's 100%
- Recent bugs in hooks rules (May 2025)
- JSON config only - no dynamic configuration

**Migration effort:** Low-medium. `biome migrate` handles ~70% automatically.

---

## Option 2: Oxlint (Linting Only)

**Pros:**
- 50-100x faster than ESLint (fastest option)
- 520+ rules including react-hooks
- Can run alongside ESLint via `eslint-plugin-oxlint`
- Good autofix support (`--fix`, `--fix-suggestions`)
- Stable v1.0 released June 2025

**Cons:**
- No formatting - still need Prettier
- Fewer specialised rules than ESLint ecosystem
- Some React hooks rule differences from ESLint
- Two-tool workflow remains

**Migration effort:** Low. Drop-in replacement for most ESLint rules.

---

## Option 3: Hybrid - Oxlint + ESLint

Run oxlint first for speed, ESLint second for specialised rules.

**Setup:**
```bash
npm install -D oxlint eslint-plugin-oxlint
```

```json
// package.json
"scripts": {
  "lint": "oxlint && eslint .",
  "lint:fix": "oxlint --fix && eslint . --fix"
}
```

**Pros:**
- Immediate speed gains on common rules
- Keep ESLint for niche plugins (react-hooks-addons)
- Gradual migration path

**Cons:**
- Two config files to maintain
- Added complexity

---

## Option 4: Biome (Formatting) + ESLint (Linting)

Use Biome solely for formatting (replacing Prettier), keep ESLint for linting.

**Pros:**
- Faster formatting
- Keep full ESLint rule ecosystem
- Minimal rule migration needed

**Cons:**
- Still have slow ESLint
- Two tools

---

## Recommendation

### Best Option: **Full Biome Migration**

**Rationale:**
1. **Speed:** 10-25x improvement addresses the core complaint
2. **Simplicity:** Single tool, single config
3. **Industry direction:** Next.js, major projects adopting Biome
4. **Good enough hooks rules:** `useExhaustiveDependencies` works, just stricter
5. **Low migration effort:** Built-in migration commands

**Acceptable trade-offs:**
- No quick-fix autofix for hooks deps (manual fixes are typically better anyway)
- Stricter deps checking (arguably better practice)
- Lose `react-hooks-addons` `no-unused-deps` (Biome's rule covers this)

### Fallback: **Oxlint + Prettier**

If Biome's hooks rules prove problematic in practice, switch to:
- Oxlint for linting (fastest)
- Keep Prettier for formatting

---

## Migration Plan (Biome)

### Phase 1: Setup
1. Install Biome: `npm install -D @biomejs/biome`
2. Run migrations:
   - `npx biome migrate eslint --write`
   - `npx biome migrate prettier --write`
3. Review generated `biome.json`

### Phase 2: Configuration Tuning
1. Map current ESLint rules to Biome equivalents
2. Configure `useExhaustiveDependencies` for custom hooks (TanStack Query)
3. Adjust formatting preferences if needed

### Phase 3: Integration
1. Update npm scripts:
   ```json
   "lint": "biome check .",
   "lint:fix": "biome check --write .",
   "format": "biome format --write ."
   ```
2. Update/remove vite-plugin-eslint
3. Configure VS Code extension (Biome)

### Phase 4: Cleanup
1. Remove ESLint deps:
   - `eslint`, `@eslint/js`
   - `@typescript-eslint/*`
   - `eslint-plugin-*`
   - `eslint-config-prettier`
   - `globals`
2. Remove `eslint.config.js`
3. Update CI/pre-commit hooks

### Phase 5: Verification
1. Run `biome check .` - fix any new violations
2. Test VS Code integration
3. Verify build pipeline works

---

## Key Rule Mappings

| ESLint Rule | Biome Equivalent |
|-------------|-----------------|
| `semi` | `javascript.formatter.semicolons` |
| `curly` | `style/useCurlyBraces` (planned) |
| `arrow-body-style` | `style/useArrowFunction` |
| `@typescript-eslint/no-unused-vars` | `correctness/noUnusedVariables` |
| `@typescript-eslint/no-explicit-any` | `suspicious/noExplicitAny` |
| `react-hooks/rules-of-hooks` | `correctness/useHookAtTopLevel` |
| `react-hooks/exhaustive-deps` | `correctness/useExhaustiveDependencies` |
| `prettier/prettier` | Built-in formatter |

---

## Sources

- [Biome vs ESLint - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Oxlint 1.0 Announcement](https://voidzero.dev/posts/announcing-oxlint-1-stable)
- [Biome useExhaustiveDependencies](https://biomejs.dev/linter/rules/use-exhaustive-dependencies/)
- [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint)
- [Biome vs ESLint 2025 Showdown](https://medium.com/@harryespant/biome-vs-eslint-the-ultimate-2025-showdown-for-javascript-developers-speed-features-and-3e5130be4a3c)
- [Oxlint Autofix Documentation](https://oxc.rs/docs/guide/usage/linter/automatic-fixes)
