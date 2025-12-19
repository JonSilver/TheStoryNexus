import type { JSX } from "react";
import brokenImage from "../../images/image-broken.svg";

const imageCache = new Set();

const useSuspenseImage = (src: string) => {
    if (!imageCache.has(src))
        throw new Promise(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imageCache.add(src);
                resolve(null);
            };
            img.onerror = () => {
                imageCache.add(src);
            };
        });
};

interface LazyImageProps {
    altText: string;
    className: string | null;
    height: "inherit" | number;
    imageRef: { current: null | HTMLImageElement };
    maxWidth: number;
    src: string;
    width: "inherit" | number;
    onError: () => void;
}

export const LazyImage = ({ altText, className, imageRef, src, width, height, maxWidth, onError }: LazyImageProps): JSX.Element => {
    useSuspenseImage(src);
    return (
        <img
            className={className || undefined}
            src={src}
            alt={altText}
            ref={imageRef}
            style={{ height, maxWidth, width }}
            onError={onError}
            draggable="false"
        />
    );
};

export const BrokenImage = (): JSX.Element => (
    <img src={brokenImage} alt="Failed to load" style={{ height: 200, opacity: 0.2, width: 200 }} draggable="false" />
);
