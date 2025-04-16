export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const baseUrl = 'http://localhost/server/api';
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            mode: 'cors',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            let errorDetails;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                errorDetails = await response.json().catch(() => null);
            } else {
                // const text = await response.text();
                throw new Error(`HTTP error ${response.status}`);
            }

            throw new Error(errorDetails?.message || `HTTP error ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error('Invalid JSON response');
        }
    } catch (error) {
        throw error;
    }
}