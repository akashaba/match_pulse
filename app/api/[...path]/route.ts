import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { readBearerUser, requireRole, signSession, SessionUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type DbUser = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  profile_photo?: string | null;
  role: SessionUser['role'];
  failed_login_attempts?: number;
  lockout_end_time?: string | null;
  account_locked?: boolean;
  first_failed_login_time?: string | null;
};

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const fail = (message: string, status = 400) => json({ message }, status);
const asInt = (value: string | undefined) => Number.parseInt(value || '', 10);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const isMissingSchema = (error: any) => error?.code === 'PGRST205' || error?.code === '42P01';
const isDuplicate = (error: any) => error?.code === '23505';
const schemaSetupMessage = 'Supabase database schema has not been initialized. Apply supabase/migrations/001_initial_sports_pred.sql to this project.';
const assetBucket = 'sports-assets';
const defaultLoginHeroUrl = '/login-hero-vr-sports.png';
const defaultScoringRules = {
  exactScore: 5,
  correctOutcome: 3,
  wrongPrediction: 0,
  jokerMultiplier: 2,
};

function assetUrl(path?: string | null) {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return undefined;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${assetBucket}/${encodedPath}`;
}

function configuredAssetUrl(path?: string | null, fallback = defaultLoginHeroUrl) {
  if (!path) return fallback;
  if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) return path;
  return assetUrl(path) ?? fallback;
}

async function loginSettings(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'login_hero_path')
    .maybeSingle();

  if (error && !isMissingSchema(error)) throw new Error(error.message);
  const loginHeroPath = data?.value ?? null;

  return {
    loginHeroPath,
    loginHeroUrl: configuredAssetUrl(loginHeroPath),
    defaultLoginHeroUrl,
  };
}

async function getSettingMap(supabase: ReturnType<typeof getSupabaseAdmin>, keys: string[]) {
  const { data, error } = await supabase.from('app_settings').select('key,value').in('key', keys);
  if (error && !isMissingSchema(error)) throw new Error(error.message);
  return new Map((data || []).map((row: any) => [row.key, row.value]));
}

function parseScoringRules(value?: string | null) {
  if (!value) return defaultScoringRules;
  try {
    const parsed = JSON.parse(value);
    return {
      exactScore: Number(parsed.exactScore ?? defaultScoringRules.exactScore),
      correctOutcome: Number(parsed.correctOutcome ?? defaultScoringRules.correctOutcome),
      wrongPrediction: Number(parsed.wrongPrediction ?? defaultScoringRules.wrongPrediction),
      jokerMultiplier: Number(parsed.jokerMultiplier ?? defaultScoringRules.jokerMultiplier),
    };
  } catch {
    return defaultScoringRules;
  }
}

async function appSettings(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const settings = await getSettingMap(supabase, [
    'app_name',
    'app_logo_path',
    'theme_image_path',
    'default_sport_id',
    'default_division_id',
    'scoring_rules',
    'login_hero_path',
  ]);
  const appLogoPath = settings.get('app_logo_path') ?? null;
  const themeImagePath = settings.get('theme_image_path') ?? null;
  const loginHeroPath = settings.get('login_hero_path') ?? null;

  return {
    appName: settings.get('app_name') || 'MatchPulse',
    appLogoPath,
    appLogoUrl: configuredAssetUrl(appLogoPath, '/matchpulse-logo.png'),
    themeImagePath,
    themeImageUrl: configuredAssetUrl(themeImagePath, '/night-football-game.jpg'),
    loginHeroPath,
    loginHeroUrl: configuredAssetUrl(loginHeroPath),
    defaultSportId: settings.get('default_sport_id') ? Number(settings.get('default_sport_id')) : null,
    defaultDivisionId: settings.get('default_division_id') ? Number(settings.get('default_division_id')) : null,
    scoringRules: parseScoringRules(settings.get('scoring_rules')),
  };
}

async function scoringRules(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const settings = await getSettingMap(supabase, ['scoring_rules']);
  return parseScoringRules(settings.get('scoring_rules'));
}

function publicUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    profilePhoto: user.profile_photo ?? undefined,
    role: user.role,
    isGuest: user.is_guest ?? false,
    accountLocked: user.account_locked,
    failedLoginAttempts: user.failed_login_attempts,
    lockoutEndTime: user.lockout_end_time,
  };
}

function authResponse(user: DbUser) {
  return {
    id: user.id,
    token: signSession({ id: user.id, username: user.username, email: user.email, role: user.role }),
    username: user.username,
    email: user.email,
    role: user.role,
    profilePhoto: user.profile_photo ?? undefined,
  };
}

function divisionDto(row: any) {
  return row ? {
    id: row.id,
    name: row.name,
    code: row.code,
    logoPath: row.logo_path ?? undefined,
    logoUrl: row.logo_url ?? assetUrl(row.logo_path),
  } : null;
}

function teamDto(row: any) {
  return row ? {
    id: row.id,
    name: row.name,
    code: row.code,
    badgePath: row.badge_path ?? undefined,
    badgeUrl: row.badge_url ?? assetUrl(row.badge_path),
    division: divisionDto(row.division) ?? undefined,
  } : null;
}

function matchdayDto(row: any) {
  const now = Date.now();
  const start = new Date(row.start_date).getTime();
  const deadline = row.end_date ? new Date(row.end_date).getTime() : start;
  const computedStatus = row.status === 'COMPLETED' ? 'COMPLETED' : now < start ? 'UPCOMING' : now < deadline ? 'IN_PROGRESS' : 'COMPLETED';

  return {
    id: row.id,
    name: row.name,
    number: row.number,
    division: divisionDto(row.division) ?? undefined,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    computedStatus,
    predictionsOpen: row.status !== 'COMPLETED' && now < deadline,
  };
}

function fixtureDto(row: any) {
  return {
    id: row.id,
    matchdayId: row.matchday_id,
    matchday: row.matchday ? matchdayDto(row.matchday) : undefined,
    homeTeam: teamDto(row.home_team),
    awayTeam: teamDto(row.away_team),
    homeScore: row.home_score,
    awayScore: row.away_score,
    kickoffAt: row.kickoff_at ?? undefined,
    displayOrder: row.display_order ?? undefined,
    status: row.status,
  };
}

async function leagueDto(supabase: ReturnType<typeof getSupabaseAdmin>, row: any) {
  const [{ data: division }, { data: creator }, { data: members }] = await Promise.all([
    supabase.from('divisions').select('id,name,code,logo_url,logo_path').eq('id', row.division_id).single(),
    supabase.from('users').select('id,username').eq('id', row.created_by).single(),
    supabase.from('league_members').select('user:users(id,username,email,profile_photo,role,is_guest)').eq('league_id', row.id),
  ]);

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    division: divisionDto(division),
    createdBy: creator,
    members: (members || []).map((m: any) => m.user).filter(Boolean),
    overallStandingsEnabled: row.overall_standings_enabled,
    h2hLeaderboardEnabled: row.h2h_leaderboard_enabled,
    h2hKnockoutEnabled: row.h2h_knockout_enabled,
  };
}

function predictionDto(row: any) {
  return {
    id: row.id,
    fixtureId: row.fixture_id,
    userId: row.user_id,
    leagueId: row.league_id,
    predictedHomeScore: row.predicted_home_score,
    predictedAwayScore: row.predicted_away_score,
    points: row.points ?? 0,
    isJoker: row.is_joker ?? false,
    user: row.user ? publicUser(row.user) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function activityDto(row: any) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    at: row.created_at,
    matchdayId: row.matchday_id ?? undefined,
    fixtureId: row.fixture_id ?? undefined,
    metadata: row.metadata || {},
    user: row.actor ? compactUser(row.actor) : undefined,
  };
}

function notificationDto(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    leagueId: row.league_id ?? undefined,
    matchdayId: row.matchday_id ?? undefined,
    fixtureId: row.fixture_id ?? undefined,
    actor: row.actor ? compactUser(row.actor) : undefined,
  };
}

function isExactPrediction(pred: any, fixture: any) {
  return fixture.status === 'COMPLETED'
    && fixture.home_score !== null
    && fixture.away_score !== null
    && pred.predicted_home_score === fixture.home_score
    && pred.predicted_away_score === fixture.away_score;
}

function isOutcomePrediction(pred: any, fixture: any) {
  if (fixture.status !== 'COMPLETED' || fixture.home_score === null || fixture.away_score === null) return false;
  const actual = Math.sign(fixture.home_score - fixture.away_score);
  const predicted = Math.sign(pred.predicted_home_score - pred.predicted_away_score);
  return actual === predicted;
}

function scorePrediction(pred: any, fixture: any, rules = defaultScoringRules) {
  if (fixture.status !== 'COMPLETED' || fixture.home_score === null || fixture.away_score === null) return 0;
  let points = rules.wrongPrediction;
  if (isExactPrediction(pred, fixture)) {
    points = rules.exactScore;
  } else if (isOutcomePrediction(pred, fixture)) {
    points = rules.correctOutcome;
  }
  return pred.is_joker ? points * rules.jokerMultiplier : points;
}

async function clearJokerForMatchday(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  userId: number,
  matchdayId: number,
  exceptFixtureId?: number
) {
  const { data: jokerRows } = await supabase
    .from('predictions')
    .select('id, fixture_id, fixture:fixtures(matchday_id)')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .eq('is_joker', true);

  const ids = (jokerRows || [])
    .filter((row: any) => row.fixture?.matchday_id === matchdayId && row.fixture_id !== exceptFixtureId)
    .map((row: any) => row.id);

  if (ids.length) {
    await supabase.from('predictions').update({ is_joker: false, updated_at: new Date().toISOString() }).in('id', ids);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'guest';
}

async function addLeagueMember(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, userId: number) {
  await supabase.from('league_members').upsert({ league_id: leagueId, user_id: userId }, { onConflict: 'league_id,user_id' });
  await supabase.from('league_standings').upsert({ league_id: leagueId, user_id: userId }, { onConflict: 'league_id,user_id' });
  await supabase.from('h2h_standings').upsert({ league_id: leagueId, user_id: userId }, { onConflict: 'league_id,user_id' });
  await ensureAllLeagueH2hMatchups(supabase, leagueId, true);
  await recalcH2h(supabase, leagueId);
}

async function canManageLeague(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  user: SessionUser,
) {
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  const { data } = await supabase.from('leagues').select('created_by').eq('id', leagueId).maybeSingle();
  return data?.created_by === user.id;
}

async function removeLeagueMember(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, userId: number) {
  const { data: league } = await supabase.from('leagues').select('created_by').eq('id', leagueId).maybeSingle();
  if (!league) throw new Error('League not found');
  if (league.created_by === userId) throw new Error('The league creator cannot be removed');

  await supabase.from('h2h_matchups').delete().eq('league_id', leagueId).or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
  await supabase.from('predictions').delete().eq('league_id', leagueId).eq('user_id', userId);
  await supabase.from('league_standings').delete().eq('league_id', leagueId).eq('user_id', userId);
  await supabase.from('h2h_standings').delete().eq('league_id', leagueId).eq('user_id', userId);
  const { error } = await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  await ensureAllLeagueH2hMatchups(supabase, leagueId, true);
  await recalcH2h(supabase, leagueId);
}

async function createGuestUser(supabase: ReturnType<typeof getSupabaseAdmin>, displayName: string, email?: string) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const username = `${slugify(displayName)}-${suffix}`;
  const syntheticEmail = email?.trim() || `${username}@guest.sportspred.local`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

  const { data, error } = await supabase.from('users').insert({
    username,
    email: syntheticEmail,
    password_hash: passwordHash,
    role: 'USER',
    is_guest: true,
    account_locked: true,
  }).select('*').single();

  if (error) throw new Error(error.message);
  return data;
}

async function mergeGuestIntoUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  guestUserId: number,
  targetUserId: number,
) {
  if (guestUserId === targetUserId) throw new Error('This guest is already linked to this account');
  const [{ data: guest }, { data: target }] = await Promise.all([
    supabase.from('users').select('*').eq('id', guestUserId).single(),
    supabase.from('users').select('*').eq('id', targetUserId).single(),
  ]);
  if (!guest?.is_guest) throw new Error('Only guest members can be claimed');
  if (!target || target.is_guest) throw new Error('Claim with a registered user account');

  const { data: guestMemberships } = await supabase.from('league_members').select('league_id').eq('user_id', guestUserId);
  const leagueIds = [...new Set((guestMemberships || []).map((row: any) => row.league_id))];

  const { data: guestPredictions } = await supabase
    .from('predictions')
    .select('fixture_id,league_id')
    .eq('user_id', guestUserId);
  for (const prediction of guestPredictions || []) {
    await supabase
      .from('predictions')
      .delete()
      .eq('user_id', targetUserId)
      .eq('fixture_id', prediction.fixture_id)
      .eq('league_id', prediction.league_id);
  }
  await supabase.from('predictions').update({ user_id: targetUserId, updated_at: new Date().toISOString() }).eq('user_id', guestUserId);

  for (const leagueId of leagueIds) {
    await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', targetUserId);
    await supabase.from('league_standings').delete().eq('league_id', leagueId).eq('user_id', targetUserId);
    await supabase.from('h2h_standings').delete().eq('league_id', leagueId).eq('user_id', targetUserId);
  }
  await supabase.from('league_members').update({ user_id: targetUserId }).eq('user_id', guestUserId);
  await supabase.from('league_standings').update({ user_id: targetUserId }).eq('user_id', guestUserId);
  await supabase.from('h2h_standings').update({ user_id: targetUserId }).eq('user_id', guestUserId);

  await supabase.from('h2h_matchups').update({ player1_id: targetUserId }).eq('player1_id', guestUserId);
  await supabase.from('h2h_matchups').update({ player2_id: targetUserId }).eq('player2_id', guestUserId);
  await supabase.from('h2h_matchups').update({ winner_id: targetUserId }).eq('winner_id', guestUserId);
  await supabase.from('activities').update({ actor_id: targetUserId }).eq('actor_id', guestUserId);
  await supabase.from('notifications').update({ actor_id: targetUserId }).eq('actor_id', guestUserId);

  const { data: guestNotifications } = await supabase.from('notifications').select('unique_key').eq('user_id', guestUserId);
  const uniqueKeys = (guestNotifications || []).map((row: any) => row.unique_key).filter(Boolean);
  if (uniqueKeys.length) {
    await supabase.from('notifications').delete().eq('user_id', targetUserId).in('unique_key', uniqueKeys);
  }
  await supabase.from('notifications').update({ user_id: targetUserId }).eq('user_id', guestUserId);

  await supabase.from('users').update({
    account_locked: true,
    failed_login_attempts: 0,
    lockout_end_time: null,
    first_failed_login_time: null,
  }).eq('id', guestUserId);

  for (const leagueId of leagueIds) {
    await recalcLeagueStandings(supabase, leagueId);
    await ensureAllLeagueH2hMatchups(supabase, leagueId, true);
    await recalcH2h(supabase, leagueId);
  }

  return { guest, target, leagueIds };
}

async function recalcLeagueStandings(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, lastMatchdayId?: number) {
  const { data: members } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId);
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, fixture:fixtures(status,matchday_id,home_score,away_score)')
    .eq('league_id', leagueId);

  for (const member of members || []) {
    const mine = (predictions || []).filter((p: any) => p.user_id === member.user_id && p.fixture?.status === 'COMPLETED');
    const matchdays = new Set(mine.map((p: any) => p.fixture?.matchday_id).filter(Boolean));
    const lastPoints = lastMatchdayId ? mine.filter((p: any) => p.fixture?.matchday_id === lastMatchdayId).reduce((sum: number, p: any) => sum + (p.points || 0), 0) : 0;

    await supabase.from('league_standings').upsert({
      league_id: leagueId,
      user_id: member.user_id,
      total_points: mine.reduce((sum: number, p: any) => sum + (p.points || 0), 0),
      matchdays_played: matchdays.size,
      correct_scores: mine.filter((p: any) => isExactPrediction(p, p.fixture)).length,
      correct_outcomes: mine.filter((p: any) => isOutcomePrediction(p, p.fixture) && !isExactPrediction(p, p.fixture)).length,
      last_matchday_points: lastPoints,
      last_matchday_id: lastMatchdayId ?? null,
    }, { onConflict: 'league_id,user_id' });
  }
}

async function totalPredictionPoints(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, userId: number | null, matchdayId: number) {
  if (!userId) return 0;
  const { data } = await supabase
    .from('predictions')
    .select('points, fixture:fixtures(matchday_id,status)')
    .eq('league_id', leagueId)
    .eq('user_id', userId);

  return (data || [])
    .filter((p: any) => p.fixture?.matchday_id === matchdayId && p.fixture?.status === 'COMPLETED')
    .reduce((sum: number, p: any) => sum + (p.points || 0), 0);
}

async function addActivity(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    leagueId: number;
    type: string;
    message: string;
    actorId?: number | null;
    matchdayId?: number | null;
    fixtureId?: number | null;
    metadata?: Record<string, unknown>;
    uniqueKey?: string;
  }
) {
  const row = {
    league_id: input.leagueId,
    actor_id: input.actorId ?? null,
    matchday_id: input.matchdayId ?? null,
    fixture_id: input.fixtureId ?? null,
    type: input.type,
    message: input.message,
    metadata: input.metadata || {},
    unique_key: input.uniqueKey ?? null,
    created_at: new Date().toISOString(),
  };

  const query = input.uniqueKey
    ? supabase.from('league_activity').upsert(row, { onConflict: 'league_id,unique_key' })
    : supabase.from('league_activity').insert(row);
  const { error } = await query;
  if (error && !isMissingSchema(error) && !isDuplicate(error)) throw new Error(error.message);
}

async function addNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    userId: number;
    type: string;
    title: string;
    message: string;
    actorId?: number | null;
    leagueId?: number | null;
    matchdayId?: number | null;
    fixtureId?: number | null;
    uniqueKey?: string;
  }
) {
  const row = {
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    league_id: input.leagueId ?? null,
    matchday_id: input.matchdayId ?? null,
    fixture_id: input.fixtureId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    unique_key: input.uniqueKey ?? null,
    created_at: new Date().toISOString(),
  };

  const query = input.uniqueKey
    ? supabase.from('notifications').upsert(row, { onConflict: 'user_id,unique_key' })
    : supabase.from('notifications').insert(row);
  const { error } = await query;
  if (error && !isMissingSchema(error) && !isDuplicate(error)) throw new Error(error.message);
}

async function notifyLeagueMembers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  input: Omit<Parameters<typeof addNotification>[1], 'userId' | 'leagueId'> & { excludeUserIds?: number[] }
) {
  const { data: members, error } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId);
  if (error && !isMissingSchema(error)) throw new Error(error.message);
  const exclude = new Set(input.excludeUserIds || []);
  await Promise.all((members || [])
    .filter((member: any) => !exclude.has(member.user_id))
    .map((member: any) => addNotification(supabase, {
      ...input,
      userId: member.user_id,
      leagueId,
      uniqueKey: input.uniqueKey ? `${input.uniqueKey}:${member.user_id}` : undefined,
    })));
}

async function getLeagueRanks(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number) {
  const { data } = await supabase
    .from('league_standings')
    .select('user_id,total_points,correct_scores,correct_outcomes,user:users(*)')
    .eq('league_id', leagueId)
    .order('total_points', { ascending: false })
    .order('correct_scores', { ascending: false })
    .order('correct_outcomes', { ascending: false });

  return new Map((data || []).map((row: any, index: number) => [row.user_id, { ...row, rank: index + 1 }]));
}

async function addPredictionActivity(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  userId: number,
  matchdayId: number
) {
  const [{ data: actor }, { data: league }, { data: matchday }, { data: predictionRows }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('leagues').select('name').eq('id', leagueId).single(),
    supabase.from('matchdays').select('id,name,number').eq('id', matchdayId).single(),
    supabase
      .from('predictions')
      .select('id, fixture:fixtures(matchday_id)')
      .eq('league_id', leagueId)
      .eq('user_id', userId),
  ]);

  const count = (predictionRows || []).filter((prediction: any) => prediction.fixture?.matchday_id === matchdayId).length;
  const matchdayName = formatMatchdayName(matchday);
  const actorName = actor?.username || 'Someone';
  await addActivity(supabase, {
    leagueId,
    type: 'prediction',
    actorId: userId,
    matchdayId,
    uniqueKey: `prediction:${userId}:${matchdayId}`,
    message: `${actorName} submitted ${count} prediction${count === 1 ? '' : 's'} for ${matchdayName}.`,
    metadata: { count, leagueName: league?.name, matchdayName },
  });
}

async function addFixtureCreatedNotifications(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  matchdayId: number,
  actorId: number,
  count: number
) {
  const { data: matchday } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
  if (!matchday) return;
  const { data: leagues } = await supabase.from('leagues').select('id,name').eq('division_id', matchday.division_id);
  const matchdayName = formatMatchdayName(matchday);

  await Promise.all((leagues || []).map(async (league: any) => {
    const message = `${count} new fixture${count === 1 ? '' : 's'} added for ${matchdayName}.`;
    await addActivity(supabase, {
      leagueId: league.id,
      type: 'fixtures',
      actorId,
      matchdayId,
      uniqueKey: `fixtures:${matchdayId}:${Date.now()}`,
      message,
      metadata: { count, matchdayName },
    });
    await notifyLeagueMembers(supabase, league.id, {
      type: 'fixtures',
      title: 'New fixtures added',
      message,
      actorId,
      matchdayId,
      uniqueKey: `fixtures:${matchdayId}:${count}:${Date.now()}`,
    });
  }));
}

async function addMatchdayResultPulse(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  matchdayId: number,
  actorId: number,
  beforeRanks: Map<any, any>
) {
  const [{ data: league }, { data: matchday }, { data: fixtures }, { data: predictions }] = await Promise.all([
    supabase.from('leagues').select('name').eq('id', leagueId).single(),
    supabase.from('matchdays').select('*').eq('id', matchdayId).single(),
    supabase.from('fixtures').select('id,status').eq('matchday_id', matchdayId),
    supabase.from('predictions').select('*, user:users(*), fixture:fixtures(matchday_id,status)').eq('league_id', leagueId),
  ]);
  if (!matchday) return;

  const allCompleted = (fixtures || []).length > 0 && (fixtures || []).every((fixture: any) => fixture.status === 'COMPLETED');
  const matchdayName = formatMatchdayName(matchday);

  if (allCompleted) {
    const message = `${matchdayName} results posted.`;
    await addActivity(supabase, {
      leagueId,
      type: 'results',
      actorId,
      matchdayId,
      uniqueKey: `results:${matchdayId}`,
      message,
      metadata: { leagueName: league?.name, matchdayName },
    });
    await notifyLeagueMembers(supabase, leagueId, {
      type: 'results',
      title: 'Results posted',
      message,
      actorId,
      matchdayId,
      uniqueKey: `results:${leagueId}:${matchdayId}`,
    });

    const matchdayPredictions = (predictions || []).filter((prediction: any) => prediction.fixture?.matchday_id === matchdayId);
    const pointsByUser = new Map<number, { user: any; points: number }>();
    for (const prediction of matchdayPredictions) {
      const existing = pointsByUser.get(prediction.user_id) || { user: prediction.user, points: 0 };
      existing.points += prediction.points || 0;
      pointsByUser.set(prediction.user_id, existing);
    }
    const bestPoints = Math.max(0, ...[...pointsByUser.values()].map((value) => value.points));
    for (const winner of [...pointsByUser.values()].filter((value) => value.points === bestPoints && bestPoints > 0)) {
      if (!winner.user?.id) continue;
      const winnerName = winner.user?.username || 'Someone';
      const winnerMessage = `${winnerName} won ${matchdayName} with ${winner.points} points.`;
      await addActivity(supabase, {
        leagueId,
        type: 'weekly_winner',
        actorId: winner.user?.id ?? null,
        matchdayId,
        uniqueKey: `weekly-winner:${matchdayId}:${winner.user?.id}`,
        message: winnerMessage,
        metadata: { points: winner.points, matchdayName },
      });
      await addNotification(supabase, {
        userId: winner.user.id,
        type: 'weekly_winner',
        title: 'You won the matchday',
        message: `You topped ${matchdayName} with ${winner.points} points.`,
        leagueId,
        matchdayId,
        uniqueKey: `weekly-winner:${leagueId}:${matchdayId}:${winner.user?.id}`,
      });
    }
  }

  const afterRanks = await getLeagueRanks(supabase, leagueId);
  for (const [moverId, after] of afterRanks.entries()) {
    const before = beforeRanks.get(moverId);
    if (!before || after.rank >= before.rank) continue;
    for (const [targetId, targetBefore] of beforeRanks.entries()) {
      if (targetId === moverId) continue;
      const targetAfter = afterRanks.get(targetId);
      if (!targetAfter) continue;
      const wasAhead = targetBefore.rank < before.rank;
      const nowBehind = targetAfter.rank > after.rank;
      if (wasAhead && nowBehind) {
        await addNotification(supabase, {
          userId: Number(targetId),
          actorId: Number(moverId),
          leagueId,
          matchdayId,
          type: 'rank_passed',
          title: 'Someone passed you',
          message: `${after.user?.username || 'A league rival'} moved ahead of you in ${league?.name || 'the league'}.`,
          uniqueKey: `rank-pass:${leagueId}:${matchdayId}:${moverId}:${targetId}`,
        });
      }
    }
  }
}

async function seedDeadlineNotifications(supabase: ReturnType<typeof getSupabaseAdmin>, userId: number) {
  const { data: memberRows } = await supabase.from('league_members').select('league:leagues(id,name,division_id)').eq('user_id', userId);
  const leagues = (memberRows || []).map((row: any) => row.league).filter(Boolean);
  if (!leagues.length) return;
  const now = Date.now();
  const soon = now + 24 * 60 * 60 * 1000;

  await Promise.all(leagues.map(async (league: any) => {
    const { data: matchdays } = await supabase
      .from('matchdays')
      .select('*')
      .eq('division_id', league.division_id);
    const active = (matchdays || []).filter((matchday: any) => {
      const dto = matchdayDto(matchday);
      const deadline = new Date(matchday.end_date || matchday.start_date).getTime();
      return dto.predictionsOpen && deadline > now && deadline <= soon;
    });

    await Promise.all(active.map(async (matchday: any) => {
      const [{ data: fixtures }, { data: predictions }] = await Promise.all([
        supabase.from('fixtures').select('id').eq('matchday_id', matchday.id),
        supabase
          .from('predictions')
          .select('id, fixture:fixtures(matchday_id)')
          .eq('league_id', league.id)
          .eq('user_id', userId),
      ]);
      const fixtureCount = fixtures?.length || 0;
      const predictedCount = (predictions || []).filter((prediction: any) => prediction.fixture?.matchday_id === matchday.id).length;
      if (fixtureCount > 0 && predictedCount >= fixtureCount) return;
      const matchdayName = formatMatchdayName(matchday);
      await addNotification(supabase, {
        userId,
        leagueId: league.id,
        matchdayId: matchday.id,
        type: 'deadline',
        title: 'Prediction deadline approaching',
        message: `${matchdayName} locks soon in ${league.name}. You still have ${Math.max(0, fixtureCount - predictedCount)} prediction${fixtureCount - predictedCount === 1 ? '' : 's'} to make.`,
        uniqueKey: `deadline:${league.id}:${matchday.id}`,
      });
    }));
  }));
}

function roundRobinPairs(memberIds: number[], roundNumber: number) {
  const players: Array<number | null> = [...memberIds];
  if (players.length % 2) players.push(null);
  if (players.length < 2) return [];

  const fixed = players[0];
  const rotating = players.slice(1);
  const rotations = Math.max(0, roundNumber - 1) % rotating.length;
  for (let index = 0; index < rotations; index += 1) {
    rotating.unshift(rotating.pop() ?? null);
  }

  const arranged = [fixed, ...rotating];
  const pairs: Array<[number | null, number | null]> = [];
  for (let index = 0; index < arranged.length / 2; index += 1) {
    pairs.push([arranged[index], arranged[arranged.length - 1 - index]]);
  }
  return pairs.filter(([player1, player2]) => player1 || player2);
}

async function ensureH2hMatchups(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  matchdayId: number,
  forceRegenerate = false,
) {
  const [{ data: league }, { data: matchday }, { data: members }] = await Promise.all([
    supabase.from('leagues').select('h2h_leaderboard_enabled,h2h_knockout_enabled,created_at').eq('id', leagueId).single(),
    supabase.from('matchdays').select('id,number,start_date,end_date').eq('id', matchdayId).single(),
    supabase.from('league_members').select('user_id').eq('league_id', leagueId).order('user_id'),
  ]);
  if (!league || !matchday) return;

  const matchupCutoff = new Date(matchday.end_date || matchday.start_date).getTime();
  const leagueCreatedAt = new Date(league.created_at).getTime();
  if (matchupCutoff < leagueCreatedAt || !members || members.length < 2) {
    await supabase.from('h2h_matchups').delete().eq('league_id', leagueId).eq('matchday_id', matchdayId);
    return;
  }

  const memberIds = members.map((member: any) => member.user_id);
  const [{ data: existingMatchups }, { data: fixtures }] = await Promise.all([
    supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).eq('matchday_id', matchdayId),
    supabase.from('fixtures').select('status').eq('matchday_id', matchdayId),
  ]);
  const matchdayComplete = !!fixtures?.length && fixtures.every((fixture: any) => fixture.status === 'COMPLETED');
  const existingParticipantIds = new Set(
    (existingMatchups || []).flatMap((matchup: any) => [matchup.player1_id, matchup.player2_id]).filter(Boolean),
  );
  const expectedMatchupCount = Math.ceil(memberIds.length / 2);
  const membershipChanged = memberIds.some((id: number) => !existingParticipantIds.has(id))
    || [...existingParticipantIds].some((id) => !memberIds.includes(Number(id)))
    || (existingMatchups || []).some((matchup: any) => matchup.format === 'LEADERBOARD')
      && (existingMatchups || []).filter((matchup: any) => matchup.format === 'LEADERBOARD').length !== expectedMatchupCount
    || (existingMatchups || []).some((matchup: any) => matchup.format === 'KNOCKOUT')
      && (existingMatchups || []).filter((matchup: any) => matchup.format === 'KNOCKOUT').length !== expectedMatchupCount;
  const onePlayerBootstrap = !!existingMatchups?.length && existingParticipantIds.size < 2;

  if (onePlayerBootstrap && matchdayComplete) {
    await supabase.from('h2h_matchups').delete().eq('league_id', leagueId).eq('matchday_id', matchdayId);
    return;
  }
  if ((forceRegenerate || membershipChanged) && !matchdayComplete) {
    await supabase.from('h2h_matchups').delete().eq('league_id', leagueId).eq('matchday_id', matchdayId);
  }
  if (league.h2h_leaderboard_enabled) {
    const { count } = await supabase
      .from('h2h_matchups')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('matchday_id', matchdayId)
      .eq('format', 'LEADERBOARD');
    if (!count) {
      const rows = roundRobinPairs(memberIds, matchday.number).map(([player1Id, player2Id]) => ({
        league_id: leagueId,
        matchday_id: matchdayId,
        format: 'LEADERBOARD',
        player1_id: player1Id || player2Id,
        player2_id: player1Id ? player2Id : null,
      }));
      if (rows.length) await supabase.from('h2h_matchups').insert(rows);
    }
  }

  if (league.h2h_knockout_enabled) {
    const { count } = await supabase
      .from('h2h_matchups')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('format', 'KNOCKOUT');
    if (!count) {
      const round = memberIds.length > 16 ? 'ROUND_OF_32'
        : memberIds.length > 8 ? 'ROUND_OF_16'
          : memberIds.length > 4 ? 'QUARTER_FINAL'
            : memberIds.length > 2 ? 'SEMI_FINAL'
              : 'FINAL';
      const rows = roundRobinPairs(memberIds, 1).map(([player1Id, player2Id], index) => ({
        league_id: leagueId,
        matchday_id: matchdayId,
        format: 'KNOCKOUT',
        player1_id: player1Id || player2Id,
        player2_id: player1Id ? player2Id : null,
        knockout_round: round,
        bracket_position: index,
      }));
      if (rows.length) await supabase.from('h2h_matchups').insert(rows);
    }
  }
}

async function ensureAllLeagueH2hMatchups(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  leagueId: number,
  forceRegenerate = false,
) {
  const { data: league } = await supabase.from('leagues').select('division_id').eq('id', leagueId).single();
  if (!league) return;
  const { data: matchdays } = await supabase.from('matchdays').select('id').eq('division_id', league.division_id).order('number');
  for (const matchday of matchdays || []) {
    await ensureH2hMatchups(supabase, leagueId, matchday.id, forceRegenerate);
  }
}

async function recalcH2h(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, matchdayId?: number) {
  let query = supabase.from('h2h_matchups').select('*').eq('league_id', leagueId);
  if (matchdayId) query = query.eq('matchday_id', matchdayId);
  const { data: matchups } = await query;

  const matchdayIds = [...new Set((matchups || []).map((matchup: any) => matchup.matchday_id))];
  const { data: fixtureRows } = matchdayIds.length
    ? await supabase.from('fixtures').select('matchday_id,status').in('matchday_id', matchdayIds)
    : { data: [] as any[] };

  for (const matchup of matchups || []) {
    const p1 = await totalPredictionPoints(supabase, leagueId, matchup.player1_id, matchup.matchday_id);
    const p2 = matchup.player2_id ? await totalPredictionPoints(supabase, leagueId, matchup.player2_id, matchup.matchday_id) : 0;
    const matchdayFixtures = (fixtureRows || []).filter((fixture: any) => fixture.matchday_id === matchup.matchday_id);
    const resolved = matchdayFixtures.length > 0 && matchdayFixtures.every((fixture: any) => fixture.status === 'COMPLETED');
    const isBye = !matchup.player2_id;
    const p1H2h = resolved ? (isBye ? (matchup.format === 'KNOCKOUT' ? 3 : 0) : p1 > p2 ? 3 : p1 === p2 ? 1 : 0) : null;
    const p2H2h = resolved ? (isBye ? 0 : p2 > p1 ? 3 : p1 === p2 ? 1 : 0) : null;
    const winnerId = resolved ? (isBye ? (matchup.format === 'KNOCKOUT' ? matchup.player1_id : null) : p1 > p2 ? matchup.player1_id : p2 > p1 ? matchup.player2_id : null) : null;

    await supabase.from('h2h_matchups').update({
      player1_points: p1,
      player2_points: p2,
      player1_h2h_points: p1H2h,
      player2_h2h_points: p2H2h,
      winner_id: winnerId,
      resolved,
    }).eq('id', matchup.id);
  }

  const { data: allMatchups } = await supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).eq('format', 'LEADERBOARD').eq('resolved', true);
  const { data: members } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId);

  for (const member of members || []) {
    const userId = member.user_id;
    const played = (allMatchups || []).filter((m: any) => m.player2_id && (m.player1_id === userId || m.player2_id === userId));
    const h2hPoints = played.reduce((sum: number, m: any) => sum + (m.player1_id === userId ? m.player1_h2h_points || 0 : m.player2_h2h_points || 0), 0);
    const predictionPoints = played.reduce((sum: number, m: any) => sum + (m.player1_id === userId ? m.player1_points || 0 : m.player2_points || 0), 0);

    await supabase.from('h2h_standings').upsert({
      league_id: leagueId,
      user_id: userId,
      h2h_points: h2hPoints,
      wins: played.filter((m: any) => m.winner_id === userId).length,
      draws: played.filter((m: any) => m.winner_id === null && m.player2_id).length,
      losses: played.filter((m: any) => m.winner_id && m.winner_id !== userId).length,
      matchups_played: played.length,
      total_prediction_points: predictionPoints,
    }, { onConflict: 'league_id,user_id' });
  }
}

async function h2hDto(supabase: ReturnType<typeof getSupabaseAdmin>, matchup: any) {
  const ids = [matchup.player1_id, matchup.player2_id, matchup.winner_id].filter(Boolean);
  const [{ data: users }, { data: matchday }] = await Promise.all([
    ids.length ? supabase.from('users').select('*').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    supabase.from('matchdays').select('name,number').eq('id', matchup.matchday_id).single(),
  ]);
  const byId = new Map((users || []).map((u: any) => [u.id, publicUser(u)]));

  return {
    id: matchup.id,
    leagueId: matchup.league_id,
    matchdayId: matchup.matchday_id,
    matchdayName: matchday?.name || `Matchday ${matchday?.number || ''}`.trim(),
    matchdayNumber: matchday?.number || 0,
    format: matchup.format,
    player1: byId.get(matchup.player1_id) ?? null,
    player2: byId.get(matchup.player2_id) ?? null,
    player1Points: matchup.player1_points,
    player2Points: matchup.player2_points,
    player1H2hPoints: matchup.player1_h2h_points,
    player2H2hPoints: matchup.player2_h2h_points,
    winnerId: matchup.winner_id,
    resolved: matchup.resolved,
    knockoutRound: matchup.knockout_round,
    bracketPosition: matchup.bracket_position,
  };
}

type LeagueInsightUser = {
  id: number;
  username: string;
  profilePhoto?: string;
};

function formatMatchdayName(matchday: any) {
  if (!matchday) return 'Matchday';
  return matchday.name || `Round ${matchday.number}`;
}

function compactUser(user: any): LeagueInsightUser | null {
  const dto = publicUser(user);
  if (!dto) return null;
  return {
    id: dto.id,
    username: dto.username,
    profilePhoto: dto.profilePhoto,
  };
}

async function leagueInsights(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, currentUserId: number) {
  const [{ data: league }, { data: memberRows }, { data: standingsRows }, { data: predictionRows }, { data: storedActivity }] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).single(),
    supabase.from('league_members').select('user:users(*)').eq('league_id', leagueId),
    supabase
      .from('league_standings')
      .select('*, user:users(*)')
      .eq('league_id', leagueId)
      .order('total_points', { ascending: false })
      .order('correct_scores', { ascending: false })
      .order('correct_outcomes', { ascending: false }),
    supabase
      .from('predictions')
      .select('*, user:users(*), fixture:fixtures(id,status,home_score,away_score,matchday_id,matchday:matchdays(id,name,number,start_date,end_date,status))')
      .eq('league_id', leagueId),
    supabase
      .from('league_activity')
      .select('*, actor:users(*)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const members = (memberRows || []).map((row: any) => row.user).filter(Boolean);
  const memberMap = new Map(members.map((member: any) => [member.id, compactUser(member)]));
  const completedPredictions = (predictionRows || [])
    .filter((prediction: any) => prediction.fixture?.status === 'COMPLETED')
    .sort((a: any, b: any) => {
      const aRound = a.fixture?.matchday?.number ?? 0;
      const bRound = b.fixture?.matchday?.number ?? 0;
      if (aRound !== bRound) return aRound - bRound;
      return (a.fixture_id ?? 0) - (b.fixture_id ?? 0);
    });

  const completedMatchdayMap = new Map<number, any>();
  for (const prediction of completedPredictions) {
    if (prediction.fixture?.matchday_id && prediction.fixture?.matchday) {
      completedMatchdayMap.set(prediction.fixture.matchday_id, prediction.fixture.matchday);
    }
  }
  const completedMatchdays = [...completedMatchdayMap.values()].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const pointsByMatchdayUser = new Map<number, Map<number, number>>();
  for (const prediction of completedPredictions) {
    const matchdayId = prediction.fixture?.matchday_id;
    if (!matchdayId) continue;
    if (!pointsByMatchdayUser.has(matchdayId)) pointsByMatchdayUser.set(matchdayId, new Map());
    const userPoints = pointsByMatchdayUser.get(matchdayId)!;
    userPoints.set(prediction.user_id, (userPoints.get(prediction.user_id) || 0) + (prediction.points || 0));
  }

  const weeklyWinsByUser = new Map<number, number>();
  const weeklyWinners = completedMatchdays.map((matchday) => {
    const userPoints = pointsByMatchdayUser.get(matchday.id) || new Map<number, number>();
    const maxPoints = Math.max(0, ...[...userPoints.values()]);
    const winners = maxPoints > 0
      ? [...userPoints.entries()]
        .filter(([, points]) => points === maxPoints)
        .map(([userId]) => {
          weeklyWinsByUser.set(userId, (weeklyWinsByUser.get(userId) || 0) + 1);
          return memberMap.get(userId);
        })
        .filter(Boolean)
      : [];

    return {
      matchdayId: matchday.id,
      matchdayName: formatMatchdayName(matchday),
      matchdayNumber: matchday.number,
      points: maxPoints,
      winners,
    };
  }).filter((winner) => winner.winners.length > 0).reverse().slice(0, 5);

  const streaksByUser = new Map<number, { outcome: number; exact: number; bestOutcome: number; bestExact: number; jokerHits: number }>();
  for (const member of members) {
    const userPredictions = completedPredictions.filter((prediction: any) => prediction.user_id === member.id);
    let outcome = 0;
    let exact = 0;
    let bestOutcome = 0;
    let bestExact = 0;
    let currentOutcomeRun = 0;
    let currentExactRun = 0;

    for (const prediction of userPredictions) {
      const outcomeHit = isOutcomePrediction(prediction, prediction.fixture);
      const exactHit = isExactPrediction(prediction, prediction.fixture);
      currentOutcomeRun = outcomeHit ? currentOutcomeRun + 1 : 0;
      currentExactRun = exactHit ? currentExactRun + 1 : 0;
      bestOutcome = Math.max(bestOutcome, currentOutcomeRun);
      bestExact = Math.max(bestExact, currentExactRun);
    }

    for (let i = userPredictions.length - 1; i >= 0; i -= 1) {
      const prediction = userPredictions[i];
      if (!isOutcomePrediction(prediction, prediction.fixture)) break;
      outcome += 1;
    }
    for (let i = userPredictions.length - 1; i >= 0; i -= 1) {
      const prediction = userPredictions[i];
      if (!isExactPrediction(prediction, prediction.fixture)) break;
      exact += 1;
    }

    streaksByUser.set(member.id, {
      outcome,
      exact,
      bestOutcome,
      bestExact,
      jokerHits: userPredictions.filter((prediction: any) => prediction.is_joker && (prediction.points || 0) > 0).length,
    });
  }

  const recentMatchdays = completedMatchdays.slice(-5);
  const byUser: Record<string, any> = {};
  for (const member of members) {
    const standing = (standingsRows || []).find((row: any) => row.user_id === member.id);
    const streaks = streaksByUser.get(member.id) || { outcome: 0, exact: 0, bestOutcome: 0, bestExact: 0, jokerHits: 0 };
    const form = recentMatchdays.map((matchday) => {
      const points = pointsByMatchdayUser.get(matchday.id)?.get(member.id) || 0;
      const weeklyTop = weeklyWinners.some((winner) => winner.matchdayId === matchday.id && winner.winners.some((winnerUser: any) => winnerUser?.id === member.id));
      return {
        matchdayId: matchday.id,
        label: points > 0 ? String(points) : '-',
        points,
        tone: weeklyTop ? 'winner' : points >= 8 ? 'hot' : points > 0 ? 'steady' : 'cold',
      };
    });

    const badges = [];
    if (standingsRows?.[0]?.user_id === member.id && (standing?.total_points || 0) > 0) badges.push({ key: 'leader', label: 'Leader' });
    if ((weeklyWinsByUser.get(member.id) || 0) > 0) badges.push({ key: 'weekly-winner', label: 'Weekly Winner' });
    if ((standing?.correct_scores || 0) >= 3) badges.push({ key: 'exact-eye', label: 'Exact Eye' });
    if (streaks.outcome >= 3) badges.push({ key: 'hot-streak', label: 'Hot Streak' });
    if (streaks.jokerHits > 0) badges.push({ key: 'joker-hit', label: 'Joker Hit' });

    byUser[String(member.id)] = {
      form,
      badges,
      streaks,
      weeklyWins: weeklyWinsByUser.get(member.id) || 0,
    };
  }

  const sortedStandings = (standingsRows || []).map((standing: any, index: number) => ({ ...standing, rank: index + 1 }));
  const currentStanding = sortedStandings.find((standing: any) => standing.user_id === currentUserId);
  const userRank = currentStanding?.rank ?? null;
  const ahead = currentStanding && userRank && userRank > 1 ? sortedStandings[userRank - 2] : null;
  const leader = sortedStandings[0] || null;
  const pressureMessage = currentStanding
    ? ahead
      ? `You are ${(ahead.total_points || 0) - (currentStanding.total_points || 0)} points behind ${ahead.user?.username}.`
      : leader && leader.user_id === currentUserId
        ? `You are leading by ${Math.max(0, (leader.total_points || 0) - (sortedStandings[1]?.total_points || 0))} points.`
        : 'You are on the board. One sharp round can change everything.'
    : 'Join the league table by making your first prediction.';

  const predictionActivity = new Map<string, any>();
  for (const prediction of predictionRows || []) {
    const matchdayId = prediction.fixture?.matchday_id;
    if (!matchdayId) continue;
    const activityKey = `${prediction.user_id}:${matchdayId}`;
    const existing = predictionActivity.get(activityKey);
    const updatedAt = prediction.updated_at || prediction.created_at;
    if (!existing) {
      predictionActivity.set(activityKey, {
        type: 'prediction',
        at: updatedAt,
        user: compactUser(prediction.user),
        count: 1,
        matchdayName: formatMatchdayName(prediction.fixture?.matchday),
      });
    } else {
      existing.count += 1;
      if (updatedAt && (!existing.at || new Date(updatedAt).getTime() > new Date(existing.at).getTime())) existing.at = updatedAt;
    }
  }

  const resultActivity = completedMatchdays.map((matchday) => ({
    type: 'results',
    at: matchday.end_date || matchday.start_date,
    matchdayName: formatMatchdayName(matchday),
  }));

  const winnerActivity = weeklyWinners.flatMap((winner) =>
    winner.winners.map((winnerUser: any) => ({
      type: 'weekly_winner',
      at: winner.matchdayNumber ? completedMatchdays.find((matchday) => matchday.id === winner.matchdayId)?.end_date : null,
      user: winnerUser,
      matchdayName: winner.matchdayName,
      points: winner.points,
      message: `${winnerUser?.username || 'Someone'} won ${winner.matchdayName} with ${winner.points} points.`,
    }))
  );

  const calculatedActivity = [...predictionActivity.values(), ...resultActivity, ...winnerActivity]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .map((item) => ({
      ...item,
      message: item.message || (item.type === 'prediction'
        ? `${item.user?.username || 'Someone'} submitted ${item.count} prediction${item.count === 1 ? '' : 's'} for ${item.matchdayName}.`
        : `${item.matchdayName} results posted.`),
    }));

  return {
    league: league ? { id: league.id, name: league.name, code: league.code } : null,
    pressure: {
      message: pressureMessage,
      rank: userRank,
      pointsBehind: ahead && currentStanding ? (ahead.total_points || 0) - (currentStanding.total_points || 0) : 0,
      targetUser: compactUser(ahead?.user),
    },
    weeklyWinners,
    byUser,
    activity: [...(storedActivity || []).map(activityDto), ...calculatedActivity]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .filter((item, index, all) => all.findIndex((other) => other.message === item.message && other.matchdayId === item.matchdayId) === index)
      .slice(0, 12),
    shareCard: {
      title: league?.name || 'League standings',
      topThree: sortedStandings.slice(0, 3).map((standing: any) => ({
        rank: standing.rank,
        user: compactUser(standing.user),
        points: standing.total_points,
      })),
      currentUser: currentStanding ? {
        rank: currentStanding.rank,
        user: compactUser(currentStanding.user),
        points: currentStanding.total_points,
      } : null,
    },
  };
}

function buildStandingRows(members: any[], predictions: any[], insights: any, filter: string) {
  const rows = members.map((member: any) => {
    const mine = predictions.filter((prediction: any) => prediction.user_id === member.id && prediction.fixture?.status === 'COMPLETED');
    const matchdays = new Set(mine.map((prediction: any) => prediction.fixture?.matchday_id).filter(Boolean));
    return {
      id: Number(`${member.id}`),
      user: publicUser(member),
      totalPoints: mine.reduce((sum: number, prediction: any) => sum + (prediction.points || 0), 0),
      matchdaysPlayed: matchdays.size,
      correctScores: mine.filter((prediction: any) => isExactPrediction(prediction, prediction.fixture)).length,
      correctOutcomes: mine.filter((prediction: any) => isOutcomePrediction(prediction, prediction.fixture) && !isExactPrediction(prediction, prediction.fixture)).length,
      lastMatchdayPoints: 0,
      form: insights.byUser[String(member.id)]?.form || [],
      badges: insights.byUser[String(member.id)]?.badges || [],
      streaks: insights.byUser[String(member.id)]?.streaks || { outcome: 0, exact: 0, bestOutcome: 0, bestExact: 0 },
      weeklyWins: insights.byUser[String(member.id)]?.weeklyWins || 0,
    };
  });

  return rows.sort((a, b) => {
    const aName = a.user?.username || '';
    const bName = b.user?.username || '';
    if (filter === 'exact') {
      return b.correctScores - a.correctScores || b.totalPoints - a.totalPoints || aName.localeCompare(bName);
    }
    return b.totalPoints - a.totalPoints || b.correctScores - a.correctScores || b.correctOutcomes - a.correctOutcomes || aName.localeCompare(bName);
  });
}

async function filteredStandings(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, currentUserId: number, filter: string) {
  const insights = await leagueInsights(supabase, leagueId, currentUserId);
  const { data: memberRows } = await supabase.from('league_members').select('user:users(*)').eq('league_id', leagueId);
  const members = (memberRows || []).map((row: any) => row.user).filter(Boolean);
  const { data: predictionRows } = await supabase
    .from('predictions')
    .select('*, fixture:fixtures(status,matchday_id,home_score,away_score,matchday:matchdays(id,number,status))')
    .eq('league_id', leagueId);

  const completedMatchdays = [...new Map((predictionRows || [])
    .filter((prediction: any) => prediction.fixture?.status === 'COMPLETED' && prediction.fixture?.matchday_id)
    .map((prediction: any) => [prediction.fixture.matchday_id, prediction.fixture.matchday])).values()]
    .sort((a: any, b: any) => (a?.number || 0) - (b?.number || 0));

  let scopedPredictions = predictionRows || [];
  if (filter === 'matchday') {
    const latest = completedMatchdays[completedMatchdays.length - 1];
    scopedPredictions = (predictionRows || []).filter((prediction: any) => prediction.fixture?.matchday_id === latest?.id);
  }
  if (filter === 'last5') {
    const ids = new Set(completedMatchdays.slice(-5).map((matchday: any) => matchday?.id));
    scopedPredictions = (predictionRows || []).filter((prediction: any) => ids.has(prediction.fixture?.matchday_id));
  }

  return buildStandingRows(members, scopedPredictions, insights, filter);
}

async function matchdaySummary(supabase: ReturnType<typeof getSupabaseAdmin>, leagueId: number, matchdayId: number) {
  const { data: matchday } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
  const revealed = matchday ? !matchdayDto(matchday).predictionsOpen : false;

  if (!revealed) {
    return {
      revealed: false,
      bestPredictor: null,
      biggestMover: null,
      mostPredictedScore: null,
      mostSurprisingResult: null,
    };
  }

  const [{ data: predictions }, { data: fixtures }, { data: standings }] = await Promise.all([
    supabase
      .from('predictions')
      .select('*, user:users(*), fixture:fixtures(status,matchday_id,home_score,away_score,home_team:teams!fixtures_home_team_id_fkey(name),away_team:teams!fixtures_away_team_id_fkey(name))')
      .eq('league_id', leagueId),
    supabase
      .from('fixtures')
      .select('*, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('matchday_id', matchdayId),
    supabase.from('league_standings').select('*, user:users(*)').eq('league_id', leagueId).order('total_points', { ascending: false }),
  ]);

  const matchdayPredictions = (predictions || []).filter((prediction: any) => prediction.fixture?.matchday_id === matchdayId);
  const pointsByUser = new Map<number, { user: any; points: number }>();
  for (const prediction of matchdayPredictions) {
    const existing = pointsByUser.get(prediction.user_id) || { user: prediction.user, points: 0 };
    existing.points += prediction.points || 0;
    pointsByUser.set(prediction.user_id, existing);
  }
  const bestPredictor = [...pointsByUser.values()].sort((a, b) => b.points - a.points)[0] || null;

  const scoreCounts = new Map<string, number>();
  for (const prediction of matchdayPredictions) {
    const key = `${prediction.predicted_home_score}-${prediction.predicted_away_score}`;
    scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
  }
  const mostPredictedScore = [...scoreCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const completedFixtures = (fixtures || []).filter((fixture: any) => fixture.status === 'COMPLETED');
  const mostSurprisingResult = completedFixtures.map((fixture: any) => {
    const fixturePredictions = matchdayPredictions.filter((prediction: any) => prediction.fixture_id === fixture.id);
    const hitRate = fixturePredictions.length
      ? fixturePredictions.filter((prediction: any) => isOutcomePrediction(prediction, fixture)).length / fixturePredictions.length
      : 1;
    return { fixture, hitRate };
  }).sort((a: any, b: any) => a.hitRate - b.hitRate)[0] || null;

  const sortedStandings = standings || [];
  const biggestMover = sortedStandings
    .map((standing: any, index: number) => ({
      user: publicUser(standing.user),
      rank: index + 1,
      points: standing.total_points,
      lastMatchdayPoints: standing.last_matchday_id === matchdayId ? standing.last_matchday_points : 0,
    }))
    .sort((a: any, b: any) => b.lastMatchdayPoints - a.lastMatchdayPoints)[0] || null;

  return {
    revealed,
    bestPredictor: bestPredictor ? { user: publicUser(bestPredictor.user), points: bestPredictor.points } : null,
    biggestMover,
    mostPredictedScore: mostPredictedScore ? { score: mostPredictedScore[0], count: mostPredictedScore[1] } : null,
    mostSurprisingResult: mostSurprisingResult ? {
      fixtureId: mostSurprisingResult.fixture.id,
      label: `${mostSurprisingResult.fixture.home_team?.name || 'Home'} ${mostSurprisingResult.fixture.home_score}-${mostSurprisingResult.fixture.away_score} ${mostSurprisingResult.fixture.away_team?.name || 'Away'}`,
      hitRate: mostSurprisingResult.hitRate,
    } : null,
  };
}

async function handleRequest(request: NextRequest, params: { path?: string[] }) {
  const supabase = getSupabaseAdmin();
  const path = params.path || [];
  const user = readBearerUser(request);
  const contentType = request.headers.get('content-type') || '';
  const body = request.method === 'GET' || contentType.includes('multipart/form-data')
    ? null
    : await request.json().catch(() => ({}));

  if (path[0] === 'auth' && path[1] === 'register' && request.method === 'POST') {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const { data, error } = await supabase.from('users').insert({
      username: body.username,
      email: body.email,
      password_hash: passwordHash,
      role: 'USER',
    }).select('*').single();

    if (isMissingSchema(error)) return fail(schemaSetupMessage, 500);
    if (error) return fail(error.message, 409);
    return json(authResponse(data));
  }

  if (path[0] === 'auth' && path[1] === 'login' && request.method === 'POST') {
    const { data, error } = await supabase.from('users').select('*').eq('username', body.username).single();
    if (isMissingSchema(error)) return fail(schemaSetupMessage, 500);
    if (!data) return fail('Invalid username or password', 401);

    if (data.account_locked && data.lockout_end_time && new Date(data.lockout_end_time).getTime() > Date.now()) {
      return fail('Account is temporarily locked. Try again later.', 423);
    }

    const valid = await bcrypt.compare(body.password, data.password_hash);
    if (!valid) {
      await supabase.from('users').update({
        failed_login_attempts: (data.failed_login_attempts || 0) + 1,
        account_locked: (data.failed_login_attempts || 0) + 1 >= 5,
        lockout_end_time: (data.failed_login_attempts || 0) + 1 >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
        first_failed_login_time: data.first_failed_login_time || new Date().toISOString(),
      }).eq('id', data.id);
      return fail('Invalid username or password', 401);
    }

    await supabase.from('users').update({ failed_login_attempts: 0, account_locked: false, lockout_end_time: null, first_failed_login_time: null }).eq('id', data.id);
    return json(authResponse(data));
  }

  if (path[0] === 'settings' && path[1] === 'login' && request.method === 'GET') {
    return json(await loginSettings(supabase));
  }

  if (path[0] === 'settings' && path[1] === 'app' && request.method === 'GET') {
    return json(await appSettings(supabase));
  }

  if (!user) return fail('Unauthorized', 401);

  if (path[0] === 'auth' && path[1] === 'change-password' && request.method === 'PUT') {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (!data || !(await bcrypt.compare(body.currentPassword, data.password_hash))) return fail('Current password is incorrect', 400);
    await supabase.from('users').update({ password_hash: await bcrypt.hash(body.newPassword, 10) }).eq('id', user.id);
    return json({ message: 'Password changed successfully' });
  }

  if (path[0] === 'users' && path[1] === 'me') {
    if (request.method === 'GET') {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      return json(publicUser(data));
    }
    if (path[2] === 'profile' && request.method === 'PUT') {
      const { data, error } = await supabase.from('users').update({ profile_photo: body.profilePhoto ?? null }).eq('id', user.id).select('*').single();
      if (error) return fail(error.message);
      return json(publicUser(data));
    }
    if (path[2] === 'profile-photo' && request.method === 'DELETE') {
      const { data } = await supabase.from('users').update({ profile_photo: null }).eq('id', user.id).select('*').single();
      return json(publicUser(data));
    }
  }

  if (path[0] === 'notifications') {
    if (request.method === 'GET') {
      await seedDeadlineNotifications(supabase, user.id);
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:users(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error && isMissingSchema(error)) return json({ unreadCount: 0, notifications: [] });
      if (error) return fail(error.message);
      const notifications = (data || []).map(notificationDto);
      return json({
        unreadCount: notifications.filter((notification: any) => !notification.readAt).length,
        notifications,
      });
    }

    if (path[1] === 'read-all' && request.method === 'PUT') {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error && isMissingSchema(error)) return json({ message: 'Notifications are not enabled yet' });
      if (error) return fail(error.message);
      return json({ message: 'Notifications marked as read' });
    }

    if (path[2] === 'read' && request.method === 'PUT') {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', asInt(path[1]))
        .eq('user_id', user.id)
        .select('*, actor:users(*)')
        .single();
      if (error && isMissingSchema(error)) return fail('Notifications are not enabled yet', 404);
      if (error) return fail(error.message);
      return json(notificationDto(data));
    }
  }

  if (path[0] === 'guest-claims') {
    if (path.length === 1 && request.method === 'POST') {
      const guestUserId = Number(body?.guestUserId || 0);
      const leagueId = Number(body?.leagueId || 0);
      if (!guestUserId || !leagueId) return fail('Guest and league are required');
      if (!await canManageLeague(supabase, leagueId, user)) return fail('Only the league creator or admin can create claim links', 403);

      const [{ data: guest }, { data: member }] = await Promise.all([
        supabase.from('users').select('*').eq('id', guestUserId).eq('is_guest', true).single(),
        supabase.from('league_members').select('user_id').eq('league_id', leagueId).eq('user_id', guestUserId).maybeSingle(),
      ]);
      if (!guest) return fail('Guest user not found', 404);
      if (!member) return fail('Guest is not in this league', 404);

      const { data, error } = await supabase.from('guest_claims').insert({
        guest_user_id: guestUserId,
        created_by: user.id,
        claim_token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('*').single();
      if (isMissingSchema(error)) return fail('Apply supabase/migrations/010_guest_claims.sql to enable guest claiming.', 500);
      if (error) return fail(error.message);

      return json({
        token: data.claim_token,
        claimUrl: `${request.nextUrl.origin}/claim-guest?token=${data.claim_token}`,
        expiresAt: data.expires_at,
        guest: publicUser(guest),
      }, 201);
    }

    if (path.length === 2 && request.method === 'GET') {
      const token = path[1];
      const { data, error } = await supabase
        .from('guest_claims')
        .select('*, guest:users!guest_claims_guest_user_id_fkey(id,username,email,is_guest)')
        .eq('claim_token', token)
        .maybeSingle();
      if (isMissingSchema(error)) return fail('Apply supabase/migrations/010_guest_claims.sql to enable guest claiming.', 500);
      if (error) return fail(error.message);
      if (!data) return fail('Claim link not found', 404);
      return json({
        guest: publicUser(data.guest),
        expiresAt: data.expires_at,
        claimedAt: data.claimed_at,
        expired: new Date(data.expires_at).getTime() < Date.now(),
      });
    }

    if (path.length === 3 && path[2] === 'claim' && request.method === 'POST') {
      const token = path[1];
      const { data: claim, error } = await supabase.from('guest_claims').select('*').eq('claim_token', token).maybeSingle();
      if (isMissingSchema(error)) return fail('Apply supabase/migrations/010_guest_claims.sql to enable guest claiming.', 500);
      if (error) return fail(error.message);
      if (!claim) return fail('Claim link not found', 404);
      if (claim.claimed_at) return fail('This guest has already been claimed', 400);
      if (new Date(claim.expires_at).getTime() < Date.now()) return fail('This claim link has expired', 400);

      const result = await mergeGuestIntoUser(supabase, claim.guest_user_id, user.id);
      await supabase.from('guest_claims').update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      }).eq('id', claim.id);

      return json({
        message: `${result.guest.username} is now linked to your account.`,
        transferredLeagues: result.leagueIds.length,
      });
    }
  }

  if (path[0] === 'sports' && request.method === 'GET') {
    const { data } = await supabase.from('sports').select('*').order('name');
    return json(data || []);
  }

  if (path[0] === 'divisions') {
    if (path.length === 1 && request.method === 'GET') {
      const { data } = await supabase.from('divisions').select('*').order('name');
      return json((data || []).map(divisionDto));
    }
    if (path[2] === 'teams' && request.method === 'GET') {
      const { data } = await supabase.from('teams').select('*, division:divisions(id,name,code,logo_url,logo_path)').eq('division_id', asInt(path[1])).order('name');
      return json((data || []).map(teamDto));
    }
    if (path[2] === 'matchdays' && request.method === 'GET') {
      const { data } = await supabase.from('matchdays').select('*, division:divisions(id,name,code,logo_url,logo_path)').eq('division_id', asInt(path[1])).order('number');
      return json((data || []).map(matchdayDto));
    }
  }

  if (path[0] === 'matchdays') {
    if (path.length === 2 && request.method === 'GET') {
      const { data } = await supabase.from('matchdays').select('*, division:divisions(id,name,code,logo_url,logo_path)').eq('id', asInt(path[1])).single();
      return data ? json(matchdayDto(data)) : fail('Matchday not found', 404);
    }
    if (path[2] === 'fixtures' && request.method === 'GET') {
      const { data } = await supabase
        .from('fixtures')
        .select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)')
        .eq('matchday_id', asInt(path[1]))
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('id');
      return json((data || []).map(fixtureDto));
    }
  }

  if (path[0] === 'fixtures' && request.method === 'GET') {
    const { data } = await supabase
      .from('fixtures')
      .select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)')
      .eq('id', asInt(path[1]))
      .single();
    return data ? json(fixtureDto(data)) : fail('Fixture not found', 404);
  }

  if (path[0] === 'leagues') {
    if (path.length === 1 && request.method === 'GET') {
      const { data: memberRows } = await supabase.from('league_members').select('league_id').eq('user_id', user.id);
      const ids = (memberRows || []).map((m: any) => m.league_id);
      if (!ids.length) return json([]);
      const { data } = await supabase.from('leagues').select('*').in('id', ids).order('name');
      return json(await Promise.all((data || []).map((l: any) => leagueDto(supabase, l))));
    }

    if (path.length === 1 && request.method === 'POST') {
      const leagueCode = (body.code || code()).slice(0, 6).toUpperCase();
      const { data, error } = await supabase.from('leagues').insert({
        name: body.name,
        code: leagueCode,
        division_id: body.divisionId,
        created_by: user.id,
        overall_standings_enabled: body.overallStandingsEnabled ?? true,
        h2h_leaderboard_enabled: body.h2hLeaderboardEnabled ?? false,
        h2h_knockout_enabled: body.h2hKnockoutEnabled ?? false,
      }).select('*').single();

      if (error) return fail(error.message, 409);
      await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id });
      await supabase.from('league_standings').insert({ league_id: data.id, user_id: user.id });
      await supabase.from('h2h_standings').insert({ league_id: data.id, user_id: user.id });
      await addActivity(supabase, {
        leagueId: data.id,
        type: 'league_created',
        actorId: user.id,
        uniqueKey: `league-created:${data.id}`,
        message: `${user.username} created ${data.name}.`,
      });
      return json(await leagueDto(supabase, data), 201);
    }

    if (path[1] === 'join' && request.method === 'POST') {
      const { data: league } = await supabase.from('leagues').select('*').eq('code', String(body.code || '').toUpperCase()).single();
      if (!league) return fail('League not found', 404);
      const { data: existingMember } = await supabase.from('league_members').select('user_id').eq('league_id', league.id).eq('user_id', user.id).maybeSingle();
      await addLeagueMember(supabase, league.id, user.id);
      if (!existingMember) {
        await addActivity(supabase, {
          leagueId: league.id,
          type: 'member_joined',
          actorId: user.id,
          uniqueKey: `member-joined:${user.id}`,
          message: `${user.username} joined ${league.name}.`,
        });
        await notifyLeagueMembers(supabase, league.id, {
          type: 'invite_accepted',
          title: 'Invite accepted',
          message: `${user.username} accepted the invite to ${league.name}.`,
          actorId: user.id,
          uniqueKey: `invite-accepted:${league.id}:${user.id}`,
          excludeUserIds: [user.id],
        });
      }
      return json(await leagueDto(supabase, league));
    }

    const leagueId = asInt(path[1]);

    if (path[2] === 'manage' && path[3] === 'users' && request.method === 'GET') {
      if (!await canManageLeague(supabase, leagueId, user)) return fail('Only the league creator can manage members', 403);
      const search = request.nextUrl.searchParams.get('search')?.trim();
      let query = supabase.from('users').select('*').eq('is_guest', false).order('username').limit(100);
      if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return fail(error.message);
      return json((data || []).map(publicUser));
    }

    if (path[2] === 'members' && path.length === 3 && request.method === 'POST') {
      if (!await canManageLeague(supabase, leagueId, user)) return fail('Only the league creator can add members', 403);
      let memberUserId = Number(body?.userId || 0);
      let memberUser = null;

      if (memberUserId) {
        const { data, error } = await supabase.from('users').select('*').eq('id', memberUserId).eq('is_guest', false).single();
        if (error || !data) return fail('Registered user not found', 404);
        memberUser = data;
      } else {
        if (!body?.displayName?.trim()) return fail('Guest display name is required');
        memberUser = await createGuestUser(supabase, body.displayName.trim(), body.email);
        memberUserId = memberUser.id;
      }

      await addLeagueMember(supabase, leagueId, memberUserId);
      const { data: league } = await supabase.from('leagues').select('name').eq('id', leagueId).single();
      await addActivity(supabase, {
        leagueId,
        type: 'member_joined',
        actorId: memberUserId,
        uniqueKey: `creator-member-added:${leagueId}:${memberUserId}`,
        message: `${memberUser?.username || body?.displayName || 'A member'} joined ${league?.name || 'the league'}.`,
      });
      return json(publicUser(memberUser), 201);
    }

    if (path[2] === 'matchdays' && path[4] === 'members' && path[6] === 'predictions') {
      if (!await canManageLeague(supabase, leagueId, user)) return fail('Only the league creator can manage member predictions', 403);
      const matchdayId = asInt(path[3]);
      const memberUserId = asInt(path[5]);

      const { data: member } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId).eq('user_id', memberUserId).maybeSingle();
      if (!member) return fail('Member is not in this league', 404);

      if (request.method === 'GET') {
        const { data, error } = await supabase
          .from('predictions')
          .select('*, fixture:fixtures(matchday_id)')
          .eq('league_id', leagueId)
          .eq('user_id', memberUserId);
        if (error) return fail(error.message);
        return json((data || []).filter((prediction: any) => prediction.fixture?.matchday_id === matchdayId).map(predictionDto));
      }

      if (request.method === 'POST') {
        const { data: matchday } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
        if (!matchday) return fail('Matchday not found', 404);
        if (!matchdayDto(matchday).predictionsOpen) return fail('Predictions are closed for this matchday and cannot be added or edited', 400);

        const rows = Array.isArray(body?.predictions) ? body.predictions : [];
        const saved = [];
        const rules = await scoringRules(supabase);
        for (const row of rows) {
          const { data: fixture } = await supabase.from('fixtures').select('*').eq('id', row.fixtureId).eq('matchday_id', matchdayId).single();
          if (!fixture) return fail(`Fixture ${row.fixtureId} not found`, 404);
          const prediction = {
            predicted_home_score: Number(row.predictedHomeScore),
            predicted_away_score: Number(row.predictedAwayScore),
            is_joker: row.isJoker === true,
          };
          if (prediction.is_joker) await clearJokerForMatchday(supabase, leagueId, memberUserId, matchdayId, row.fixtureId);
          const { data, error } = await supabase.from('predictions').upsert({
            fixture_id: row.fixtureId,
            user_id: memberUserId,
            league_id: leagueId,
            ...prediction,
            points: scorePrediction(prediction, fixture, rules),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'fixture_id,user_id,league_id' }).select('*').single();
          if (error) return fail(error.message);
          saved.push(predictionDto(data));
        }
        await recalcLeagueStandings(supabase, leagueId, matchdayId);
        await recalcH2h(supabase, leagueId, matchdayId);
        await addPredictionActivity(supabase, leagueId, memberUserId, matchdayId);
        return json(saved);
      }
    }

    if (path.length === 2 && request.method === 'GET') {
      const { data } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
      return data ? json(await leagueDto(supabase, data)) : fail('League not found', 404);
    }

    if (path[2] === 'standings' && request.method === 'GET') {
      const filter = request.nextUrl.searchParams.get('filter') || 'overall';
      if (['matchday', 'last5', 'exact'].includes(filter)) {
        return json(await filteredStandings(supabase, leagueId, user.id, filter));
      }

      const { data } = await supabase
        .from('league_standings')
        .select('*, user:users(*)')
        .eq('league_id', leagueId)
        .order('total_points', { ascending: false })
        .order('correct_scores', { ascending: false })
        .order('correct_outcomes', { ascending: false });

      const insights = await leagueInsights(supabase, leagueId, user.id);
      return json((data || []).map((s: any) => ({
        id: s.id,
        user: publicUser(s.user),
        totalPoints: s.total_points,
        matchdaysPlayed: s.matchdays_played,
        correctScores: s.correct_scores,
        correctOutcomes: s.correct_outcomes,
        lastMatchdayPoints: s.last_matchday_points,
        lastMatchdayId: s.last_matchday_id,
        form: insights.byUser[String(s.user_id)]?.form || [],
        badges: insights.byUser[String(s.user_id)]?.badges || [],
        streaks: insights.byUser[String(s.user_id)]?.streaks || { outcome: 0, exact: 0, bestOutcome: 0, bestExact: 0 },
        weeklyWins: insights.byUser[String(s.user_id)]?.weeklyWins || 0,
      })));
    }

    if (path[2] === 'insights' && request.method === 'GET') {
      return json(await leagueInsights(supabase, leagueId, user.id));
    }

    if (path[2] === 'matchdays' && path[4] === 'summary' && request.method === 'GET') {
      return json(await matchdaySummary(supabase, leagueId, asInt(path[3])));
    }

    if (path[2] === 'h2h') {
      if (path[3] === 'leaderboard' && path[4] === 'standings' && request.method === 'GET') {
        await ensureAllLeagueH2hMatchups(supabase, leagueId);
        await recalcH2h(supabase, leagueId);
        const { data } = await supabase.from('h2h_standings').select('*, user:users(*)').eq('league_id', leagueId).order('h2h_points', { ascending: false }).order('total_prediction_points', { ascending: false });
        return json((data || []).map((s: any) => ({
          id: s.id,
          user: publicUser(s.user),
          h2hPoints: s.h2h_points,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          matchupsPlayed: s.matchups_played,
          totalPredictionPoints: s.total_prediction_points,
        })));
      }

      if (path[3] === 'leaderboard' && path[4] === 'matchups' && request.method === 'GET') {
        const matchdayId = request.nextUrl.searchParams.get('matchdayId');
        if (matchdayId) await ensureH2hMatchups(supabase, leagueId, Number(matchdayId));
        else await ensureAllLeagueH2hMatchups(supabase, leagueId);
        await recalcH2h(supabase, leagueId, matchdayId ? Number(matchdayId) : undefined);
        let query = supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).eq('format', 'LEADERBOARD');
        if (matchdayId) query = query.eq('matchday_id', Number(matchdayId));
        const { data } = await query.order('matchday_id').order('id');
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }

      if (path[3] === 'leaderboard' && path[4] === 'generate' && request.method === 'POST') {
        if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) return fail('Forbidden', 403);
        const matchdayId = Number(request.nextUrl.searchParams.get('matchdayId'));
        const { data: members } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId).order('user_id');
        const ids = (members || []).map((m: any) => m.user_id);
        const rows = [];
        for (let i = 0; i < ids.length; i += 2) {
          rows.push({ league_id: leagueId, matchday_id: matchdayId, format: 'LEADERBOARD', player1_id: ids[i], player2_id: ids[i + 1] ?? null });
        }
        const { data } = await supabase.from('h2h_matchups').insert(rows).select('*');
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }

      if (path[3] === 'knockout' && path[4] === 'bracket' && request.method === 'GET') {
        await ensureAllLeagueH2hMatchups(supabase, leagueId);
        await recalcH2h(supabase, leagueId);
        const { data } = await supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).eq('format', 'KNOCKOUT').order('bracket_position');
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }

      if (path[3] === 'knockout' && path[4] === 'generate' && request.method === 'POST') {
        if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) return fail('Forbidden', 403);
        const { data: firstMatchday } = await supabase.from('matchdays').select('id').order('number').limit(1).single();
        const { data: members } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId).order('user_id');
        const ids = (members || []).map((m: any) => m.user_id);
        const rows = [];
        for (let i = 0; i < ids.length; i += 2) {
          rows.push({ league_id: leagueId, matchday_id: firstMatchday?.id, format: 'KNOCKOUT', player1_id: ids[i], player2_id: ids[i + 1] ?? null, knockout_round: ids.length > 16 ? 'ROUND_OF_32' : ids.length > 8 ? 'ROUND_OF_16' : ids.length > 4 ? 'QUARTER_FINAL' : ids.length > 2 ? 'SEMI_FINAL' : 'FINAL', bracket_position: i / 2 });
        }
        const { data } = await supabase.from('h2h_matchups').insert(rows).select('*');
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }

      if (path[3] === 'matchday' && path[5] === 'my-matchups' && request.method === 'GET') {
        const matchdayId = asInt(path[4]);
        await ensureH2hMatchups(supabase, leagueId, matchdayId);
        const matchdayIds = [matchdayId];
        if (request.nextUrl.searchParams.get('includePrevious') === 'true') {
          const { data: currentMatchday } = await supabase.from('matchdays').select('number,division_id').eq('id', matchdayId).maybeSingle();
          if (currentMatchday) {
            const { data: previousMatchday } = await supabase
              .from('matchdays')
              .select('id')
              .eq('division_id', currentMatchday.division_id)
              .lt('number', currentMatchday.number)
              .order('number', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (previousMatchday?.id) {
              matchdayIds.push(previousMatchday.id);
              await ensureH2hMatchups(supabase, leagueId, previousMatchday.id);
            }
          }
        }
        for (const id of matchdayIds) await recalcH2h(supabase, leagueId, id);
        const { data } = await supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).in('matchday_id', matchdayIds).or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }

      if (path[3] === 'matchday' && path[5] === 'matchups' && request.method === 'GET') {
        const matchdayId = asInt(path[4]);
        await ensureH2hMatchups(supabase, leagueId, matchdayId);
        await recalcH2h(supabase, leagueId, matchdayId);
        const { data } = await supabase.from('h2h_matchups').select('*').eq('league_id', leagueId).eq('matchday_id', matchdayId);
        return json(await Promise.all((data || []).map((m: any) => h2hDto(supabase, m))));
      }
    }
  }

  if (path[0] === 'predictions') {
    if (request.method === 'POST') {
      const { data: fixture } = await supabase.from('fixtures').select('*, matchday:matchdays(*)').eq('id', body.fixtureId).single();
      if (!fixture) return fail('Fixture not found', 404);
      if (!matchdayDto(fixture.matchday).predictionsOpen) return fail('Predictions are closed for this fixture', 400);

      const isJoker = body.isJoker === true;
      if (isJoker) {
        await clearJokerForMatchday(supabase, body.leagueId, user.id, fixture.matchday_id, body.fixtureId);
      }

      const pred = {
        predicted_home_score: body.predictedHomeScore,
        predicted_away_score: body.predictedAwayScore,
        is_joker: isJoker,
      };
      const rules = await scoringRules(supabase);
      const points = scorePrediction(pred, fixture, rules);
      const { data, error } = await supabase.from('predictions').upsert({
        fixture_id: body.fixtureId,
        user_id: user.id,
        league_id: body.leagueId,
        predicted_home_score: body.predictedHomeScore,
        predicted_away_score: body.predictedAwayScore,
        is_joker: isJoker,
        points,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'fixture_id,user_id,league_id' }).select('*').single();

      if (error) return fail(error.message);
      await recalcLeagueStandings(supabase, body.leagueId, fixture.matchday_id);
      await addPredictionActivity(supabase, body.leagueId, user.id, fixture.matchday_id);
      return json(predictionDto(data));
    }

    if (path[1] === 'matchday' && path[3] === 'league' && request.method === 'GET') {
      const matchdayId = asInt(path[2]);
      const leagueId = asInt(path[4]);
      const wantsAll = path[5] === 'all';
      const { data: matchday } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
      const revealOpen = matchday ? !matchdayDto(matchday).predictionsOpen : false;
      let query = supabase
        .from('predictions')
        .select('*, user:users(*), fixture:fixtures(matchday_id)')
        .eq('league_id', leagueId);
      if (!wantsAll || (!revealOpen && !requireRole(user, ['ADMIN', 'SUPER_ADMIN']))) query = query.eq('user_id', user.id);
      const { data } = await query;
      return json({
        revealed: wantsAll ? revealOpen || requireRole(user, ['ADMIN', 'SUPER_ADMIN']) : true,
        predictions: (data || []).filter((p: any) => p.fixture?.matchday_id === matchdayId).map(predictionDto),
      });
    }

    if (path[1] === 'league' && path[3] === 'status' && request.method === 'GET') {
      const leagueId = asInt(path[2]);
      const ids = (request.nextUrl.searchParams.get('matchdayIds') || '').split(',').map(Number).filter(Boolean);
      const { data } = await supabase.from('predictions').select('fixture:fixtures(matchday_id)').eq('league_id', leagueId).eq('user_id', user.id);
      const predicted = new Set((data || []).map((p: any) => p.fixture?.matchday_id).filter(Boolean));
      return json(Object.fromEntries(ids.map((id) => [id, predicted.has(id)])));
    }
  }

  if (path[0] === 'admin') {
    if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) return fail('Forbidden', 403);

    if (path[1] === 'leagues' && path.length === 2 && request.method === 'GET') {
      const { data, error } = await supabase.from('leagues').select('*').order('name');
      if (error) return fail(error.message);
      return json(await Promise.all((data || []).map((league: any) => leagueDto(supabase, league))));
    }

    if (path[1] === 'users' && request.method === 'GET') {
      const search = request.nextUrl.searchParams.get('search')?.trim();
      let query = supabase.from('users').select('*').order('username').limit(100);
      if (search) {
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) return fail(error.message);
      return json((data || []).map(publicUser));
    }

    if (path[1] === 'leagues' && path[3] === 'members' && request.method === 'POST') {
      const leagueId = asInt(path[2]);
      let memberUserId = Number(body?.userId || 0);
      let memberUser = null;

      if (memberUserId) {
        const { data, error } = await supabase.from('users').select('*').eq('id', memberUserId).single();
        if (error || !data) return fail('Registered user not found', 404);
        memberUser = data;
      } else {
        if (!body?.displayName?.trim()) return fail('Guest display name is required');
        memberUser = await createGuestUser(supabase, body.displayName.trim(), body.email);
        memberUserId = memberUser.id;
      }

      await addLeagueMember(supabase, leagueId, memberUserId);
      const { data: league } = await supabase.from('leagues').select('name').eq('id', leagueId).single();
      await addActivity(supabase, {
        leagueId,
        type: 'member_joined',
        actorId: memberUserId,
        uniqueKey: `member-added:${memberUserId}`,
        message: `${memberUser?.username || body?.displayName || 'A member'} joined ${league?.name || 'the league'}.`,
      });
      await notifyLeagueMembers(supabase, leagueId, {
        type: 'member_joined',
        title: 'New league member',
        message: `${memberUser?.username || body?.displayName || 'A member'} was added to ${league?.name || 'the league'}.`,
        actorId: user.id,
        uniqueKey: `member-added:${leagueId}:${memberUserId}`,
        excludeUserIds: [memberUserId],
      });
      return json(publicUser(memberUser), 201);
    }

    if (path[1] === 'leagues' && path[3] === 'matchdays' && path[5] === 'members' && path[7] === 'predictions' && request.method === 'GET') {
      const leagueId = asInt(path[2]);
      const matchdayId = asInt(path[4]);
      const memberUserId = asInt(path[6]);
      const { data, error } = await supabase
        .from('predictions')
        .select('*, fixture:fixtures(matchday_id)')
        .eq('league_id', leagueId)
        .eq('user_id', memberUserId);

      if (error) return fail(error.message);
      return json((data || []).filter((p: any) => p.fixture?.matchday_id === matchdayId).map(predictionDto));
    }

    if (path[1] === 'leagues' && path[3] === 'matchdays' && path[5] === 'members' && path[7] === 'predictions' && request.method === 'POST') {
      const leagueId = asInt(path[2]);
      const matchdayId = asInt(path[4]);
      const memberUserId = asInt(path[6]);
      const rows = Array.isArray(body?.predictions) ? body.predictions : [];

      const { data: matchday } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
      if (!matchday) return fail('Matchday not found', 404);
      if (!matchdayDto(matchday).predictionsOpen) {
        return fail('Predictions are closed for this matchday and cannot be added or edited', 400);
      }

      const { data: member } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId)
        .eq('user_id', memberUserId)
        .single();
      if (!member) return fail('Member is not in this league', 404);

      const saved = [];
      for (const row of rows) {
        const { data: fixture, error: fixtureError } = await supabase
          .from('fixtures')
          .select('*, matchday:matchdays(*)')
          .eq('id', row.fixtureId)
          .eq('matchday_id', matchdayId)
          .single();
        if (fixtureError || !fixture) return fail(`Fixture ${row.fixtureId} not found`, 404);

        const pred = {
          predicted_home_score: Number(row.predictedHomeScore),
          predicted_away_score: Number(row.predictedAwayScore),
          is_joker: row.isJoker === true,
        };
        if (pred.is_joker) {
          await clearJokerForMatchday(supabase, leagueId, memberUserId, matchdayId, row.fixtureId);
        }
        const { data, error } = await supabase.from('predictions').upsert({
          fixture_id: row.fixtureId,
          user_id: memberUserId,
          league_id: leagueId,
          predicted_home_score: pred.predicted_home_score,
          predicted_away_score: pred.predicted_away_score,
          is_joker: pred.is_joker,
          points: scorePrediction(pred, fixture, await scoringRules(supabase)),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'fixture_id,user_id,league_id' }).select('*').single();

        if (error) return fail(error.message);
        saved.push(predictionDto(data));
      }

      await recalcLeagueStandings(supabase, leagueId, matchdayId);
      await recalcH2h(supabase, leagueId, matchdayId);
      await addPredictionActivity(supabase, leagueId, memberUserId, matchdayId);
      return json(saved);
    }

    if (path[1] === 'assets' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const assetType = String(formData.get('assetType') || '');
      const entityId = String(formData.get('entityId') || 'new').replace(/[^a-zA-Z0-9_-]/g, '');

      if (!(file instanceof File)) return fail('Image file is required');
      if (!file.type.startsWith('image/')) return fail('Only image uploads are allowed');
      if (!['division-logo', 'team-badge', 'login-hero', 'app-logo', 'theme-image'].includes(assetType)) return fail('Invalid asset type');

      const prefix = assetType === 'division-logo' ? 'division-logos'
        : assetType === 'team-badge' ? 'team-badges'
          : assetType === 'app-logo' ? 'app-logos'
            : assetType === 'theme-image' ? 'theme-images'
              : 'login-heroes';
      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'png';
      const safeName = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'asset';
      const uploadPath = `${prefix}/${entityId}/${crypto.randomUUID()}-${safeName}.${extension}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(assetBucket)
        .upload(uploadPath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) return fail(error.message);
      return json({ path: uploadPath, publicUrl: assetUrl(uploadPath) });
    }

    if (path[1] === 'divisions' && request.method === 'POST') {
      const { data, error } = await supabase.from('divisions').insert({ name: body.name, code: body.code, sport_id: body.sportId, logo_url: body.logoUrl || null, logo_path: body.logoPath || null }).select('*').single();
      return error ? fail(error.message) : json(divisionDto(data), 201);
    }
    if (path[1] === 'divisions' && request.method === 'PUT') {
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.sportId !== undefined) updates.sport_id = body.sportId;
      if (body.logoUrl !== undefined) updates.logo_url = body.logoUrl || null;
      if (body.logoPath !== undefined) updates.logo_path = body.logoPath || null;
      const { data, error } = await supabase.from('divisions').update(updates).eq('id', asInt(path[2])).select('*').single();
      return error ? fail(error.message) : json(divisionDto(data));
    }
    if (path[1] === 'divisions' && request.method === 'DELETE') {
      await supabase.from('divisions').delete().eq('id', asInt(path[2]));
      return json({ message: 'Division deleted' });
    }
    if (path[1] === 'teams' && request.method === 'POST') {
      const { data, error } = await supabase.from('teams').insert({ name: body.name, code: body.code, division_id: body.divisionId, badge_url: body.badgeUrl || null, badge_path: body.badgePath || null }).select('*').single();
      return error ? fail(error.message) : json(teamDto(data), 201);
    }
    if (path[1] === 'teams' && request.method === 'PUT') {
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.divisionId !== undefined) updates.division_id = body.divisionId;
      if (body.badgeUrl !== undefined) updates.badge_url = body.badgeUrl || null;
      if (body.badgePath !== undefined) updates.badge_path = body.badgePath || null;
      const { data, error } = await supabase.from('teams').update(updates).eq('id', asInt(path[2])).select('*').single();
      return error ? fail(error.message) : json(teamDto(data));
    }
    if (path[1] === 'teams' && request.method === 'DELETE') {
      await supabase.from('teams').delete().eq('id', asInt(path[2]));
      return json({ message: 'Team deleted' });
    }
    if (path[1] === 'matchdays' && request.method === 'POST') {
      const { data, error } = await supabase.from('matchdays').insert({ name: body.name, number: body.number, division_id: body.divisionId, start_date: body.startDate, end_date: body.endDate || null }).select('*, division:divisions(id,name,code,logo_url,logo_path)').single();
      return error ? fail(error.message) : json(matchdayDto(data), 201);
    }
    if (path[1] === 'matchdays' && path[3] === 'status' && request.method === 'PUT') {
      const status = request.nextUrl.searchParams.get('status');
      const { data } = await supabase.from('matchdays').update({ status }).eq('id', asInt(path[2])).select('*, division:divisions(id,name,code,logo_url,logo_path)').single();
      return json(matchdayDto(data));
    }
    if (path[1] === 'fixtures' && request.method === 'POST') {
      const { data: existing } = await supabase.from('fixtures').select('id').eq('matchday_id', body.matchdayId);
      const { data, error } = await supabase.from('fixtures').insert({
        matchday_id: body.matchdayId,
        home_team_id: body.homeTeamId,
        away_team_id: body.awayTeamId,
        kickoff_at: body.kickoffAt || null,
        display_order: body.displayOrder ?? ((existing?.length || 0) + 1),
      }).select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)').single();
      if (error) return fail(error.message);
      await addFixtureCreatedNotifications(supabase, body.matchdayId, user.id, 1);
      return json(fixtureDto(data), 201);
    }

    if (path[1] === 'fixtures' && path[2] === 'bulk' && request.method === 'POST') {
      const rows = Array.isArray(body.fixtures) ? body.fixtures : [];
      if (!rows.length) return fail('At least one fixture is required');
      const { data: existing } = await supabase.from('fixtures').select('id').eq('matchday_id', body.matchdayId);
      const startOrder = existing?.length || 0;
      const insertRows = rows.map((fixture: any, index: number) => ({
        matchday_id: body.matchdayId,
        home_team_id: fixture.homeTeamId,
        away_team_id: fixture.awayTeamId,
        kickoff_at: fixture.kickoffAt || null,
        display_order: fixture.displayOrder ?? startOrder + index + 1,
      }));
      const { data, error } = await supabase.from('fixtures').insert(insertRows).select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)');
      if (error) return fail(error.message);
      await addFixtureCreatedNotifications(supabase, body.matchdayId, user.id, insertRows.length);
      return json((data || []).map(fixtureDto), 201);
    }

    if (path[1] === 'fixtures' && path[3] === 'metadata' && request.method === 'PUT') {
      const fixtureId = asInt(path[2]);
      const updates: Record<string, unknown> = {};
      if (body.kickoffAt !== undefined) updates.kickoff_at = body.kickoffAt || null;
      if (body.displayOrder !== undefined) updates.display_order = body.displayOrder;
      const { data, error } = await supabase.from('fixtures').update(updates).eq('id', fixtureId).select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)').single();
      return error ? fail(error.message) : json(fixtureDto(data));
    }

    if (path[1] === 'fixtures' && path[2] === 'reorder' && request.method === 'PUT') {
      const rows = Array.isArray(body.orders) ? body.orders : [];
      for (const row of rows) {
        await supabase.from('fixtures').update({ display_order: row.displayOrder }).eq('id', row.fixtureId);
      }
      return json({ message: 'Fixtures reordered' });
    }
    if (path[1] === 'fixtures' && path[3] === 'result' && request.method === 'PUT') {
      const fixtureId = asInt(path[2]);
      const { data: fixture } = await supabase.from('fixtures').update({ home_score: body.homeScore, away_score: body.awayScore, status: 'COMPLETED' }).eq('id', fixtureId).select('*, home_team:teams!fixtures_home_team_id_fkey(id,name,code,badge_url,badge_path), away_team:teams!fixtures_away_team_id_fkey(id,name,code,badge_url,badge_path), matchday:matchdays(*)').single();
      const { data: preds } = await supabase.from('predictions').select('*').eq('fixture_id', fixtureId);
      const leagueIds = new Set<number>();
      const beforeRanksByLeague = new Map<number, Map<any, any>>();
      const rules = await scoringRules(supabase);
      for (const pred of preds || []) {
        leagueIds.add(pred.league_id);
        await supabase.from('predictions').update({ points: scorePrediction(pred, fixture, rules), updated_at: new Date().toISOString() }).eq('id', pred.id);
      }
      for (const leagueId of leagueIds) {
        beforeRanksByLeague.set(leagueId, await getLeagueRanks(supabase, leagueId));
      }
      for (const leagueId of leagueIds) {
        await recalcLeagueStandings(supabase, leagueId, fixture.matchday_id);
        await recalcH2h(supabase, leagueId, fixture.matchday_id);
        await addMatchdayResultPulse(supabase, leagueId, fixture.matchday_id, user.id, beforeRanksByLeague.get(leagueId) || new Map());
      }
      return json(fixtureDto(fixture));
    }
  }

  if (path[0] === 'super-admin') {
    if (!requireRole(user, ['SUPER_ADMIN'])) return fail('Forbidden', 403);
    if (path[1] === 'leagues' && path.length === 2 && request.method === 'GET') {
      const { data, error } = await supabase.from('leagues').select('*').order('name');
      if (error) return fail(error.message);
      return json(await Promise.all((data || []).map((league: any) => leagueDto(supabase, league))));
    }
    if (path[1] === 'leagues' && path[3] === 'members' && path.length === 5 && request.method === 'DELETE') {
      try {
        await removeLeagueMember(supabase, asInt(path[2]), asInt(path[4]));
        return json({ message: 'Member removed from league' });
      } catch (error: any) {
        return fail(error.message || 'Could not remove member', error.message === 'League not found' ? 404 : 400);
      }
    }
    if (path[1] === 'settings' && path[2] === 'app' && request.method === 'PUT') {
      const rows = [
        { key: 'app_name', value: String(body.appName || 'MatchPulse').trim() || 'MatchPulse' },
        { key: 'app_logo_path', value: body.appLogoPath || null },
        { key: 'theme_image_path', value: body.themeImagePath || null },
        { key: 'default_sport_id', value: body.defaultSportId ? String(body.defaultSportId) : null },
        { key: 'default_division_id', value: body.defaultDivisionId ? String(body.defaultDivisionId) : null },
        { key: 'scoring_rules', value: JSON.stringify(parseScoringRules(JSON.stringify(body.scoringRules || defaultScoringRules))) },
      ].map((row) => ({ ...row, updated_at: new Date().toISOString() }));

      const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
      if (isMissingSchema(error)) return fail('Apply supabase/migrations/007_app_setup_and_fixture_metadata.sql to enable app setup.', 500);
      if (error) return fail(error.message);
      return json(await appSettings(supabase));
    }

    if (path[1] === 'settings' && path[2] === 'login-hero' && request.method === 'PUT') {
      const loginHeroPath = typeof body.loginHeroPath === 'string' && body.loginHeroPath.trim()
        ? body.loginHeroPath.trim()
        : null;
      const { error } = await supabase.from('app_settings').upsert({
        key: 'login_hero_path',
        value: loginHeroPath,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      if (isMissingSchema(error)) return fail('Apply supabase/migrations/005_login_settings.sql to enable login settings.', 500);
      if (error) return fail(error.message);
      return json(await loginSettings(supabase));
    }
    if (path[1] === 'users' && path.length === 2 && request.method === 'GET') {
      const { data } = await supabase.from('users').select('*').order('username');
      return json((data || []).map(publicUser));
    }
    if (path[1] === 'users' && path.length === 3 && request.method === 'GET') {
      const { data } = await supabase.from('users').select('*').eq('id', asInt(path[2])).single();
      return data ? json(publicUser(data)) : fail('User not found', 404);
    }
    if (path[1] === 'users' && path[3] === 'role' && request.method === 'PUT') {
      const { data } = await supabase.from('users').update({ role: body.role }).eq('id', asInt(path[2])).select('*').single();
      return json(publicUser(data));
    }
    if (path[1] === 'users' && path[3] === 'reset-password' && request.method === 'PUT') {
      await supabase.from('users').update({ password_hash: await bcrypt.hash(body.newPassword, 10) }).eq('id', asInt(path[2]));
      return json({ message: 'Password reset successfully' });
    }
    if (path[1] === 'users' && path[3] === 'unlock' && request.method === 'PUT') {
      await supabase.from('users').update({ account_locked: false, failed_login_attempts: 0, lockout_end_time: null, first_failed_login_time: null }).eq('id', asInt(path[2]));
      return json({ message: 'User unlocked successfully' });
    }
  }

  return fail('Not found', 404);
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleRequest(request, context.params).catch((error) => fail(error.message || 'Server error', 500));
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleRequest(request, context.params).catch((error) => fail(error.message || 'Server error', 500));
}

export async function PUT(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleRequest(request, context.params).catch((error) => fail(error.message || 'Server error', 500));
}

export async function DELETE(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleRequest(request, context.params).catch((error) => fail(error.message || 'Server error', 500));
}
