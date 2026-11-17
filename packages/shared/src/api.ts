/** Shared API contract between apps/api and apps/web. */
export const API_VERSION = 'v1';

export interface ApiError {
  error: string;
}

export interface StageSummary {
  id: number;
  titleFa: string;
  descriptionFa: string;
  track: 'tg' | 'ru';
  lessons: { id: string; titleFa: string; newLetters: string[] }[];
  comingSoon?: boolean;
}
