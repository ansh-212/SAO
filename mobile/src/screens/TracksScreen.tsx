/**
 * InterviewVault Mobile — Learning Tracks Screen
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const TRACKS = [
    {
        id: 'frontend_dev', title: 'Frontend Developer', icon: '🎨', description: 'Master UI/UX, React, JavaScript.',
        milestones: [
            { id: 'fe_1', title: 'Internet Fundamentals', topics: ['HTTP', 'DNS', 'Browsers'] },
            { id: 'fe_2', title: 'HTML, CSS & JS Core', topics: ['DOM', 'CSS Grid', 'ES6+'] },
            { id: 'fe_3', title: 'Frontend Frameworks', topics: ['React', 'State Mgmt', 'Routing'] },
            { id: 'fe_4', title: 'Web Performance', topics: ['Optimization', 'Caching'] },
            { id: 'fe_5', title: 'System Design (UI)', topics: ['Component Design', 'Scalability'] },
        ]
    },
    {
        id: 'backend_dev', title: 'Backend Developer', icon: '⚙️', description: 'Architect servers, APIs, databases.',
        milestones: [
            { id: 'be_1', title: 'Language Core', topics: ['Python/Java', 'Data Structures', 'OOP'] },
            { id: 'be_2', title: 'Databases', topics: ['SQL', 'NoSQL', 'Indexing'] },
            { id: 'be_3', title: 'APIs & Communication', topics: ['REST', 'GraphQL', 'gRPC'] },
            { id: 'be_4', title: 'System Architecture', topics: ['Microservices', 'Caching'] },
            { id: 'be_5', title: 'Security & DevOps', topics: ['Auth', 'Docker', 'CI/CD'] },
        ]
    },
    {
        id: 'data_science', title: 'Data Scientist', icon: '📊', description: 'Discover insights through ML.',
        milestones: [
            { id: 'ds_1', title: 'Math & Stats', topics: ['Linear Algebra', 'Probability'] },
            { id: 'ds_2', title: 'Data Manipulation', topics: ['Pandas', 'NumPy', 'SQL'] },
            { id: 'ds_3', title: 'Machine Learning', topics: ['Regression', 'Classification'] },
            { id: 'ds_4', title: 'Deep Learning', topics: ['Neural Networks', 'NLP'] },
            { id: 'ds_5', title: 'Deployment', topics: ['Model Serving', 'MLOps'] },
        ]
    },
];

const DEMO_PROGRESS: Record<string, number[]> = {
    frontend_dev: [100, 66, 33, 0, 0],
    backend_dev: [66, 25, 0, 0, 0],
    data_science: [33, 0, 0, 0, 0],
};

const MILESTONE_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

export default function TracksScreen() {
    const { isDemoMode } = useAuth();
    const [selectedTrack, setSelectedTrack] = useState<any>(null);
    const [progress, setProgress] = useState<number[]>([]);

    const openTrack = async (track: any) => {
        setSelectedTrack(track);
        if (isDemoMode) {
            setProgress(DEMO_PROGRESS[track.id] || []);
            return;
        }
        try {
            const res = await api.get(`/api/tracks/${track.id}/progress`);
            setProgress(res.data.milestones?.map((m: any) => m.percent_complete) || []);
        } catch {
            setProgress(DEMO_PROGRESS[track.id] || []);
        }
    };

    if (selectedTrack) {
        const overallProgress = Math.round(progress.reduce((a, b) => a + b, 0) / (progress.length || 1));
        return (
            <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <TouchableOpacity onPress={() => setSelectedTrack(null)} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>

                <View style={styles.trackHeader}>
                    <Text style={{ fontSize: 32 }}>{selectedTrack.icon}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.trackDetailTitle}>{selectedTrack.title}</Text>
                        <Text style={styles.trackDetailDesc}>{selectedTrack.description}</Text>
                    </View>
                    <View style={styles.progressRing}>
                        <Text style={styles.progressRingText}>{overallProgress}%</Text>
                    </View>
                </View>

                {/* Milestone timeline */}
                {selectedTrack.milestones.map((ms: any, i: number) => {
                    const pct = progress[i] || 0;
                    const color = MILESTONE_COLORS[i % MILESTONE_COLORS.length];
                    const isComplete = pct === 100;
                    return (
                        <View key={ms.id} style={styles.milestoneRow}>
                            {/* Dot */}
                            <View style={[styles.milestoneDot, { borderColor: color, backgroundColor: isComplete ? color : '#05050a' }]} />
                            {/* Line */}
                            {i < selectedTrack.milestones.length - 1 && <View style={styles.milestoneLine} />}
                            {/* Card */}
                            <View style={[styles.milestoneCard, isComplete && { borderColor: `${color}40` }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={styles.msTitle}>{isComplete ? '✅ ' : ''}{ms.title}</Text>
                                    <View style={[styles.msPctBadge, { backgroundColor: `${color}20` }]}>
                                        <Text style={[styles.msPctText, { color }]}>{pct}%</Text>
                                    </View>
                                </View>
                                {/* Progress bar */}
                                <View style={styles.msProgressBar}>
                                    <View style={[styles.msProgressFill, { width: `${pct}%`, backgroundColor: color }]} />
                                </View>
                                {/* Topic tags */}
                                <View style={styles.topicTags}>
                                    {ms.topics.map((t: string) => (
                                        <View key={t} style={styles.topicTag}>
                                            <Text style={styles.topicTagText}>{t}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ padding: 20 }}>
                <Text style={styles.title}>🛤️ Learning Tracks</Text>
                <Text style={styles.subtitle}>Choose a role-based roadmap.</Text>
            </View>
            <FlatList
                data={TRACKS}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 30 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.trackCard} onPress={() => openTrack(item)}>
                        <Text style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</Text>
                        <Text style={styles.trackTitle}>{item.title}</Text>
                        <Text style={styles.trackDesc}>{item.description}</Text>
                        <Text style={styles.milestoneCount}>{item.milestones.length} milestones →</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={item => item.id}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050a' },
    title: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
    subtitle: { color: '#64748b', fontSize: 14, marginBottom: 8 },
    trackCard: {
        padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    trackTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
    trackDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 10 },
    milestoneCount: { fontSize: 12, fontWeight: '600', color: '#a78bfa' },
    backBtn: { marginBottom: 16 },
    backText: { color: '#64748b', fontSize: 14 },
    trackHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
    trackDetailTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
    trackDetailDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
    progressRing: {
        width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: '#6366f1',
        alignItems: 'center', justifyContent: 'center',
    },
    progressRingText: { fontSize: 12, fontWeight: '800', color: '#6366f1' },
    milestoneRow: { flexDirection: 'row', marginBottom: 16, paddingLeft: 6 },
    milestoneDot: {
        width: 14, height: 14, borderRadius: 7, borderWidth: 3,
        position: 'absolute', left: 0, top: 14, zIndex: 2,
    },
    milestoneLine: {
        position: 'absolute', left: 6, top: 28, bottom: -16, width: 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    milestoneCard: {
        flex: 1, marginLeft: 24, padding: 16, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    msTitle: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
    msPctBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    msPctText: { fontSize: 11, fontWeight: '700' },
    msProgressBar: {
        height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 10, overflow: 'hidden',
    },
    msProgressFill: { height: '100%', borderRadius: 2 },
    topicTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    topicTag: {
        paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    topicTagText: { fontSize: 11, color: '#94a3b8' },
});
