import type { KnipConfig } from "knip";

const config: KnipConfig = {
    ignoreDependencies: [
        // Transitive deps of @lexical/react - see CLAUDE.md "Lexical Dependencies"
        "@lexical/mark",
        "@lexical/utils",
        "@lexical/selection",
        "@lexical/yjs"
    ]
};

export default config;
