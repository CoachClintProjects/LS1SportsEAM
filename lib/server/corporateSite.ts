import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export type CorporateAction = { label: string; href: string };
export type CorporateBrand = { name: string; descriptor: string; mark: string; accent: string };
export type CorporateNavItem = { code: string; label: string; href: string; sort_order: number };
export type CorporateSection = {
  id: string;
  code: string;
  section_type: string;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  items: string[];
  primary_action: CorporateAction | null;
  secondary_action: CorporateAction | null;
  sort_order: number;
};
export type CorporatePage = {
  id: string;
  slug: string;
  eyebrow: string | null;
  title: string;
  summary: string | null;
  sections: CorporateSection[];
};
export type CorporatePricingPlan = {
  id: string;
  code: string;
  name: string;
  price_amount: number | null;
  currency: string | null;
  billing_period: string | null;
  price_label: string | null;
  description: string | null;
  all_features_enabled: boolean;
  cta_label: string;
  cta_href: string;
  statements: string[];
};
export type CorporateAuthPolicy = {
  code: string;
  sso_enabled: boolean;
  sso_domain: string | null;
  magic_link_enabled: boolean;
  require_mfa: boolean;
  required_aal: 'aal1' | 'aal2';
  session_max_age_seconds: number;
};
export type CorporateSite = {
  brand: CorporateBrand;
  primaryCta: CorporateAction;
  loginCta: CorporateAction;
  footerStatement: string;
  navigation: CorporateNavItem[];
  page: CorporatePage;
  pricingPlans: CorporatePricingPlan[];
  authPolicy: CorporateAuthPolicy | null;
};

async function rest<T>(path: string): Promise<T> {
  const { url, serviceKey, publicKey } = supabaseServerConfig();
  const key = serviceKey ?? publicKey;
  if (!key) throw new Error('Corporate site database connection is not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Corporate site query failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function requiredConfig<T>(rows: Array<{ key: string; value: unknown }>, key: string): T {
  const row = rows.find((item) => item.key === key);
  if (!row) throw new Error(`Corporate site configuration '${key}' is missing.`);
  return row.value as T;
}

export async function getCorporateSite(slug: string): Promise<CorporateSite> {
  const [configRows, navigation, pages, plans, authRows] = await Promise.all([
    rest<Array<{ key: string; value: unknown }>>('corporate_site_config?select=key,value&is_active=eq.true'),
    rest<CorporateNavItem[]>('corporate_navigation?select=code,label,href,sort_order&is_active=eq.true&order=sort_order.asc'),
    rest<Array<Omit<CorporatePage, 'sections'>>>(`corporate_pages?select=id,slug,eyebrow,title,summary&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`),
    rest<Array<Omit<CorporatePricingPlan, 'statements'>>>('corporate_pricing_plans?select=id,code,name,price_amount,currency,billing_period,price_label,description,all_features_enabled,cta_label,cta_href&is_active=eq.true&order=sort_order.asc'),
    rest<CorporateAuthPolicy[]>('platform_auth_configuration?select=code,sso_enabled,sso_domain,magic_link_enabled,require_mfa,required_aal,session_max_age_seconds&code=eq.SUPERUSER&is_active=eq.true&limit=1'),
  ]);

  const page = pages[0];
  if (!page) throw new Error(`Corporate page '${slug}' is not configured.`);

  const [sections, statementRows] = await Promise.all([
    rest<CorporateSection[]>(`corporate_page_sections?select=id,code,section_type,eyebrow,title,body,items,primary_action,secondary_action,sort_order&page_id=eq.${page.id}&is_active=eq.true&order=sort_order.asc`),
    plans.length
      ? rest<Array<{ plan_id: string; statement: string; sort_order: number }>>(`corporate_plan_feature_statements?select=plan_id,statement,sort_order&plan_id=in.(${plans.map((plan) => plan.id).join(',')})&is_active=eq.true&order=sort_order.asc`)
      : Promise.resolve([]),
  ]);

  const pricingPlans = plans.map((plan) => ({
    ...plan,
    statements: statementRows.filter((row) => row.plan_id === plan.id).map((row) => row.statement),
  }));

  const brand = requiredConfig<CorporateBrand>(configRows, 'brand');
  const primaryCta = requiredConfig<CorporateAction>(configRows, 'primary_cta');
  const loginCta = requiredConfig<CorporateAction>(configRows, 'login_cta');
  const footer = requiredConfig<{ statement: string }>(configRows, 'footer');

  return {
    brand,
    primaryCta,
    loginCta,
    footerStatement: footer.statement,
    navigation,
    page: { ...page, sections },
    pricingPlans,
    authPolicy: authRows[0] ?? null,
  };
}
