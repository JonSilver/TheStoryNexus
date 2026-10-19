import { $getState, $setState, createState, DecoratorNode, type LexicalNode } from "lexical";
import type { JSX } from "react";
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
    // A serialised "generating" is by definition orphaned (the request died
    // with its editor) — normalise to done so reopening never shows a live
    // Stop state with no stream behind it
    parse: (v): SceneBeatStatus => (v === "generating" ? "done" : isStatus(v) ? v : "idle")
});
export const generatedTextState = createState("generatedText", { parse: asString });
const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
const asIndex = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
/** Every completed generation survives as a take; regeneration never destroys a draft. */
export const takesState = createState("takes", { parse: asStringArray });
export const activeTakeState = createState("activeTake", { parse: asIndex });
const asIndexList = (v: unknown): number[] =>
    Array.isArray(v) ? v.filter((i): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0) : [];
/** Takes cut short by a failure (indexes into takes) — kept, and labelled. */
export const incompleteTakesState = createState("incompleteTakes", { parse: asIndexList });
/** In-flight tokens stream here — durable mid-generation, never clobbering takes. */
export const streamingState = createState("streaming", { parse: asString });
export const collapsedState = createState("collapsed", { parse: asBoolean });
export const povCharacterState = createState("povCharacter", { parse: asString });
export const povTypeState = createState("povType", { parse: asString });

export interface SceneBeatData {
    command: string;
    status: SceneBeatStatus;
    /** Completed generations, oldest first (legacy generatedText folds in as the first take). */
    takes: string[];
    activeTake: number;
    incompleteTakes: number[];
    streaming: string;
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
                { stateConfig: takesState, flat: true },
                { stateConfig: activeTakeState, flat: true },
                { stateConfig: incompleteTakesState, flat: true },
                { stateConfig: streamingState, flat: true },
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

/**
 * Fold any streamed text into the takes list and settle status. Used at
 * generation completion AND to recover orphaned streams — a reload
 * mid-generation or an undo reviving a deleted beat leaves streamed text
 * with no owning request; it must surface as a take, never vanish.
 */
export const $commitStreamingAsTake = (node: SceneBeatNode, incomplete = false) => {
    const streamed = $getState(node, streamingState).trim();
    const legacy = $getState(node, generatedTextState);
    const stored = $getState(node, takesState);
    const takes = stored.length > 0 ? stored : legacy ? [legacy] : [];
    if (streamed) {
        const next = [...takes, streamed];
        $setState(node, takesState, next);
        $setState(node, activeTakeState, next.length - 1);
        $setState(node, generatedTextState, "");
        if (incomplete) $setState(node, incompleteTakesState, prev => [...prev, next.length - 1]);
    }
    $setState(node, streamingState, "");
    $setState(node, statusState, streamed || takes.length > 0 ? "done" : "idle");
};

export const $readSceneBeat = (node: SceneBeatNode): SceneBeatData => {
    const storedTakes = $getState(node, takesState);
    const legacy = $getState(node, generatedTextState);
    // Legacy single-draft beats surface their draft as take one
    const takes = storedTakes.length > 0 ? storedTakes : legacy ? [legacy] : [];
    const activeTake = Math.min($getState(node, activeTakeState), Math.max(takes.length - 1, 0));
    return {
        command: $getState(node, commandState),
        status: $getState(node, statusState),
        takes,
        activeTake,
        incompleteTakes: $getState(node, incompleteTakesState),
        streaming: $getState(node, streamingState),
        collapsed: $getState(node, collapsedState),
        povCharacter: $getState(node, povCharacterState),
        povType: $getState(node, povTypeState)
    };
};
