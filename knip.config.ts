import type { KnipConfig } from "knip";

const config: KnipConfig = {
    ignore: [
        // Lexical editor is a custom implementation with internal dependencies
        "src/Lexical/**"
    ],
    ignoreDependencies: [
        // Transitive deps of @lexical/react - see CLAUDE.md "Lexical Dependencies"
        "@lexical/mark"
    ]
};

export default config;
