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
  BookOpen
} from 'lucide-react';

export const navigationItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: Tv, label: 'Matrix Control', href: '/matrix-control' },
  { icon: Volume2, label: 'Audio Zones', href: '/audio-zones' },
  { icon: Calendar, label: 'Sports Guide', href: '/sports-guide' },
  { icon: Calendar, label: 'Smart Scheduler', href: '/scheduler' },
  { icon: Brain, label: 'AI Assistant', href: '/ai-assistant' },
  { icon: Settings, label: 'Device Config', href: '/device-config' },
  { icon: FileText, label: 'Documents', href: '/documents' },
  { icon: GitBranch, label: 'GitHub Sync', href: '/github-sync' },
];
