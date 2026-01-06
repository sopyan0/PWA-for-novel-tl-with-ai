
export interface GlossaryItem {
  id: string;
  original: string;
  translated: string;
  sourceLanguage: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'tool';
  text: string;
  tool_call_id?: string;
  functionName?: string;
  isHidden?: boolean; 
}

export interface SavedTranslation {
  id: string;
  projectId: string; 
  name: string;
  translatedText: string;
  timestamp: string;
}

export interface NovelProject {
  id: string;
  name: string; 
  sourceLanguage: string;
  targetLanguage: string;
  translationInstruction: string;
  glossary: GlossaryItem[];
}

export interface AppSettings {
  // Global Tech Settings
  activeProvider: string;
  apiKeys: Record<string, string>;
  selectedModel: Record<string, string>;
  assistantChat: ChatMessage[];

  // Project Management
  activeProjectId: string;
  projects: NovelProject[];
  
  // REMOVED: savedTranslations 
  // Alasan: Data ini berat. Jangan disimpan di memori global. 
  // Kita akan fetch langsung dari IndexedDB di komponen yang membutuhkannya.

  // Runtime Context
  sourceLanguage?: string;
  targetLanguage?: string;
  translationInstruction?: string;
  glossary?: GlossaryItem[];
}

export interface EditorContext {
  sourceText: string;
  translatedText: string;
}

export type Page = 'translate' | 'settings' | 'saved-translations';

export interface AssistantAction {
  type: 'ADD_GLOSSARY' | 'REMOVE_GLOSSARY' | 'SET_INSTRUCTION' | 'NONE' | 'CLEAR_CHAT' | 'READ_SAVED_TRANSLATION' | 'READ_CURRENT_EDITOR';
  payload?: any;
  message: string;
}
