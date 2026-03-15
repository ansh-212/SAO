/**
 * InterviewVault Mobile — API Client
 * Shared axios instance pointing at the FastAPI backend.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Change this to your deployed backend URL for production
const BASE_URL = 'http://10.0.2.2:8000'; // Android emulator → host localhost

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from SecureStore to every request
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
