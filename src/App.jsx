import { useEffect } from "react"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Home from '@/pages/Home';
import DownloadPrompt from '@/pages/DownloadPrompt';
import Competitor from '@/pages/Competitor';
import Public from '@/pages/Public';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/competitor" element={<Competitor />} />
      <Route path="/public" element={<Public />} />
      <Route path="/download-prompt" element={<DownloadPrompt />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: 'hsl(0 0% 9%)',
              border: '1px solid hsl(0 0% 16%)',
              color: 'hsl(60 5% 96%)',
              fontFamily: 'var(--font-sans)',
            }
          }}
        />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App