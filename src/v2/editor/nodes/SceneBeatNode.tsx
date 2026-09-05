import type { JSX } from "react";
import { $getState, $setState, createState, DecoratorNode, type LexicalNode } from "lexical";
import { SceneBeatComponent } from "../components/SceneBeatComponent";

export const SCENE_BEAT_STATUSES = ["idle", "generating", "done", "accepted"] as const;
export type SceneBeatStatus = (typeof SCENE_BEAT_STATUSES)[number];

const isStatus = (v: unknown): v is SceneBeatStatus => SCENE_BEAT_STATUSES.includes(v as SceneBeatStatus);
const asString = (v: unknown) => (typeof v === "string" ? v : "");
const asBoolean = (v: unknown) => v === true;

/**
 * NodeState (Lexical >=0.28): each entry serialises itself into the
 * editor-state JSON and restores on import with no importJSON/exportJSON.
 * Values equal to parse(undefined) are omitted from the JSON (contracts
 * Appendix A) — readers must not assume presence.
 */
export const commandState = createState("command", { parse: asString });
export const statusState = createState("status", {
    parse: (v): SceneBeatStatus => (isStatus(v) ? v : "idle")
});
export const generatedTextState = createState("generatedText", { parse: asString });
export const collapsedState = createState("collapsed", { parse: asBoolean });
export const povCharacterState = createState("povCharacter", { parse: asString });
export const povTypeState = createState("povType", { parse: asString });

export interface SceneBeatData {
    command: string;
    status: SceneBeatStatus;
    generatedText: string;
    collapsed: boolean;
    povCharacter: string;
    povType: string;
}

export class SceneBeatNode extends DecoratorNode<JSX.Element> {
    $config() {
        // Distinct from v1's "scene-beat": the two editors must never claim
        // each other's nodes — v1 parsing a v2 beat silently destroyed its
        // state (and vice versa) when both used the same type name
        return this.config("scene-beat-v2", {
            extends: DecoratorNode,
            stateConfigs: [
                { stateConfig: commandState, flat: true },
                { stateConfig: statusState, flat: true },
                { stateConfig: generatedTextState, flat: true },
                { stateConfig: collapsedState, flat: true },
                { stateConfig: povCharacterState, flat: true },
                { stateConfig: povTypeState, flat: true }
            ]
        });
    }

    createDOM(): HTMLElement {
        const el = document.createElement("div");
        el.className = "v2-scene-beat-host";
        return el;
    }

    updateDOM(): false {
        return false;
    }

    decorate(): JSX.Element {
        return <SceneBeatComponent nodeKey={this.getKey()} />;
    }

    isInline(): false {
        return false;
    }

    isKeyboardSelectable(): true {
        return true;
    }
}

export const $createSceneBeatNode = (command = "") => $setState(new SceneBeatNode(), commandState, command);

export const $isSceneBeatNode = (node: LexicalNode | null | undefined): node is SceneBeatNode =>
    node instanceof SceneBeatNode;

export const $readSceneBeat = (node: SceneBeatNode): SceneBeatData => ({
    command: $getState(node, commandState),
    status: $getState(node, statusState),
    generatedText: $getState(node, generatedTextState),
    collapsed: $getState(node, collapsedState),
    povCharacter: $getState(node, povCharacterState),
    povType: $getState(node, povTypeState)
});
