export const DEFAULT_SETTINGS = {
    hasLinkAttributes: false,
    isCollab: false,
    isRichText: true,
    selectionAlwaysOnDisplay: false,
    shouldUseLexicalContextMenu: false,
    showTreeView: true
} as const;

export const INITIAL_SETTINGS: Record<SettingName, boolean> = {
    ...DEFAULT_SETTINGS
};

export type SettingName = keyof typeof DEFAULT_SETTINGS;
