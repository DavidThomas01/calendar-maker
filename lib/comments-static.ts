import { DayComment } from '@/lib/types';

/**
 * Hardcoded comments data to replace Blob storage
 * This data is sourced from data/comments.json and serves as the static data source
 */
export const STATIC_COMMENTS: DayComment[] = [
  {
    "id": "comment_1754047766308_mnituvqyx",
    "bookingId": "14945179",
    "apartmentName": "At Home in Madrid IX, Trendy Chueca, Prado, GranVia",
    "date": "2025-08-01",
    "text": "test - comentario",
    "fontSize": "medium",
    "createdAt": new Date("2025-08-01T11:29:26.308Z"),
    "updatedAt": new Date("2025-08-01T11:38:18.097Z"),
    "createdBy": "owner"
  },
  {
    "id": "comment_1754384330051_qg3n3qhha",
    "bookingId": "DAY_2025-09-17_At_Home_in_Madrid_IX,_Trendy_Chueca,_Prado,_GranVia",
    "apartmentName": "At Home in Madrid IX, Trendy Chueca, Prado, GranVia",
    "date": "2025-09-16",
    "text": "vienen a cambiar bombillas",
    "fontSize": "medium",
    "createdAt": new Date("2025-08-05T08:58:50.051Z"),
    "updatedAt": new Date("2025-08-05T08:58:50.051Z"),
    "createdBy": "owner"
  },
  {
    "id": "comment_1754685423158_qjrhh1g8h",
    "bookingId": "14945184",
    "apartmentName": "At Home in Madrid IX, Trendy Chueca, Prado, GranVia",
    "date": "2025-09-03",
    "text": "test 1 production",
    "fontSize": "medium",
    "createdAt": new Date("2025-08-08T20:37:03.158Z"),
    "updatedAt": new Date("2025-08-08T20:37:03.158Z"),
    "createdBy": "owner"
  }
];

/**
 * In-memory storage for optimistic UI updates during the session
 * This starts with the static data and can be modified by API calls
 * but changes are not persisted between sessions
 */
let sessionComments: DayComment[] = [...STATIC_COMMENTS];

/**
 * Get all comments (for session)
 */
export function getSessionComments(): DayComment[] {
  return [...sessionComments];
}

/**
 * Set session comments (for optimistic updates)
 */
export function setSessionComments(comments: DayComment[]): void {
  sessionComments = [...comments];
}

/**
 * Reset session comments to static data
 */
export function resetSessionComments(): void {
  sessionComments = [...STATIC_COMMENTS];
}
