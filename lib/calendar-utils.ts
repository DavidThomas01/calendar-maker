import { Reservation, CalendarDay, CalendarWeek, ApartmentCalendar, ReservationInfo, DayComment } from './types';

// Extract apartment number from property name (converts Roman numerals to apartment codes)
export function getApartmentNumber(propertyName: string): string {
  const romanToNumber: { [key: string]: string } = {
    'I': '1C',
    'II': '2C', 
    'III': '3C',
    'IV': '1B',
    'V': '1E',
    'VI': '1A',
    'VII': 'Libertad1',
    'VIII': '2E',
    'IX': 'Libertad2',
    'X': 'Entreplanta'
  };

  // Extract Roman numeral from property name
  // Order matters: longer patterns first to avoid partial matches (e.g., IV before I)
  const match = propertyName.match(/At Home in Madrid (VIII|VII|VI|IX|IV|III|II|X|V|I)\b/);
  if (match && match[1]) {
    return romanToNumber[match[1]] || '';
  }
  return '';
}

// Extract Roman numeral from apartment name for filename generation
export function extractRomanNumeral(propertyName: string): string {
  // Order matters: longer patterns first to avoid partial matches (e.g., IV before I)
  const match = propertyName.match(/At Home in Madrid (VIII|VII|VI|IX|IV|III|II|X|V|I)\b/);
  return match ? match[1] : '';
}

// Generate filename in format: ApartmentNumber_AtHomeInMadrid_RomanNumeral_MonthYear
export function generateCalendarFilename(apartmentName: string, month: number, year: number): string {
  const apartmentNumber = getApartmentNumber(apartmentName);
  const romanNumeral = extractRomanNumeral(apartmentName);
  const monthName = getMonthName(month);
  
  if (apartmentNumber && romanNumeral) {
    return `${apartmentNumber}_AtHomeInMadrid_${romanNumeral}_${monthName}${year}.pdf`;
  } else {
    // Fallback if no Roman numeral found
    const cleanApartmentName = apartmentName.replace(/[^a-z0-9]/gi, '_');
    return `${cleanApartmentName}_${monthName}_${year}.pdf`;
  }
}

// Generate clean display name for apartment options: ApartmentNumber_AtHomeInMadrid_RomanNumber
export function generateCleanDisplayName(apartmentName: string): string {
  const apartmentNumber = getApartmentNumber(apartmentName);
  const romanNumeral = extractRomanNumeral(apartmentName);
  
  if (apartmentNumber && romanNumeral) {
    return `${apartmentNumber}_AtHomeInMadrid_${romanNumeral}`;
  } else {
    // Fallback to original name if no Roman numeral found
    return apartmentName;
  }
}

export function parseCSVToReservations(csvData: any[]): Reservation[] {
  return csvData.map(row => {
    // Handle empty DateCreated field gracefully
    let dateCreated = new Date(row.DateCreated);
    if (!row.DateCreated || isNaN(dateCreated.getTime())) {
      dateCreated = new Date(); // Use current date as fallback
    }
    
    return {
      Id: row.Id || '',
      Type: row.Type || 'Booking',
      Source: row.Source || 'Airbnb',
      SourceText: row.SourceText || '',
      Name: row.Name || 'Guest',
      DateArrival: new Date(row.DateArrival),
      DateDeparture: new Date(row.DateDeparture),
      Nights: parseInt(row.Nights) || 0,
      HouseName: row.HouseName || '',
      InternalCode: row.InternalCode || '',
      House_Id: row.House_Id || '',
      RoomTypes: row.RoomTypes || '',
      People: parseInt(row.People) || 2, // Default to 2 people if not specified
      DateCreated: dateCreated,
      TotalAmount: parseFloat(row.TotalAmount) || 0,
      Currency: row.Currency || 'EUR',
      Status: row.Status || 'Booked',
      Email: row.Email || '',
      Phone: row.Phone || '',
      CountryName: row.CountryName || '',
    };
  }).filter(reservation => 
    // Filter for confirmed bookings only
    ['Booked', 'Open'].includes(reservation.Status) &&
    !isNaN(reservation.DateArrival.getTime()) &&
    !isNaN(reservation.DateDeparture.getTime())
  );
}

export function filterReservationsForMonth(reservations: Reservation[], year: number, month: number): Reservation[] {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // Last day of month
  
  return reservations.filter(reservation =>
    // Include reservations that overlap with the target month
    reservation.DateArrival <= monthEnd && reservation.DateDeparture >= monthStart
  );
}

export function getCalendarDates(year: number, month: number): Date[] {
  // First day of the month (month is 1-based, Date constructor is 0-based)
  const firstDay = new Date(year, month - 1, 1);
  // Last day of the month
  const lastDay = new Date(year, month, 0);
  
  // Find the Sunday of the week containing the first day
  let startDate = new Date(firstDay);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days to go back to Sunday (0)
  startDate.setDate(firstDay.getDate() - firstDayOfWeek);
  
  // Find the Saturday of the week containing the last day
  let endDate = new Date(lastDay);
  const lastDayOfWeek = lastDay.getDay();
  
  // Calculate days to go forward to Saturday (6)
  const daysToGoForward = 6 - lastDayOfWeek;
  endDate.setDate(lastDay.getDate() + daysToGoForward);
  
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export function groupDatesByWeek(dates: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  dates.forEach((date, index) => {
    currentWeek.push(date);
    // Group by Sunday-Saturday weeks
    if (currentWeek.length === 7 || index === dates.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  
  return weeks;
}

export function createReservationLookup(reservations: Reservation[], comments?: DayComment[]): Map<string, ReservationInfo[]> {
  const lookup = new Map<string, ReservationInfo[]>();
  
  // Create a map of comments by booking ID for quick lookup
  const commentsByBookingId = new Map<string, DayComment[]>();
  if (comments) {
    comments.forEach(comment => {
      if (!commentsByBookingId.has(comment.bookingId)) {
        commentsByBookingId.set(comment.bookingId, []);
      }
      commentsByBookingId.get(comment.bookingId)!.push(comment);
    });
  }
  
  reservations.forEach(reservation => {
    const arrivalDate = new Date(reservation.DateArrival);
    const departureDate = new Date(reservation.DateDeparture);
    const reservationComments = commentsByBookingId.get(reservation.Id) || [];
    
    // Handle the stay period (arrival date to day before departure)
    const currentDate = new Date(arrivalDate);
    while (currentDate < departureDate) {
      const dateKey = currentDate.toDateString();
      if (!lookup.has(dateKey)) {
        lookup.set(dateKey, []);
      }
      
      const isCheckin = currentDate.toDateString() === arrivalDate.toDateString();
      const isCheckout = false; // No checkout during stay period
      
      lookup.get(dateKey)!.push({
        reservation,
        isCheckin,
        isCheckout,
        comments: reservationComments
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Handle the departure date (checkout)
    const departureDateKey = departureDate.toDateString();
    if (!lookup.has(departureDateKey)) {
      lookup.set(departureDateKey, []);
    }
    
    lookup.get(departureDateKey)!.push({
      reservation,
      isCheckin: false,
      isCheckout: true,
      comments: reservationComments
    });
  });
  
  return lookup;
}

// Fetch comments for specific booking IDs
export async function fetchCommentsForBookings(bookingIds: string[]): Promise<DayComment[]> {
  try {
    if (bookingIds.length === 0) {
      return [];
    }
    
    const response = await fetch(
      `/api/comments?bookingIds=${bookingIds.join('|')}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch comments');
    }
    
    const data = await response.json();
    return data.comments || [];
  } catch (error) {
    console.error('Error fetching comments for bookings:', error);
    return [];
  }
}

// Fetch general day comments for an apartment and date range
export async function fetchGeneralDayComments(
  apartmentName: string,
  startDate: Date,
  endDate: Date
): Promise<DayComment[]> {
  try {
    // Generate day booking IDs for the date range
    const dayBookingIds: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Use local date formatting to avoid timezone issues
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayBookingId = `DAY_${dateStr}_${apartmentName.replace(/\s+/g, '_')}`;
      dayBookingIds.push(dayBookingId);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (dayBookingIds.length === 0) {
      return [];
    }
    
    const response = await fetch(
      `/api/comments?bookingIds=${dayBookingIds.join('|')}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch general day comments');
    }
    
    const data = await response.json();
    return data.comments || [];
  } catch (error) {
    console.error('Error fetching general day comments:', error);
    return [];
  }
}

// Create a comment lookup map by date
export function createCommentLookup(comments: DayComment[]): Map<string, DayComment[]> {
  const lookup = new Map<string, DayComment[]>();
  
  comments.forEach(comment => {
    const date = new Date(comment.date);
    const dateKey = date.toDateString();
    
    if (!lookup.has(dateKey)) {
      lookup.set(dateKey, []);
    }
    lookup.get(dateKey)!.push(comment);
  });
  
  return lookup;
}

export async function generateApartmentCalendar(
  apartmentName: string,
  reservations: Reservation[],
  year: number,
  month: number
): Promise<ApartmentCalendar> {
  // Get all calendar dates
  const calendarDates = getCalendarDates(year, month);
  
  // Group dates by week
  const dateWeeks = groupDatesByWeek(calendarDates);
  
  // Extract all booking IDs from reservations
  const bookingIds = reservations.map(r => r.Id);
  
  // Fetch comments for all these bookings
  const comments = await fetchCommentsForBookings(bookingIds);
  
  // Fetch general day comments for this month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const generalDayComments = await fetchGeneralDayComments(apartmentName, monthStart, monthEnd);
  
  // Combine all comments
  const allComments = [...comments, ...generalDayComments];
  
  // Create reservation lookup with comments attached
  const reservationLookup = createReservationLookup(reservations, allComments);
  
  // Count reservations for this month
  const monthReservations = reservations.filter(r => 
    (r.DateArrival.getFullYear() === year && r.DateArrival.getMonth() === month - 1) ||
    (r.DateDeparture.getFullYear() === year && r.DateDeparture.getMonth() === month - 1) ||
    (r.DateArrival < new Date(year, month - 1, 1) && r.DateDeparture > new Date(year, month, 0))
  );
  
  // Create a lookup map for general day comments by date
  const generalCommentsByDate = new Map<string, DayComment[]>();
  generalDayComments.forEach(comment => {
    if (comment.bookingId.startsWith('DAY_') && comment.date) {
      const dateKey = new Date(comment.date).toDateString();
      if (!generalCommentsByDate.has(dateKey)) {
        generalCommentsByDate.set(dateKey, []);
      }
      generalCommentsByDate.get(dateKey)!.push(comment);
    }
  });

  // Build calendar weeks
  const weeks: CalendarWeek[] = dateWeeks.map(weekDates => ({
    days: weekDates.map(date => ({
      date,
      isCurrentMonth: date.getMonth() === month - 1,
      reservations: reservationLookup.get(date.toDateString()) || [],
      generalComments: generalCommentsByDate.get(date.toDateString()) || []
    }))
  }));
  
  return {
    apartmentName,
    year,
    month,
    weeks,
    totalBookings: monthReservations.length
  };
}

// Helper function to convert hex to HSL
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

// Helper function to convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getBookingColor(source: string, reservationId?: string): string {
  const baseColors = {
    'Airbnb': '#A020F0',
    'VRBO': '#10B981', 
    'Website': '#3B82F6'
  };
  
  const baseColor = baseColors[source as keyof typeof baseColors] || '#666666';
  
  // If no reservationId provided, return the base color
  if (!reservationId) {
    return baseColor;
  }
  
  // Use a simple hash of the reservation ID to create subtle variations
  let hash = 0;
  for (let i = 0; i < reservationId.length; i++) {
    const char = reservationId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert base color to HSL
  const [h, s, l] = hexToHsl(baseColor);
  
  // Create moderate variations by adjusting lightness and saturation
  const variations = Math.abs(hash) % 8;
  let newL = l;
  let newS = s;
  
  switch (variations) {
    case 0: // Base color
      break;
    case 1: // Lighter
      newL = Math.min(l + 15, 90);
      break;
    case 2: // Darker
      newL = Math.max(l - 15, 30);
      break;
    case 3: // More saturated
      newS = Math.min(s + 15, 100);
      break;
    case 4: // Less saturated
      newS = Math.max(s - 15, 25);
      break;
    case 5: // Lighter and more saturated
      newL = Math.min(l + 10, 85);
      newS = Math.min(s + 12, 95);
      break;
    case 6: // Darker and more saturated
      newL = Math.max(l - 10, 35);
      newS = Math.min(s + 12, 95);
      break;
    case 7: // Significant adjustment
      newL = l > 50 ? Math.max(l - 20, 30) : Math.min(l + 20, 80);
      newS = Math.min(s + 8, 90);
      break;
  }
  
  return hslToHex(h, newS, newL);
}

// Normalize apartment name to standard format for consistent grouping
export function normalizeApartmentName(houseName: string): string {
  // Extract Roman numeral from any apartment name format
  const romanNumeral = extractRomanNumeral(houseName);
  if (romanNumeral) {
    return `At Home in Madrid ${romanNumeral}`;
  }
  return houseName; // fallback to original if no Roman numeral found
}

export function groupReservationsByApartment(reservations: Reservation[]): Map<string, Reservation[]> {
  const apartmentGroups = new Map<string, Reservation[]>();
  
  reservations.forEach(reservation => {
    // Use normalized apartment name for consistent grouping
    const apartmentName = normalizeApartmentName(reservation.HouseName);
    if (!apartmentGroups.has(apartmentName)) {
      apartmentGroups.set(apartmentName, []);
    }
    apartmentGroups.get(apartmentName)!.push(reservation);
  });
  
  return apartmentGroups;
}

export function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1];
}

// VRBO ICAL Sync Functions
export async function fetchVrboIcalReservations(apartmentName?: string, forceRefresh: boolean = false): Promise<Reservation[]> {
  // VRBO ICAL sync is currently disabled - returning empty array
  console.log(`🚫 VRBO ICAL sync is disabled, returning empty reservations array`);
  return [];
  
  /* DISABLED VRBO SYNC CODE - KEPT FOR FUTURE RE-ENABLING
  try {
    console.log(`🔄 Starting VRBO ICAL fetch for apartment: ${apartmentName}`);
    
    const params = new URLSearchParams();
    if (apartmentName) {
      params.append('apartment', apartmentName);
    }
    if (forceRefresh) {
      params.append('refresh', 'true');
    }

    // Construct URL with proper origin for both client-side and server-side fetch
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/vrbo-ical-sync?${params.toString()}`;
    console.log(`🔄 Fetching VRBO ICAL reservations from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('❌ VRBO ICAL Sync API Error:', data.error);
      return [];
    }

    console.log(`✅ Fetched ${data.totalReservations} VRBO ICAL reservations`);
    if (data.errors && data.errors.length > 0) {
      console.warn('⚠️ VRBO ICAL Sync warnings:', data.errors);
    }

    // Convert date strings back to Date objects (they come as strings from JSON)
    const reservations = (data.reservations || []).map((reservation: any) => ({
      ...reservation,
      DateArrival: new Date(reservation.DateArrival),
      DateDeparture: new Date(reservation.DateDeparture),
      DateCreated: new Date(reservation.DateCreated)
    }));

    return reservations;
  } catch (error) {
    console.error('❌ Error fetching VRBO ICAL reservations:', error);
    return [];
  }
  */
}

export async function mergeReservationsWithVrboIcal(
  existingReservations: Reservation[], 
  apartmentName?: string,
  forceRefresh: boolean = false
): Promise<Reservation[]> {
  try {
    console.log(`🔄 Merging VRBO reservations for apartment: ${apartmentName}, existing reservations: ${existingReservations.length}`);
    
    // Fetch VRBO ICAL reservations
    const vrboReservations = await fetchVrboIcalReservations(apartmentName, forceRefresh);
    
    console.log(`📊 Fetched ${vrboReservations.length} VRBO reservations`);
    
    if (vrboReservations.length === 0) {
      console.log('ℹ️ No VRBO ICAL reservations found, returning existing reservations');
      return existingReservations;
    }

    // Filter VRBO reservations for specific apartment if provided
    let filteredVrboReservations = vrboReservations;
    if (apartmentName) {
      filteredVrboReservations = vrboReservations.filter(reservation => 
        reservation.HouseName.toLowerCase().includes(apartmentName.toLowerCase())
      );
    }

    // Combine reservations - VRBO ICAL reservations first, then existing
    const mergedReservations = [...filteredVrboReservations, ...existingReservations];
    
    // Remove duplicates based on dates and apartment (keep VRBO ICAL version if conflict)
    const uniqueReservations = new Map<string, Reservation>();
    
    for (const reservation of mergedReservations) {
      const key = `${reservation.HouseName}_${reservation.DateArrival.toDateString()}_${reservation.DateDeparture.toDateString()}`;
      
      // Only keep first occurrence (VRBO ICAL reservations are first, so they take precedence)
      if (!uniqueReservations.has(key)) {
        uniqueReservations.set(key, reservation);
      } else {
        const existing = uniqueReservations.get(key)!;
        // If existing is not VRBO sync and new one is VRBO sync, replace it
        if (existing.Source !== 'VRBO' && reservation.Source === 'VRBO') {
          uniqueReservations.set(key, reservation);
        }
      }
    }

    const finalReservations = Array.from(uniqueReservations.values());
    
    console.log(`🔄 Merged reservations: ${existingReservations.length} existing + ${filteredVrboReservations.length} VRBO ICAL = ${finalReservations.length} total`);
    
    return finalReservations;
  } catch (error) {
    console.error('❌ Error merging reservations with VRBO ICAL:', error);
    return existingReservations; // Return original reservations on error
  }
}

// Static CSV reservation loading functions
export async function loadStaticCSVReservations(csvFileName: string): Promise<Reservation[]> {
  try {
    console.log(`🔄 Loading static CSV reservations from: ${csvFileName}`);
    
    // Construct URL for the static CSV file in the data directory
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/load-static-csv?filename=${encodeURIComponent(csvFileName)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Static CSV loading error:', data.error);
      return [];
    }

    console.log(`✅ Loaded ${data.reservations.length} static CSV reservations from ${csvFileName}`);

    // Convert date strings back to Date objects and parse reservations
    const reservations = parseCSVToReservations(data.reservations);

    return reservations;
  } catch (error) {
    console.error('❌ Error loading static CSV reservations:', error);
    return [];
  }
}

export async function mergeReservationsWithStaticCSV(
  existingReservations: Reservation[], 
  csvFileNames: string[] = ['october_2025_reservations.csv', 'november_2025_airbnb_reservations.csv']
): Promise<Reservation[]> {
  try {
    console.log(`🔄 Merging static CSV reservations from: ${csvFileNames.join(', ')}, existing reservations: ${existingReservations.length}`);
    
    // Load all static CSV reservations from multiple files
    const allStaticReservations: Reservation[] = [];
    
    for (const csvFileName of csvFileNames) {
      const staticReservations = await loadStaticCSVReservations(csvFileName);
      console.log(`📊 Loaded ${staticReservations.length} reservations from ${csvFileName}`);
      allStaticReservations.push(...staticReservations);
    }
    
    console.log(`📊 Total loaded ${allStaticReservations.length} static CSV reservations from ${csvFileNames.length} files`);
    
    if (allStaticReservations.length === 0) {
      console.log('ℹ️ No static CSV reservations found, returning existing reservations');
      return existingReservations;
    }

    // Combine reservations - existing reservations first, then static CSV
    const mergedReservations = [...existingReservations, ...allStaticReservations];
    
    // Remove duplicates based on dates, apartment, and guest name (keep existing version if conflict)
    const uniqueReservations = new Map<string, Reservation>();
    
    for (const reservation of mergedReservations) {
      const key = `${reservation.HouseName}_${reservation.DateArrival.toDateString()}_${reservation.DateDeparture.toDateString()}_${reservation.Name}`;
      
      // Only keep first occurrence (existing reservations are first, so they take precedence over static CSV)
      if (!uniqueReservations.has(key)) {
        uniqueReservations.set(key, reservation);
      }
    }

    const finalReservations = Array.from(uniqueReservations.values());
    
    console.log(`🔄 Merged reservations: ${existingReservations.length} existing + ${allStaticReservations.length} static CSV = ${finalReservations.length} total`);
    
    return finalReservations;
  } catch (error) {
    console.error('❌ Error merging reservations with static CSV:', error);
    return existingReservations; // Return original reservations on error
  }
} 