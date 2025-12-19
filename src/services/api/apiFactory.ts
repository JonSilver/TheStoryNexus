const API_BASE = "/api";

// Helper function for fetch requests
export const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return response.json();
};

// Helper for form data uploads (no Content-Type header - browser sets multipart boundary)
export const uploadFile = async <T>(url: string, file: File): Promise<T> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        const message = error.details ? `${error.error}: ${error.details}` : error.error || "Upload failed";
        throw new Error(message);
    }
    return response.json();
};
