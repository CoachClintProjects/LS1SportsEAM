// =============================================================================
// ICON REGISTRY - Database-Driven
// =============================================================================

import React from 'react';
import * as LucideIcons from 'lucide-react';

// Fallback hardcoded map (only used if database fetch fails)
const fallbackIconMap: Record<string, React.ComponentType<any>> = {
  'layout-dashboard': LucideIcons.LayoutDashboard,
  'building2': LucideIcons.Building2,
  'users': LucideIcons.Users,
  'user-check': LucideIcons.UserCheck,
  'dollar-sign': LucideIcons.DollarSign,
  'warehouse': LucideIcons.Warehouse,
  'briefcase': LucideIcons.Briefcase,
  'upload': LucideIcons.Upload,
  'clipboard-check': LucideIcons.ClipboardCheck,
  'bar-chart-3': LucideIcons.BarChart3,
  'shield': LucideIcons.Shield,
  'folder-tree': LucideIcons.FolderTree,
  'calendar': LucideIcons.Calendar,
  'file-text': LucideIcons.FileText,
  'credit-card': LucideIcons.CreditCard,
  'receipt': LucideIcons.Receipt,
  'settings': LucideIcons.Settings,
  'home': LucideIcons.Home,
  'activity': LucideIcons.Activity,
  'trophy': LucideIcons.Trophy,
  'target': LucideIcons.Target,
  'heart': LucideIcons.Heart,
  'award': LucideIcons.Award,
  'medal': LucideIcons.Medal,
  'clock': LucideIcons.Clock,
  'message-square': LucideIcons.MessageSquare,
  'calendar-days': LucideIcons.CalendarDays,
  'user-cog': LucideIcons.UserCog,
  'truck': LucideIcons.Truck,
  'eye': LucideIcons.Eye,
  'compass': LucideIcons.Compass,
  'bookmark': LucideIcons.Bookmark,
  'search': LucideIcons.Search,
  'user': LucideIcons.User,
  'globe': LucideIcons.Globe,
  'map-pin': LucideIcons.MapPin,
  'phone': LucideIcons.Phone,
  'mail': LucideIcons.Mail,
  'trending-up': LucideIcons.TrendingUp,
  'trending-down': LucideIcons.TrendingDown,
  'wallet': LucideIcons.Wallet,
  'alert-triangle': LucideIcons.AlertTriangle,
  'check-circle-2': LucideIcons.CheckCircle2,
  'bell': LucideIcons.Bell,
  'arrow-up-right': LucideIcons.ArrowUpRight,
  'arrow-down-right': LucideIcons.ArrowDownRight,
  'plus': LucideIcons.Plus,
  'chevron-right': LucideIcons.ChevronRight,
  'chevron-down': LucideIcons.ChevronDown,
  'chevron-left': LucideIcons.ChevronLeft,
  'menu': LucideIcons.Menu,
  'x': LucideIcons.X,
  'refresh-cw': LucideIcons.RefreshCw,
  'edit-2': LucideIcons.Edit2,
  'trash-2': LucideIcons.Trash2,
  'download': LucideIcons.Download,
  'filter': LucideIcons.Filter,
  'user-plus': LucideIcons.UserPlus,
  'users2': LucideIcons.Users2,
  'command': LucideIcons.Command,
  'git-branch': LucideIcons.GitBranch,
  'layers': LucideIcons.Layers,
  'lock': LucideIcons.Lock,
  'key': LucideIcons.Key,
  'workflow': LucideIcons.Workflow,
  'package': LucideIcons.Package,
  'boxes': LucideIcons.Boxes,
  'bot': LucideIcons.Bot,
  'sparkles': LucideIcons.Sparkles,
  'lightbulb': LucideIcons.Lightbulb,
  'book': LucideIcons.Book,
  'database': LucideIcons.Database,
  'server': LucideIcons.Server,
  'rocket': LucideIcons.Rocket,
  'plug': LucideIcons.Plug,
  'repeat': LucideIcons.Repeat,
  'send': LucideIcons.Send,
  'list': LucideIcons.List,
  'route': LucideIcons.Route,
  'timer': LucideIcons.Timer,
  'badge': LucideIcons.Badge,
  'archive': LucideIcons.Archive,
  'history': LucideIcons.History,
  'check': LucideIcons.Check,
  'clipboard': LucideIcons.Clipboard,
  'map': LucideIcons.Map,
  'dollar': LucideIcons.DollarSign,
  'reports': LucideIcons.BarChart3,
  'chart': LucideIcons.BarChart3,
  'file': LucideIcons.FileText,
  'gavel': LucideIcons.Gavel,
  'flag': LucideIcons.Flag,
};

// Cache for database-driven icon registry
let iconRegistry: Record<string, React.ComponentType<any>> | null = null;
let isLoading = false;

async function loadIconRegistry(): Promise<Record<string, React.ComponentType<any>>> {
  if (iconRegistry) return iconRegistry;
  
  try {
    const response = await fetch('/api/icons');
    const data = await response.json();
    if (data.icons && Array.isArray(data.icons)) {
      const registry: Record<string, React.ComponentType<any>> = {};
      for (const entry of data.icons) {
        const Icon = (LucideIcons as any)[entry.lucide_component];
        if (Icon) {
          registry[entry.icon_name] = Icon;
        }
      }
      iconRegistry = registry;
      return registry;
    }
  } catch (error) {
    console.error('Failed to load icon registry from database, using fallback:', error);
  }
  
  return fallbackIconMap;
}

export async function renderIcon(iconName: string | null | undefined, className: string = 'h-4 w-4'): Promise<React.ReactNode> {
  if (!iconName) return null;
  const registry = await loadIconRegistry();
  const Icon = registry[iconName];
  if (!Icon) return null;
  return React.createElement(Icon, { className });
}

export function renderIconSync(iconName: string | null | undefined, className: string = 'h-4 w-4'): React.ReactNode {
  if (!iconName) return null;
  // Use fallback map synchronously (for components that can't wait)
  const Icon = fallbackIconMap[iconName];
  if (!Icon) return null;
  return React.createElement(Icon, { className });
}

export function getIconSync(iconName: string | null | undefined): React.ComponentType<any> | null {
  if (!iconName) return null;
  return fallbackIconMap[iconName] || null;
}