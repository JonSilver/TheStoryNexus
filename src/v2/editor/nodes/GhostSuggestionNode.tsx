import { $getState, $setState, createState, DecoratorNode, type LexicalNode } from "lexical";
import type { JSX } from "react";
import { GhostSuggestion } from "../components/GhostSuggestion";

const asString = (v: unknown) => (typeof v === "string" ? v : "");

export const ghostTextState = createState("text", { parse: asString });
export const ghostStatusState = createState("ghostStatus", {
    // Any serialised value is an orphan (the stream died with its editor) —
    // always rehydrate as done; runtime "streaming" is set via $setState
    parse: (): "streaming" | "done" => "done"
});

/**
 * Inline provisional continuation (writing-process review W2): streamed prose
 * shown greyed IN the manuscript at the caret. Keep converts it to real
 * paragraphs in one undo step; Dismiss removes it. Contributes nothing to
 * exports or word count (decorator), and survives reloads as a ghost.
 */
export class GhostSuggestionNode extends DecoratorNode<JSX.Element> {
    $config() {
        return this.config("suggestion-v2", {
            extends: DecoratorNode,
            stateConfigs: [
                { stateConfig: ghostTextState, flat: true },
                { stateConfig: ghostStatusState, flat: true }
            ]
        });
    }

    createDOM(): HTMLElement {
        const el = document.createElement("div");
        el.className = "v2-ghost-host";
        return el;
    }

    updateDOM(): false {
        return false;
    }

    decorate(): JSX.Element {
        return <GhostSuggestion nodeKey={this.getKey()} />;
    }

    isInline(): false {
        return false;
    }

    isKeyboardSelectable(): true {
        return true;
    }
}

export const $createGhostSuggestionNode = () => new GhostSuggestionNode();

export const $isGhostSuggestionNode = (node: LexicalNode | null | undefined): node is GhostSuggestionNode =>
    node instanceof GhostSuggestionNode;

export const $readGhost = (node: GhostSuggestionNode) => ({
    text: $getState(node, ghostTextState),
    ghostStatus: $getState(node, ghostStatusState)
});

export const $setGhostText = (node: GhostSuggestionNode, updater: string | ((prev: string) => string)) =>
    $setState(node, ghostTextState, updater);
