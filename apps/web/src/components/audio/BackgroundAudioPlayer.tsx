"use client";

import React, { useState, useEffect, useRef } from "react";
import { Music, Volume2, VolumeX, Play, Pause, SkipForward } from "lucide-react";

// Helper to extract clean YouTube Video ID from any format URL
export function extractYoutubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const match = clean.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function BackgroundAudioPlayer() {
  const [videoList, setVideoList] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isApiReadyRef = useRef(false);

  // Load configured links from localStorage
  const loadPlaylist = () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("bg_music_youtube_links") || "";
    // Default relax/lofi chill trading music if empty
    const defaultIds = ["jfKfPfyJRdk", "5qap5aO4i9A", "DWcJFNfaw9c"];
    const parsed = raw
      .split(/[,;\n]/)
      .map((item) => extractYoutubeId(item))
      .filter((id): id is string => Boolean(id));

    const finalPlaylist = parsed.length > 0 ? parsed : defaultIds;
    setVideoList(finalPlaylist);
  };

  useEffect(() => {
    loadPlaylist();

    // Listen to storage events so when owner saves in /owner/key it updates immediately
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bg_music_youtube_links") {
        loadPlaylist();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      isApiReadyRef.current = true;
      initPlayer();
    };

    if ((window as any).YT && (window as any).YT.Player) {
      isApiReadyRef.current = true;
      initPlayer();
    }
  }, [videoList]);

  const initPlayer = () => {
    if (!videoList.length || !isApiReadyRef.current || playerRef.current) return;

    try {
      playerRef.current = new (window as any).YT.Player("yt-bg-audio-frame", {
        height: "1",
        width: "1",
        videoId: videoList[0],
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            // Player is ready
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              handleNextTrack();
            } else if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
        },
      });
    } catch (e) {
      console.warn("YouTube player init error", e);
    }
  };

  const handleNextTrack = () => {
    if (!videoList.length) return;
    const nextIdx = (currentIndex + 1) % videoList.length;
    setCurrentIndex(nextIdx);
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(videoList[nextIdx]);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) {
      initPlayer();
    }
    if (!playerRef.current || typeof playerRef.current.playVideo !== "function") return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  return (
    <>
      {/* Hidden zero-size YouTube iframe */}
      <div className="fixed -bottom-10 -left-10 w-1 h-1 opacity-0 pointer-events-none overflow-hidden z-0">
        <div id="yt-bg-audio-frame" />
      </div>

      {/* Floating Mini Player Widget (Bisa di-pause, mini, unobtrusive) */}
      <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-50 select-none">
        <div className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-full bg-zinc-950/90 border border-zinc-800/90 backdrop-blur-md shadow-xl text-zinc-300 hover:border-zinc-700 transition-all">
          <button
            type="button"
            onClick={togglePlay}
            className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors ${
              isPlaying
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
            title={isPlaying ? "Pause Music" : "Play Background Music"}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>

          {/* Mini info and controls */}
          <div className="flex items-center gap-1 pr-2">
            <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-400 max-w-[90px] sm:max-w-[120px] truncate pl-1">
              <Music className={`h-3 w-3 shrink-0 ${isPlaying ? "text-emerald-400 animate-spin" : "text-zinc-500"}`} />
              <span className="truncate">{isPlaying ? "Trading Chill" : "Music Paused"}</span>
            </span>

            <button
              type="button"
              onClick={handleNextTrack}
              className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Next Track / Skip"
            >
              <SkipForward className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
