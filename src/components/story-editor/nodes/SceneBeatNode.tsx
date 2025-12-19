import type { LexicalNode, NodeKey, SerializedLexicalNode, Spread } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import type { JSX } from "react";
import { Suspense } from "react";
import { logger } from "@/utils/logger";
import SceneBeatComponent from "./scene-beat/SceneBeatComponent";

type SerializedSceneBeatNode = Spread<
    {
        type: "scene-beat";
        version: 1;
        sceneBeatId: string;
    },
    SerializedLexicalNode
>;

export class SceneBeatNode extends DecoratorNode<JSX.Element> {
    __sceneBeatId: string;

    constructor(sceneBeatId: string = "", key?: NodeKey) {
        super(key);
        this.__sceneBeatId = sceneBeatId;
        logger.info("🏗️ SceneBeatNode constructor:", { sceneBeatId, key });
    }

    static getType(): string {
        return "scene-beat";
    }

    static clone(node: SceneBeatNode): SceneBeatNode {
        return new SceneBeatNode(node.__sceneBeatId, node.__key);
    }

    static importJSON(serializedNode: SerializedSceneBeatNode): SceneBeatNode {
        logger.info("📥 SceneBeat importJSON:", serializedNode.sceneBeatId);
        return $createSceneBeatNode(serializedNode.sceneBeatId || "");
    }

    exportJSON(): SerializedSceneBeatNode {
        return {
            type: "scene-beat",
            version: 1,
            sceneBeatId: this.__sceneBeatId
        };
    }

    getSceneBeatId(): string {
        return this.__sceneBeatId;
    }

    setSceneBeatId(id: string): void {
        const self = this.getWritable();
        self.__sceneBeatId = id;
    }

    createDOM(): HTMLElement {
        const div = document.createElement("div");
        div.className = "scene-beat-node";
        return div;
    }

    updateDOM(): boolean {
        return false;
    }

    isInline(): boolean {
        return false;
    }

    decorate(): JSX.Element {
        return (
            <Suspense fallback={null}>
                <SceneBeatComponent nodeKey={this.__key} />
            </Suspense>
        );
    }
}

export const $createSceneBeatNode = (sceneBeatId: string = ""): SceneBeatNode =>
    $applyNodeReplacement(new SceneBeatNode(sceneBeatId));

export const $isSceneBeatNode = (node: LexicalNode | null | undefined): node is SceneBeatNode =>
    node?.getType() === "scene-beat";
