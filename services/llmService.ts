
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { AppSettings, AssistantAction, EditorContext } from "../types"; 
import { DEFAULT_MODELS } from "../constants";

interface AIClientConfig {
  provider: string;
  model: string;
  apiKey: string;
  endpoint: string;
  headers: Record<string, string>;
  isGemini: boolean;
}

const getAIClientConfig = (settings: AppSettings): AIClientConfig => {
  const provider = settings.activeProvider;
  
  // PRIORITAS: API Key dari input user di UI
  let apiKey = settings.apiKeys[provider] || ''; 
  
  // CADANGAN: Jika di UI kosong, pakai environment variable (Vercel)
  if (!apiKey && process.env.API_KEY) {
    apiKey = process.env.API_KEY;
  }
  
  let modelName = settings.selectedModel[provider] || DEFAULT_MODELS[provider];
  let endpoint = '';
  let headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  let isGemini = false;

  switch (provider) {
    case 'Gemini':
      isGemini = true;
      break;
    case 'OpenAI (GPT)':
      endpoint = 'https://api.openai.com/v1/chat/completions';
      break;
    case 'DeepSeek':
      endpoint = 'https://api.deepseek.com/chat/completions';
      break;
    case 'Grok (xAI)':
      endpoint = 'https://api.x.ai/v1/chat/completions';
      break;
    default:
      endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  return { provider, model: modelName, apiKey, endpoint, headers, isGemini };
};

// --- STREAMING TRANSLATION FUNCTION ---
export const translateTextStream = async (
  text: string, 
  settings: AppSettings, 
  onChunk: (chunk: string) => void
): Promise<{ result: string, detectedLanguage: string | null }> => {
  const config = getAIClientConfig(settings);
  if (!config.apiKey) throw new Error(`API Key untuk ${config.provider} belum diisi. Masukkan Key dulu ya Kak!`);
  
  const instruction = settings.translationInstruction || "Terjemahkan dengan gaya novel yang mengalir.";
  const targetLang = settings.targetLanguage || "Indonesian";
  const glossary = settings.glossary || [];

  // --- SMART GLOSSARY FILTERING ---
  // Hanya ambil item glosarium yang BENAR-BENAR MUNCUL di input text.
  const relevantGlossary = glossary.filter(item => {
    return text.toLowerCase().includes(item.original.toLowerCase());
  });

  const glossaryInstruction = relevantGlossary.length > 0 
    ? `
    [🚨 MANDATORY GLOSSARY / GLOSARIUM WAJIB 🚨]
    CRITICAL: The following terms appear in the text and MUST be translated EXACTLY as defined.
    DO NOT IGNORE THIS LIST. CHECK EVERY SENTENCE AGAINST THIS LIST.
    
    ${relevantGlossary.map(item => `• "${item.original}"  ➔  "${item.translated}"`).join('\n')}
    
    INSTRUCTION: If you see the source word, you MUST use the target word.
    `
    : "";

  const systemInstruction = `
    ROLE: Expert Novel Translator to ${targetLang}.
    
    TASK: Translate the input text while strictly adhering to the glossary.

    [PROCESS - FOR LONG TEXTS]
    1. Read the text sentence by sentence.
    2. BEFORE translating a sentence, scan it for "MANDATORY GLOSSARY" terms.
    3. Replace terms immediately.
    4. Ensure the style flows naturally.

    ${glossaryInstruction}

    [STYLE]
    ${instruction}

    [FORMATTING]
    1. No Markdown Headers (#).
    2. Use standard paragraphs.
  `;

  let fullText = "";
  let detectedLanguage = null;

  try {
    if (config.isGemini) {
      const ai = new GoogleGenAI({ apiKey: config.apiKey }); 
      const responseStream = await ai.models.generateContentStream({
        model: config.model,
        contents: [{ role: 'user', parts: [{ text: text }] }], 
        config: { 
          systemInstruction, 
          temperature: 0.3, 
          topP: 0.95,
        },
      });

      for await (const chunk of responseStream) {
        const chunkText = chunk.text || "";
        fullText += chunkText;
        onChunk(chunkText); 
      }
    } 
    else {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          stream: true 
        })
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `API Error (${response.status})`);
      }

      if (!response.body) throw new Error("Browser Kakak nggak dukung streaming nih.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line === "data: [DONE]") break;
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.replace("data: ", ""));
              const content = json.choices[0]?.delta?.content || "";
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {}
          }
        }
      }
    }

    return { result: fullText.trim(), detectedLanguage };

  } catch (error: any) {
     console.error("Translation Error:", error);
     throw error;
  }
};

export const translateText = async (text: string, settings: AppSettings): Promise<{ result: string, detectedLanguage: string | null }> => {
    let resultText = "";
    const res = await translateTextStream(text, settings, (chunk) => { resultText += chunk });
    return res;
};

// --- TOOLS DEFINITION ---
const geminiGlossaryTool: FunctionDeclaration = {
  name: 'add_to_glossary',
  description: 'Simpan istilah baru ke glosarium.',
  parameters: {
    type: Type.OBJECT,
    properties: { 
      items: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                original: { type: Type.STRING },
                translated: { type: Type.STRING }
            },
            required: ['original', 'translated']
        }
      }
    },
    required: ['items'],
  },
};

const geminiRemoveGlossaryTool: FunctionDeclaration = {
  name: 'remove_from_glossary',
  description: 'Hapus istilah dari glosarium berdasarkan kata aslinya (original).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      originals: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Daftar kata asli (original) yang ingin dihapus."
      }
    },
    required: ['originals']
  }
};

const openAIGlossaryTool = {
  type: "function",
  function: {
    name: "add_to_glossary",
    description: "Simpan istilah baru ke glosarium.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              original: { type: "string" },
              translated: { type: "string" }
            },
            required: ["original", "translated"]
          }
        }
      },
      required: ["items"]
    }
  }
};

const openAIRemoveGlossaryTool = {
  type: "function",
  function: {
    name: "remove_from_glossary",
    description: "Hapus istilah dari glosarium berdasarkan kata aslinya.",
    parameters: {
      type: "object",
      properties: {
        originals: {
          type: "array",
          items: { type: "string" },
          description: "Daftar kata asli (original) yang ingin dihapus."
        }
      },
      required: ["originals"]
    }
  }
};

// --- CHAT FUNCTION ---
export const chatWithAssistant = async (userMessage: string, settings: AppSettings, editorContext?: EditorContext): Promise<AssistantAction> => {
  if (['reset', 'bersihkan', 'clear'].includes(userMessage.toLowerCase().trim())) {
      return { type: 'CLEAR_CHAT', message: "Siap! Memori Danggo sudah dibersihkan. 🍡" };
  }

  const config = getAIClientConfig(settings);
  if (!config.apiKey) throw new Error(`API Key untuk ${config.provider} belum diisi.`);

  const activeProject = settings.projects.find(p => p.id === settings.activeProjectId);
  const glossaryCount = activeProject?.glossary.length || 0;

  const systemPrompt = `
    Nama: Danggo 🍡. 
    Peran: Asisten Penulis/Penerjemah.
    
    STATUS:
    - Glosarium: ${glossaryCount} item.

    ATURAN UTAMA:
    1. PENYIMPANAN: Gunakan tool 'add_to_glossary' jika user ingin menyimpan kata.
    2. PENGHAPUSAN: Gunakan tool 'remove_from_glossary' jika user ingin MENGHAPUS kata dari glosarium.
    3. ANTI-LOOP: Jangan panggil tool ulang jika user hanya bertanya status.
    4. TEKS: Jawab pertanyaan status dengan teks biasa.

    Gaya Bicara: Santai, membantu, to-the-point.
  `;

  try {
    if (config.isGemini) {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({
          model: config.model,
          contents: [
            ...settings.assistantChat
               .filter(m => !m.isHidden) 
               .slice(-8)
               .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })), 
            { role: 'user', parts: [{ text: userMessage }] }
          ],
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: [geminiGlossaryTool, geminiRemoveGlossaryTool] }],
            generationConfig: { 
                temperature: 0.3,
                maxOutputTokens: 2000
            }
          }
        });

        const fc = response.functionCalls?.[0];
        if (fc) {
            if (fc.name === 'add_to_glossary') {
                return { type: 'ADD_GLOSSARY', payload: fc.args.items || [], message: `Siap Kak! Memproses glosarium...` };
            }
            if (fc.name === 'remove_from_glossary') {
                // @ts-ignore
                const originals = fc.args.originals || [];
                return { type: 'REMOVE_GLOSSARY', payload: originals, message: `Siap, menghapus ${originals.length} item...` };
            }
        }
        return { type: 'NONE', message: response.text || "..." };
    } 
    else {
       const messages = [
          { role: 'system', content: systemPrompt },
          ...settings.assistantChat.filter(m => !m.isHidden).slice(-8).map(m => ({ 
            role: m.role === 'model' ? 'assistant' : 'user', 
            content: m.text 
          })),
          { role: 'user', content: userMessage }
       ];

       const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify({
            model: config.model,
            messages: messages,
            temperature: 0.3,
            tools: [openAIGlossaryTool, openAIRemoveGlossaryTool],
          })
       });

       const data = await response.json();
       if (!response.ok) throw new Error(data.error?.message || "API Error");

       const message = data.choices?.[0]?.message;
       
       if (message.tool_calls && message.tool_calls.length > 0) {
           const toolCall = message.tool_calls[0];
           const args = JSON.parse(toolCall.function.arguments);
           if (toolCall.function.name === 'add_to_glossary') {
              return { type: 'ADD_GLOSSARY', payload: args.items || [], message: "Siap Kak! Memproses glosarium..." };
           }
           if (toolCall.function.name === 'remove_from_glossary') {
              return { type: 'REMOVE_GLOSSARY', payload: args.originals || [], message: "Siap, menghapus item..." };
           }
       }

       return { type: 'NONE', message: message.content || "..." };
    }

  } catch (err: any) {
      return { type: 'NONE', message: `Error: ${err.message}` };
  }
};
