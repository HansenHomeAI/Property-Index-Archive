import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://rqomxflhuxnivwkdwrbv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OjPe4QlroqvzKydhU83AZw_4Cb3Idg2';
const CANYON_VISTA_PROPERTY_ID = '543ea93b-4715-4ca4-af1c-054cace3c896';
const FLOORPLAN_IMAGE_BUCKET = 'floorplan-images';

export const apartmentUnitsSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function throwIfSupabaseError(error) {
  if (error) throw new Error(error.message || 'Supabase query failed');
}

export async function fetchCanyonVistaProperty() {
  const { data, error } = await apartmentUnitsSupabase
    .from('properties')
    .select('id, name, website_url, rentcafe_floorplans_url, updated_at')
    .eq('id', CANYON_VISTA_PROPERTY_ID)
    .single();

  throwIfSupabaseError(error);
  return data;
}

export async function fetchCanyonVistaUnits({ availableOnly = false, limit = 1000 } = {}) {
  let query = apartmentUnitsSupabase
    .from('apartment_units')
    .select('id, unit_number, unit_type, floorplan_name, rent, available, apply_url, updated_at')
    .eq('property_id', CANYON_VISTA_PROPERTY_ID)
    .order('unit_number', { ascending: true })
    .limit(limit);

  if (availableOnly) query = query.eq('available', true);

  const { data, error } = await query;
  throwIfSupabaseError(error);
  return data || [];
}

export async function fetchCanyonVistaFloorplans() {
  const { data, error } = await apartmentUnitsSupabase
    .from('floorplans')
    .select('id, floorplan_name, unit_type, beds, baths, sqft_min, sqft_max, starting_price, available_count, floorplan_image_path, features, source_url')
    .eq('property_id', CANYON_VISTA_PROPERTY_ID)
    .order('beds', { ascending: true })
    .order('floorplan_name', { ascending: true });

  throwIfSupabaseError(error);
  return data || [];
}

export async function fetchAvailableUnitsForFloorplan(floorplanName) {
  const value = String(floorplanName || '').trim();
  if (!value) return [];

  const { data, error } = await apartmentUnitsSupabase
    .from('apartment_units')
    .select('id, unit_number, floorplan_name, unit_type, rent, available, apply_url, scraped_source_url')
    .eq('property_id', CANYON_VISTA_PROPERTY_ID)
    .eq('floorplan_name', value)
    .eq('available', true)
    .order('unit_number', { ascending: true });

  throwIfSupabaseError(error);
  return data || [];
}

export async function fetchCanyonVistaUnit(unitNumber) {
  const value = String(unitNumber || '').trim();
  if (!value) return null;

  const { data, error } = await apartmentUnitsSupabase
    .from('apartment_units')
    .select('id, unit_number, unit_type, floorplan_name, rent, available, apply_url, updated_at')
    .eq('property_id', CANYON_VISTA_PROPERTY_ID)
    .eq('unit_number', value)
    .maybeSingle();

  throwIfSupabaseError(error);
  return data;
}

export async function fetchCanyonVistaUnitSpatialMapping(unitNumber) {
  const value = String(unitNumber || '').trim();
  if (!value) return null;

  const { data, error } = await apartmentUnitsSupabase
    .from('unit_spatial_mappings')
    .select('id, unit_number, floor, polygon, volume, updated_at')
    .eq('property_id', CANYON_VISTA_PROPERTY_ID)
    .eq('unit_number', value)
    .maybeSingle();

  throwIfSupabaseError(error);
  return data;
}

function normalizeFloorplanImagePath(path) {
  const value = String(path || '').trim();
  if (value.endsWith('/Timpanogos.webp')) return value.replace('/Timpanogos.webp', '/Timponogos.webp');
  return value;
}

export function getFloorplanImageUrl(path) {
  const cleanPath = normalizeFloorplanImagePath(path);
  if (!cleanPath) return '';
  const { data } = apartmentUnitsSupabase.storage.from(FLOORPLAN_IMAGE_BUCKET).getPublicUrl(cleanPath);
  return data?.publicUrl || '';
}

export const canyonVistaSupabaseConfig = {
  url: SUPABASE_URL,
  propertyId: CANYON_VISTA_PROPERTY_ID,
  floorplanImageBucket: FLOORPLAN_IMAGE_BUCKET,
};
