import { toast } from "react-toastify";

/**
 * Standardized toast notifications for CRUD operations.
 * Provides consistent messaging across the application.
 */
export const toastCRUD = {
    createSuccess: (entity: string) => toast.success(`${entity} created successfully`),
    createError: (entity: string, error?: unknown) => {
        const message = `Failed to create ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    updateSuccess: (entity: string) => toast.success(`${entity} updated successfully`),
    updateError: (entity: string, error?: unknown) => {
        const message = `Failed to update ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    deleteSuccess: (entity: string) => toast.success(`${entity} deleted successfully`),
    deleteError: (entity: string, error?: unknown) => {
        const message = `Failed to delete ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    saveSuccess: (entity: string) => toast.success(`${entity} saved successfully`),
    saveError: (entity: string, error?: unknown) => {
        const message = `Failed to save ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    loadError: (entity: string, error?: unknown) => {
        const message = `Failed to load ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    importSuccess: (entity: string, count?: number) => {
        const message = count ? `${count} ${entity} imported successfully` : `${entity} imported successfully`;
        toast.success(message);
    },
    importError: (entity: string, error?: unknown) => {
        const message = `Failed to import ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    exportSuccess: (entity: string) => toast.success(`${entity} exported successfully`),
    exportError: (entity: string, error?: unknown) => {
        const message = `Failed to export ${entity}`;
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    copySuccess: (entity?: string) => toast.success(entity ? `${entity} copied to clipboard` : "Copied to clipboard"),
    copyError: (error?: unknown) => {
        const message = "Failed to copy to clipboard";
        toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
    },

    generic: {
        success: (message: string) => toast.success(message),
        error: (message: string, error?: unknown) => {
            toast.error(error instanceof Error ? `${message}: ${error.message}` : message);
        },
        info: (message: string) => toast.info(message),
        warning: (message: string) => toast.warning(message)
    }
};
