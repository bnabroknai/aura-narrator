import { GoogleGenAI, Modality } from '@google/genai';

// Use the default injected API key for Gemini text/tts
const defaultAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractStoryText(pdfBytes: Uint8Array, mimeType: string, personality: string = 'Classic'): Promise<string> {
  const base64Data = btoa(
    new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  let prompt = 'Extract and format the entire story from this document into clean, readable text. Remove any formatting artifacts, page numbers, or publisher notes. Just the raw story flowing logically.';
  
  if (personality !== 'Classic') {
    prompt += `\n\nCRITICAL INSTRUCTION: After extracting the story, rewrite the narrative text in the tone, style, and vocabulary of a [${personality}]. Fully immerse the story in this personality.`;
  }

  const response = await defaultAi.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt }
    ]
  });

  return response.text || '';
}

export async function generateNarration(storyText: string, voiceName: string = 'Zephyr'): Promise<Float32Array[]> {
  // TTS limits text, so we might need to chunk if the story is long. 
  // Let's chunk by paragraphs and sequentially generate.
  const chunks = storyText.split(/\n\s*\n/).filter(c => c.trim().length > 0);
  const audioChunks: Float32Array[] = [];

  // To prevent timeouts, we can process them sequentially or batch them. 
  // For safety, let's limit chunks for this demo if there are too many.
  const maxChunks = Math.min(chunks.length, 10); // Safeguard
  
  for (let i = 0; i < maxChunks; i++) {
    const chunk = chunks[i];
    try {
      const resp = await defaultAi.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName } 
            }
          }
        }
      });

      const base64Audio = resp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         // Decode PCM array. Gemini TTS returns 24000hz raw PCM.
         const binaryString = atob(base64Audio);
         const len = binaryString.length;
         const bytes = new Uint8Array(len);
         for (let j = 0; j < len; j++) bytes[j] = binaryString.charCodeAt(j);
         
         // 16-bit PCM little-endian decoding
         const floats = new Float32Array(bytes.length / 2);
         const dataView = new DataView(bytes.buffer);
         for (let j = 0; j < floats.length; j++) {
            floats[j] = dataView.getInt16(j * 2, true) / 32768.0;
         }
         audioChunks.push(floats);
      }
    } catch(err) {
      console.warn("Failed to generate audio for a chunk", err);
    }
  }

  return audioChunks;
}

export async function generateAmbientMusic(storyTheme: string): Promise<Uint8Array | null> {
  // Use Lyria. Needs the User's paid key.
  
  let apiKey: string | undefined;
  try {
    apiKey = (window as any).process?.env?.API_KEY || (process as any)?.env?.API_KEY;
  } catch (e) {
    console.warn("Could not access process.env.API_KEY");
  }

  if (!apiKey) {
    console.warn("Lyria generation requested but no valid API_KEY found. Skipping ambient music.");
    return null;
  }

  const lyriaAi = new GoogleGenAI({ apiKey });

  let audioBase64 = "";

  try {
    const responseStream = await lyriaAi.models.generateContentStream({
      model: 'lyria-3-pro-preview', 
      contents: 'Generate cinematic ambient background music for a story about: ' + storyTheme.slice(0, 500) + '. No vocals, just ambient spatial atmosphere.'
    });

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          audioBase64 += part.inlineData.data;
        }
      }
    }
  } catch (err) {
     console.error("Lyria generation failed:", err);
     return null; // Swallow error to let narration continue
  }

  if (!audioBase64) return null;

  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
