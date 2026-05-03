-- DATABASE_SCHEMA_MASTER_V6
-- Auto generated from database_spec.yaml

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS partner_branding (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id uuid,
  logo_url varchar
);

CREATE TABLE IF NOT EXISTS partner_domains (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id uuid,
  domain varchar
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  settings jsonb
);

CREATE TABLE IF NOT EXISTS clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  email varchar
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  action varchar,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS white_label_brands (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS white_label_domains (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid,
  domain varchar
);

CREATE TABLE IF NOT EXISTS white_label_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid,
  asset_url varchar
);

CREATE TABLE IF NOT EXISTS white_label_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid,
  settings jsonb
);

CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar,
  email varchar
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid,
  code varchar
);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid,
  customer_id uuid
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id uuid,
  clicked_at timestamp
);

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id uuid,
  deal_id uuid
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id uuid,
  amount numeric
);

CREATE TABLE IF NOT EXISTS procedure_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar
);

CREATE TABLE IF NOT EXISTS procedures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS procedure_pricing (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id uuid,
  clinic_id uuid,
  price numeric
);

CREATE TABLE IF NOT EXISTS procedure_benefits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id uuid,
  benefit text
);

CREATE TABLE IF NOT EXISTS procedure_risks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id uuid,
  risk text
);

CREATE TABLE IF NOT EXISTS procedure_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id uuid,
  image_url varchar
);

CREATE TABLE IF NOT EXISTS procedure_videos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id uuid,
  video_url varchar
);

CREATE TABLE IF NOT EXISTS procedure_comparisons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_a uuid,
  procedure_b uuid,
  comparison_data jsonb
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  data jsonb
);

CREATE TABLE IF NOT EXISTS customer_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  preferences jsonb
);

CREATE TABLE IF NOT EXISTS customer_scores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  score numeric
);

CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar
);

CREATE TABLE IF NOT EXISTS customer_tag_map (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  tag_id uuid
);

CREATE TABLE IF NOT EXISTS customer_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  procedure_id uuid
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  scheduled_at timestamp
);

CREATE TABLE IF NOT EXISTS appointment_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid,
  action varchar
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  points integer
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  started_at timestamp
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  text text
);

CREATE TABLE IF NOT EXISTS message_embeddings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid,
  embedding vector
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  procedure_id uuid
);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  decision_data jsonb
);

CREATE TABLE IF NOT EXISTS conversation_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  rating integer
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  source varchar
);

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid,
  procedure_id uuid
);

CREATE TABLE IF NOT EXISTS sales_pipeline (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  stage varchar
);

CREATE TABLE IF NOT EXISTS sales_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid,
  action varchar
);

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid,
  price numeric
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS campaign_segments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  rule jsonb
);

CREATE TABLE IF NOT EXISTS campaign_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  message text
);

CREATE TABLE IF NOT EXISTS campaign_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  conversions integer
);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  platform varchar
);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid,
  creative_url varchar
);

CREATE TABLE IF NOT EXISTS ad_performance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creative_id uuid,
  clicks integer
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  total numeric
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid,
  amount numeric
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  plan varchar
);

CREATE TABLE IF NOT EXISTS subscription_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id uuid,
  action varchar
);

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id uuid,
  amount numeric
);

CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  event varchar
);

CREATE TABLE IF NOT EXISTS token_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  tokens integer
);

CREATE TABLE IF NOT EXISTS token_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  limit_value integer
);

CREATE TABLE IF NOT EXISTS token_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  usage_id uuid,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type varchar,
  event_data jsonb
);

CREATE TABLE IF NOT EXISTS conversion_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid,
  converted boolean
);

CREATE TABLE IF NOT EXISTS revenue_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  revenue numeric
);

CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  model varchar,
  accuracy numeric
);

CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric varchar,
  value numeric
);

CREATE TABLE IF NOT EXISTS report_exports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  file_url varchar
);

CREATE TABLE IF NOT EXISTS ai_datasets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_type varchar,
  data jsonb
);

CREATE TABLE IF NOT EXISTS ai_training_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id uuid,
  result jsonb
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  score integer
);

CREATE TABLE IF NOT EXISTS learning_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type varchar,
  data jsonb
);

CREATE TABLE IF NOT EXISTS dataset_improvements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id uuid,
  change_data jsonb
);

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid,
  type varchar
);

CREATE TABLE IF NOT EXISTS integration_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid,
  token varchar
);

CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid,
  log text
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source varchar,
  payload jsonb
);

CREATE TABLE IF NOT EXISTS integration_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid,
  message text
);

CREATE TABLE IF NOT EXISTS dashboards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  name varchar
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id uuid,
  type varchar
);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id uuid,
  layout jsonb
);

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id uuid,
  data jsonb
);

CREATE TABLE IF NOT EXISTS dashboard_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key varchar,
  value jsonb
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar,
  enabled boolean
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action varchar,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS customer_tag_map (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  tag_id uuid
);

CREATE TABLE IF NOT EXISTS customer_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  procedure_id uuid
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  scheduled_at timestamp
);

CREATE TABLE IF NOT EXISTS appointment_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid,
  action varchar
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid,
  points integer
);

CREATE TABLE IF NOT EXISTS consultation_flows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem varchar,
  recommendation jsonb
);

