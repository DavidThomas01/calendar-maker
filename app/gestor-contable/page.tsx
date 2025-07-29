'use client';

import { AuthProvider } from '@/components/AuthProvider';
import AccountingManager from '@/components/AccountingManager';

export default function GestorContablePage() {
  return (
    <AuthProvider>
      <AccountingManager />
    </AuthProvider>
  );
} 