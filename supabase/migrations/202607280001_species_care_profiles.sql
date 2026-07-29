-- Species-level care defaults used by diary routines.
-- This keeps routine recommendations, food candidates, and environment ranges
-- in the backend so the app can reuse the same data across flows.

create table if not exists public.species_care_profiles (
  profile_key text primary key,
  label text not null,
  category text not null check (category in ('reptile', 'amphibian')),
  aliases text[] not null default '{}',
  environment_profile jsonb,
  food_options jsonb not null default '[]'::jsonb,
  routine_types text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.species_care_profiles enable row level security;

drop policy if exists "species_care_profiles_read_all" on public.species_care_profiles;
create policy "species_care_profiles_read_all" on public.species_care_profiles
for select to authenticated using (true);

alter table public.care_plans
  drop constraint if exists care_plans_task_type_check;

alter table public.care_plans
  add constraint care_plans_task_type_check check (
    task_type in (
      'feed',
      'water',
      'mist',
      'temperature',
      'water_temperature',
      'humidity',
      'cleaning',
      'partial_cleaning',
      'full_cleaning',
      'substrate_change',
      'structure_cleaning',
      'wall_wipe',
      'uvb_check',
      'water_quality',
      'filter_check',
      'weight',
      'custom'
    )
  );

create or replace function public.complete_daily_task(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  task_row public.daily_tasks;
  record_row public.care_records;
  record_type text;
  record_memo text;
begin
  select * into task_row from public.daily_tasks where id = p_task_id and user_id = auth.uid() for update;
  if task_row.id is null then raise exception 'daily task not found'; end if;
  if task_row.status = 'completed' then
    select * into record_row from public.care_records where daily_task_id = task_row.id;
    return to_jsonb(record_row);
  end if;

  record_type := case
    when task_row.task_type = 'feed' then 'food'
    when task_row.task_type in ('cleaning', 'partial_cleaning', 'full_cleaning', 'substrate_change', 'structure_cleaning', 'wall_wipe') then 'cleaning'
    when task_row.task_type = 'weight' then 'weight'
    else 'other'
  end;

  record_memo := case task_row.task_type
    when 'feed' then '먹이 주기'
    when 'water' then '물그릇 교체'
    when 'mist' then '분무'
    when 'temperature' then '온도 확인'
    when 'water_temperature' then '수온 확인'
    when 'humidity' then '습도 확인'
    when 'cleaning' then '청소'
    when 'partial_cleaning' then '부분 청소'
    when 'full_cleaning' then '전체 청소'
    when 'substrate_change' then '바닥재 교체'
    when 'structure_cleaning' then '구조물 세척'
    when 'wall_wipe' then '벽 닦기'
    when 'uvb_check' then 'UVB 확인'
    when 'water_quality' then '수질 확인'
    when 'filter_check' then '여과기 상태 확인'
    when 'weight' then '무게 측정'
    else '관리'
  end;

  update public.daily_tasks set status = 'completed', completed_at = now(), updated_at = now() where id = task_row.id;
  insert into public.care_records (user_id, pet_id, record_date, record_type, memo, payload, daily_task_id, occurred_at, scheduled_for, status)
  values (
    task_row.user_id,
    task_row.pet_id,
    timezone('Asia/Seoul', now())::date,
    record_type,
    record_memo,
    jsonb_build_object('task_type', task_row.task_type, 'scheduled_date', task_row.scheduled_date),
    task_row.id,
    now(),
    task_row.scheduled_date,
    'completed'
  )
  returning * into record_row;
  return to_jsonb(record_row);
end;
$$;

insert into public.species_care_profiles (profile_key, label, category, aliases, environment_profile, food_options, routine_types, sort_order)
values
('crested_gecko','크레스티드 게코','reptile',array['크레스티드게코','crestedgecko'],'{"key":"crested_gecko","label":"크레스티드 게코","temperatureType":"air","targetTemperature":24,"minTemperature":22,"maxTemperature":26,"humidityEnabled":true,"targetHumidity":55,"minHumidity":40,"maxHumidity":70,"isBroadCategory":false}'::jsonb,'[{"key":"gecko_diet","label":"게코 전용 푸드"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],10),
('leopard_gecko','레오파드 게코','reptile',array['레오파드게코','leopardgecko'],'{"key":"leopard_gecko","label":"레오파드 게코","temperatureType":"air","targetTemperature":27,"minTemperature":24,"maxTemperature":30,"humidityEnabled":true,"targetHumidity":35,"minHumidity":30,"maxHumidity":40,"isBroadCategory":false}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],20),
('fat_tailed_gecko','팻테일 게코','reptile',array['펫테일게코','팻테일게코','fattailgecko','fat-tailedgecko','fat_tailedgecko'],'{"key":"fat_tailed_gecko","label":"팻테일 게코","temperatureType":"air","targetTemperature":26,"minTemperature":24,"maxTemperature":29,"humidityEnabled":true,"targetHumidity":60,"minHumidity":50,"maxHumidity":70,"isBroadCategory":false}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],30),
('viper_gecko','바이퍼 게코','reptile',array['바이퍼게코','vipergecko'],'{"key":"viper_gecko","label":"바이퍼 게코","temperatureType":"air","targetTemperature":27,"minTemperature":24,"maxTemperature":30,"humidityEnabled":true,"targetHumidity":40,"minHumidity":30,"maxHumidity":50,"isBroadCategory":false}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],40),
('chahoua_gecko','차화 게코','reptile',array['차화게코','chahouagecko'],'{"key":"chahoua_gecko","label":"차화 게코","temperatureType":"air","targetTemperature":24,"minTemperature":22,"maxTemperature":26,"humidityEnabled":true,"targetHumidity":60,"minHumidity":50,"maxHumidity":75,"isBroadCategory":false}'::jsonb,'[{"key":"gecko_diet","label":"게코 전용 푸드"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],50),
('gargoyle_gecko','가고일 게코','reptile',array['가고일게코','gargoylegecko'],'{"key":"gargoyle_gecko","label":"가고일 게코","temperatureType":"air","targetTemperature":24,"minTemperature":22,"maxTemperature":26,"humidityEnabled":true,"targetHumidity":60,"minHumidity":50,"maxHumidity":75,"isBroadCategory":false}'::jsonb,'[{"key":"gecko_diet","label":"게코 전용 푸드"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],60),
('day_gecko','데이 게코','reptile',array['데이게코','daygecko'],'{"key":"day_gecko","label":"데이 게코","temperatureType":"air","targetTemperature":27,"minTemperature":24,"maxTemperature":30,"humidityEnabled":true,"targetHumidity":58,"minHumidity":40,"maxHumidity":75,"isBroadCategory":false}'::jsonb,'[{"key":"gecko_diet","label":"게코 전용 푸드"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],70),
('tokay_gecko','토케이 게코','reptile',array['토케이게코','tokaygecko'],'{"key":"tokay_gecko","label":"토케이 게코","temperatureType":"air","targetTemperature":27,"minTemperature":25,"maxTemperature":29,"humidityEnabled":true,"targetHumidity":65,"minHumidity":55,"maxHumidity":75,"isBroadCategory":false}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','humidity','temperature','full_cleaning','partial_cleaning','custom'],80),
('bearded_dragon','비어디드래곤','reptile',array['비어디드래곤','비어디','beardeddragon'],'{"key":"bearded_dragon","label":"비어디드래곤","temperatureType":"air","targetTemperature":30,"minTemperature":22,"maxTemperature":42,"humidityEnabled":true,"targetHumidity":35,"minHumidity":30,"maxHumidity":40,"isBroadCategory":false}'::jsonb,'[{"key":"fruit","label":"과일"},{"key":"vegetable","label":"채소"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"diet","label":"사료"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],90),
('monitor','모니터·왕도마뱀','reptile',array['모니터','왕도마뱀','monitor'],'{"key":"monitor","label":"모니터·왕도마뱀","temperatureType":"air","targetTemperature":29,"minTemperature":26,"maxTemperature":32,"humidityEnabled":true,"targetHumidity":60,"minHumidity":45,"maxHumidity":70,"isBroadCategory":true}'::jsonb,'[{"key":"mouse","label":"쥐"},{"key":"chick","label":"병아리"},{"key":"quail","label":"메추리"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"egg","label":"달걀"},{"key":"meat","label":"육류"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],100),
('chameleon','카멜레온','reptile',array['카멜레온','chameleon'],'{"key":"chameleon","label":"카멜레온","temperatureType":"air","targetTemperature":25,"minTemperature":22,"maxTemperature":28,"humidityEnabled":true,"targetHumidity":65,"minHumidity":50,"maxHumidity":80,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"fly","label":"파리류"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],110),
('iguana','이구아나','reptile',array['이구아나','iguana'],'{"key":"iguana","label":"이구아나","temperatureType":"air","targetTemperature":28,"minTemperature":25,"maxTemperature":31,"humidityEnabled":true,"targetHumidity":75,"minHumidity":65,"maxHumidity":85,"isBroadCategory":true}'::jsonb,'[{"key":"leafy_greens","label":"잎채소"},{"key":"vegetables","label":"기타 채소"},{"key":"fruit","label":"과일"},{"key":"flower","label":"꽃"},{"key":"iguana_diet","label":"이구아나 전용 사료"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],120),
('skink','스킨크','reptile',array['스킨크','skink'],'{"key":"skink","label":"스킨크","temperatureType":"air","targetTemperature":27,"minTemperature":24,"maxTemperature":30,"humidityEnabled":true,"targetHumidity":50,"minHumidity":40,"maxHumidity":60,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"superworm","label":"슈퍼밀웜"},{"key":"egg","label":"달걀"},{"key":"meat","label":"육류"},{"key":"vegetable","label":"채소"},{"key":"fruit","label":"과일"},{"key":"skink_diet","label":"스킨크 전용 사료"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],130),
('uromastyx','유로매스틱스','reptile',array['유로매스틱스','uromastyx'],'{"key":"uromastyx","label":"유로매스틱스","temperatureType":"air","targetTemperature":34,"minTemperature":30,"maxTemperature":38,"humidityEnabled":true,"targetHumidity":25,"minHumidity":20,"maxHumidity":35,"isBroadCategory":true}'::jsonb,'[{"key":"leafy_greens","label":"잎채소"},{"key":"vegetables","label":"기타 채소"},{"key":"flower","label":"꽃"},{"key":"seed","label":"씨앗류"},{"key":"bean","label":"콩류"},{"key":"uromastyx_diet","label":"유로매스틱스 전용 사료"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],140),
('snake','스네이크','reptile',array['스네이크','snake'],null,'[{"key":"mouse","label":"쥐"},{"key":"quail","label":"메추리"},{"key":"chick","label":"병아리"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water','full_cleaning','partial_cleaning','weight','custom'],150),
('python','파이톤','reptile',array['파이톤','python'],null,'[{"key":"mouse","label":"쥐"},{"key":"rat","label":"랫"},{"key":"quail","label":"메추리"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water','full_cleaning','partial_cleaning','weight','custom'],160),
('boa','보아','reptile',array['보아','boa'],null,'[{"key":"mouse","label":"쥐"},{"key":"rat","label":"랫"},{"key":"quail","label":"메추리"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water','full_cleaning','partial_cleaning','weight','custom'],170),
('tortoise','육지거북','reptile',array['육지거북','육지거북이','tortoise'],'{"key":"tortoise","label":"육지거북","temperatureType":"air","targetTemperature":23,"minTemperature":20,"maxTemperature":25,"humidityEnabled":true,"targetHumidity":50,"minHumidity":40,"maxHumidity":60,"isBroadCategory":true}'::jsonb,'[{"key":"vegetable","label":"채소"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water','humidity','temperature','full_cleaning','partial_cleaning','weight','custom'],180),
('aquatic_turtle','수생거북','reptile',array['수생거북','수생거북이','aquaticturtle'],'{"key":"aquatic_turtle","label":"수생거북","temperatureType":"water","targetTemperature":25,"minTemperature":22,"maxTemperature":27,"humidityEnabled":false,"targetHumidity":null,"minHumidity":null,"maxHumidity":null,"isBroadCategory":true}'::jsonb,'[{"key":"turtle_diet","label":"거북이 전용사료"},{"key":"cricket","label":"귀뚜라미"},{"key":"aquatic_plant","label":"수초"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water_temperature','water_quality','filter_check','weight','full_cleaning','partial_cleaning','custom'],190),
('semi_aquatic_turtle','반수생 거북','reptile',array['반수생거북','반수생거북이','semiaquaticturtle','terrapin'],'{"key":"semi_aquatic_turtle","label":"반수생 거북","temperatureType":"air","targetTemperature":25,"minTemperature":22,"maxTemperature":25,"humidityEnabled":false,"targetHumidity":null,"minHumidity":null,"maxHumidity":null,"isBroadCategory":true}'::jsonb,'[{"key":"turtle_diet","label":"거북이사료"},{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"vegetable","label":"채소"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','temperature','water_temperature','water_quality','filter_check','weight','full_cleaning','partial_cleaning','custom'],200),
('pacman_frog','팩맨','amphibian',array['팩맨','pacman','pacmanfrog'],'{"key":"pacman_frog","label":"팩맨","temperatureType":"air","targetTemperature":25,"minTemperature":23,"maxTemperature":28,"humidityEnabled":true,"targetHumidity":75,"minHumidity":70,"maxHumidity":85,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],210),
('tree_frog','트리프록','amphibian',array['트리프록','treefrog'],'{"key":"tree_frog","label":"트리프록","temperatureType":"air","targetTemperature":25,"minTemperature":22,"maxTemperature":28,"humidityEnabled":true,"targetHumidity":75,"minHumidity":65,"maxHumidity":85,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],220),
('dart_frog','다트프록','amphibian',array['다트프록','독화살개구리','dartfrog'],'{"key":"dart_frog","label":"다트프록","temperatureType":"air","targetTemperature":24,"minTemperature":22,"maxTemperature":26,"humidityEnabled":true,"targetHumidity":85,"minHumidity":75,"maxHumidity":90,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],230),
('toad','토드','amphibian',array['토드','두꺼비','toad'],'{"key":"toad","label":"토드","temperatureType":"air","targetTemperature":22,"minTemperature":19,"maxTemperature":25,"humidityEnabled":true,"targetHumidity":75,"minHumidity":65,"maxHumidity":85,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],240),
('newt','뉴트','amphibian',array['뉴트','newt'],'{"key":"newt","label":"뉴트","temperatureType":"water","targetTemperature":19,"minTemperature":16,"maxTemperature":22,"humidityEnabled":false,"targetHumidity":null,"minHumidity":null,"maxHumidity":null,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water_temperature','water_quality','weight','full_cleaning','partial_cleaning','custom'],250),
('salamander','살라만다','amphibian',array['살라만다','salamander'],'{"key":"salamander","label":"살라만다","temperatureType":"air","targetTemperature":19,"minTemperature":16,"maxTemperature":22,"humidityEnabled":true,"targetHumidity":80,"minHumidity":70,"maxHumidity":90,"isBroadCategory":true}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','mist','water','humidity','temperature','full_cleaning','partial_cleaning','custom'],260),
('axolotl','아홀로틀','amphibian',array['아홀로틀','axolotl'],'{"key":"axolotl","label":"아홀로틀","temperatureType":"water","targetTemperature":18,"minTemperature":16,"maxTemperature":20,"humidityEnabled":false,"targetHumidity":null,"minHumidity":null,"maxHumidity":null,"isBroadCategory":false}'::jsonb,'[{"key":"cricket","label":"귀뚜라미"},{"key":"mealworm","label":"밀웜"},{"key":"silkworm","label":"누에"},{"key":"custom","label":"기타 직접 입력"}]'::jsonb,array['feed','water_temperature','water_quality','filter_check','weight','full_cleaning','partial_cleaning','custom'],270)
on conflict (profile_key) do update set
  label = excluded.label,
  category = excluded.category,
  aliases = excluded.aliases,
  environment_profile = excluded.environment_profile,
  food_options = excluded.food_options,
  routine_types = excluded.routine_types,
  sort_order = excluded.sort_order,
  updated_at = now();
