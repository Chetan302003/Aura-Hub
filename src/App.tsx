import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Titlebar } from './components/Titlebar';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";


// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FleetOverview from "./pages/FleetOverview";
import MyStats from "./pages/MyStats";
import LogJob from "./pages/LogJob";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import UserManagement from "./pages/UserManagement";
import SystemLogs from "./pages/SystemLogs";
import DeveloperPanel from "./pages/DeveloperPanel";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import CalendarPage from "./pages/Calendar";
import Telemetry from "./pages/Telemetry";

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Auth route - redirect if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      
      {/* Protected Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/fleet" element={<ProtectedRoute><FleetOverview /></ProtectedRoute>} />
      <Route path="/my-stats" element={<ProtectedRoute><MyStats /></ProtectedRoute>} />
      <Route path="/log-job" element={<ProtectedRoute><LogJob /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><SystemLogs /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/telemetry" element={<ProtectedRoute><Telemetry /></ProtectedRoute>} />
      <Route path="/developer" element={<ProtectedRoute><DeveloperPanel /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
{/* This wrapper ensures the Titlebar is always present 
        and the content is pushed down so it's not hidden.
      */}
      <div className="min-h-screen bg-aura-dark text-white flex flex-col">
        <Titlebar />
        <main className="flex-1 pt-10">
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </main>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;