import { GoogleGenAI, Type } from "@google/genai";

export async function explainWordText(word: string): Promise<{ arabicText: string, videoPrompt: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Explain the meaning and the need/usefulness of this word/concept: "${word}". Make the explanation in engaging Arabic, suitable for a short audio/video. Also provide an English prompt describing a matching video scene for the word.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          arabicText: { type: Type.STRING, description: "A beautiful, engaging Arabic explanation of the word, about 3-4 sentences." },
          videoPrompt: { type: Type.STRING, description: "A vivid English prompt for a video generator (like Veo) that perfectly visually represents the word, cinematic style." }
        },
        required: ["arabicText", "videoPrompt"]
      }
    }
  });

  const text = response.text?.trim() || "{}";
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON", text);
    return { arabicText: "حدث خطأ أثناء التوليد.", videoPrompt: "An error occurred." };
  }
}

function pcmBase64ToWavUrl(base64: string, sampleRate = 24000): string {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const buffer = bytes.buffer;
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      v.setUint8(o + i, s.charCodeAt(i));
    }
  };
  
  let offset = 0;
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + len, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM)
  view.setUint16(offset, 1, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
  view.setUint32(offset, sampleRate * 2, true); offset += 4; // ByteRate
  view.setUint16(offset, 2, true); offset += 2; // BlockAlign
  view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
  
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, len, true); offset += 4;
  
  const blob = new Blob([wavHeader, buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export async function generateTTS(text: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    // @ts-ignore
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return pcmBase64ToWavUrl(base64Audio);
    }
    return null;
  } catch (e) {
    console.error("TTS generation error", e);
    return null;
  }
}

export async function generateVeoVideo(prompt: string, onProgress?: (status: string) => void): Promise<string | null> {
  let ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY }); // Requires user API key
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'A beautiful abstract cinematic background',
      config: {
        numberOfVideos: 1,
        resolution: '720p', 
        aspectRatio: '9:16' // Short format!
      }
    });

    onProgress?.('Generating Video...');

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      // Re-create AI instance just in case
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY }); 
      operation = await ai.operations.getVideosOperation({operation: operation});
      onProgress?.('Still generating Video... This takes a few minutes.');
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || '',
        },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url;
    }
  } catch (e) {
    console.error("Video generation error", e);
  }
  return null;
}
