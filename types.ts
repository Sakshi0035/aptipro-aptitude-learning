import { User as SupabaseUser } from '@supabase/supabase-js';

export type User = SupabaseUser;

export interface Profile {
    id: string;
    username: string | null;
    avatar_url: string | null;
    score: number;
    bio: string | null;
    banner_color: string | null;
}

export interface Question {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface VoiceQuestion {
    question: string;
    answer: string;
}

export interface TestResult {
    id: string;
    user_id: string;
    topic: string;
    score: number;
    total_questions: number;
    created_at: string;
}
