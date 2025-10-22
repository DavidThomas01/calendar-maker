# September 2025 Reservations Integration

This document describes the implementation of static CSV reservations for September 2025.

## Overview

A new system has been implemented to load and integrate static CSV reservation data with the existing dynamic reservation sources (Lodgify API and VRBO iCal). This allows for hard-coded reservations to be displayed alongside real-time data.

## Files Created/Modified

### New Files

1. **`data/september_2025_reservations.csv`** - Contains 42 reservations for September 2025
   - Properly mapped to existing property names
   - Includes all required fields for calendar display
   - Uses sequential IDs (SEP2025001-SEP2025042)

2. **`app/api/load-static-csv/route.ts`** - API endpoint to load static CSV files
   - Security checks to prevent directory traversal
   - Uses Papa Parse for CSV parsing
   - Returns structured JSON data

### Modified Files

1. **`lib/calendar-utils.ts`** - Added static CSV loading functions:
   - `loadStaticCSVReservations()` - Loads reservations from static CSV
   - `mergeReservationsWithStaticCSV()` - Merges static with existing reservations

2. **`components/StaffCalendarViewer.tsx`** - Integrated static CSV loading
   - Merges static reservations after VRBO reservations
   - Maintains existing precedence (Lodgify > VRBO > Static CSV)

3. **`app/calendario-automatico/page.tsx`** - Integrated static CSV loading
   - Merges static reservations in admin calendar view
   - Same precedence order as staff view

4. **`app/subir-csv/page.tsx`** - Integrated static CSV loading
   - Includes static reservations in CSV upload calendar generation

## Property Name Mapping

The reservations were carefully mapped to the correct existing property names:

| CSV Name | System Property Name |
|----------|---------------------|
| AT HOME IN MADRID II | At Home in Madrid II, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID III | At Home in Madrid III, Centro, Prado, BarrioLetras |
| AT HOME IN MADRID IV | At Home in Madrid IV, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID V | At Home in Madrid V, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID VI | At Home in Madrid VI, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID VII | At Home in Madrid VII, Trendy Neighborhood |
| AT HOME IN MADRID VIII | At Home in Madrid VIII, Centro, Prado, Letras |
| AT HOME IN MADRID IX | At Home in Madrid IX, Trendy Chueca, Prado, GranVia |
| AT HOME IN MADRID X | At Home in Madrid X, Center, Prado, Barrio Letras |

## CSV Schema

The CSV follows the exact same schema as existing reservation data:

```csv
Id,Type,Source,SourceText,Name,DateArrival,DateDeparture,Nights,HouseName,InternalCode,House_Id,RoomTypes,People,DateCreated,TotalAmount,Currency,Status,Email,Phone,CountryName
```

### Key Fields:
- **Id**: Sequential format `SEP2025001` to `SEP2025042`
- **Source**: All set to "Airbnb" as requested
- **DateArrival/DateDeparture**: ISO date format (YYYY-MM-DD)
- **Status**: All set to "Booked" to ensure display in calendars
- **HouseName**: Mapped to exact existing property names

## Integration Points

### 1. Staff Calendar (`StaffCalendarViewer.tsx`)
- Loads static CSV after VRBO reservations
- Displays in compact month view
- Shows guest names and check-in/check-out indicators

### 2. Admin Calendar (`calendario-automatico/page.tsx`)
- Loads static CSV after VRBO reservations
- Available in detailed calendar generation
- Included in PDF exports

### 3. CSV Upload Calendar (`subir-csv/page.tsx`)
- Merges static reservations with uploaded CSV data
- Useful for combining multiple data sources

## Merge Logic

The system uses a smart merge strategy to avoid duplicates:

1. **Existing reservations** (Lodgify, VRBO) take precedence
2. **Static CSV reservations** are added if no conflict exists
3. **Conflict detection** based on: apartment + dates + guest name
4. **First-come-first-served** - existing reservations override static ones

## Extensibility

### Adding New Static Reservations

1. **Create new CSV file** in `data/` directory
2. **Use same schema** as `september_2025_reservations.csv`
3. **Call merge function** with filename parameter:
   ```typescript
   await mergeReservationsWithStaticCSV(existingReservations, 'new_file.csv')
   ```

### Adding New Months

Simply create new CSV files following the naming convention:
- `october_2025_reservations.csv`
- `november_2025_reservations.csv`
- etc.

## Testing

To verify the integration:

1. **Navigate to Staff Calendar** and select September 2025
2. **Check Admin Calendar** with September 2025 selected
3. **Look for** guest names like Alberto, Vladimir, Saige, etc.
4. **Verify colors** - should display in Airbnb purple (#A020F0)
5. **Check date ranges** match the original data

## Security

The API endpoint includes security measures:
- **File extension validation** (only .csv files)
- **Directory traversal prevention** (no .. / \ allowed)
- **File existence checking**
- **Error handling** for malformed CSV data

## Performance

- **Caching**: Static CSV data is loaded on-demand
- **Minimal overhead**: Only loads when reservations are requested
- **Error resilience**: System continues working if static CSV fails to load

