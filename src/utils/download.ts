/** Saves a blob as a file in the browser's downloads; `name` is a title, made filename-safe here. */
export const downloadBlob = (name: string, extension: string, blob: Blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/[^\w-]+/g, "-")}.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const downloadText = (name: string, extension: string, text: string, mime: string) =>
    downloadBlob(name, extension, new Blob([text], { type: `${mime};charset=utf-8` }));
