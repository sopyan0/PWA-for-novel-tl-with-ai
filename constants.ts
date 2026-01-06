
import { AppSettings, NovelProject } from "./types";

export const LANGUAGES = [
  "Deteksi Otomatis",
  "Indonesia", "Inggris", "Korea", "Jepang", "Mandarin", 
  "Prancis", "Jerman", "Spanyol", "Arab", "Rusia"
];

export const STORAGE_KEY = 'novtl_settings_v2_projects'; 

export const LLM_PROVIDERS = ['Gemini', 'OpenAI (GPT)', 'DeepSeek', 'Grok (xAI)'];

export const DEFAULT_MODELS: Record<string, string> = {
  'Gemini': 'gemini-flash-lite-latest', 
  'OpenAI (GPT)': 'gpt-4o-mini',
  'DeepSeek': 'deepseek-chat',
  'Grok (xAI)': 'grok-2-latest'
};

const DEFAULT_PROJECT_ID = 'default-project-001';

const DEFAULT_PROJECT: NovelProject = {
  id: DEFAULT_PROJECT_ID,
  name: 'Novel Pertamaku',
  sourceLanguage: 'Deteksi Otomatis',
  targetLanguage: 'Indonesia',
  translationInstruction: 'Terjemahkan dengan akurasi nuansa tinggi. Tangkap idiom dan konteks budaya, pastikan teks mengalir alami layaknya novel best-seller.',
  glossary: []
};

export const DEFAULT_SETTINGS: AppSettings = {
  activeProvider: 'Gemini',
  apiKeys: {},
  selectedModel: DEFAULT_MODELS,
  assistantChat: [
    { role: 'model', text: 'Halo Kakak Author! 🍡 Danggo di sini siap nemenin nulis. Sekarang Danggo pakai mode "Lite" biar lebih ngebut tapi tetep pinter. Mau diskusi apa kita hari ini? ✨' }
  ],
  activeProjectId: DEFAULT_PROJECT_ID,
  projects: [DEFAULT_PROJECT],
  // savedTranslations dihapus agar memory footprint kecil
};
