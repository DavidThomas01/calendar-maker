# October 2025 Reservations Integration

This document describes the implementation of static CSV reservations for October 2025, replacing VRBO iCal sync functionality.

## Overview

The system has been updated to use hardcoded October 2025 reservations instead of VRBO iCal sync. The VRBO sync functionality has been disabled while keeping the code intact for potential future re-enabling.

## Changes Made

### New Files

1. **`data/october_2025_reservations.csv`** - Contains 72 reservations for October 2025
   - Properly mapped to existing property names
   - Includes all required fields for calendar display
   - Uses sequential IDs (OCT2025001-OCT2025072)
   - Covers all 10 apartments (At Home in Madrid I-X)
   - Includes both Airbnb and VRBO source reservations

2. **`app/test-october-integration/page.tsx`** - Test page to verify October integration
   - Shows total reservation counts
   - Breaks down by source (Airbnb vs VRBO)
   - Displays apartment statistics
   - Lists all reservations with proper color coding

### Modified Files

1. **`lib/calendar-utils.ts`**
   - **DISABLED**: `fetchVrboIcalReservations()` - Now returns empty array with disabled message
   - **UPDATED**: `mergeReservationsWithStaticCSV()` - Default CSV filename changed to `october_2025_reservations.csv`
   - VRBO sync code commented out but preserved for future re-enabling

2. **`components/StaffCalendarViewer.tsx`**
   - Updated comment references from September to October
   - Still calls VRBO sync but it returns empty results

3. **`app/calendario-automatico/page.tsx`**
   - Updated comment references from September to October
   - Still calls VRBO sync but it returns empty results

4. **`app/subir-csv/page.tsx`**
   - Updated comment references from September to October
   - Still calls VRBO sync but it returns empty results

## October 2025 Reservations Summary

### Total Reservations: 72
- **Airbnb**: 47 reservations
- **VRBO**: 25 reservations

### Reservations by Apartment:

| Apartment | Total | Airbnb | VRBO |
|-----------|-------|---------|------|
| At Home in Madrid I | 6 | 2 | 4 |
| At Home in Madrid II | 4 | 4 | 0 |
| At Home in Madrid III | 7 | 5 | 2 |
| At Home in Madrid IV | 5 | 5 | 0 |
| At Home in Madrid V | 8 | 6 | 2 |
| At Home in Madrid VI | 7 | 4 | 3 |
| At Home in Madrid VII | 7 | 3 | 4 |
| At Home in Madrid VIII | 11 | 8 | 3 |
| At Home in Madrid IX | 8 | 6 | 2 |
| At Home in Madrid X | 9 | 8 | 1 |

### Date Coverage:
- Reservations span from September 27, 2025 to November 5, 2025
- All reservations with at least 1 day in October are included
- Proper overlap handling for multi-month stays

## Color Coding
- **Airbnb**: Purple (#A020F0)
- **VRBO**: Green (#10B981)

## Property Name Mapping

All reservations are properly mapped to the correct existing property names:

| Short Name | Full System Property Name |
|------------|---------------------------|
| AT HOME IN MADRID I | At Home in Madrid I, Centro de Madrid |
| AT HOME IN MADRID II | At Home in Madrid II, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID III | At Home in Madrid III, Centro, Prado, BarrioLetras |
| AT HOME IN MADRID IV | At Home in Madrid IV, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID V | At Home in Madrid V, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID VI | At Home in Madrid VI, Centro, Prado, Barrio Letras |
| AT HOME IN MADRID VII | At Home in Madrid VII, Trendy Neighborhood |
| AT HOME IN MADRID VIII | At Home in Madrid VIII, Centro, Prado, Letras |
| AT HOME IN MADRID IX | At Home in Madrid IX, Trendy Chueca, Prado, GranVia |
| AT HOME IN MADRID X | At Home in Madrid X, Center, Prado, Barrio Letras |

## VRBO Sync Disabled

The VRBO iCal sync functionality has been disabled by modifying the `fetchVrboIcalReservations()` function to return an empty array. The original code is preserved in comments for potential future re-enabling.

### To Re-enable VRBO Sync:
1. Uncomment the code in `fetchVrboIcalReservations()` 
2. Remove the early return statement
3. Test the integration

## Testing

Visit `/test-october-integration` to verify:
- All 72 reservations are loaded correctly
- Proper source distribution (Airbnb/VRBO)
- Correct apartment mapping
- Accurate date ranges
- Proper color coding

## Calendar Display

The October reservations will now appear in:
- Staff Calendar Viewer
- Automatic Calendar Generator
- CSV Upload Calendar
- Owner Dashboard

All with proper color coding and source attribution.
