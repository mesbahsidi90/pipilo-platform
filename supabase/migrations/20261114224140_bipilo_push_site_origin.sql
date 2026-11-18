alter table public.push_subscriptions add column if not exists site_origin text; alter table public.demo_push_subscriptions add column if not exists site_origin text;
