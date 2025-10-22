# Calendar Maker - Apartment Reservations

A beautiful web application that generates A4 portrait calendars from CSV reservation data. Perfect for property managers who need to visualize bookings across multiple apartments.

## Features

- **Drag & Drop CSV Upload**: Easy file upload with validation
- **Multiple Calendar Generation**: Create calendars for individual apartments or all at once
- **A4 Portrait Format**: Optimized for printing with professional layout
- **Overlapping Reservation Support**: Handles check-in/check-out on the same day
- **Color-Coded Sources**: Visual distinction between Airbnb, VRBO, and Website bookings
- **Month/Year Selection**: Generate calendars for any month and year
- **Print & PDF Ready**: Built-in print functionality with proper page breaks

## Live Demo

Visit the deployed application at: [Your Vercel URL]

## CSV Format Requirements

Your CSV file must contain the following columns:

- `HouseName` - Apartment/property name
- `DateArrival` - Check-in date (YYYY-MM-DD format)
- `DateDeparture` - Check-out date (YYYY-MM-DD format)
- `Name` - Guest name
- `Source` - Booking source (Airbnb, VRBO, Website)
- `Status` - Booking status (only "Booked" and "Open" are included)
- `People` - Number of guests
- `Nights` - Number of nights

Additional columns will be ignored but won't cause errors.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd calendar-maker
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Deployment on Vercel

This app is optimized for Vercel deployment:

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Deploy with default settings

Or use the Vercel CLI:

```bash
vercel --prod
```

## Usage

1. **Upload CSV File**: Drag and drop your reservation CSV file or click to browse
2. **Configure Calendar**: Select the year, month, and apartment (or leave blank for all)
3. **Generate Calendar**: Click the generate button to create your calendars
4. **Print/Download**: Use the print button to save as PDF or print directly

## Calendar Features

- **Full Week Display**: Shows complete weeks including adjacent month days
- **Reservation Bars**: Color-coded horizontal bars spanning the duration of stays
- **Check-in/Check-out Indicators**: Clear visual markers for arrival and departure
- **Split Day Cells**: When check-out and check-in occur on the same day
- **Booking Count**: Total reservations displayed for each apartment/month
- **Legend**: Color coding explanation for different booking sources

## Technical Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **Deployment**: Vercel

## Project Structure

```
calendar-maker/
├── app/                    # Next.js 13+ app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── CalendarDisplay.tsx
│   └── FileUpload.tsx
├── lib/                   # Utility functions
│   ├── types.ts           # TypeScript definitions
│   └── calendar-utils.ts  # Calendar logic
├── data/                  # Sample data
└── public/                # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on GitHub or contact [your-email].

## September 2025 Reservations 🎉

**New Feature**: Static CSV reservations for September 2025 have been integrated!

### What's Included
- **42 reservations** for September 2025 across all 10 properties
- **Automatic integration** with both Staff and Admin calendar views
- **Proper property mapping** to existing apartment names
- **Airbnb source** for all reservations as requested

### How to View
1. **Staff Calendar**: Navigate to the Staff Calendar and select September 2025
2. **Admin Calendar**: Use the Automatic Calendar Generator for September 2025
3. **CSV Upload**: Upload any CSV - September 2025 reservations will be automatically included

### Guest Names Included
Alberto, Vladimir, Saige, John, Beth, Vanisha, Pepe, Maria, Nicola, Kelly, Sarah, Kara, Sonia, Melissa, Pablo Antonio, Chris, Dominique, Cassandra, B (Unknown Chinese), Ai, Jerald, Masood, Bruce, Marie-Louise, Nikki, Debbie, Unknown Korean Person, Marina, Magdalena, Olga, Derek, Sandy, Simona, Marianne, Solange, Carol, Mark, Taylor, Bridget, Karell Roberto, Annette, Signe

### Testing
Visit `/test-september-integration` to run comprehensive integration tests that verify:
- ✅ CSV loading functionality
- ✅ Property name mapping
- ✅ Date parsing and validation
- ✅ Merge functionality with existing reservations
- ✅ Calendar filtering for September 2025
- ✅ Apartment grouping
- ✅ Guest name preservation

### Technical Details
- **File**: `data/september_2025_reservations.csv`
- **API**: `/api/load-static-csv`
- **Integration**: Automatic merge with Lodgify and VRBO reservations
- **Priority**: Existing reservations take precedence over static CSV

## Changelog

### v1.1.0 - September 2025 Integration
- ✅ Added 42 static reservations for September 2025
- ✅ Integrated with Staff Calendar view
- ✅ Integrated with Admin Calendar view
- ✅ Integrated with CSV Upload functionality
- ✅ Proper property name mapping to existing system
- ✅ Smart merge logic with existing reservations
- ✅ Comprehensive test suite for validation
- ✅ API endpoint for loading static CSV files
- ✅ Security measures for file access

### v1.0.0
- Initial release
- CSV upload and parsing
- Calendar generation for multiple apartments
- A4 print formatting
- Vercel deployment ready 