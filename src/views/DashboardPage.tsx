import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FaCalendarAlt,
  FaChevronDown,
  FaFutbol,
  FaMedal,
  FaRegHeart,
  FaShieldAlt,
  FaStar,
  FaTable,
  FaTrophy,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ActivityFeed from '../components/ActivityFeed';
import { fixtureApi } from '../api/fixtureApi';
import { leagueApi } from '../api/leagueApi';
import { matchdayApi } from '../api/matchdayApi';
import { predictionApi } from '../api/predictionApi';
import { standingsApi } from '../api/standingsApi';
import { League } from '../types/league.types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isFixturePredictionOpen } from '../lib/predictionDeadlines';

const formatFixtureDate = (value?: string) => {
  if (!value) return 'Date TBC';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const teamInitials = (name?: string) =>
  (name || 'TBD')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const LeagueIcon = ({ league, active }: { league: League; active?: boolean }) => (
  <div className={cn(
    'grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border',
    active ? 'border-white/70 bg-white/65' : 'border-white/60 bg-white/35'
  )}>
    {league.division?.logoUrl ? (
      <img src={league.division.logoUrl} alt={league.division.name} className="h-full w-full object-cover" />
    ) : (
      <FaFutbol className={active ? 'text-teal-700' : 'text-teal-500'} />
    )}
  </div>
);

const TeamBadge = ({ badgeUrl, name }: { badgeUrl?: string; name?: string }) => (
  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/70 bg-white/55 text-sm font-black text-teal-700 shadow-sm">
    {badgeUrl ? (
      <img src={badgeUrl} alt={name} className="h-full w-full object-cover" />
    ) : (
      teamInitials(name)
    )}
  </div>
);

const DashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['dashboard-leagues'],
    queryFn: leagueApi.getUserLeagues,
  });

  useEffect(() => {
    if (!selectedLeagueId && leagues.length) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) || leagues[0],
    [leagues, selectedLeagueId]
  );

  const { data: matchdays = [] } = useQuery({
    queryKey: ['dashboard-matchdays', selectedLeague?.division?.id],
    queryFn: () => matchdayApi.getMatchdaysByDivision(selectedLeague!.division.id),
    enabled: !!selectedLeague?.division?.id,
  });

  const activeMatchday = useMemo(() => {
    const ordered = [...matchdays].sort((a, b) => a.number - b.number);
    return (
      ordered.find((matchday) => matchday.computedStatus === 'IN_PROGRESS') ||
      ordered.find((matchday) => matchday.computedStatus === 'UPCOMING') ||
      ordered[ordered.length - 1]
    );
  }, [matchdays]);

  const { data: fixtures = [] } = useQuery({
    queryKey: ['dashboard-fixtures', activeMatchday?.id],
    queryFn: () => fixtureApi.getFixturesByMatchday(activeMatchday!.id),
    enabled: !!activeMatchday?.id,
  });

  const nextMatchday = useMemo(() => {
    if (!activeMatchday) return undefined;
    return [...matchdays]
      .filter((matchday) => matchday.number > activeMatchday.number && matchday.computedStatus !== 'COMPLETED')
      .sort((a, b) => a.number - b.number)[0];
  }, [activeMatchday, matchdays]);

  const orderedFixtures = useMemo(() => [...fixtures].sort((a, b) => {
    const aTime = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || (a.displayOrder || a.id) - (b.displayOrder || b.id);
  }), [fixtures]);

  const pendingFixtures = orderedFixtures.filter((fixture) => fixture.status !== 'COMPLETED');

  const { data: nextMatchdayFixtures = [] } = useQuery({
    queryKey: ['dashboard-next-fixtures', nextMatchday?.id],
    queryFn: () => fixtureApi.getFixturesByMatchday(nextMatchday!.id),
    enabled: !!nextMatchday?.id && pendingFixtures.length === 0,
  });

  const orderedNextMatchdayFixtures = useMemo(() => [...nextMatchdayFixtures]
    .filter((fixture) => fixture.status !== 'COMPLETED')
    .sort((a, b) => {
      const aTime = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime || (a.displayOrder || a.id) - (b.displayOrder || b.id);
    }), [nextMatchdayFixtures]);

  const { data: userPredictions = [] } = useQuery({
    queryKey: ['dashboard-predictions', selectedLeague?.id, activeMatchday?.id],
    queryFn: () => predictionApi.getUserPredictionsForMatchday(activeMatchday!.id, selectedLeague!.id),
    enabled: !!selectedLeague?.id && !!activeMatchday?.id,
  });

  const { data: standings = [] } = useQuery({
    queryKey: ['dashboard-standings', selectedLeague?.id],
    queryFn: () => standingsApi.getLeagueStandings(selectedLeague!.id),
    enabled: !!selectedLeague?.id,
  });

  const { data: insights } = useQuery({
    queryKey: ['dashboard-insights', selectedLeague?.id],
    queryFn: () => standingsApi.getLeagueInsights(selectedLeague!.id),
    enabled: !!selectedLeague?.id,
  });

  const primaryFixture = pendingFixtures[0] || orderedNextMatchdayFixtures[0];
  const primaryFixtureMatchday = pendingFixtures.length ? activeMatchday : nextMatchday;
  const predictionsByFixture = new Map(userPredictions.map((prediction) => [prediction.fixtureId, prediction]));
  const activeOpenFixtures = orderedFixtures.filter((fixture) => isFixturePredictionOpen(fixture, activeMatchday, currentTime));
  const visiblePredictionFixtures = activeOpenFixtures.length
    ? orderedFixtures
    : orderedFixtures.filter((fixture) => predictionsByFixture.has(fixture.id));
  const topFixtures = visiblePredictionFixtures.slice(0, 3);
  const topStandings = standings.slice(0, 6);
  const leader = standings[0];
  const userRank = standings.findIndex((standing) => standing.user.username === user?.username) + 1;
  const userStanding = userRank > 0 ? standings[userRank - 1] : undefined;
  const pointsBehindLeader = leader && userStanding ? Math.max(0, leader.totalPoints - userStanding.totalPoints) : 0;
  const completedFixtures = fixtures.filter((fixture) => fixture.status === 'COMPLETED').length;
  const openPredictionCount = activeOpenFixtures.length;
  const showOnboarding = !leaguesLoading && leagues.length === 0;
  const isWelcome = searchParams.get('welcome') === '1';

  return (
    <div className="matchpulse-dashboard-bg min-h-screen text-slate-900">
      <Navbar />

      <main className="mx-auto w-full max-w-[1420px] px-4 pb-24 pt-6 lg:pl-[17.5rem] lg:pr-8 lg:pt-36 2xl:max-w-[1500px]">
        <header className="mb-5">
          <p className="text-sm font-semibold text-teal-700">Welcome back, {user?.username}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-normal text-slate-900 sm:text-5xl">Dashboard</h1>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(14rem,1fr)_minmax(22rem,1.45fr)_minmax(14rem,0.85fr)]">
          <article className="dashboard-panel min-h-[14.5rem] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="font-semibold">My Leagues</h2>
                <p className="text-xs text-slate-500">{leagues.length} active</p>
              </div>
              <FaUsers className="text-teal-600" />
            </div>

            {leaguesLoading ? (
              <div className="px-5 py-6 text-sm text-slate-500">Loading leagues...</div>
            ) : leagues.length ? (
              <div className="space-y-2 px-4 pb-4">
                {leagues.slice(0, 4).map((league) => {
                  const active = league.id === selectedLeague?.id;
                  return (
                    <button
                      key={league.id}
                      type="button"
                      onClick={() => setSelectedLeagueId(league.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition',
                        active ? 'bg-teal-600 text-white shadow-[0_12px_26px_rgb(13_148_157_/_0.24)]' : 'bg-white/35 text-teal-800 hover:bg-white/55'
                      )}
                    >
                      <LeagueIcon league={league} active={active} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{league.name}</p>
                        <p className={cn('truncate text-xs', active ? 'text-white/70' : 'text-teal-700/55')}>{league.division?.name}</p>
                      </div>
                      <FaChevronDown className={active ? 'text-white/75' : 'text-teal-500/55'} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 pb-5 pt-2">
                <p className="text-sm text-slate-500">You have not joined a league yet.</p>
                <Link to="/leagues">
                  <Button className="mt-4 w-full rounded-full">Create or Join</Button>
                </Link>
              </div>
            )}
          </article>

          <article className="dashboard-panel min-h-[14.5rem] p-6">
            <p className="text-sm font-semibold text-teal-700">
              {isWelcome ? 'Welcome to MatchPulse' : 'Ready to start?'}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-900">
              {showOnboarding
                ? 'Create or join your first league to unlock predictions.'
                : selectedLeague
                  ? `Jump into ${selectedLeague.name}.`
                  : 'Choose a league to begin.'}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Predict fixtures, use one Joker per matchday, and watch the table shift as results come in.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/leagues">
                <Button>{showOnboarding ? 'Create a League' : 'Manage Leagues'}</Button>
              </Link>
              {selectedLeague && activeMatchday ? (
                <Link to={`/leagues/${selectedLeague.id}/matchdays/${activeMatchday.id}`}>
                  <Button variant="outline">Prediction Center</Button>
                </Link>
              ) : (
                <Link to="/leagues">
                  <Button variant="outline">Join with Code</Button>
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="secondary" className="gap-2">
                    <FaShieldAlt />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          </article>

          <aside className="dashboard-panel row-span-2 min-h-[27rem] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-5">
              <div>
                <h2 className="text-xl font-semibold">Predictions</h2>
                <p className="text-xs text-slate-500">
                  {completedFixtures}/{fixtures.length} fixtures completed
                </p>
              </div>
              <FaMedal className="text-teal-600" />
            </div>

            <div className="space-y-4 p-4 pt-0">
              {topFixtures.length ? topFixtures.map((fixture) => {
                const prediction = predictionsByFixture.get(fixture.id);
                return (
                <article key={fixture.id} className="rounded-[1.35rem] border border-white/55 bg-white/38 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-3xl bg-white/45 p-2">
                      <TeamBadge badgeUrl={fixture.homeTeam.badgeUrl} name={fixture.homeTeam.name} />
                      <span className="px-3 text-xs font-black text-teal-700">VS</span>
                      <TeamBadge badgeUrl={fixture.awayTeam.badgeUrl} name={fixture.awayTeam.name} />
                    </div>
                    <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-white/45 text-teal-600">
                      <FaRegHeart />
                    </button>
                  </div>

                  <h3 className="mt-4 text-base font-semibold leading-tight">
                    {fixture.homeTeam.name}
                    <br />
                    {fixture.awayTeam.name}
                  </h3>

                  <div className="mt-4 border-t border-white/55 pt-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{activeMatchday?.number ? `GW ${activeMatchday.number}` : 'TBC'}</span>
                      <span>{formatFixtureDate(fixture.kickoffAt || activeMatchday?.startDate)}</span>
                    </div>

                    {prediction && (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/55 px-3 py-2 text-sm">
                        <span className="font-semibold text-slate-600">Your prediction</span>
                        <span className="font-black text-teal-700">
                          {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
                        </span>
                      </div>
                    )}
                    {fixture.status === 'COMPLETED' && (
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-teal-600 px-3 py-2 text-sm text-white">
                        <span className="font-semibold">Final result</span>
                        <span className="font-black">{fixture.homeScore} - {fixture.awayScore}</span>
                      </div>
                    )}

                    {selectedLeague && activeMatchday && isFixturePredictionOpen(fixture, activeMatchday, currentTime) && fixture.status !== 'COMPLETED' && (
                      <Link to={`/leagues/${selectedLeague.id}/matchdays/${activeMatchday.id}`}>
                        <Button className="mt-4 w-full rounded-full">
                          {prediction ? 'Edit Prediction' : 'Make Prediction'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </article>
              );
              }) : (
                <div className="rounded-[1.35rem] border border-white/55 bg-white/35 p-8 text-center text-sm text-slate-500">
                  {activeMatchday && !openPredictionCount
                    ? 'No fixtures are currently open. You did not submit any visible picks for this matchday.'
                    : 'No fixtures available for the selected matchday.'}
                </div>
              )}
            </div>
          </aside>

          <article className="dashboard-hero min-h-[14rem] overflow-hidden rounded-[1.65rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-teal-700">Next game</p>
                <p className="mt-2 text-xs text-slate-500">
                  {primaryFixtureMatchday ? `${primaryFixtureMatchday.name} - ${formatFixtureDate(primaryFixture?.kickoffAt || primaryFixtureMatchday.startDate)}` : 'No gameweek scheduled'}
                </p>
              </div>
              <FaCalendarAlt className="text-teal-600" />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-center">
              {primaryFixture ? (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <TeamBadge badgeUrl={primaryFixture.homeTeam.badgeUrl} name={primaryFixture.homeTeam.name} />
                    <span className="text-sm font-semibold">{primaryFixture.homeTeam.name}</span>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-300 text-sm font-bold text-white">VS</span>
                  <div className="flex flex-col items-center gap-2">
                    <TeamBadge badgeUrl={primaryFixture.awayTeam.badgeUrl} name={primaryFixture.awayTeam.name} />
                    <span className="text-sm font-semibold">{primaryFixture.awayTeam.name}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-600">No pending fixtures are currently scheduled.</p>
              )}
            </div>
          </article>

          <article className="dashboard-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
              <div className="flex items-center gap-3">
                <FaTable className="text-teal-600" />
                <div>
                  <h2 className="text-xl font-semibold">League Table</h2>
                  <p className="text-xs text-slate-500">{selectedLeague?.name || 'Select a league'}</p>
                </div>
              </div>
              {selectedLeague && (
                <Link to={`/leagues/${selectedLeague.id}/standings`}>
                  <Button variant="outline" size="sm" className="rounded-full">
                    Full Table
                  </Button>
                </Link>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="dashboard-table w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Pos</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3 text-center">MP</th>
                    <th className="px-5 py-3 text-center">Last</th>
                    <th className="px-5 py-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {topStandings.length ? topStandings.map((standing, index) => (
                    <tr key={standing.id} className={standing.user.username === user?.username ? 'bg-teal-500/8' : undefined}>
                      <td className="px-5 py-4 text-slate-500">{String(index + 1).padStart(2, '0')}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-white/55 text-xs font-bold text-teal-700">
                            {standing.user.profilePhoto ? (
                              <img src={standing.user.profilePhoto} alt={standing.user.username} className="h-full w-full object-cover" />
                            ) : (
                              standing.user.username.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="font-medium">{standing.user.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-slate-600">{standing.matchdaysPlayed}</td>
                      <td className="px-5 py-4 text-center text-slate-600">{standing.lastMatchdayPoints}</td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{standing.totalPoints}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        Standings will appear once league members start scoring points.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-3 lg:col-start-2">
            <div className="dashboard-panel p-4">
              <p className="text-2xl font-bold text-teal-700">5 pts</p>
              <p className="mt-1 text-sm font-semibold">Exact score</p>
            </div>
            <div className="dashboard-panel p-4">
              <p className="text-2xl font-bold text-amber-500">3 pts</p>
              <p className="mt-1 text-sm font-semibold">Outcome</p>
            </div>
            <div className="dashboard-panel p-4">
              <p className="flex items-center gap-2 text-2xl font-bold text-violet-500">
                <FaStar /> 2x
              </p>
              <p className="mt-1 text-sm font-semibold">Joker</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          {leader ? (
            <article className="dashboard-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-teal-700">Competition pulse</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {userStanding
                      ? pointsBehindLeader === 0
                        ? 'You are leading this league.'
                        : `You are ${pointsBehindLeader} points behind ${leader.user.username}.`
                      : `${leader.user.username} leads the league.`}
                  </h2>
                </div>
                <div className="grid gap-2 text-right text-sm">
                  <span className="font-semibold text-slate-500">Leader: <strong className="text-slate-900">{leader.user.username}</strong></span>
                  <span className="font-semibold text-slate-500">Your rank: <strong className="text-slate-900">{userRank || 'Unranked'}</strong></span>
                  <span className="font-semibold text-slate-500">Open predictions: <strong className="text-slate-900">{openPredictionCount}</strong></span>
                </div>
              </div>
            </article>
          ) : (
            <article className="dashboard-panel p-5">
              <p className="text-sm font-semibold text-teal-700">Competition pulse</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">No league movement yet.</h2>
              <p className="mt-2 text-sm text-slate-500">Once predictions are scored, rank changes and pressure messages will appear here.</p>
            </article>
          )}

          <ActivityFeed activity={insights?.activity || []} compact />
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
