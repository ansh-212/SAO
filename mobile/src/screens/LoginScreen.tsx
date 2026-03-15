/**
 * InterviewVault Mobile — Login Screen
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
    const { login, enterDemoMode } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) return Alert.alert('Error', 'Enter email and password');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            Alert.alert('Login Failed', err?.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#05050a', '#0a0a1a', '#05050a']} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
                {/* Logo */}
                <View style={styles.logoRow}>
                    <View style={styles.logoIcon}>
                        <Text style={{ fontSize: 20 }}>⚡</Text>
                    </View>
                    <Text style={styles.logoText}>
                        Interview<Text style={styles.logoAccent}>Vault</Text>
                    </Text>
                </View>

                <Text style={styles.subtitle}>AI-Powered Interview Preparation</Text>

                {/* Form */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sign In</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#64748b"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                        <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.gradientBtn}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.btnText}>Sign In</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Demo shortcut */}
                <TouchableOpacity style={styles.demoBtn} onPress={enterDemoMode}>
                    <Text style={styles.demoBtnText}>🎓 Explore Demo</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, alignSelf: 'center' },
    logoIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    },
    logoText: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.5 },
    logoAccent: { color: '#a78bfa' },
    subtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 32 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18, padding: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 20 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 14, fontSize: 15,
        color: '#f1f5f9', marginBottom: 14,
    },
    primaryBtn: { marginTop: 6, borderRadius: 12, overflow: 'hidden' },
    gradientBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    demoBtn: {
        marginTop: 20, alignSelf: 'center',
        paddingVertical: 12, paddingHorizontal: 28,
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
        backgroundColor: 'rgba(168,85,247,0.06)',
    },
    demoBtnText: { color: '#a78bfa', fontSize: 14, fontWeight: '600' },
});
