import type { JSX } from "react";
import type { Position } from "./InlineImageNode";

const imageCache = new Set();

function useSuspenseImage(src: string) {
    if (!imageCache.has(src))
        throw new Promise(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imageCache.add(src);
                resolve(null);
            };
        });
}

export default function LazyImage({
    altText,
    className,
    imageRef,
    src,
    width,
    height,
    position
}: {
    altText: string;
    className: string | null;
    height: "inherit" | number;
    imageRef: { current: null | HTMLImageElement };
    src: string;
    width: "inherit" | number;
    position: Position;
}): JSX.Element {
    useSuspenseImage(src);
    return (
        <img
            className={className || undefined}
            src={src}
            alt={altText}
            ref={imageRef}
            data-position={position}
            style={{
                display: "block",
                height,
                width
            }}
            draggable="false"
        />
    );
}
