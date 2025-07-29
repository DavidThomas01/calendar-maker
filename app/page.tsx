'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import OwnerDashboard from '@/components/OwnerDashboard';
import StaffCalendarViewer from '@/components/StaffCalendarViewer';

export default function Home() {
  const { userType } = useAuth();

  if (userType === 'owner') {
    return <OwnerDashboard />;
  } else if (userType === 'staff') {
    return <StaffCalendarViewer />;
  }

  // This should never happen due to auth protection, but just in case
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Cargando...</h1>
      </div>
    </div>
  );
} 