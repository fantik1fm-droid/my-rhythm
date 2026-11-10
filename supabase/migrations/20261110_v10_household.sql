-- Мой Ритм v10: «наш дом» — общие данные видны только участникам дома,
-- новые разделы (покупки, дела, бюджеты, записки, хроника, свидания, меню),
-- расширенные привычки/задачи/финансы, realtime.

-- ===== Дом и участники =====
create table if not exists public.households(
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Наш дом',
  invite_code text unique not null default upper(substr(md5(random()::text||clock_timestamp()::text),1,6)),
  created_at timestamptz default now());
create table if not exists public.household_members(
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key(household_id,user_id));
create unique index if not exists household_members_one_per_user on public.household_members(user_id);

create or replace function public.my_household() returns uuid
language sql stable security definer set search_path=public as
$$ select household_id from public.household_members where user_id=auth.uid() limit 1 $$;

create or replace function public.same_household(uid uuid) returns boolean
language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.household_members a join public.household_members b using(household_id)
                 where a.user_id=auth.uid() and b.user_id=uid) $$;

-- создать дом, если его нет
create or replace function public.ensure_household() returns uuid
language plpgsql security definer set search_path=public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select household_id into h from public.household_members where user_id=auth.uid();
  if h is null then
    insert into public.households default values returning id into h;
    insert into public.household_members(household_id,user_id) values(h,auth.uid());
  end if;
  return h;
end $$;

-- присоединиться к дому партнёра по коду
create or replace function public.join_household(code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare h uuid; old uuid; cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into h from public.households where invite_code=upper(trim(code));
  if h is null then raise exception 'Код не найден'; end if;
  select count(*) into cnt from public.household_members where household_id=h;
  if cnt>=2 and not exists(select 1 from public.household_members where household_id=h and user_id=auth.uid()) then
    raise exception 'В этом доме уже двое'; end if;
  select household_id into old from public.household_members where user_id=auth.uid();
  if old is not null and old<>h then
    delete from public.household_members where user_id=auth.uid();
    delete from public.households where id=old and not exists(select 1 from public.household_members where household_id=old);
  end if;
  insert into public.household_members(household_id,user_id) values(h,auth.uid()) on conflict do nothing;
  return h;
end $$;

-- новый код приглашения
create or replace function public.new_invite_code() returns text
language plpgsql security definer set search_path=public as $$
declare c text;
begin
  c:=upper(substr(md5(random()::text||clock_timestamp()::text),1,6));
  update public.households set invite_code=c where id=public.my_household();
  return c;
end $$;

grant execute on function public.my_household(), public.same_household(uuid), public.ensure_household(),
  public.join_household(text), public.new_invite_code() to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated using (id=public.my_household());
drop policy if exists households_update on public.households;
create policy households_update on public.households for update to authenticated using (id=public.my_household());
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select to authenticated using (household_id=public.my_household());

-- ===== Перенос существующих пользователей в один общий дом =====
do $$
declare h uuid;
begin
  if not exists(select 1 from public.household_members) then
    insert into public.households(name) values('Наш дом') returning id into h;
    insert into public.household_members(household_id,user_id) select h,id from auth.users;
  end if;
end $$;

-- ===== Новые общие таблицы =====
create table if not exists public.shopping(
  id uuid primary key default gen_random_uuid(),
  text text not null, cat text default 'Другое', qty text,
  done boolean default false, added_by uuid default auth.uid(), done_by uuid, done_at timestamptz,
  created_at timestamptz default now());
create table if not exists public.chores(
  id uuid primary key default gen_random_uuid(),
  title text not null, emoji text default '🧹', every_days int not null default 7,
  assignee uuid, next_date date not null default current_date, created_at timestamptz default now());
create table if not exists public.chore_log(
  id uuid primary key default gen_random_uuid(),
  chore_id uuid references public.chores(id) on delete cascade,
  title text, user_id uuid default auth.uid(), date date default current_date, created_at timestamptz default now());
create table if not exists public.budgets(
  id uuid primary key default gen_random_uuid(),
  category text not null, amount numeric not null default 0, created_at timestamptz default now());
create table if not exists public.notes(
  id uuid primary key default gen_random_uuid(),
  from_user uuid default auth.uid(), to_user uuid, kind text default 'note',
  text text not null, read_at timestamptz, created_at timestamptz default now());
create table if not exists public.memories(
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date, title text not null, text text, emoji text default '📸',
  created_by uuid default auth.uid(), created_at timestamptz default now());
create table if not exists public.date_ideas(
  id uuid primary key default gen_random_uuid(),
  text text not null, emoji text default '💡', cost text, done boolean default false, done_date date,
  created_by uuid default auth.uid(), created_at timestamptz default now());
create table if not exists public.meal_plan(
  id uuid primary key default gen_random_uuid(),
  date date not null, slot text default 'Ужин', title text not null, recipe_id uuid,
  created_at timestamptz default now());

-- household_id + RLS «только мой дом» для всех общих таблиц
do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','fin_goals','payments','wishlist','important_dates','plans','game_ttt',
                           'shopping','chores','chore_log','budgets','notes','memories','date_ideas','meal_plan'] loop
    execute format('alter table public.%I add column if not exists household_id uuid references public.households(id) on delete cascade default public.my_household()',t);
    execute format('update public.%I set household_id=(select id from public.households order by created_at limit 1) where household_id is null',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('create index if not exists %I on public.%I(household_id)',t||'_household_idx',t);
  end loop;
end $$;

drop policy if exists accounts_all_auth on public.accounts;
drop policy if exists tx_all_auth on public.transactions;
drop policy if exists fin_goals_all_auth on public.fin_goals;
drop policy if exists payments_all_auth on public.payments;
drop policy if exists wishlist_all_auth on public.wishlist;
drop policy if exists dates_all_auth on public.important_dates;
drop policy if exists plans_all_auth on public.plans;
drop policy if exists ttt_all_auth on public.game_ttt;

do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','fin_goals','payments','wishlist','important_dates','plans','game_ttt',
                           'shopping','chores','chore_log','budgets','notes','memories','date_ideas','meal_plan'] loop
    execute format('drop policy if exists %I on public.%I',t||'_household',t);
    execute format('create policy %I on public.%I for all to authenticated using (household_id=public.my_household()) with check (household_id=public.my_household())',t||'_household',t);
  end loop;
end $$;

create unique index if not exists budgets_household_category on public.budgets(household_id,category);

-- ===== Профили: видны только себе и партнёру =====
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_select_household on public.profiles;
create policy profiles_select_household on public.profiles for select to authenticated
  using (id=auth.uid() or public.same_household(id));

-- ===== Расширение личных таблиц =====
alter table public.days add column if not exists energy int;
alter table public.days add column if not exists weight numeric;
alter table public.habits add column if not exists kind text default 'check';
alter table public.habits add column if not exists target numeric default 1;
alter table public.habits add column if not exists unit text;
alter table public.habits add column if not exists weekdays int[];
alter table public.habits add column if not exists challenge_days int;
alter table public.habits add column if not exists archived boolean default false;
alter table public.habit_marks add column if not exists value numeric default 1;
alter table public.tasks add column if not exists shared boolean default false;
alter table public.tasks add column if not exists assignee uuid;
alter table public.tasks add column if not exists repeat text;
alter table public.tasks add column if not exists household_id uuid references public.households(id) on delete cascade default public.my_household();
alter table public.transactions add column if not exists to_account_id uuid;
alter table public.payments add column if not exists kind text default 'bill';
alter table public.payments add column if not exists remaining numeric;
alter table public.wishlist add column if not exists reserved_by uuid;
alter table public.wishlist add column if not exists price numeric;
alter table public.wishlist add column if not exists link text;

-- партнёр видит моё настроение/день, общие привычки и отметки, общие задачи
drop policy if exists days_select_household on public.days;
create policy days_select_household on public.days for select to authenticated using (public.same_household(user_id));
drop policy if exists habits_select_shared on public.habits;
create policy habits_select_shared on public.habits for select to authenticated using (shared and public.same_household(user_id));
drop policy if exists marks_select_household on public.habit_marks;
create policy marks_select_household on public.habit_marks for select to authenticated using (public.same_household(user_id));
drop policy if exists marks_all_own on public.habit_marks; -- дубль habit_marks_all_own
drop policy if exists tasks_shared on public.tasks;
create policy tasks_shared on public.tasks for all to authenticated
  using (shared and household_id=public.my_household()) with check (shared and household_id=public.my_household());

-- ===== Realtime =====
do $$
declare t text;
begin
  foreach t in array array['tasks','habits','habit_marks','days','accounts','transactions','fin_goals','payments','wishlist',
                           'important_dates','plans','shopping','chores','chore_log','budgets','notes','memories','date_ideas','meal_plan'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
