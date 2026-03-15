/**
 * InterviewVault Mobile — Dashboard Screen
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const DEMO_ANALYTICS = {
    total_submissions: 12, average_score: 78, best_score: 95,
    xp_points: 2450, streak_days: 7,
    peer_percentile: 82, success_prediction: 76,
    daily_plan: {
        greeting: 'Ready to crush your goals today? 🚀',
        tasks: [
            { title: 'Review Weak Areas', emoji: '📖', duration_min: 15, type: 'review' },
            { title: 'DSA Practice', emoji: '✏️', duration_min: 25, type: 'practice' },
            { title: 'Mock Interview', emoji: '🎙️', duration_min: 20, type: 'mock_interview' },
            { title: 'System Design', emoji: '🏗️', duration_min: 30, type: 'challenge' },
        ],
        estimated_total_min: 90,
    },
};

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function DashboardScreen({ navigation }: Props) {
    const { user, isDemoMode, logout } = useAuth();
    const [analytics, setAnalytics] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        if (isDemoMode) { setAnalytics(DEMO_ANALYTICS); return; }
        try {
            const [analyticsRes, planRes] = await Promise.all([
                api.get('/api/analytics/me'),
                api.get('/api/planner/today').catch(() => ({ data: null })),
            ]);
            setAnalytics({ ...analyticsRes.data, daily_plan: planRes.data });
        } catch {
            setAnalytics(DEMO_ANALYTICS);
        }
    };

    useEffect(() => { fetchData(); }, [isDemoMode]);

    const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

    const typeColors: Record<string, string> = { review: '#6366f1', practice: '#10b981', challenge: '#f59e0b', mock_interview: '#a855f7' };

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
            >
                {/* Header */}
                <Text style={styles.greeting}>👋 Welcome, {user?.name?.split(' ')[0]}!</Text>
                <Text style={styles.subtext}>Here's your daily progress.</Text>

                {/* Stat Cards */}
                <View style={styles.statsRow}>
                    <StatCard icon="📝" value={analytics?.total_submissions || 0} label="Assessments" />
                    <StatCard icon="⭐" value={`${analytics?.average_score || 0}%`} label="Avg Score" />
                    <StatCard icon="🏆" value={`${analytics?.best_score || 0}%`} label="Best" />
                    <StatCard icon="⚡" value={analytics?.xp_points || 0} label="XP" />
                </View>

                {/* Competitive Insights */}
                <View style={styles.insightsRow}>
                    <GaugeCard value={analytics?.peer_percentile || 50} label="Peer Percentile" color="#10b981"
                        sub={`Top ${100 - (analytics?.peer_percentile || 50)}%`} />
                    <GaugeCard value={analytics?.success_prediction || 50} label="Interview Readiness" color="#6366f1"
                        sub={analytics?.success_prediction >= 80 ? '🟢 Strong' : analytics?.success_prediction >= 50 ? '🟡 Building' : '🔴 Keep going'} />
                </View>

                {/* Daily Plan */}
                {analytics?.daily_plan && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>📋 Today's Plan</Text>
                        <Text style={styles.cardSub}>{analytics.daily_plan.greeting}</Text>
                        {analytics.daily_plan.tasks?.map((task: any, i: number) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.taskItem, { borderLeftColor: typeColors[task.type] || '#6366f1' }]}
                                onPress={() => task.type === 'mock_interview' && navigation.navigate('Interview')}
                            >
                                <Text style={styles.taskEmoji}>{task.emoji}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.taskTitle}>{task.title}</Text>
                                </View>
                                <View style={[styles.durationBadge, { backgroundColor: `${typeColors[task.type] || '#6366f1'}20` }]}>
                                    <Text style={[styles.durationText, { color: typeColors[task.type] || '#6366f1' }]}>
                                        {task.duration_min}m
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Quick Nav */}
                <View style={styles.navRow}>
                    <NavButton icon="🎙️" label="Interview" onPress={() => navigation.navigate('Interview')} />
                    <NavButton icon="🛤️" label="Tracks" onPress={() => navigation.navigate('Tracks')} />
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <Text style={styles.logoutText}>{isDemoMode ? '🚀 Exit Demo' : '🚪 Sign Out'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

function StatCard({ icon, value, label }: { icon: string; value: any; label: string }) {
    return (
        <View style={styles.statCard}>
            <Text style={{ fontSize: 18 }}>{icon}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function GaugeCard({ value, label, color, sub }: { value: number; label: string; color: string; sub: string }) {
    return (
        <View style={styles.gaugeCard}>
            <View style={[styles.gaugeRing, { borderColor: color }]}>
                <Text style={[styles.gaugeValue, { color }]}>{value}%</Text>
            </View>
            <View>
                <Text style={styles.gaugeLabel}>{label}</Text>
                <Text style={styles.gaugeSub}>{sub}</Text>
            </View>
        </View>
    );
}

function NavButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.navBtn} onPress={onPress}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
            <Text style={styles.navBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050a' },
    scroll: { padding: 20, paddingBottom: 40 },
    greeting: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
    subtext: { color: '#64748b', fontSize: 14, marginBottom: 20 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    statCard: {
        flex: 1, minWidth: 70, backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 14, padding: 14, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    statValue: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', marginTop: 6 },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    insightsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    gaugeCard: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    gaugeRing: {
        width: 48, height: 48, borderRadius: 24, borderWidth: 3,
        alignItems: 'center', justifyContent: 'center',
    },
    gaugeValue: { fontSize: 13, fontWeight: '800' },
    gaugeLabel: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
    gaugeSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
    cardSub: { fontSize: 13, color: '#64748b', marginBottom: 12 },
    taskItem: {
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
        backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10,
        borderLeftWidth: 3, marginBottom: 8,
    },
    taskEmoji: { fontSize: 18 },
    taskTitle: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
    durationBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    durationText: { fontSize: 11, fontWeight: '700' },
    navRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    navBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    navBtnText: { color: '#a78bfa', fontSize: 13, fontWeight: '600', marginTop: 6 },
    logoutBtn: {
        alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 28,
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
        backgroundColor: 'rgba(239,68,68,0.06)',
    },
    logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});
