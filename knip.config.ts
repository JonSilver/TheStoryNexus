import type { KnipConfig } from "knip";

const config: KnipConfig = {
    ignore: [
        // Lexical editor is a custom implementation with internal dependencies
        "src/Lexical/**"
    ]
};

export default config;
