import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContexts';
import { supabase } from '../services/supabase';
import { MailIcon, EditIcon, TrashIcon, FlameIcon, CheckIcon, WarningIcon, StarIcon, TrophyIcon, BookOpenIcon, TargetIcon } from './Icons';
import { Profile as ProfileType, TestResult } from '../types';
import Avatar from './Avatar';
import DatabaseSetupInstructions from './DatabaseSetupInstructions';
import { format } from 'date-fns';

const bannerColorOptions = [
  { name: 'Fire', class: 'from-fire-orange-start to-fire-red-end' },
  { name: 'Ocean', class: 'from-blue-500 to-cyan-400' },
  { name: 'Forest', class: 'from-green-500 to-emerald-500' },
  { name: 'Dusk', class: 'from-purple-600 to-indigo-600' },
  { name: 'Sunset', class: 'from-yellow-400 to-orange-500' },
  { name: 'Galaxy', class: 'from-slate-800 to-slate-900' },
];

const BIO_CHAR_LIMIT = 160;

type SaveStatus = 'idle' | 'typing' | 'saving' | 'success' | 'error';
type Achievement = { id: string; name: string; description: string; icon: React.ReactElement; };
type ProfileStats = { testsTaken: number; overallAccuracy: number; bestTopic: string | null; };

const Badge: React.FC<{ achievement: Achievement }> = ({ achievement }) => (
    <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full text-white">
            {achievement.icon}
        </div>
        <div className="ml-3">
            <p className="font-semibold text-sm">{achievement.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{achievement.description}</p>
        </div>
    </div>
);


const StatusIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
    if (status === 'saving') {
        return <div className="flex items-center text-sm text-gray-500 dark:text-gray-400"><div className="w-4 h-4 mr-2 border-2 border-t-transparent rounded-full animate-spin border-gray-400"></div>Saving...</div>;
    }
    if (status === 'success') {
        return <div className="flex items-center text-sm text-green-500"><CheckIcon size={16} className="mr-1"/> Saved</div>;
    }
    if (status === 'error') {
        return <div className="flex items-center text-sm text-red-500"><WarningIcon size={16} className="mr-1"/> Save failed</div>;
    }
    if (status === 'typing') {
        return <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">...</div>;
    }
    return <div className="flex items-center text-sm text-gray-400 dark:text-gray-500"><CheckIcon size={16} className="mr-1"/> Up to date</div>;
};

const Profile: React.FC = () => {
    const { userId } = useParams<{ userId?: string }>();
    const { user: currentUser, profile: currentUserProfile, setProfile: setCurrentUserProfile, signOut } = useAuth();
    
    const [viewedProfile, setViewedProfile] = useState<ProfileType | null>(null);
    const [testHistory, setTestHistory] = useState<TestResult[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [profileStats, setProfileStats] = useState<ProfileStats>({ testsTaken: 0, overallAccuracy: 0, bestTopic: null });
    const [formData, setFormData] = useState({ username: '', bio: '' });

    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [bannerColor, setBannerColor] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [isEditingBanner, setIsEditingBanner] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    
    const isOwnProfile = !userId || (currentUser?.id === userId);
    
    const autoSaveTimerRef = useRef<number | null>(null);
    const formDataRef = useRef(formData);
    const viewedProfileRef = useRef(viewedProfile);
    const saveStatusRef = useRef(saveStatus);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { formDataRef.current = formData; }, [formData]);
    useEffect(() => { viewedProfileRef.current = viewedProfile; }, [viewedProfile]);
    useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);
    
    const calculateProfileAnalytics = (profile: ProfileType, history: TestResult[]) => {
        // Calculate Stats
        const testsTaken = history.length;
        const totalCorrect = history.reduce((sum, test) => sum + test.score, 0);
        const totalPossible = history.reduce((sum, test) => sum + test.total_questions, 0);
        const overallAccuracy = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0;

        const topicPerformance: { [key: string]: { correct: number, total: number } } = {};
        history.forEach(test => {
            if (!topicPerformance[test.topic]) topicPerformance[test.topic] = { correct: 0, total: 0 };
            topicPerformance[test.topic].correct += test.score;
            topicPerformance[test.topic].total += test.total_questions;
        });

        let bestTopic: string | null = null;
        let highestAccuracy = -1;
        for (const topic in topicPerformance) {
            const accuracy = (topicPerformance[topic].correct / topicPerformance[topic].total);
            if (accuracy > highestAccuracy) {
                highestAccuracy = accuracy;
                bestTopic = topic;
            }
        }
        setProfileStats({ testsTaken, overallAccuracy, bestTopic });

        // Calculate Achievements
        const earnedAchievements: Achievement[] = [];
        const allAchievements: Achievement[] = [
            { id: 'welcome', name: 'Welcome Aboard', description: 'Joined the AptiPro community.', icon: <StarIcon size={20} /> },
            { id: 'first_test', name: 'First Steps', description: 'Completed your first test.', icon: <StarIcon size={20} /> },
            { id: 'novice_learner', name: 'Novice Learner', description: 'Earned over 1,000 XP.', icon: <StarIcon size={20} /> },
            { id: 'challenger', name: 'Consistent Challenger', description: 'Completed 5 tests.', icon: <StarIcon size={20} /> },
            { id: 'perfect_score', name: 'Perfectionist', description: 'Achieved a perfect score on a test.', icon: <StarIcon size={20} /> },
            { id: 'apti_pro', name: 'AptiPro', description: 'Reached 10,000 XP. True dedication!', icon: <TrophyIcon size={20} /> }
        ];

        if (profile.score >= 0) earnedAchievements.push(allAchievements[0]);
        if (history.length >= 1) earnedAchievements.push(allAchievements[1]);
        if (profile.score >= 1000) earnedAchievements.push(allAchievements[2]);
        if (history.length >= 5) earnedAchievements.push(allAchievements[3]);
        if (history.some(t => t.score === t.total_questions)) earnedAchievements.push(allAchievements[4]);
        if (profile.score >= 10000) earnedAchievements.push(allAchievements[5]);

        setAchievements(earnedAchievements);
    };


    const handleProfileUpdate = useCallback(async (updatePayload: Partial<ProfileType>) => {
        if (!currentUser || Object.keys(updatePayload).length === 0) return;
        
        setSaveStatus('saving');
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ ...updatePayload, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error("Profile update failed. This may be due to security policies.");

            setViewedProfile(data);
            setCurrentUserProfile(data);
            if (updatePayload.hasOwnProperty('banner_color')) {
                setBannerColor(data.banner_color || null);
            }

            setSaveStatus('success');
            setTimeout(() => {
                if (saveStatusRef.current === 'success') {
                    setSaveStatus('idle');
                }
            }, 2000);

        } catch (err: unknown) {
            console.error("Error updating profile:", err);
            let message: string;
            if (err && typeof err === 'object' && 'message' in err) {
                const supabaseError = err as { message: string; details?: string; hint?: string };
                message = supabaseError.message;
                
                if (message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
                    message = "This username is already taken. Please choose another one.";
                } else {
                    if (supabaseError.details) message += ` Details: ${supabaseError.details}`;
                    if (supabaseError.hint) message += ` Hint: ${supabaseError.hint}`;
                }
            } else {
                try {
                    message = JSON.stringify(err);
                } catch {
                    message = "An un-serializable error occurred during the update.";
                }
            }
            
            alert(`Error updating profile: ${message}`);
            setSaveStatus('error');
            
            if (viewedProfileRef.current && updatePayload.hasOwnProperty('banner_color')) {
                setBannerColor(viewedProfileRef.current.banner_color || null);
            }
        }
    }, [currentUser, setCurrentUserProfile]);

    useEffect(() => {
        const fetchProfileData = async () => {
            const profileId = userId || currentUser?.id;
            if (!profileId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setFetchError(null);

            try {
                const profilePromise = supabase.from('profiles').select('*').eq('id', profileId).single();
                const historyPromise = supabase.from('test_results').select('*').eq('user_id', profileId).order('created_at', { ascending: false });

                const [{ data: profileData, error: profileError }, { data: historyData, error: historyError }] = await Promise.all([profilePromise, historyPromise]);
                
                if (profileError) throw profileError;
                if (historyError) throw historyError;
                
                if (profileData) {
                    setViewedProfile(profileData);
                    setFormData({ username: profileData.username || '', bio: profileData.bio || '' });
                    setBannerColor(profileData.banner_color || null);
                    setTestHistory(historyData || []);
                    calculateProfileAnalytics(profileData, historyData || []);
                } else {
                    throw new Error("Profile not found.");
                }
            } catch (err: unknown) {
                console.error("Error fetching profile data:", err);
                let message: string;
                if (err && typeof err === 'object' && 'message' in err) {
                    const supabaseError = err as { message: string; details?: string; hint?: string };
                    message = supabaseError.message;
                    if (supabaseError.details) message += ` Details: ${supabaseError.details}`;
                    if (supabaseError.hint) message += ` Hint: ${supabaseError.hint}`;
                } else {
                    try {
                        message = JSON.stringify(err);
                    } catch {
                        message = "An un-serializable error occurred while fetching the profile.";
                    }
                }
                setFetchError(message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [userId, currentUser]);
    
    const triggerAutoSave = useCallback(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = window.setTimeout(() => {
            const currentFormData = formDataRef.current;
            const currentProfile = viewedProfileRef.current;

            if (!currentProfile) return;

            const payload: Partial<ProfileType> = {};
            const trimmedUsername = currentFormData.username.trim();
            const trimmedBio = currentFormData.bio.trim().slice(0, BIO_CHAR_LIMIT);

            if (trimmedUsername !== (currentProfile.username || '')) {
                payload.username = trimmedUsername || null;
            }
            if (trimmedBio !== (currentProfile.bio || '')) {
                payload.bio = trimmedBio || null;
            }

            if (Object.keys(payload).length > 0) {
                handleProfileUpdate(payload);
            } else {
                setSaveStatus('idle');
            }
        }, 1500);
    }, [handleProfileUpdate]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSaveStatus('typing');
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        triggerAutoSave();
    };

    const handleBannerChange = (colorClass: string | null) => {
        setIsEditingBanner(false);
        if (colorClass !== bannerColor) {
            setBannerColor(colorClass);
            handleProfileUpdate({ banner_color: colorClass });
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !currentUser) return;
        
        setAvatarUploading(true);
        try {
            const file = event.target.files[0];
            const filePath = `${currentUser.id}/${Math.random()}.${file.name.split('.').pop()}`;
    
            await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
            
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const { data, error } = await supabase
                .from('profiles')
                .update({ avatar_url: `${publicUrl}?t=${new Date().getTime()}` })
                .eq('id', currentUser.id)
                .select()
                .single();
    
            if (error) throw error;

            if (data) {
                setCurrentUserProfile(data);
                setViewedProfile(data);
            }
        } catch(err: unknown) {
            console.error("Error uploading avatar:", err);
            let message: string;
            if (err && typeof err === 'object' && 'message' in err) {
                const supabaseError = err as { message: string; details?: string; hint?: string; error?: string };
                // Storage errors can have a different structure
                message = supabaseError.message || supabaseError.error || 'An unknown storage error occurred.';
            } else {
                try {
                    message = JSON.stringify(err);
                } catch {
                    message = "An un-serializable error occurred during avatar upload.";
                }
            }
            alert(`Error uploading avatar: ${message}`);
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you absolutely sure? This action is irreversible.")) {
            alert("Account deletion initiated. A Supabase Edge Function is required for full implementation. Signing out as a placeholder.");
            signOut();
        }
    };

    const getUserTitle = (score: number) => {
        if (score >= 10000) return "AptiPro Master";
        if (score >= 5000) return "Expert Analyst";
        if (score >= 2500) return "Skilled Professional";
        if (score >= 1000) return "Consistent Challenger";
        if (score >= 500) return "Rising Talent";
        return "AptiPro Novice";
    };

    if (isLoading) return <div className="flex items-center justify-center h-full"><div className="w-12 h-12 border-4 border-t-transparent border-fire-orange-start rounded-full animate-spin"></div></div>;
    if (fetchError) return <div className="p-4 sm:p-6 lg:p-8"><DatabaseSetupInstructions feature="profile" error={fetchError} /></div>;
    if (!viewedProfile) return <div className="text-center p-10">Profile not found.</div>;
    
    const displayUsername = typeof viewedProfile?.username === 'string' && viewedProfile.username ? viewedProfile.username : 'AptiPro User';
    const defaultBanner = 'from-fire-orange-start to-fire-red-end';

    return (
        <div className="max-w-4xl mx-auto animate-fade-in space-y-6 pb-24">
            {/* --- Banner & Header Section --- */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                <div className={`relative h-32 bg-gradient-to-r ${isOwnProfile ? (bannerColor || defaultBanner) : (viewedProfile.banner_color || defaultBanner)} transition-all`}>
                     {isOwnProfile && (
                        <>
                            <div className="absolute top-3 right-3 z-20"><StatusIndicator status={saveStatus}/></div>
                            <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="absolute top-3 left-3 p-1.5 bg-black/30 rounded-full text-white hover:bg-black/50 backdrop-blur-sm transition-colors z-20" aria-label="Edit banner"><EditIcon size={16} /></button>
                            {isEditingBanner && (
                                <div className="absolute top-12 left-3 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-xl animate-fade-in z-10 w-64">
                                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Choose Banner</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        {bannerColorOptions.map(color => (<button key={color.name} title={color.name} onClick={() => handleBannerChange(color.class)} className={`w-8 h-8 rounded-full bg-gradient-to-r ${color.class} ring-2 ring-offset-2 dark:ring-offset-gray-900 ${bannerColor === color.class ? 'ring-fire-orange-start' : 'ring-transparent'}`} />))}
                                        <button title="Default" onClick={() => handleBannerChange(null)} className={`w-8 h-8 rounded-full bg-gradient-to-r ${defaultBanner} ring-2 ring-offset-2 dark:ring-offset-gray-900 ${!bannerColor ? 'ring-fire-orange-start' : 'ring-transparent'}`} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="p-6 -mt-16 relative">
                   <div className="relative w-28 h-28">
                       <Avatar avatarUrl={viewedProfile?.avatar_url} name={displayUsername} size={112} className="border-4 border-white dark:border-gray-800" />
                        {isOwnProfile && (
                            <>
                                <button onClick={() => avatarFileInputRef.current?.click()} className="absolute bottom-1 right-1 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-colors" disabled={avatarUploading} aria-label="Upload profile picture">
                                    {avatarUploading ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></div> : <EditIcon size={16} />}
                                </button>
                               <input type="file" ref={avatarFileInputRef} onChange={handleAvatarUpload} accept="image/jpeg,image/png" className="hidden" disabled={avatarUploading} />
                            </>
                        )}
                    </div>
                </div>
            </div>

             {/* --- Main Content Grid --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="md:col-span-1 space-y-6">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                        {isOwnProfile ? (
                            <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder="Enter your username" className="text-2xl font-bold bg-transparent focus:outline-none w-full border-b-2 border-transparent focus:border-fire-orange-start transition-colors" />
                        ) : (
                            <h1 className="text-2xl font-bold">{displayUsername}</h1>
                        )}
                        <p className="text-sm font-semibold text-fire-orange-start mt-1">{getUserTitle(viewedProfile.score)}</p>
                        
                        <div className="flex items-center text-lg font-semibold text-gray-700 dark:text-gray-200 mt-4">
                            <FlameIcon className="text-orange-500 mr-2" />
                            <span>{(viewedProfile?.score || 0).toLocaleString()} XP</span>
                        </div>
                        {isOwnProfile && (
                            <p className="flex items-center text-sm mt-2 text-gray-500 dark:text-gray-400">
                                <MailIcon className="mr-2"/>
                                {currentUser?.email}
                            </p>
                        )}

                        <div className="mt-6">
                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Bio</label>
                            {isOwnProfile ? (
                                <>
                                    <textarea name="bio" value={formData.bio} onChange={handleInputChange} className="mt-1 w-full p-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-fire-orange-start" rows={4} maxLength={BIO_CHAR_LIMIT} placeholder="Tell us about yourself..." />
                                    <div className="text-right text-xs text-gray-500">{formData.bio.length}/{BIO_CHAR_LIMIT}</div>
                                </>
                            ) : (
                                 <p className="text-sm text-gray-600 dark:text-gray-300 italic mt-1">
                                    {viewedProfile.bio ? `"${viewedProfile.bio}"` : "This user hasn't added a bio yet."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Right Column */}
                <div className="md:col-span-2 space-y-6">
                    {/* Performance Stats */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                        <h2 className="font-bold text-xl mb-4">Performance Stats</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <BookOpenIcon size={28} className="mx-auto text-fire-orange-start"/>
                                <p className="text-2xl font-bold mt-2">{profileStats.testsTaken}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Tests Taken</p>
                            </div>
                             <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <TargetIcon size={28} className="mx-auto text-fire-orange-start"/>
                                <p className="text-2xl font-bold mt-2">{profileStats.overallAccuracy}%</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
                            </div>
                             <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg col-span-2 sm:col-span-1">
                                <TrophyIcon size={28} className="mx-auto text-fire-orange-start"/>
                                <p className="text-lg font-bold mt-2 truncate">{profileStats.bestTopic || 'N/A'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Best Topic</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Achievements */}
                     <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                        <h2 className="font-bold text-xl mb-4">Achievements</h2>
                        {achievements.length > 0 ? (
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {achievements.map(ach => <Badge key={ach.id} achievement={ach}/>)}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">Complete some tests to start earning achievements!</p>
                        )}
                    </div>

                    {/* Recent Activity */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                        <h2 className="font-bold text-xl mb-4">Recent Activity</h2>
                        {testHistory.length > 0 ? (
                            <ul className="space-y-3">
                                {testHistory.slice(0, 5).map(test => (
                                    <li key={test.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div>
                                            <p className="font-semibold">{test.topic}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(test.created_at), "MMM d, yyyy")}</p>
                                        </div>
                                        <div className="text-right">
                                             <p className="font-bold text-fire-orange-start">{test.score}/{test.total_questions}</p>
                                             <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <p className="text-sm text-gray-500 text-center py-4">No recent activity. <Link to="/practice" className="text-fire-orange-start font-semibold">Take a test!</Link></p>
                        )}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
             {isOwnProfile && (
                <div className="mt-6 p-6 bg-red-50 dark:bg-gray-800/20 border border-red-200 dark:border-red-500/30 rounded-2xl shadow-lg">
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Danger Zone</h2>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">This action is permanent and cannot be undone.</p>
                    <div className="mt-4">
                        <button onClick={handleDeleteAccount} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">
                           <span className="flex items-center"><TrashIcon size={16} className="mr-2"/> Delete My Account</span>
                        </button>
                    </div>
                </div>
             )}
        </div>
    );
};

export default Profile;
