/**
 * InterviewVault Mobile — Interview Coach Screen
 */
import React, { useState } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const TOPICS = [
    { id: 'dsa', name: 'Data Structures & Algorithms', emoji: '🧠' },
    { id: 'sys_design', name: 'System Design', emoji: '🏗️' },
    { id: 'os', name: 'Operating Systems', emoji: '⚙️' },
    { id: 'dbms', name: 'Database Management', emoji: '🗄️' },
    { id: 'cn', name: 'Computer Networks', emoji: '🌐' },
    { id: 'ml', name: 'Machine Learning', emoji: '🤖' },
    { id: 'python', name: 'Python', emoji: '🐍' },
    { id: 'java', name: 'Java', emoji: '☕' },
    { id: 'react', name: 'React & Frontend', emoji: '⚛️' },
    { id: 'behavioral', name: 'Behavioral', emoji: '🤝' },
    { id: 'leadership', name: 'Leadership', emoji: '👥' },
    { id: 'problem_solving', name: 'Problem Solving', emoji: '💡' },
];

type Phase = 'setup' | 'interview' | 'evaluation';
interface Message { role: 'interviewer' | 'candidate'; text: string }

const DEMO_FIRST_MSG: Message = {
    role: 'interviewer',
    text: "Hello! I'm your AI interviewer today. Let's explore your knowledge. Here's your first question:\n\nCan you explain what a hash table is and describe its time complexity for common operations?",
};

export default function InterviewScreen() {
    const { isDemoMode } = useAuth();
    const [phase, setPhase] = useState<Phase>('setup');
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [questionNum, setQuestionNum] = useState(0);
    const totalQuestions = 5;

    const startInterview = async () => {
        if (!selectedTopic) return;
        setLoading(true);
        if (isDemoMode) {
            setTimeout(() => {
                setMessages([DEMO_FIRST_MSG]);
                setQuestionNum(1);
                setPhase('interview');
                setLoading(false);
            }, 800);
            return;
        }
        try {
            const res = await api.post('/api/interview/start', {
                topic: selectedTopic, difficulty: 'intermediate', num_questions: totalQuestions,
            });
            setMessages([{ role: 'interviewer', text: `${res.data.greeting}\n\n${res.data.question}` }]);
            setQuestionNum(1);
            setPhase('interview');
        } catch {
            setMessages([DEMO_FIRST_MSG]);
            setQuestionNum(1);
            setPhase('interview');
        } finally { setLoading(false); }
    };

    const sendResponse = async () => {
        if (!input.trim()) return;
        const userMsg: Message = { role: 'candidate', text: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        if (isDemoMode) {
            setTimeout(() => {
                if (questionNum >= totalQuestions) {
                    setPhase('evaluation');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'interviewer',
                        text: `Good answer! Here's question ${questionNum + 1}:\n\nCan you describe a real-world scenario where you would use this concept?`,
                    }]);
                    setQuestionNum(prev => prev + 1);
                }
                setLoading(false);
            }, 1000);
            return;
        }

        try {
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
            const res = await api.post('/api/interview/respond', { history, student_response: userMsg.text });
            if (res.data.is_complete) {
                setPhase('evaluation');
            } else {
                setMessages(prev => [...prev, { role: 'interviewer', text: res.data.question }]);
                setQuestionNum(prev => prev + 1);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'interviewer', text: 'Great response! Moving to the next question...' }]);
            setQuestionNum(prev => prev + 1);
        } finally { setLoading(false); }
    };

    const resetInterview = () => {
        setPhase('setup');
        setMessages([]);
        setSelectedTopic(null);
        setQuestionNum(0);
    };

    // Setup phase
    if (phase === 'setup') {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>🎙️ AI Interview Coach</Text>
                <Text style={styles.subtitle}>Choose a topic to begin your mock interview.</Text>
                <FlatList
                    data={TOPICS}
                    numColumns={2}
                    contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
                    columnWrapperStyle={{ gap: 10 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.topicCard, selectedTopic === item.id && styles.topicSelected]}
                            onPress={() => setSelectedTopic(item.id)}
                        >
                            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                            <Text style={[styles.topicName, selectedTopic === item.id && { color: '#a78bfa' }]}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={item => item.id}
                />
                <TouchableOpacity
                    style={[styles.startBtn, !selectedTopic && { opacity: 0.4 }]}
                    onPress={startInterview}
                    disabled={!selectedTopic || loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>Start Interview</Text>}
                </TouchableOpacity>
            </View>
        );
    }

    // Evaluation phase
    if (phase === 'evaluation') {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
                <Text style={styles.title}>Interview Complete!</Text>
                <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                    You answered {totalQuestions} questions on {TOPICS.find(t => t.id === selectedTopic)?.name}.
                </Text>
                <TouchableOpacity style={styles.startBtn} onPress={resetInterview}>
                    <Text style={styles.startBtnText}>Start New Interview</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Interview (chat) phase
    return (
        <View style={styles.container}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(questionNum / totalQuestions) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>Question {questionNum} / {totalQuestions}</Text>

            <FlatList
                data={messages}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 10 }}
                renderItem={({ item }) => (
                    <View style={[styles.bubble, item.role === 'candidate' ? styles.bubbleCandidate : styles.bubbleInterviewer]}>
                        <Text style={styles.bubbleText}>{item.text}</Text>
                    </View>
                )}
                keyExtractor={(_, i) => String(i)}
            />

            {loading && (
                <View style={styles.typingIndicator}>
                    <Text style={{ color: '#64748b', fontSize: 13 }}>Interviewer is typing…</Text>
                </View>
            )}

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.chatInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your answer..."
                    placeholderTextColor="#64748b"
                    multiline
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendResponse} disabled={loading || !input.trim()}>
                    <Text style={styles.sendBtnText}>➤</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050a', padding: 20 },
    title: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
    subtitle: { color: '#64748b', fontSize: 14, marginBottom: 20 },
    topicCard: {
        flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    topicSelected: { borderColor: 'rgba(99,102,241,0.5)', backgroundColor: 'rgba(99,102,241,0.08)' },
    topicName: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
    startBtn: {
        backgroundColor: '#6366f1', paddingVertical: 14,
        borderRadius: 12, alignItems: 'center', marginTop: 12,
    },
    startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    progressContainer: {
        height: 4, backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 2, marginBottom: 4, overflow: 'hidden',
    },
    progressBar: { height: '100%', backgroundColor: '#6366f1', borderRadius: 2 },
    progressText: { color: '#64748b', fontSize: 12, marginBottom: 12 },
    bubble: { padding: 14, borderRadius: 14, marginBottom: 10, maxWidth: '85%' },
    bubbleInterviewer: { backgroundColor: 'rgba(99,102,241,0.1)', alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
    bubbleCandidate: { backgroundColor: 'rgba(168,85,247,0.1)', alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(168,85,247,0.15)' },
    bubbleText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
    typingIndicator: { paddingVertical: 8 },
    inputRow: { flexDirection: 'row', gap: 10, paddingTop: 10 },
    chatInput: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 14, color: '#f1f5f9', fontSize: 14, maxHeight: 100,
    },
    sendBtn: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    },
    sendBtnText: { color: '#fff', fontSize: 18 },
});
