import {
  Home,
  Tv,
  Volume2,
  Settings,
  FileText,
  Calendar,
  GitBranch,
  Sparkles,
  Brain,
  BookOpen,
  Activity,
  Trophy
} from 'lucide-react';

export const navigationItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: Tv, label: 'Matrix Control', href: '/matrix-control' },
  { icon: Volume2, label: 'Audio Zones', href: '/audio-zones' },
  // Single Sports Guide entry — consolidated admin page holds Guide, Games,
  // Schedule, Home Teams, Channels, Providers, Configuration, and Logs tabs
  // (v2.4.0 Phase C). Replaces the prior three entries for AI Game Plan,
  // Sports Guide, and Smart Scheduler. Old URLs redirect here via
  // next.config.js redirects().
  { icon: Trophy, label: 'Sports Guide', href: '/sports-guide-admin' },
  { icon: Brain, label: 'AI Assistant', href: '/ai-assistant' },
  { icon: Activity, label: 'Tests', href: '/tests' },
  { icon: Settings, label: 'Device Config', href: '/device-config' },
  { icon: FileText, label: 'Documents', href: '/documents' },
  { icon: GitBranch, label: 'GitHub Sync', href: '/github-sync' },
];
