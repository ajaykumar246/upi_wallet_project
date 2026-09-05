const API_BASE = 'http://localhost:3000/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const api = {
    // Auth
    signup: async (username, password) => {
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Signup failed');
        }
        return res.json();
    },

    login: async (username, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Login failed');
        }
        return res.json();
    },

    logout: async () => {
        const res = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return res.json();
    },

    // User Data
    getBalance: async () => {
        const res = await fetch(`${API_BASE}/balance`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to fetch balance');
        }
        return res.json();
    },

    getHistory: async () => {
        const res = await fetch(`${API_BASE}/history`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to fetch history');
        }
        return res.json();
    },

    // Actions
    createPin: async (pin) => {
        const res = await fetch(`${API_BASE}/createpin`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ pin })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create PIN');
        }
        return res.json();
    },

    pay: async (receiver_vpa, amount, category, pin, idempotencyKey = null) => {
        const headers = getAuthHeaders();
        if (idempotencyKey) {
            headers['x-idempotency-key'] = idempotencyKey;
        }
        
        const res = await fetch(`${API_BASE}/pay`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ receiver_vpa, amount: Number(amount), category, pin })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Payment failed');
        }
        return res.json();
    },

    deposit: async (amount) => {
        const res = await fetch(`${API_BASE}/deposit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ amount: Number(amount) })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Deposit failed');
        }
        return res.json();
    },

    checkHasPin: async () => {
        const res = await fetch(`${API_BASE}/haspin`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to check PIN status');
        }
        return res.json();
    },

    updatePin: async (newPin, oldPin, password) => {
        const res = await fetch(`${API_BASE}/pin`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ newPin, oldPin, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update PIN');
        }
        return res.json();
    }
};
