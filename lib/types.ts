export interface Reservation {
  Id: string;
  Type: string;
  Source: string;
  SourceText: string;
  Name: string;
  DateArrival: Date;
  DateDeparture: Date;
  Nights: number;
  HouseName: string;
  InternalCode: string;
  House_Id: string;
  RoomTypes: string;
  People: number;
  DateCreated: Date;
  TotalAmount: number;
  Currency: string;
  Status: string;
  Email: string;
  Phone: string;
  CountryName: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  reservations: ReservationInfo[];
  comments?: DayComment[];
  generalComments?: DayComment[]; // General day-level comments (yellow comments)
}

export interface ReservationInfo {
  reservation: Reservation;
  isCheckin: boolean;
  isCheckout: boolean;
  comments?: DayComment[];
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface DayComment {
  id: string;
  bookingId: string; // The reservation/booking ID this comment belongs to
  apartmentName: string;
  date: string; // YYYY-MM-DD format (for reference)
  text: string;
  fontSize: 'small' | 'medium' | 'large';
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'owner' | 'staff';
}

export interface ApartmentCalendar {
  apartmentName: string;
  year: number;
  month: number;
  weeks: CalendarWeek[];
  totalBookings: number;
} 