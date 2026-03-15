/**
 * InterviewVault Mobile — Auth Context
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    xp_points?: number;
    streak_days?: number;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDemoMode: boolean;
    login: (email: string, password: string) => Promise<void>;
    enterDemoMode: () => void;
    logout: () => Promise<void>;
}

const DEMO_USER: User = {
    id: 999,
    name: 'Arjun Patel',
    email: 'demo@interviewvault.ai',
    role: 'student',
    xp_points: 2450,
    streak_days: 7,
};

const AuthContext = createContext<AuthContextType>({
    user: null, loading: true, isDemoMode: false,
    login: async () => { }, enterDemoMode: () => { }, logout: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const token = await SecureStore.getItemAsync('access_token');
                if (token) {
                    const res = await api.get('/api/auth/me');
                    setUser(res.data);
                }
            } catch {
                await SecureStore.deleteItemAsync('access_token');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const login = async (email: string, password: string) => {
        const res = await api.post('/api/auth/login', { email, password });
        await SecureStore.setItemAsync('access_token', res.data.access_token);
        setUser(res.data.user);
        setIsDemoMode(false);
    };

    const enterDemoMode = () => {
        setUser(DEMO_USER);
        setIsDemoMode(true);
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('access_token');
        setUser(null);
        setIsDemoMode(false);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isDemoMode, login, enterDemoMode, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
