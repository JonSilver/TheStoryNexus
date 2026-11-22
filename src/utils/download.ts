/** Saves a blob as a file in the browser's downloads; `name` is a title, made filename-safe here. */
export const downloadBlob = (name: string, extension: string, blob: Blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/[^\w-]+/g, "-")}.${extension}`;
    link.click();
    // Some browsers read the blob after click() returns: revoking at once can cut a large file short
    setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
};

export const downloadText = (name: string, extension: string, text: string, mime: string) =>
    downloadBlob(name, extension, new Blob([text], { type: `${mime};charset=utf-8` }));
