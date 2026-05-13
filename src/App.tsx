/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Play, Volume2, Video, Sparkles, AlertCircle, Download } from "lucide-react";
import { explainWordText, generateTTS, generateVeoVideo } from "./services/ai";
import { Toaster, toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

// @ts-ignore
const hasSelectedApiKey = async () => window.aistudio?.hasSelectedApiKey ? await window.aistudio.hasSelectedApiKey() : false;
// @ts-ignore
const openSelectKey = async () => window.aistudio?.openSelectKey ? await window.aistudio.openSelectKey() : null;

export default function App() {
  const [word, setWord] = useState("");
  const [format, setFormat] = useState<"audio" | "video">("audio");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [progressVal, setProgressVal] = useState(0);

  const [result, setResult] = useState<{
    arabicText: string;
    audioUrl?: string | null;
    videoUrl?: string | null;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stop video/audio when resetting
  const reset = () => {
    setResult(null);
    setStatus("");
    setProgressVal(0);
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerate = async () => {
    if (!word.trim()) {
      toast.error("Please enter a word first!");
      return;
    }

    if (format === "video") {
      const hasKey = await hasSelectedApiKey();
      if (!hasKey) {
        await openSelectKey();
        // Assume key selection was successful to mitigate race condition
      }
    }

    setIsGenerating(true);
    reset();

    try {
      setStatus("Thinking about the word...");
      setProgressVal(10);
      const { arabicText, videoPrompt } = await explainWordText(word);
      setProgressVal(30);

      setStatus("Generating Arabic voice...");
      const audioUrl = await generateTTS(arabicText);
      setProgressVal(50);

      let videoUrl = null;
      if (format === "video") {
        setStatus("Generating cinematic video... (This usually takes a few minutes, please be patient)");
        setProgressVal(60);
        
        let progressInterval = setInterval(() => {
          setProgressVal(prev => prev < 95 ? prev + 1 : prev);
        }, 3000);

        videoUrl = await generateVeoVideo(videoPrompt, (statusMsg) => setStatus(statusMsg));
        clearInterval(progressInterval);
        setProgressVal(100);
      } else {
        setProgressVal(100);
      }

      setResult({
        arabicText,
        audioUrl,
        videoUrl,
      });
      setStatus("");
      
      if (format === "audio") {
        toast.success("Audio generated successfully!");
      } else {
        toast.success("Video short generated successfully!");
      }
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("Requested entity was not found")) {
         toast.error("API Key not found or invalid. Please select your API Key again via the settings.");
         await openSelectKey();
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4 lg:p-8 font-sans relative overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] rotate-12 pointer-events-none"></div>

      <div className="w-full max-w-2xl space-y-8 z-10">
        
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">K</span>
            </div>
            <div className="text-left text-white">
              <h1 className="text-3xl font-bold tracking-tight">Kalima <span className="text-indigo-400 font-normal">/ كلمة</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">AI Linguistic Visualization</p>
            </div>
          </div>
          <p className="text-lg text-slate-300" dir="rtl">
            تساعدك هذه الأداة على تحويل الكلمات إلى تجارب حسية بالصوت والصورة.
          </p>
        </div>

        {!result && (
          <Card className="bg-white/5 backdrop-blur-2xl border-white/10 rounded-[32px] shadow-2xl text-slate-100 overflow-hidden">
            <CardHeader className="border-b border-white/10 pb-6">
              <CardTitle className="text-slate-100">What word do you want to learn?</CardTitle>
              <CardDescription className="text-slate-400">Enter a word, tool, or concept in any language (we will explain it in Arabic).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="word" className="text-sm font-medium text-slate-400 ml-1">Input Word / الكلمة</Label>
                <Input
                  id="word"
                  placeholder="e.g. Serenity, Quantum Computing..."
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl focus:outline-none focus:ring-2 ring-indigo-500/50 transition-all placeholder:text-slate-600 shadow-inner h-auto text-slate-100"
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div onClick={() => setFormat("audio")}>
                    <div className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center gap-2 transition-all ${format === 'audio' ? 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/20 text-white' : 'bg-white/5 border-white/10 hover:border-indigo-500/50 text-slate-300'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${format === 'audio' ? 'bg-indigo-500 text-white' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40'}`}>
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <span className="font-medium">Audio / صوتي</span>
                    </div>
                  </div>
                  <div onClick={() => setFormat("video")}>
                    <div className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center gap-2 transition-all ${format === 'video' ? 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/20 text-white' : 'bg-white/5 border-white/10 hover:border-indigo-500/50 text-slate-300'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${format === 'video' ? 'bg-indigo-500 text-white' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40'}`}>
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="font-medium">Video / مرئي</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-8 pt-2 px-6">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating} 
                className="w-full py-6 h-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-900/20 hover:scale-[1.01] transition-transform active:scale-[0.98] border-0 text-white"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Masterpiece / إنشاء
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {isGenerating && (
           <div className="w-full p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
             <div className="flex items-center justify-between text-sm font-medium text-slate-300">
               <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {status}</span>
               <span className="text-indigo-400">{Math.round(progressVal)}%</span>
             </div>
             <Progress value={progressVal} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-purple-500" />
             {format === "video" && progressVal > 50 && (
               <div className="flex items-start gap-2 mt-4 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                 <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                 <p>Veo video generation uses the Live API and may take 2-4 minutes to render. Feel free to wait, the result will magically appear here!</p>
               </div>
             )}
           </div>
        )}

        {result && (
          <div className="w-full space-y-6 animate-in zoom-in-95 fade-in duration-500">
             <Button variant="ghost" onClick={reset} className="mb-4 text-slate-400 hover:text-white hover:bg-white/10 rounded-full px-6">
                &larr; Try another word / الكلمة التالية
             </Button>
            
            {result.videoUrl ? (
              <Card className="overflow-hidden bg-black/40 backdrop-blur-2xl border-white/10 rounded-[32px] shadow-2xl relative group pb-0 border">
                  <div className="relative aspect-[9/16] w-full max-w-[400px] mx-auto bg-black flex items-center justify-center rounded-3xl m-4 overflow-hidden shadow-2xl">
                    <video 
                      ref={videoRef}
                      src={result.videoUrl} 
                      className="w-full h-full object-cover"
                      playsInline
                      loop
                      autoPlay
                      muted={false}
                      controls
                    />
                    {result.audioUrl && (
                       // We can't easily sync two media elements flawlessly on the web without WebAudio API, 
                       // but for a simple demo, playing both at the same time is acceptable.
                       <audio src={result.audioUrl} autoPlay />
                    )}
                  </div>
                  <div className="absolute top-8 inset-x-8">
                    <div className="bg-black/40 backdrop-blur-xl px-5 py-4 rounded-2xl border border-white/10 shadow-2xl text-right overflow-y-auto max-h-[30vh]" dir="rtl">
                       <p className="text-white text-lg font-medium leading-relaxed drop-shadow-sm">{result.arabicText}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-6 right-6">
                    <Button 
                      size="icon" 
                      className="rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white"
                      onClick={() => handleDownload(result.videoUrl!, `${word}-video.mp4`)}
                      title="Download Video"
                    >
                      <Download className="w-5 h-5" />
                    </Button>
                  </div>
              </Card>
            ) : (
              <Card className="bg-white/5 backdrop-blur-2xl border-white/10 rounded-[32px] shadow-2xl text-slate-100 overflow-hidden">
                <CardHeader className="border-b border-white/10 pb-6 flex flex-row items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <span className="px-3 py-1 bg-indigo-500 text-[10px] font-bold rounded-full uppercase tracking-tighter text-white">Audio Result</span>
                  </div>
                  <CardTitle className="text-right flex items-center justify-end gap-2 text-indigo-300" dir="rtl">
                    <Volume2 className="w-5 h-5 text-indigo-400" />
                    الشرح الصوتي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {result.audioUrl ? (
                    <div className="w-full bg-black/20 border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-inner">
                      <Button size="icon" className="rounded-full w-14 h-14 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg border-0" onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = 0;
                          audioRef.current.play();
                        }
                      }}>
                        <Play className="w-6 h-6 ml-1" />
                      </Button>
                      <audio ref={audioRef} controls src={result.audioUrl} className="w-full max-w-full opacity-60 hover:opacity-100 transition-opacity" autoPlay />
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="rounded-full w-14 h-14 shrink-0 border-white/10 bg-white/5 hover:bg-white/10 text-white" 
                        onClick={() => handleDownload(result.audioUrl!, `${word}-audio.wav`)}
                        title="Download Audio"
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl text-center shadow-inner">Failed to generate audio.</div>
                  )}

                  <ScrollArea className="h-[200px] w-full rounded-2xl border border-white/10 p-6 bg-black/20 shadow-inner">
                    <p className="text-2xl leading-relaxed text-slate-300 text-right font-serif" dir="rtl">
                      {result.arabicText}
                    </p>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}

