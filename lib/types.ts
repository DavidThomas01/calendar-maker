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
}

export interface ReservationInfo {
  reservation: Reservation;
  isCheckin: boolean;
  isCheckout: boolean;
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface ApartmentCalendar {
  apartmentName: string;
  year: number;
  month: number;
  weeks: CalendarWeek[];
  totalBookings: number;
} 