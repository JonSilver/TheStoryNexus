
export function setDomHiddenUntilFound(dom: HTMLElement): void {
    // @ts-expect-error - "until-found" is a valid HTML hidden attribute value not yet in TypeScript types
    dom.hidden = "until-found";
}

export function domOnBeforeMatch(dom: HTMLElement, callback: () => void): void {
    dom.onbeforematch = callback;
}
