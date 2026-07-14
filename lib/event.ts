export const EVENT_START = "2026-08-15T08:30:00-06:00";
export const EVENT_CAPACITY = 250;

export function eventDaysRemaining(now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(EVENT_START).getTime() - now) / 86_400_000));
}

export type EventSpeaker = {
  id: number;
  name: string;
  professional_title: string;
  talk_title: string;
  talk_time: string;
  bio: string;
  photo_url: string | null;
  video_url: string | null;
  display_order: number;
  is_published: boolean;
};
