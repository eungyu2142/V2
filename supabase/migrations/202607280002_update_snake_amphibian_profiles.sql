-- Update snake and amphibian species care profiles.
-- These rows are read by diary routine recommendations, food choices, and environment checks.

update public.species_care_profiles
set
  environment_profile = '{"key":"snake","label":"스네이크","temperatureType":"air","targetTemperature":26,"minTemperature":23,"maxTemperature":29,"humidityEnabled":true,"targetHumidity":50,"minHumidity":40,"maxHumidity":60,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"frozen_thawed_mouse","label":"냉동 해동 마우스"},{"key":"frozen_thawed_rat","label":"냉동 해동 래트"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  routine_types = array['feed','water','humidity','temperature','full_cleaning','partial_cleaning','weight','custom'],
  updated_at = now()
where profile_key = 'snake';

update public.species_care_profiles
set
  environment_profile = '{"key":"python","label":"파이톤","temperatureType":"air","targetTemperature":28,"minTemperature":25,"maxTemperature":31,"humidityEnabled":true,"targetHumidity":60,"minHumidity":50,"maxHumidity":70,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"frozen_thawed_mouse","label":"냉동 해동 마우스"},{"key":"frozen_thawed_rat","label":"냉동 해동 래트"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  routine_types = array['feed','water','humidity','temperature','full_cleaning','partial_cleaning','weight','custom'],
  updated_at = now()
where profile_key = 'python';

update public.species_care_profiles
set
  environment_profile = '{"key":"boa","label":"보아","temperatureType":"air","targetTemperature":28,"minTemperature":25,"maxTemperature":31,"humidityEnabled":true,"targetHumidity":65,"minHumidity":55,"maxHumidity":75,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"frozen_thawed_mouse","label":"냉동 해동 마우스"},{"key":"frozen_thawed_rat","label":"냉동 해동 래트"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  routine_types = array['feed','water','humidity','temperature','full_cleaning','partial_cleaning','weight','custom'],
  updated_at = now()
where profile_key = 'boa';

update public.species_care_profiles
set
  environment_profile = '{"key":"newt","label":"뉴트","temperatureType":"water","targetTemperature":19,"minTemperature":16,"maxTemperature":22,"humidityEnabled":true,"targetHumidity":75,"minHumidity":65,"maxHumidity":85,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"earthworm","label":"지렁이"},{"key":"bloodworm","label":"장구벌레"},{"key":"blackworm","label":"블랙웜"},{"key":"daphnia","label":"물벼룩"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'newt';

update public.species_care_profiles
set
  food_options = '[{"key":"earthworm","label":"지렁이"},{"key":"cricket","label":"귀뚜라미"},{"key":"springtail","label":"톡토기"},{"key":"isopod","label":"등각류"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'salamander';

update public.species_care_profiles
set
  food_options = '[{"key":"earthworm","label":"지렁이"},{"key":"sinking_pellet","label":"전용 침강사료"},{"key":"bloodworm","label":"장구벌레"},{"key":"blackworm","label":"블랙웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'axolotl';

update public.species_care_profiles
set
  environment_profile = '{"key":"pacman_frog","label":"팩맨","temperatureType":"air","targetTemperature":25,"minTemperature":23,"maxTemperature":28,"humidityEnabled":true,"targetHumidity":70,"minHumidity":60,"maxHumidity":80,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"cricket","label":"귀뚜라미"},{"key":"earthworm","label":"지렁이"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'pacman_frog';

update public.species_care_profiles
set
  environment_profile = '{"key":"tree_frog","label":"트리프록","temperatureType":"air","targetTemperature":24,"minTemperature":22,"maxTemperature":28,"humidityEnabled":true,"targetHumidity":70,"minHumidity":60,"maxHumidity":80,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"cricket","label":"귀뚜라미"},{"key":"silkworm","label":"누에"},{"key":"flightless_fruit_fly","label":"날개 없는 초파리"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'tree_frog';

update public.species_care_profiles
set
  environment_profile = '{"key":"dart_frog","label":"다트프록","temperatureType":"air","targetTemperature":23,"minTemperature":22,"maxTemperature":26,"humidityEnabled":true,"targetHumidity":85,"minHumidity":75,"maxHumidity":90,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"flightless_fruit_fly","label":"날개 없는 초파리"},{"key":"springtail","label":"톡토기"},{"key":"small_isopod","label":"소형 등각류"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'dart_frog';

update public.species_care_profiles
set
  environment_profile = '{"key":"toad","label":"토드","temperatureType":"air","targetTemperature":22,"minTemperature":19,"maxTemperature":25,"humidityEnabled":true,"targetHumidity":65,"minHumidity":55,"maxHumidity":75,"isBroadCategory":true}'::jsonb,
  food_options = '[{"key":"cricket","label":"귀뚜라미"},{"key":"earthworm","label":"지렁이"},{"key":"silkworm","label":"누에"},{"key":"isopod","label":"등각류"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,
  updated_at = now()
where profile_key = 'toad';
