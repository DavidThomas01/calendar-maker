# Calendar Comments System Documentation

## Overview

The calendar application has two types of comments and two different calendar views, each with distinct display approaches:

- **Comment Types**: Blue (Reservation) Comments vs Yellow (General Day) Comments
- **Calendar Views**: Detailed Calendar (Owner) vs Simplified Calendar (Staff)

---

## Comment Types

### 1. Blue Comments (Reservation Comments)
- **Purpose**: Comments attached to specific reservations
- **Scope**: Tied to a specific booking/reservation
- **Booking ID Format**: `{reservation.Id}` (e.g., "12345678")
- **When Shown**: Only on check-in days to avoid duplication
- **Color**: Blue highlighting (`bg-blue-50 border-blue-200`)

### 2. Yellow Comments (General Day Comments)
- **Purpose**: General comments for a specific day and apartment
- **Scope**: Tied to a date + apartment combination
- **Booking ID Format**: `DAY_{YYYY-MM-DD}_{apartment_name}` (e.g., "DAY_2025-08-20_At_Home_in_Madrid_IX,_Trendy_Chueca,_Prado,_GranVia")
- **When Shown**: Any day that has general comments
- **Color**: Yellow highlighting (`ring-4 ring-yellow-400 ring-inset bg-yellow-50`)

---

## Calendar Views

### Detailed Calendar (Owner View)

**Access**: Main calendar page with owner authentication
**Purpose**: Full-featured calendar with editing capabilities
**File**: `components/CalendarDisplay.tsx`

#### Blue Comments Display
```tsx
{/* Reservation Comments - Only show for check-in days to avoid duplication */}
{day.reservations.length > 0 && day.reservations.map((resInfo, index) => {
  const updatedResInfo = getReservationInfo(resInfo, day.date.toDateString());
  // Only show comments for check-in days to avoid duplication
  if (!resInfo.isCheckin) return null;
  
  return (
    <DayComments
      key={`${resInfo.reservation.Id}-${index}`}
      reservation={resInfo.reservation}
      comments={updatedResInfo.comments || []}
      isOwner={true}
      onCommentsUpdate={handleCommentsUpdate}
    />
  );
})}
```

#### Yellow Comments Display
```tsx
{/* Day-Level Comments - Always show for any day */}
<GeneralDayComments
  key={`day-${day.date.toDateString()}`}
  date={day.date}
  apartmentName={calendar.apartmentName}
  comments={getDayLevelComments(day)}
  isOwner={true}
  onCommentsUpdate={handleCommentsUpdate}
/>
```

#### Visual Styling
- **Day Cell**: Yellow ring around entire day cell when general comments exist
- **Comments Section**: Below reservations, dedicated area for comments
- **Interaction**: Full CRUD operations (Create, Read, Update, Delete)

### Simplified Calendar (Staff View)

**Access**: Staff login with password 'calendario'
**Purpose**: Read-only view for staff members
**File**: `components/StaffCalendarViewer.tsx`

#### Blue Comments Display
- **Method**: Implicit through reservation data
- **Styling**: Blue background on day cell (`bg-blue-50 border-blue-200`)
- **Components**: No explicit comment components shown
- **Detection**: `dayHasReservationComments(day)` function

#### Yellow Comments Display
```tsx
{/* Day-Level Comments - Same as detailed calendar */}
<div className="mt-1">
  <GeneralDayComments
    key={`day-${day.date.toDateString()}`}
    date={day.date}
    apartmentName={calendar.apartmentName}
    comments={getDayLevelComments(day, calendar.apartmentName)}
    isOwner={false}
    onCommentsUpdate={handleCommentsUpdate}
  />
</div>
```

#### Visual Styling
- **Day Cell**: Yellow ring around entire day cell (`ring-4 ring-yellow-400 ring-inset bg-yellow-50`)
- **Comments Section**: Integrated within day cell
- **Interaction**: Read-only (isOwner=false)

---

## Technical Implementation

### Data Structures

#### Blue Comments (Reservation Comments)
```typescript
// Stored in updatedReservations state
const [updatedReservations, setUpdatedReservations] = useState<ReservationInfo[]>([]);

// Structure:
interface ReservationInfo {
  reservation: Reservation;
  comments?: DayComment[];
  // ... other fields
}
```

#### Yellow Comments (General Day Comments)
```typescript
// Stored in dayComments state (both calendars)
const [dayComments, setDayComments] = useState<Map<string, DayComment[]>>(new Map());

// Key format: "DAY_{YYYY-MM-DD}_{apartment_name_with_underscores}"
// Value: Array of DayComment objects
```

### API Integration

#### Comment Fetching
```typescript
// Single API endpoint for both comment types
GET /api/comments?bookingIds={id1}|{id2}|{id3}

// Examples:
// Blue comments: ?bookingIds=12345678|87654321
// Yellow comments: ?bookingIds=DAY_2025-08-20_At_Home_in_Madrid_IX|DAY_2025-08-21_At_Home_in_Madrid_IX
```

#### Chunked Requests (Staff Calendar)
Due to URL length limitations, staff calendar breaks requests into chunks:
```typescript
const chunkSize = 50; // 50 booking IDs per request
for (let i = 0; i < dayBookingIds.length; i += chunkSize) {
  const chunk = dayBookingIds.slice(i, i + chunkSize);
  const response = await fetch(`/api/comments?bookingIds=${chunk.join('|')}`);
  // Process chunk results...
}
```

### Key Functions

#### Detailed Calendar Functions
```typescript
// Generate day booking ID for general comments
const generateDayBookingId = (date: Date, apartmentName: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return `DAY_${dateStr}_${apartmentName.replace(/\s+/g, '_')}`;
};

// Get day-level comments for a specific day
const getDayLevelComments = (day: any): DayComment[] => {
  const dayBookingId = generateDayBookingId(day.date, calendar.apartmentName);
  return dayComments.get(dayBookingId) || [];
};

// Check if day has general comments
const dayHasGeneralComments = (day: any): boolean => {
  return getDayLevelComments(day).length > 0;
};
```

#### Staff Calendar Functions
```typescript
// Same functions as detailed calendar, but with apartment parameter
const getDayLevelComments = (day: any, apartmentName: string): DayComment[] => {
  const dayBookingId = generateDayBookingId(day.date, apartmentName);
  return dayComments.get(dayBookingId) || [];
};

const dayHasGeneralComments = (day: any, apartmentName: string): boolean => {
  return getDayLevelComments(day, apartmentName).length > 0;
};
```

---

## Visual Comparison

### Detailed Calendar (Owner)
```
┌─────────────────────────────────────┐
│ Day 20          [Yellow Ring Around]│
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     Reservation Bar (Blue)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Comments Section:                   │
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Reservation Comment          │ │
│ │    [Edit] [Delete]              │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 General Day Comment          │ │
│ │    [Edit] [Delete] [Add]        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Simplified Calendar (Staff)
```
┌─────────────────────────────────────┐
│ Day 20          [Yellow Ring Around]│
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     Reservation Button (Blue)   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 General Day Comment          │ │
│ │    (Read-only)                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Component Hierarchy

### Detailed Calendar
```
CalendarDisplay.tsx
├── DayComments.tsx (Blue comments)
│   ├── Individual comment display
│   ├── Add/Edit/Delete functionality
│   └── Font size options
└── GeneralDayComments.tsx (Yellow comments)
    ├── Individual comment display
    ├── Add/Edit/Delete functionality
    └── Font size options
```

### Simplified Calendar
```
StaffCalendarViewer.tsx
├── (Blue comments - implicit through styling)
└── GeneralDayComments.tsx (Yellow comments)
    ├── Individual comment display (read-only)
    └── No edit functionality (isOwner=false)
```

---

## State Management

### Comment Loading Process

#### Detailed Calendar
1. `useEffect` triggers on component mount/calendar change
2. Fetches general day comments for the month
3. Fetches reservation comments for all reservations
4. Updates `dayComments` and `updatedReservations` states
5. Components re-render with comment data

#### Staff Calendar
1. `fetchCalendars()` called when user clicks "Ver Calendarios"
2. Fetches reservations from Lodgify API
3. Generates calendar data structure
4. Calls `fetchAllDayComments()` for general comments
5. Updates `dayComments` state
6. Components re-render with comment data

### Data Flow
```
API (/api/comments) 
    ↓
fetchGeneralDayComments() / fetchAllDayComments()
    ↓
dayComments Map (state)
    ↓
getDayLevelComments() (getter function)
    ↓
GeneralDayComments component (display)
```

---

## Key Differences Summary

| Aspect | Detailed Calendar | Simplified Calendar |
|--------|------------------|-------------------|
| **Blue Comments** | Full DayComments component | Implicit styling only |
| **Yellow Comments** | Full GeneralDayComments component | Read-only GeneralDayComments |
| **Editing** | Full CRUD operations | Read-only |
| **Layout** | Table-based, large cells | Grid-based, compact cells |
| **Comment Loading** | useEffect on mount | Manual trigger on button click |
| **API Requests** | Standard single requests | Chunked requests for performance |
| **User Interaction** | Click day → edit comments | Click day → view comments |

---

## Troubleshooting

### Common Issues

1. **Comments not showing**: Check console for API errors or 431 URL length errors
2. **Yellow ring not appearing**: Verify `dayHasGeneralComments()` returns true
3. **API 431 errors**: Ensure chunked requests are working (staff calendar)
4. **Timezone issues**: Verify `generateDayBookingId()` uses local date formatting

### Debug Console Messages
```
Staff Calendar:
🔍 Fetching general comments for 310 day combinations
📡 Fetching chunk 1/7 (50 IDs)
✅ Chunk 1: Found 2 comments  
🟨 General comment: 2025-08-20 for booking DAY_... = "test yellow"
🗺️ DayComments Map has 2 entries total
```

---

This documentation provides a complete overview of how comments work across both calendar systems. The key insight is that both calendars now use the same `GeneralDayComments` component for yellow comments, but with different interaction modes (edit vs read-only).