import type { JSX } from "react";
import { $getState, $setState, createState, DecoratorNode, type LexicalNode } from "lexical";

const asString = (v: unknown) => (typeof v === "string" ? v : "");

export const srcState = createState("src", { parse: asString });
export const altState = createState("alt", { parse: asString });
export const captionState = createState("caption", { parse: asString });

/**
 * Serialises as { type: "image", src, alt, caption } (flat NodeState) —
 * exactly the shape the export converters parse. src is always a server
 * asset URL (contracts §4): never a data URL.
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
    $config() {
        return this.config("image", {
            extends: DecoratorNode,
            stateConfigs: [
                { stateConfig: srcState, flat: true },
                { stateConfig: altState, flat: true },
                { stateConfig: captionState, flat: true }
            ]
        });
    }

    createDOM(): HTMLElement {
        const el = document.createElement("div");
        el.className = "v2-image-host";
        return el;
    }

    updateDOM(): false {
        return false;
    }

    decorate(): JSX.Element {
        const src = $getState(this, srcState);
        const alt = $getState(this, altState);
        const caption = $getState(this, captionState);
        return (
            <figure className="my-4">
                <img src={src} alt={alt} className="max-w-full rounded-md" />
                {caption && <figcaption className="mt-1 text-center text-xs text-muted-foreground">{caption}</figcaption>}
            </figure>
        );
    }

    isInline(): false {
        return false;
    }

    isKeyboardSelectable(): true {
        return true;
    }
}

export const $createImageNode = (src: string, alt = "") =>
    $setState($setState(new ImageNode(), srcState, src), altState, alt);

export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode => node instanceof ImageNode;
