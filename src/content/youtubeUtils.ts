import { YoutubeTranscript } from 'youtube-transcript';

export async function getYouTubeMetadata() {
  try {
    // Advanced DOM extraction specifically for YouTube's architecture
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') || 
                    document.querySelector('meta[name="title"]');
    const title = titleEl?.textContent || titleEl?.getAttribute('content') || document.title.replace(/^\(\d+\)\s*/, '').replace(' - YouTube', '');
                  
    const descEl = document.querySelector('ytd-text-inline-expander#description-inline-expander') || 
                   document.querySelector('meta[name="description"]');
    const description = descEl?.textContent || descEl?.getAttribute('content') || '';
    
    // Robust channel name extraction
    const channelEl = document.querySelector('ytd-video-owner-renderer #channel-name a') || 
                      document.querySelector('link[itemprop="name"]');
    const channelName = channelEl?.textContent || channelEl?.getAttribute('content') || 'Unknown Channel';

    return {
      title: title.trim(),
      channelName: channelName.trim(),
      description: description.trim()
    };
  } catch (err) {
    console.error("Error extracting metadata", err);
    return { title: 'Unknown', channelName: 'Unknown', description: '' };
  }
}

export async function getYouTubeTranscript(videoId: string) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((t: any) => ({
      text: t.text,
      start: t.offset / 1000,
      duration: t.duration / 1000
    }));
  } catch (error: any) {
    console.error('Transcript error:', error);
    throw new Error('No transcript available for this video. It may be music, age-restricted, or have captions disabled.');
  }
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
