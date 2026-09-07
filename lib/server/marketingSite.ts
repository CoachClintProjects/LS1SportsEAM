import { cache } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface MarketingSite {
  id: string;
  slug: string;
  brand_name: string;
  wordmark: string;
  meta_title: string;
  meta_description: string;
  theme: Record<string, string>;
  is_published: boolean;
}

export interface MarketingNavigationItem {
  id: string;
  site_id: string;
  label: string;
  href: string;
  item_type: string;
  sort_order: number;
  is_visible: boolean;
  metadata: Record<string, unknown>;
}

export interface MarketingSection {
  id: string;
  site_id: string;
  section_key: string;
  section_type: string;
  eyebrow: string | null;
  headline: string | null;
  body: string | null;
  sort_order: number;
  is_visible: boolean;
  settings: Record<string, unknown>;
  items: MarketingItem[];
}

export interface MarketingItem {
  id: string;
  section_id: string;
  item_key: string;
  title: string | null;
  description: string | null;
  kicker: string | null;
  value: string | null;
  href: string | null;
  cta_label: string | null;
  icon_key: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
}

export interface MarketingPricingPlan {
  id: string;
  site_id: string;
  plan_key: string;
  name: string;
  price_amount: number | null;
  price_label: string;
  currency_code: string;
  billing_period: string | null;
  description: string;
  cta_label: string;
  cta_href: string;
  all_features_included: boolean;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
}

export interface MarketingSiteData {
  site: MarketingSite;
  navigation: MarketingNavigationItem[];
  sections: MarketingSection[];
  pricing: MarketingPricingPlan[];
}

async function rest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase marketing site credentials are not configured.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Marketing data request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}

export const getMarketingSite = cache(async (slug = 'ls1sports'): Promise<MarketingSiteData | null> => {
  const sites = await rest<MarketingSite[]>(
    `marketing_sites?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*&limit=1`,
  );

  const site = sites[0];
  if (!site) return null;

  const siteId = encodeURIComponent(site.id);
  const [navigation, rawSections, pricing] = await Promise.all([
    rest<MarketingNavigationItem[]>(
      `marketing_navigation?site_id=eq.${siteId}&is_visible=eq.true&select=*&order=sort_order.asc`,
    ),
    rest<Omit<MarketingSection, 'items'>[]>(
      `marketing_sections?site_id=eq.${siteId}&is_visible=eq.true&select=*&order=sort_order.asc`,
    ),
    rest<MarketingPricingPlan[]>(
      `marketing_pricing?site_id=eq.${siteId}&is_active=eq.true&select=*&order=sort_order.asc`,
    ),
  ]);

  const sectionIds = rawSections.map((section) => section.id);
  const sectionItems = sectionIds.length
    ? await rest<MarketingItem[]>(
        `marketing_items?section_id=in.(${sectionIds.join(',')})&select=*&order=sort_order.asc`,
      )
    : [];

  const sections = rawSections.map((section) => ({
    ...section,
    items: sectionItems.filter((item) => item.section_id === section.id),
  }));

  return { site, navigation, sections, pricing };
});
