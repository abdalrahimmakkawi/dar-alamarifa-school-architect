import React, { useState } from 'react';
import { 
  Sparkles, 
  Printer, 
  Calendar, 
  ChevronRight, 
  BookOpen, 
  GraduationCap, 
  Globe,
  Brain,
  Palette,
  Microscope,
  History,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callAgent } from '../../agents/engine';
import { supabase } from '../../lib/supabase';

import { translations } from '../../lib/translations';

type AgeGroup = 'elementary' | 'high_school';
type Category = 'story' | 'math' | 'science' | 'arabic' | 'geography' | 'logic' | 'career' | 'literature' | 'skills';

interface EduPlayPanelProps {
  appLanguage?: 'en' | 'ar';
}

export default function EduPlayPanel({ appLanguage = 'en' }: EduPlayPanelProps) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('elementary');
  const [category, setCategory] = useState<Category>('story');
  const [language, setLanguage] = useState<'ar' | 'en'>(appLanguage);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);

  const t = translations[appLanguage];

  const categories: Record<AgeGroup, { id: Category, label: string, icon: any }[]> = {
    elementary: [
      { id: 'story', label: t.storyTime, icon: BookOpen },
      { id: 'math', label: t.mathAdventures, icon: Brain },
      { id: 'arabic', label: t.arabicGames, icon: Languages },
      { id: 'science', label: t.scienceWonders, icon: Microscope },
      { id: 'geography', label: t.geographyExplorer, icon: Globe },
    ],
    high_school: [
      { id: 'logic', label: t.criticalThinking, icon: Brain },
      { id: 'career', label: t.careerInspiration, icon: GraduationCap },
      { id: 'literature', label: t.literaturePoetry, icon: Palette },
      { id: 'science', label: t.stemExploration, icon: Microscope },
      { id: 'skills', label: t.lifeSkills, icon: History },
    ]
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setActivity(null);
    
    const prompt = `Generate an EduPlay activity for ${ageGroup.replace('_', ' ')} students (Ages ${ageGroup === 'elementary' ? '6-14' : '14-18'}) in the category of ${category}. Language: ${language === 'ar' ? 'Arabic' : 'English'}.`;
    
    try {
      const response = await callAgent('tutor', prompt, [], language);
      setActivity(response);
    } catch (error) {
      console.error('EduPlay error:', error);
      setActivity('⚠️ Failed to generate activity. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveToCalendar = async () => {
    if (!activity) return;
    const title = activity.split('\n')[0] || 'EduPlay Activity';
    
    await supabase.from('events').insert([{
      title: `EduPlay: ${title}`,
      description: activity,
      date: new Date().toISOString().split('T')[0],
      type: 'academic'
    }]);
    
    alert(t.activitySaved);
  };

  return (
    <div className={`space-y-6 ${appLanguage === 'ar' ? 'rtl' : 'ltr'}`} dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg shadow-emerald-100">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t.eduPlayModule}</h2>
              <p className="text-slate-500 text-sm">{t.eduPlayDesc}</p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setLanguage('ar')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${language === 'ar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
            >
              العربية
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${language === 'en' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
            >
              English
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t.selectAgeGroup}</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setAgeGroup('elementary'); setCategory('story'); }}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${ageGroup === 'elementary' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${ageGroup === 'elementary' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <BookOpen size={20} />
                </div>
                <h4 className="font-bold text-slate-900">{t.elementary}</h4>
                <p className="text-xs text-slate-500">{t.ages6_14}</p>
              </button>
              <button 
                onClick={() => { setAgeGroup('high_school'); setCategory('logic'); }}
                className={`p-6 rounded-2xl border-2 transition-all text-left ${ageGroup === 'high_school' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${ageGroup === 'high_school' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <GraduationCap size={20} />
                </div>
                <h4 className="font-bold text-slate-900">{t.highSchool}</h4>
                <p className="text-xs text-slate-500">{t.ages14_18}</p>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t.chooseCategory}</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {categories[ageGroup].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${category === cat.id ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 hover:bg-slate-50 text-slate-600'}`}
                >
                  <cat.icon size={16} />
                  <span className="text-xs font-bold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              {t.generatingMagic}
            </>
          ) : (
            <>
              <Sparkles size={20} />
              {t.generateActivity}
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {activity && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">{t.generatedActivity}</h3>
              <div className="flex gap-3">
                <button 
                  onClick={handlePrint}
                  className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
                  title={t.printActivity}
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={handleSaveToCalendar}
                  className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
                  title={t.saveToCalendar}
                >
                  <Calendar size={20} />
                </button>
              </div>
            </div>
            
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                {activity}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
