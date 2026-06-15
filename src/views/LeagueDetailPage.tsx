import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Users, Hash, Clock, CheckCircle, ChevronRight, Calendar, AlertCircle, Edit, Eye, XCircle, Swords, Target, ChevronDown, ChevronUp, History, Copy, Share2, Settings } from 'lucide-react';
import { leagueApi } from '../api/leagueApi';
import { matchdayApi } from '../api/matchdayApi';
import { predictionApi } from '../api/predictionApi';
import { standingsApi } from '../api/standingsApi';
import { h2hApi } from '../api/h2hApi';
import { H2hMatchup } from '../types/h2h.types';
import Navbar from '../components/Navbar';
import ActivityFeed from '../components/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';

const LeagueDetailPage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [expandedCompleted, setExpandedCompleted] = useState<Record<number, boolean>>({});
  const [copiedInvite, setCopiedInvite] = useState(false);

  const { data: league, isLoading: leagueLoading } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leagueApi.getLeagueById(Number(leagueId)),
    enabled: !!leagueId,
  });

  const { data: insights } = useQuery({
    queryKey: ['league-insights', leagueId],
    queryFn: () => standingsApi.getLeagueInsights(Number(leagueId)),
    enabled: !!leagueId,
  });

  const { data: standings = [] } = useQuery({
    queryKey: ['league-home-standings', leagueId],
    queryFn: () => standingsApi.getLeagueStandings(Number(leagueId)),
    enabled: !!leagueId,
  });

  const { data: matchdays, isLoading: matchdaysLoading } = useQuery({
    queryKey: ['matchdays', league?.division?.id],
    queryFn: () => matchdayApi.getMatchdaysByDivision(league!.division.id),
    enabled: !!league,
  });

  // Fetch prediction status for all matchdays
  const { data: predictionStatus } = useQuery({
    queryKey: ['predictionStatus', leagueId, matchdays?.map(m => m.id)],
    queryFn: () => predictionApi.getPredictionStatusForMatchdays(
      Number(leagueId),
      matchdays!.map(m => m.id)
    ),
    enabled: !!leagueId && !!matchdays && matchdays.length > 0,
  });

  // Fetch H2H matchups for each matchday
  const hasH2h = league?.h2hLeaderboardEnabled || league?.h2hKnockoutEnabled;
  
  const { data: matchdayMatchups } = useQuery({
    queryKey: ['matchdayH2hMatchups', leagueId, matchdays?.map(m => m.id)],
    queryFn: async () => {
      if (!matchdays || !leagueId) return {};
      const results: Record<number, H2hMatchup[]> = {};
      await Promise.all(
        matchdays.map(async (md) => {
          try {
            const matchups = await h2hApi.getAllMatchupsForMatchday(Number(leagueId), md.id);
            if (matchups.length > 0) {
              results[md.id] = matchups;
            }
          } catch {
            // Matchups may not exist for this matchday yet
          }
        })
      );
      return results;
    },
    enabled: !!leagueId && !!matchdays && matchdays.length > 0 && hasH2h,
  });

  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();
  const canManageLeague = isAdmin || isSuperAdmin || league?.createdBy.id === user?.id || league?.createdBy.username === user?.username;

  const inviteLink = React.useMemo(() => {
    if (!league?.code || typeof window === 'undefined') return '';
    return `${window.location.origin}/leagues?join=${league.code}`;
  }, [league?.code]);

  const copyInvite = async () => {
    if (!inviteLink || typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  const shareInvite = async () => {
    if (!inviteLink || typeof navigator === 'undefined') return;
    const text = `Join ${league?.name || 'my league'} on MatchPulse with code ${league?.code}: ${inviteLink}`;
    if (navigator.share) {
      await navigator.share({ title: league?.name || 'MatchPulse League', text, url: inviteLink });
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  if (leagueLoading) {
    return (
      <div className="min-h-screen bg-stadium flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!league) {
    return (
      <div className="min-h-screen bg-stadium">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-xl font-semibold text-foreground">League Not Found</h3>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return <Badge variant="warning">Upcoming</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Split matchdays into active (current + upcoming) and completed
  const activeMatchdays = matchdays?.filter(md => {
    const status = md.computedStatus || md.status;
    return status !== 'COMPLETED';
  }) || [];

  const completedMatchdays = matchdays?.filter(md => {
    const status = md.computedStatus || md.status;
    return status === 'COMPLETED';
  }) || [];
  const nextMatchday = activeMatchdays[0] || completedMatchdays[completedMatchdays.length - 1];
  const nextDeadline = nextMatchday ? new Date(nextMatchday.endDate || nextMatchday.startDate) : null;
  const nextHasPredicted = nextMatchday ? predictionStatus?.[nextMatchday.id] || false : false;
  const latestWinner = insights?.weeklyWinners?.[0];
  const topFive = standings.slice(0, 5);

  const toggleCompletedExpand = (id: number) => {
    setExpandedCompleted(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /** Renders a full matchday card (used for active matchdays) */
  const renderActiveMatchdayCard = (matchday: any) => {
    const effectiveStatus = matchday.computedStatus || matchday.status;
    const isPredictionsOpen = matchday.predictionsOpen !== undefined 
      ? matchday.predictionsOpen 
      : new Date() < new Date(matchday.endDate || matchday.startDate);
    const hasPredicted = predictionStatus?.[matchday.id] || false;
    
    let buttonText = 'Make Predictions';
    let buttonVariant: 'default' | 'secondary' | 'warning' = 'default';
    let ButtonIcon = ChevronRight;
    
    if (isPredictionsOpen) {
      if (hasPredicted) {
        buttonText = 'Edit Predictions';
        buttonVariant = 'warning';
        ButtonIcon = Edit;
      } else {
        buttonText = 'Make Predictions';
        buttonVariant = 'default';
        ButtonIcon = ChevronRight;
      }
    } else {
      buttonText = 'View Predictions';
      buttonVariant = 'secondary';
      ButtonIcon = Eye;
    }
    
    return (
      <Card 
        key={matchday.id} 
        className={cn(
          "bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all",
          isPredictionsOpen && "border-l-4 border-l-primary"
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{matchday.name}</h3>
              <div className="flex flex-wrap items-center gap-3">
                {getStatusBadge(effectiveStatus)}
                {isPredictionsOpen ? (
                  <span className="flex items-center gap-1 text-sm text-primary">
                    <CheckCircle className="h-4 w-4" />
                    Predictions Open
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Predictions Closed
                  </span>
                )}
                {hasPredicted ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Predicted
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Predicted
                  </Badge>
                )}
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Deadline: {new Date(matchday.endDate || matchday.startDate).toLocaleString()}
              </p>
              {/* H2H Matchup Info */}
              {renderH2hMatchups(matchday.id)}
            </div>
            <Link to={`/leagues/${leagueId}/matchdays/${matchday.id}`}>
              <Button 
                variant={buttonVariant}
                className="gap-2"
              >
                {buttonText}
                <ButtonIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  /** Renders H2H matchup rows for a given matchday */
  const renderH2hMatchups = (matchdayId: number) => {
    if (!matchdayMatchups?.[matchdayId] || matchdayMatchups[matchdayId].length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5 pt-1">
        {matchdayMatchups[matchdayId].map((m) => (
          <div key={m.id} className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
            m.format === 'LEADERBOARD' 
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-red-500/10 border border-red-500/20"
          )}>
            {m.format === 'LEADERBOARD' ? (
              <Swords className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : (
              <Target className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )}
            <span className={cn(
              "font-medium",
              m.format === 'LEADERBOARD' ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
            )}>
              {m.format === 'LEADERBOARD' ? 'H2H:' : (m.knockoutRound?.replace(/_/g, ' ') || 'KO') + ':'}
            </span>
            {m.player1 && m.player2 ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={m.player1.profilePhoto || undefined} />
                  <AvatarFallback className="text-[8px]">{getInitials(m.player1.username)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{m.player1.username}</span>
                <span className="text-muted-foreground mx-0.5">vs</span>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={m.player2.profilePhoto || undefined} />
                  <AvatarFallback className="text-[8px]">{getInitials(m.player2.username)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{m.player2.username}</span>
                {m.resolved && (
                  <Badge variant="success" className="ml-1 text-[10px] px-1.5 py-0">
                    {m.player1Points} - {m.player2Points} pts
                  </Badge>
                )}
              </div>
            ) : m.player1 ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={m.player1.profilePhoto || undefined} />
                  <AvatarFallback className="text-[8px]">{getInitials(m.player1.username)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{m.player1.username}</span>
                <span className="text-muted-foreground italic">— BYE</span>
              </div>
            ) : (
              <span className="text-muted-foreground italic">TBD</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  /** Renders a compact collapsible completed matchday item */
  const renderCompletedMatchdayItem = (matchday: any) => {
    const hasPredicted = predictionStatus?.[matchday.id] || false;
    const isExpanded = expandedCompleted[matchday.id] || false;
    const hasMatchups = matchdayMatchups?.[matchday.id] && matchdayMatchups[matchday.id].length > 0;

    return (
      <div key={matchday.id} className="border border-border/50 rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm">
        {/* Collapsed header - always visible */}
        <button
          onClick={() => toggleCompletedExpand(matchday.id)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground truncate">{matchday.name}</span>
            {hasPredicted ? (
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2 border-t border-border/30">
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="success" className="text-[10px]">Completed</Badge>
              {hasPredicted ? (
                <Badge variant="success" className="text-[10px] gap-0.5">
                  <CheckCircle className="h-2.5 w-2.5" />
                  Predicted
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] gap-0.5">
                  <XCircle className="h-2.5 w-2.5" />
                  Not Predicted
                </Badge>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(matchday.endDate || matchday.startDate).toLocaleDateString()}
            </p>
            {/* H2H matchups in compact form */}
            {hasMatchups && (
              <div className="flex flex-col gap-1 pt-0.5">
                {matchdayMatchups![matchday.id].map((m) => (
                  <div key={m.id} className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[11px]",
                    m.format === 'LEADERBOARD' 
                      ? "bg-amber-500/10"
                      : "bg-red-500/10"
                  )}>
                    {m.format === 'LEADERBOARD' ? (
                      <Swords className="h-3 w-3 text-amber-500 shrink-0" />
                    ) : (
                      <Target className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="text-foreground truncate">
                      {m.player1?.username || 'TBD'}
                    </span>
                    {m.player2 ? (
                      <>
                        <span className="text-muted-foreground">vs</span>
                        <span className="text-foreground truncate">
                          {m.player2.username}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">BYE</span>
                    )}
                    {m.resolved && (
                      <span className="text-[10px] text-primary font-medium ml-auto shrink-0">
                        {m.player1Points}-{m.player2Points}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link to={`/leagues/${leagueId}/matchdays/${matchday.id}`} className="block pt-1">
              <Button variant="secondary" size="sm" className="w-full gap-1 text-xs h-7">
                <Eye className="h-3 w-3" />
                View Predictions
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* League Info Card */}
        <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-primary mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Trophy className="h-7 w-7 text-primary" />
                  {league.name}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    {league.code}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {league.members.length} members
                  </span>
                  <span className="flex items-center gap-1">
                    Created by {league.createdBy.username}
                  </span>
                </CardDescription>
                {/* Format badges */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {league.overallStandingsEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Trophy className="h-3 w-3" /> Overall
                    </span>
                  )}
                  {league.h2hLeaderboardEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                      <Swords className="h-3 w-3" /> H2H League
                    </span>
                  )}
                  {league.h2hKnockoutEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-medium">
                      <Target className="h-3 w-3" /> Knockout
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageLeague && (
                  <Link to={`/leagues/${leagueId}/manage`}>
                    <Button variant="outline" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Manage Members
                    </Button>
                  </Link>
                )}
                <Button variant="secondary" className="gap-2" onClick={copyInvite}>
                  <Copy className="h-4 w-4" />
                  {copiedInvite ? 'Copied' : 'Copy Invite'}
                </Button>
                <Button variant="outline" className="gap-2" onClick={shareInvite}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Link to={`/leagues/${leagueId}/standings`}>
                  <Button className="gap-2">
                    <Trophy className="h-4 w-4" />
                    View Standings
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <section className="mb-8 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-5">
            <article className="dashboard-hero overflow-hidden rounded-[1.65rem] p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-sm font-semibold text-teal-700">League home</p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                    {insights?.pressure?.message || 'The table is waiting for its first shake-up.'}
                  </h2>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {nextMatchday ? (
                      <Link to={`/leagues/${leagueId}/matchdays/${nextMatchday.id}`}>
                        <Button className="gap-2 rounded-full">
                          {nextMatchday.predictionsOpen ? (nextHasPredicted ? 'Edit Predictions' : 'Make Predictions') : 'View Reveal'}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button className="rounded-full" disabled>No Matchday Ready</Button>
                    )}
                    <Link to={`/leagues/${leagueId}/standings`}>
                      <Button variant="outline" className="rounded-full">Full Standings</Button>
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:w-[24rem] lg:grid-cols-1">
                  <div className="rounded-2xl bg-white/50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Next deadline</p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {nextDeadline ? nextDeadline.toLocaleString() : 'No deadline set'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-teal-700">{nextMatchday?.name || 'Awaiting matchday'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/50 p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Your position</p>
                      <p className="mt-1 text-2xl font-black text-teal-700">{insights?.pressure?.rank || '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/50 p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Behind</p>
                      <p className="mt-1 text-2xl font-black text-amber-500">{insights?.pressure?.pointsBehind || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-5 lg:grid-cols-2">
              <article className="dashboard-panel overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Current Top 5</h2>
                    <p className="text-xs font-semibold text-teal-700">{league.name}</p>
                  </div>
                  <Trophy className="h-5 w-5 text-teal-600" />
                </div>
                <div className="space-y-2 px-4 pb-4">
                  {topFive.length ? topFive.map((standing, index) => (
                    <div key={standing.id} className="flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={standing.user.profilePhoto || undefined} />
                        <AvatarFallback className="bg-white/70 text-xs font-bold text-teal-700">{getInitials(standing.user.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">{standing.user.username}</p>
                        <p className="text-xs font-semibold text-slate-500">{standing.correctScores} exact scores</p>
                      </div>
                      <span className="text-xl font-black text-slate-900">{standing.totalPoints}</span>
                    </div>
                  )) : (
                    <div className="designed-empty-state py-8 text-center">
                      <h3 className="text-lg font-bold text-slate-900">No standings yet</h3>
                      <p className="mt-1 text-sm text-slate-500">The top five will appear once results are scored.</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="dashboard-panel p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-400 text-white shadow-[0_12px_28px_rgb(245_158_11_/_0.22)]">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700">Latest matchday winner</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-900">
                      {latestWinner?.winners?.map((winner) => winner.username).join(', ') || 'No winner yet'}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {latestWinner ? `${latestWinner.matchdayName} · ${latestWinner.points} points` : 'Winners will show here once a matchday is scored.'}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/45 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Members</p>
                    <p className="mt-1 text-2xl font-black text-violet-500">{league.members.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/45 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Matchdays</p>
                    <p className="mt-1 text-2xl font-black text-teal-700">{matchdays?.length || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-white/45 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{nextMatchday?.predictionsOpen ? 'Open' : 'Locked'}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <ActivityFeed activity={insights?.activity || []} compact title="Latest Activity" />
        </section>

        {matchdaysLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : matchdays && matchdays.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main column: Current & Upcoming Matchdays */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                Current Matchdays
              </h2>

              {activeMatchdays.length > 0 ? (
                <div className="grid gap-4">
                  {activeMatchdays.map(renderActiveMatchdayCard)}
                </div>
              ) : (
                <Card className="bg-card/80 backdrop-blur-sm">
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <CheckCircle className="h-12 w-12 text-primary/40 mb-3" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">All Caught Up!</h3>
                    <p className="text-muted-foreground text-center text-sm">
                      No active matchdays right now. Check back soon for the next round!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Side column: Completed Matchdays */}
            {completedMatchdays.length > 0 && (
              <div className="lg:w-80 xl:w-96 shrink-0">
                <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-emerald-500 sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4.5 w-4.5 text-emerald-500" />
                      Completed
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {completedMatchdays.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1 scrollbar-thin">
                      {completedMatchdays.map(renderCompletedMatchdayItem)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Matchdays Yet</h3>
              <p className="text-muted-foreground text-center">
                No matchdays available yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LeagueDetailPage;
