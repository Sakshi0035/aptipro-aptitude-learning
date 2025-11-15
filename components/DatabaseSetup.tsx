import React, { useState } from 'react';
import { DatabaseIcon, ClipboardIcon, CheckIcon } from './Icons';

const allSqlCommands = `-- 
-- This script sets up all necessary tables, policies, and functions for the AptiPro app.
-- Run this entire script in your Supabase SQL Editor to get started.
--

-- =============================================
-- 1. PROFILES TABLE
-- Stores user data like username, score, etc.
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  banner_color TEXT,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they don't exist (for backward compatibility for users with old schemas)
-- This ensures that users who set up the database with an older version of this script get the new columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles table
DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone."
ON public.profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =============================================
-- 2. HANDLE NEW USER FUNCTION & TRIGGER
-- Automatically creates a profile when a new user signs up.
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. TEST RESULTS TABLE
-- Stores scores from practice tests.
-- =============================================
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT test_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Policies for test_results table
DROP POLICY IF EXISTS "Users can view their own test results." ON public.test_results;
CREATE POLICY "Users can view their own test results."
ON public.test_results
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own test results." ON public.test_results;
CREATE POLICY "Users can insert their own test results."
ON public.test_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 4. INCREMENT SCORE FUNCTION
-- A secure way to update a user's score.
-- =============================================
CREATE OR REPLACE FUNCTION public.increment_user_score(increment_value INT)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET score = score + increment_value,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. STORAGE BUCKETS & POLICIES
-- =============================================

-- Create public bucket for avatars if it doesn't exist.
-- Adds file size and type restrictions for security.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 1048576, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE 
SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

--
-- RLS POLICIES FOR storage.objects
-- Clean up old/conflicting policies before creating new ones.
--
DROP POLICY IF EXISTS "Public can view files in avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
-- Also dropping some older policy names just in case.
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar." ON storage.objects;

-- POLICY 1: Allow public read access to avatars.
CREATE POLICY "Public can view files in avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- POLICY 2: Allow authenticated users to upload files into their own folder.
-- The file path must be in the format: {user_id}/{file_name}.
-- This prevents users from uploading files into other users' folders.
CREATE POLICY "Authenticated users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- POLICY 3: Allow users to update their own files.
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'avatars' );

-- POLICY 4: Allow users to delete their own files.
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING ( auth.uid() = owner AND bucket_id = 'avatars' );

--
-- End of script.
--
`;

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-md text-sm text-left overflow-x-auto relative">
    <code>{children}</code>
  </pre>
);

// FIX: Changed to a named export to resolve potential module resolution issues.
export const DatabaseSetup: React.FC = () => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(allSqlCommands);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <div className="text-center">
                <DatabaseIcon className="mx-auto text-fire-orange-start" size={48} />
                <h1 className="text-3xl font-bold mt-4">Database Setup Required</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    To use all features of AptiPro, you need to set up your Supabase database.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                    Copy the SQL script below and run it in your project's SQL Editor.
                </p>
            </div>
            <div className="mt-6 relative">
                <CodeBlock>{allSqlCommands}</CodeBlock>
                <button 
                    onClick={copyToClipboard} 
                    className="absolute top-4 right-4 p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                    {copied ? <CheckIcon className="text-green-500" /> : <ClipboardIcon />}
                </button>
            </div>
        </div>
    );
};
