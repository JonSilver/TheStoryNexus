/** Saves text as a file in the browser's downloads; `name` is a title, made filename-safe here. */
export const downloadText = (name: string, extension: string, text: string, mime: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    link.download = `${name.replace(/[^\w-]+/g, "-")}.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
};
