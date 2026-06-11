import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ArrowLeft, Medal, Target, TrendingUp, Info, Swords, Crown, Users, Copy, Share2, Activity, Download } from 'lucide-react';
import { FaFire, FaBolt, FaBullseye, FaStar } from 'react-icons/fa6';
import { standingsApi } from '../api/standingsApi';
import { leagueApi } from '../api/leagueApi';
import { h2hApi } from '../api/h2hApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { H2hMatchup } from '../types/h2h.types';

type TabType = 'overall' | 'h2h-leaderboard' | 'h2h-knockout';
type LeaderboardFilter = 'overall' | 'matchday' | 'last5' | 'exact';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTextWithin(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  const ellipsis = '...';
  let clipped = text;
  while (clipped.length > 0 && ctx.measureText(`${clipped}${ellipsis}`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped.trimEnd()}${ellipsis}`, x, y);
}

function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number) {
  ctx.fillText(text, centerX - ctx.measureText(text).width / 2, y);
}

const StandingsPage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const [copied, setCopied] = useState('');
  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>('overall');

  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leagueApi.getLeagueById(Number(leagueId)),
    enabled: !!leagueId,
  });

  // Determine default tab
  const getDefaultTab = (): TabType => {
    if (league?.overallStandingsEnabled) return 'overall';
    if (league?.h2hLeaderboardEnabled) return 'h2h-leaderboard';
    if (league?.h2hKnockoutEnabled) return 'h2h-knockout';
    return 'overall';
  };

  const [activeTab, setActiveTab] = useState<TabType>('overall');

  // Set default tab when league loads
  React.useEffect(() => {
    if (league) {
      setActiveTab(getDefaultTab());
    }
  }, [league]);

  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings', leagueId, leaderboardFilter],
    queryFn: () => standingsApi.getLeagueStandings(Number(leagueId), leaderboardFilter),
    enabled: !!leagueId && activeTab === 'overall',
  });

  const { data: insights } = useQuery({
    queryKey: ['leagueInsights', leagueId],
    queryFn: () => standingsApi.getLeagueInsights(Number(leagueId)),
    enabled: !!leagueId,
  });

  const { data: h2hStandings, isLoading: h2hStandingsLoading } = useQuery({
    queryKey: ['h2hStandings', leagueId],
    queryFn: () => h2hApi.getLeaderboardStandings(Number(leagueId)),
    enabled: !!leagueId && activeTab === 'h2h-leaderboard',
  });

  const { data: h2hMatchups } = useQuery({
    queryKey: ['h2hMatchups', leagueId],
    queryFn: () => h2hApi.getLeaderboardMatchups(Number(leagueId)),
    enabled: !!leagueId && activeTab === 'h2h-leaderboard',
  });

  const { data: knockoutBracket, isLoading: knockoutLoading } = useQuery({
    queryKey: ['knockoutBracket', leagueId],
    queryFn: () => h2hApi.getKnockoutBracket(Number(leagueId)),
    enabled: !!leagueId && activeTab === 'h2h-knockout',
  });

  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-slate-400" />;
    if (index === 2) return <Medal className="h-4 w-4 text-amber-600" />;
    return null;
  };

  const inviteLink = React.useMemo(() => {
    if (!league?.code || typeof window === 'undefined') return '';
    return `${window.location.origin}/leagues?join=${league.code}`;
  }, [league?.code]);

  const shareText = React.useMemo(() => {
    const topThree = insights?.shareCard.topThree
      .map((row) => `${row.rank}. ${row.user?.username || 'Player'} - ${row.points} pts`)
      .join('\n') || 'No standings yet';
    return `${insights?.shareCard.title || league?.name || 'League standings'}\n${topThree}\nJoin: ${inviteLink}`;
  }, [insights, league?.name, inviteLink]);

  const copyText = async (text: string, key: string) => {
    if (!text || typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const shareStandings = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: insights?.shareCard.title || league?.name || 'League standings',
        text: shareText,
      });
      return;
    }
    await copyText(shareText, 'share');
  };

  const generateStandingsImageCard = async () => {
    const formatLabel = activeTab === 'overall'
      ? leaderboardFilters.find((filter) => filter.id === leaderboardFilter)?.label || 'Overall'
      : activeTab === 'h2h-leaderboard'
        ? 'H2H League'
        : 'Knockout';
    const title = league?.name || 'MatchPulse League';
    const rows = activeTab === 'overall'
      ? (standings || []).slice(0, 11).map((standing, index) => ({
        rank: index + 1,
        name: standing.user.username,
        sub: `${standing.correctScores} exact · ${standing.correctOutcomes} outcomes`,
        small1: String(standing.matchdaysPlayed),
        small2: String(standing.correctScores),
        small3: String(standing.correctOutcomes),
        small4: standing.lastMatchdayPoints > 0 ? `+${standing.lastMatchdayPoints}` : String(standing.lastMatchdayPoints),
        total: String(standing.totalPoints),
      }))
      : activeTab === 'h2h-leaderboard'
        ? (h2hStandings || []).slice(0, 11).map((standing, index) => ({
          rank: index + 1,
          name: standing.user.username,
          sub: `${standing.wins}W ${standing.draws}D ${standing.losses}L`,
          small1: String(standing.matchupsPlayed),
          small2: String(standing.wins),
          small3: String(standing.losses),
          small4: String(standing.draws),
          total: String(standing.h2hPoints),
        }))
        : (knockoutBracket || []).slice(0, 11).map((matchup, index) => ({
          rank: index + 1,
          name: `${matchup.player1?.username || 'TBD'} vs ${matchup.player2?.username || 'BYE'}`,
          sub: matchup.knockoutRound?.replace(/_/g, ' ') || 'Knockout',
          small1: matchup.resolved ? String(matchup.player1Points ?? 0) : '-',
          small2: matchup.resolved ? String(matchup.player2Points ?? 0) : '-',
          small3: matchup.resolved ? 'FT' : 'TBD',
          small4: matchup.winnerId ? 'WIN' : '-',
          total: matchup.winnerId ? 'WIN' : 'LIVE',
        }));

    const canvas = document.createElement('canvas');
    canvas.width = 1900;
    canvas.height = 1900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawPoly = (points: Array<[number, number]>, fill: string, stroke?: string) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    const green = '#f5c451';
    const ribbonBlue = '#2f8fd3';
    ctx.fillStyle = '#170326';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#4c13dc';
    ctx.beginPath();
    ctx.ellipse(200, -70, 980, 300, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1760, 430, 820, 340, 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#240544';
    ctx.beginPath();
    ctx.ellipse(340, 790, 700, 980, -0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1350, 1060, 780, 760, 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(24,244,109,0.28)';
    ctx.lineWidth = 2;
    for (let x = 16; x < canvas.width; x += 72) {
      for (let y = 250; y < canvas.height; y += 72) {
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
      }
    }

    const panelX = 385;
    const panelY = 70;
    const panelW = 1020;
    const panelH = 1660;
    const nameX = panelX + 138;
    const teamRibbonEndX = panelX + 585;
    const statRibbonStartX = panelX + 565;
    const statRibbonEndX = panelX + 922;
    const totalRibbonStartX = panelX + 905;
    const totalRibbonEndX = panelX + 1018;
    const nameMaxWidth = teamRibbonEndX - nameX - 42;
    const statCenters = [panelX + 650, panelX + 735, panelX + 820, panelX + 895];
    const totalCenterX = panelX + 970;

    ctx.fillStyle = '#230743';
    roundRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.strokeStyle = green;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    for (let y = panelY + 270; y < panelY + panelH - 40; y += 126) {
      ctx.fillRect(panelX + 1, y, panelW - 2, 96);
    }

    ctx.fillStyle = '#f4fff8';
    ctx.font = '800 28px Inter, Arial';
    ctx.fillText('MATCHPULSE', panelX + 58, panelY + 110);
    ctx.fillStyle = green;
    ctx.font = '900 46px Inter, Arial';
    ctx.fillText(title.toUpperCase().slice(0, 24), panelX + 58, panelY + 170);
    ctx.fillStyle = '#d7e7dc';
    ctx.font = '700 20px Inter, Arial';
    ctx.fillText(formatLabel.toUpperCase(), panelX + 58, panelY + 215);

    ctx.fillStyle = '#cbd5cf';
    ctx.font = '700 17px Inter, Arial';
    const headers = activeTab === 'h2h-leaderboard'
      ? ['PLAYED', 'WON', 'LOST', 'TIED']
      : activeTab === 'overall'
        ? ['PLAYED', 'EXACT', 'OUT', 'LAST']
        : ['P1', 'P2', 'STATE', 'WIN'];
    headers.forEach((header, index) => drawCenteredText(ctx, header, statCenters[index], panelY + 275));
    ctx.fillStyle = '#ffffff';
    drawCenteredText(ctx, 'TOTAL', totalCenterX, panelY + 275);

    rows.forEach((row, index) => {
      const y = panelY + 340 + index * 118;
      const rowY = y - 45;
      const rowH = 74;
      const notch = 28;
      drawPoly([[panelX + 18, rowY], [panelX + 112, rowY], [panelX + 86, rowY + rowH / 2], [panelX + 112, rowY + rowH], [panelX + 18, rowY + rowH], [panelX, rowY + rowH / 2]], ribbonBlue, 'rgba(255,255,255,0.38)');
      drawPoly([[panelX + 90 + notch, rowY], [teamRibbonEndX - notch, rowY], [teamRibbonEndX, rowY + rowH / 2], [teamRibbonEndX - notch, rowY + rowH], [panelX + 90 + notch, rowY + rowH], [panelX + 90, rowY + rowH / 2]], '#ffffff');
      drawPoly([[statRibbonStartX + notch, rowY], [statRibbonEndX - notch, rowY], [statRibbonEndX, rowY + rowH / 2], [statRibbonEndX - notch, rowY + rowH], [statRibbonStartX + notch, rowY + rowH], [statRibbonStartX, rowY + rowH / 2]], ribbonBlue, 'rgba(255,255,255,0.28)');
      drawPoly([[totalRibbonStartX + notch, rowY], [totalRibbonEndX - 18, rowY], [totalRibbonEndX, rowY + rowH / 2], [totalRibbonEndX - 18, rowY + rowH], [totalRibbonStartX + notch, rowY + rowH], [totalRibbonStartX, rowY + rowH / 2]], '#ffffff');

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px Inter, Arial';
      ctx.fillText(`${row.rank}.`, panelX + 28, y);

      ctx.fillStyle = '#06101e';
      ctx.font = '900 30px Inter, Arial';
      drawTextWithin(ctx, row.name, nameX, y - 8, nameMaxWidth);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px Inter, Arial';
      [row.small1, row.small2, row.small3, row.small4].forEach((value, index) => {
        drawCenteredText(ctx, value, statCenters[index], y);
      });
      ctx.font = '900 38px Inter, Arial';
      ctx.fillStyle = '#030712';
      drawCenteredText(ctx, row.total, totalCenterX, y + 5);
    });

    ctx.save();
    ctx.translate(1705, 180);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 42px Inter, Arial';
    ctx.fillText(`${formatLabel.toUpperCase()} STANDINGS`, 0, 0);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px Inter, Arial';
    ctx.fillText('made by', 1540, 1760);
    ctx.font = '900 44px Inter, Arial';
    ctx.fillText('MatchPulse', 1540, 1812);

    const link = document.createElement('a');
    link.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${formatLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-standings.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const getFormClass = (tone?: string) => {
    if (tone === 'winner') return 'bg-amber-400 text-amber-950 shadow-sm';
    if (tone === 'hot') return 'bg-emerald-500 text-white';
    if (tone === 'steady') return 'bg-primary/15 text-primary';
    return 'bg-slate-200/80 text-slate-500';
  };

  const getBadgeIcon = (key: string) => {
    if (key === 'leader') return <Crown className="h-3 w-3" />;
    if (key === 'weekly-winner') return <Trophy className="h-3 w-3" />;
    if (key === 'exact-eye') return <FaBullseye className="h-3 w-3" />;
    if (key === 'hot-streak') return <FaFire className="h-3 w-3" />;
    return <FaStar className="h-3 w-3" />;
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: 'overall', label: 'Overall', icon: <Trophy className="h-4 w-4" />, enabled: league?.overallStandingsEnabled ?? true },
    { id: 'h2h-leaderboard', label: 'H2H League', icon: <Swords className="h-4 w-4" />, enabled: league?.h2hLeaderboardEnabled ?? false },
    { id: 'h2h-knockout', label: 'Knockout', icon: <Target className="h-4 w-4" />, enabled: league?.h2hKnockoutEnabled ?? false },
  ];

  const enabledTabs = tabs.filter(t => t.enabled);
  const leaderboardFilters: Array<{ id: LeaderboardFilter | 'h2h'; label: string }> = [
    { id: 'overall', label: 'Overall' },
    { id: 'matchday', label: 'This Matchday' },
    { id: 'last5', label: 'Last 5 Matchdays' },
    { id: 'exact', label: 'Exact-score Ranking' },
    { id: 'h2h', label: 'H2H Ranking' },
  ];

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              {league?.name} - Standings
            </h1>
            <p className="text-muted-foreground mt-1">League leaderboard and rankings</p>
          </div>
          <Link to={`/leagues/${leagueId}`}>
            <Button variant="secondary" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to League
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        {enabledTabs.length > 1 && (
          <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
            {enabledTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2 rounded-[1.25rem] border border-white/60 bg-white/35 p-2">
          {leaderboardFilters.map((filter) => {
            const active = filter.id === 'h2h' ? activeTab === 'h2h-leaderboard' : activeTab === 'overall' && leaderboardFilter === filter.id;
            const disabled = filter.id === 'h2h' && !league?.h2hLeaderboardEnabled;
            return (
              <Button
                key={filter.id}
                type="button"
                variant={active ? 'default' : 'secondary'}
                size="sm"
                disabled={disabled}
                onClick={() => {
                  if (filter.id === 'h2h') {
                    setActiveTab('h2h-leaderboard');
                  } else {
                    setActiveTab('overall');
                    setLeaderboardFilter(filter.id);
                  }
                }}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>

        {insights && (
          <div className="grid gap-4 mb-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                      <FaBolt className="h-4 w-4" />
                      Competition pressure
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{insights.pressure.message}</h2>
                    <p className="text-sm text-muted-foreground">
                      Weekly winners, streaks, form and badges update as results are posted.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="gap-2" onClick={() => copyText(inviteLink, 'invite')} disabled={!inviteLink}>
                      <Copy className="h-4 w-4" />
                      {copied === 'invite' ? 'Copied' : 'Invite Link'}
                    </Button>
                    <Button className="gap-2" onClick={shareStandings}>
                      <Share2 className="h-4 w-4" />
                      {copied === 'share' ? 'Copied' : 'Share Standings'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={generateStandingsImageCard}>
                      <Download className="h-4 w-4" />
                      Image Card
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Medal className="h-4 w-4 text-amber-500" />
                  Weekly Winners
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.weeklyWinners.length > 0 ? insights.weeklyWinners.slice(0, 3).map((winner) => (
                  <div key={winner.matchdayId} className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{winner.matchdayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {winner.winners.map((win) => win.username).join(', ')}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-400/80 px-3 py-1 text-xs font-black text-amber-950">
                      {winner.points} pts
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Weekly winners appear once results are posted.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overall Standings Tab */}
        {activeTab === 'overall' && (
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
              <div>
              <Card className="standings-board mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Medal className="h-5 w-5 text-primary" />
                    League Table
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[840px] border-separate border-spacing-y-3">
                      <thead>
                        <tr>
                          <th className="py-3 px-3 text-left">Rank</th>
                          <th className="py-3 px-3 text-left">Player</th>
                          <th className="py-3 px-3 text-center">Played</th>
                          <th className="py-3 px-3 text-center">Exact</th>
                          <th className="py-3 px-3 text-center">Outcome</th>
                          <th className="py-3 px-3 text-center">Last</th>
                          <th className="py-3 px-3 text-center">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings && standings.length > 0 ? (
                          standings.map((standing, index) => {
                            const isCurrentUser = standing.user.username === user?.username;
                            return (
                              <tr 
                                key={standing.user.id} 
                                className={cn(
                                  "standings-row h-[3.35rem] transition-transform hover:-translate-y-0.5",
                                  isCurrentUser && "standings-row-current"
                                )}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    <span className="standings-rank">
                                      {index + 1}
                                    </span>
                                    {getRankIcon(index)}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border border-slate-200 bg-white shadow-sm">
                                      {standing.user.profilePhoto ? (
                                        <AvatarImage src={standing.user.profilePhoto} alt={standing.user.username} />
                                      ) : null}
                                      <AvatarFallback className="bg-slate-100 text-slate-900 text-xs font-black">
                                        {getInitials(standing.user.username)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <span className="standings-player-cell">{standing.user.username}</span>
                                      {isCurrentUser && (
                                        <span className="ml-2 text-xs font-bold text-emerald-700">(You)</span>
                                      )}
                                      {(standing.badges?.length || 0) > 0 && (
                                        <div className="mt-1 flex max-w-[18rem] flex-wrap gap-1">
                                          {standing.badges?.slice(0, 3).map((badge) => (
                                            <span key={badge.key} className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-black uppercase text-primary">
                                              {getBadgeIcon(badge.key)}
                                              {badge.label}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center standings-number">
                                  {standing.matchdaysPlayed}
                                </td>
                                <td className="py-2 px-3 text-center standings-number">
                                  {standing.correctScores}
                                </td>
                                <td className="py-2 px-3 text-center standings-number">
                                  {standing.correctOutcomes}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="standings-number">
                                    {standing.lastMatchdayPoints > 0 ? `+${standing.lastMatchdayPoints}` : standing.lastMatchdayPoints}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="standings-points">{standing.totalPoints}</span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-white/80">
                              No standings data yet. Play some matchdays first!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {standings && standings.length > 0 ? standings.map((standing, index) => {
                      const isCurrentUser = standing.user.username === user?.username;
                      return (
                        <div
                          key={standing.user.id}
                          className={cn(
                            "rounded-[1.25rem] border border-white/60 bg-white/45 p-4 shadow-sm",
                            isCurrentUser && "outline outline-2 outline-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="standings-rank text-xl">#{index + 1}</span>
                              <Avatar className="h-10 w-10 border border-slate-200 bg-white shadow-sm">
                                {standing.user.profilePhoto ? (
                                  <AvatarImage src={standing.user.profilePhoto} alt={standing.user.username} />
                                ) : null}
                                <AvatarFallback className="bg-slate-100 text-slate-900 text-xs font-black">
                                  {getInitials(standing.user.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black uppercase text-slate-950">
                                  {standing.user.username}{isCurrentUser ? ' (You)' : ''}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {standing.badges?.slice(0, 2).map((badge) => (
                                    <span key={badge.key} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-primary">
                                      {getBadgeIcon(badge.key)}
                                      {badge.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-slate-950">{standing.totalPoints}</p>
                              <p className="text-[10px] font-black uppercase text-muted-foreground">points</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/45 p-2 text-center">
                            <div>
                              <p className="text-xs font-black text-primary">{standing.correctScores}</p>
                              <p className="text-[10px] font-bold text-muted-foreground">Scores</p>
                            </div>
                            <div>
                              <p className="text-xs font-black text-primary">{standing.correctOutcomes}</p>
                              <p className="text-[10px] font-bold text-muted-foreground">Outcomes</p>
                            </div>
                            <div>
                              <p className="text-xs font-black text-primary">{standing.lastMatchdayPoints > 0 ? `+${standing.lastMatchdayPoints}` : standing.lastMatchdayPoints}</p>
                              <p className="text-[10px] font-bold text-muted-foreground">Last MD</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1">
                            {(standing.form || []).map((form) => (
                              <span key={form.matchdayId} className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-black", getFormClass(form.tone))}>
                                {form.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="designed-empty-state">
                        <div className="flex items-center gap-4">
                          <div className="designed-empty-icon">
                            <Trophy className="h-7 w-7" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-foreground">No standings yet</h3>
                            <p className="text-sm text-muted-foreground">Standings will appear after predictions score points.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Scoring Info */}
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Scoring System</h4>
                      <div className="grid gap-2 sm:grid-cols-3 mb-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-primary text-lg">5 pts</span>
                          <span className="text-sm text-muted-foreground">Exact score</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-amber-500 text-lg">3 pts</span>
                          <span className="text-sm text-muted-foreground">Correct outcome</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-muted-foreground text-lg">0 pts</span>
                          <span className="text-sm text-muted-foreground">Wrong prediction</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Tiebreaker: Correct scores → Correct outcomes → Alphabetical
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>

              {insights && (
                <aside className="space-y-6">
                  <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Share2 className="h-4 w-4 text-primary" />
                        Share Card
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-white/80 via-cyan-50/80 to-violet-100/80 p-4 shadow-sm">
                        <p className="text-xs font-black uppercase text-primary">MatchPulse Standings</p>
                        <h3 className="mt-1 text-xl font-black text-foreground">{insights.shareCard.title}</h3>
                        <div className="mt-4 space-y-2">
                          {insights.shareCard.topThree.length > 0 ? insights.shareCard.topThree.map((row) => (
                            <div key={row.rank} className="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2">
                              <span className="text-sm font-bold">{row.rank}. {row.user?.username || 'Player'}</span>
                              <span className="text-sm font-black text-primary">{row.points} pts</span>
                            </div>
                          )) : (
                            <p className="text-sm text-muted-foreground">No standings yet.</p>
                          )}
                        </div>
                        {insights.shareCard.currentUser && (
                          <div className="mt-3 rounded-2xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                            You: #{insights.shareCard.currentUser.rank}, {insights.shareCard.currentUser.points} pts
                          </div>
                        )}
                      </div>
                      <Button variant="secondary" className="mt-3 w-full gap-2" onClick={() => copyText(shareText, 'share-card')}>
                        <Copy className="h-4 w-4" />
                        {copied === 'share-card' ? 'Copied' : 'Copy Share Text'}
                      </Button>
                      <Button className="mt-2 w-full gap-2" onClick={generateStandingsImageCard}>
                        <Download className="h-4 w-4" />
                        Download Image Card
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4 text-primary" />
                        Activity Feed
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {insights.activity.length > 0 ? insights.activity.slice(0, 7).map((activity, index) => (
                        <div key={`${activity.message}-${index}`} className="rounded-2xl bg-white/50 px-3 py-2">
                          <p className="text-sm font-semibold text-foreground">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{activity.at ? new Date(activity.at).toLocaleString() : ''}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">Predictions and result updates will appear here.</p>
                      )}
                    </CardContent>
                  </Card>
                </aside>
              )}
              </div>
            </>
          )
        )}

        {/* H2H Leaderboard Tab */}
        {activeTab === 'h2h-leaderboard' && (
          h2hStandingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* H2H Leaderboard Table */}
              <Card className="standings-board mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Swords className="h-5 w-5 text-amber-500" />
                    H2H Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-y-3">
                      <thead>
                        <tr>
                          <th className="py-3 px-3 text-left">Rank</th>
                          <th className="py-3 px-3 text-left">Player</th>
                          <th className="py-3 px-3 text-center">Played</th>
                          <th className="py-3 px-3 text-center">Won</th>
                          <th className="py-3 px-3 text-center">Lost</th>
                          <th className="py-3 px-3 text-center">Tied</th>
                          <th className="py-3 px-3 text-center">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {h2hStandings && h2hStandings.length > 0 ? (
                          h2hStandings.map((standing, index) => {
                            const isCurrentUser = standing.user.username === user?.username;
                            return (
                              <tr 
                                key={standing.user.id} 
                                className={cn(
                                  "standings-row h-[3.35rem] transition-transform hover:-translate-y-0.5",
                                  isCurrentUser && "standings-row-current"
                                )}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    <span className="standings-rank">
                                      {index + 1}
                                    </span>
                                    {getRankIcon(index)}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border border-slate-200 bg-white shadow-sm">
                                      {standing.user.profilePhoto ? (
                                        <AvatarImage src={standing.user.profilePhoto} alt={standing.user.username} />
                                      ) : null}
                                      <AvatarFallback className="bg-slate-100 text-slate-900 text-xs font-black">
                                        {getInitials(standing.user.username)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <span className="standings-player-cell">{standing.user.username}</span>
                                      {isCurrentUser && (
                                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center standings-number">{standing.matchupsPlayed}</td>
                                <td className="py-2 px-3 text-center standings-number">{standing.wins}</td>
                                <td className="py-2 px-3 text-center standings-number">{standing.losses}</td>
                                <td className="py-2 px-3 text-center standings-number">{standing.draws}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="standings-points">{standing.h2hPoints}</span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-white/80">
                              No H2H matchups have been played yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Recent H2H Matchups */}
              {h2hMatchups && h2hMatchups.length > 0 && (
                <Card className="bg-card/80 backdrop-blur-sm mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-500" />
                      Recent Matchups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {h2hMatchups.slice(-20).reverse().map((matchup) => (
                        <MatchupCard key={matchup.id} matchup={matchup} currentUsername={user?.username} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* H2H Scoring Info */}
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Info className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">H2H Scoring</h4>
                      <div className="grid gap-2 sm:grid-cols-3 mb-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-green-500 text-lg">3 pts</span>
                          <span className="text-sm text-muted-foreground">Win (more prediction pts)</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-amber-500 text-lg">1 pt</span>
                          <span className="text-sm text-muted-foreground">Draw (equal prediction pts)</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="font-bold text-red-500 text-lg">0 pts</span>
                          <span className="text-sm text-muted-foreground">Loss</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Each matchday, you face a different opponent. The player with more prediction points wins the H2H matchup.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )
        )}

        {/* H2H Knockout Tab */}
        {activeTab === 'h2h-knockout' && (
          knockoutLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : knockoutBracket && knockoutBracket.length > 0 ? (
            <KnockoutBracketView bracket={knockoutBracket} currentUsername={user?.username} />
          ) : (
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Knockout Not Started</h3>
                <p className="text-muted-foreground text-center">
                  The knockout bracket hasn't been generated yet. It will be available once enough matchdays have been played.
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
};

// --- Matchup Card Component ---
const MatchupCard: React.FC<{ matchup: H2hMatchup; currentUsername?: string }> = ({ matchup, currentUsername }) => {
  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();
  const isBye = matchup.player2 === null;
  const isCurrentUserP1 = matchup.player1?.username === currentUsername;
  const isCurrentUserP2 = matchup.player2?.username === currentUsername;
  
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border border-border/50",
      (isCurrentUserP1 || isCurrentUserP2) && "bg-amber-500/5 border-amber-500/20",
      matchup.resolved ? "opacity-100" : "opacity-70"
    )}>
      {/* Player 1 */}
      <div className="flex items-center gap-3 flex-1">
        <Avatar className="h-8 w-8">
          {matchup.player1?.profilePhoto ? (
            <AvatarImage src={matchup.player1.profilePhoto} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {matchup.player1 ? getInitials(matchup.player1.username) : '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <span className={cn(
            "font-medium",
            matchup.resolved && matchup.winnerId === matchup.player1?.id && "text-green-500"
          )}>
            {matchup.player1?.username || 'TBD'}
          </span>
          {isCurrentUserP1 && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 px-4">
        {matchup.resolved ? (
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-lg font-bold min-w-[2rem] text-center",
              matchup.winnerId === matchup.player1?.id ? "text-green-500" : 
              matchup.winnerId === null ? "text-amber-500" : "text-red-500"
            )}>
              {matchup.player1Points ?? 0}
            </span>
            <span className="text-muted-foreground text-sm">vs</span>
            <span className={cn(
              "text-lg font-bold min-w-[2rem] text-center",
              matchup.winnerId === matchup.player2?.id ? "text-green-500" : 
              matchup.winnerId === null ? "text-amber-500" : "text-red-500"
            )}>
              {isBye ? 'BYE' : (matchup.player2Points ?? 0)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground px-3 py-1 bg-muted/50 rounded-md">
            {isBye ? 'BYE' : `MD ${matchup.matchdayNumber}`}
          </span>
        )}
      </div>

      {/* Player 2 */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        {!isBye && (
          <>
            <div className="text-right">
              <span className={cn(
                "font-medium",
                matchup.resolved && matchup.winnerId === matchup.player2?.id && "text-green-500"
              )}>
                {matchup.player2?.username || 'TBD'}
              </span>
              {isCurrentUserP2 && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
            </div>
            <Avatar className="h-8 w-8">
              {matchup.player2?.profilePhoto ? (
                <AvatarImage src={matchup.player2.profilePhoto} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {matchup.player2 ? getInitials(matchup.player2.username) : '?'}
              </AvatarFallback>
            </Avatar>
          </>
        )}
        {isBye && (
          <span className="text-muted-foreground italic">BYE</span>
        )}
      </div>
    </div>
  );
};

// --- Knockout Bracket View ---
const KnockoutBracketView: React.FC<{ bracket: H2hMatchup[]; currentUsername?: string }> = ({ bracket, currentUsername }) => {
  // Group matchups by round
  const roundOrder = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
  const roundLabels: Record<string, string> = {
    'ROUND_OF_32': 'Round of 32',
    'ROUND_OF_16': 'Round of 16',
    'QUARTER_FINAL': 'Quarter-Finals',
    'SEMI_FINAL': 'Semi-Finals',
    'FINAL': 'Final',
  };

  const matchupsByRound = new Map<string, H2hMatchup[]>();
  bracket.forEach(m => {
    const round = m.knockoutRound || 'UNKNOWN';
    if (!matchupsByRound.has(round)) {
      matchupsByRound.set(round, []);
    }
    matchupsByRound.get(round)!.push(m);
  });

  // Sort each round by bracket position
  matchupsByRound.forEach((matchups) => {
    matchups.sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
  });

  const activeRounds = roundOrder.filter(r => matchupsByRound.has(r));

  // Find the winner if the Final is resolved
  const finalMatchups = matchupsByRound.get('FINAL');
  const champion = finalMatchups?.[0]?.resolved ? 
    (finalMatchups[0].winnerId === finalMatchups[0].player1?.id ? finalMatchups[0].player1 : finalMatchups[0].player2) 
    : null;

  return (
    <div className="space-y-6">
      {champion && (
        <Card className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30">
          <CardContent className="flex items-center justify-center gap-3 py-6">
            <Crown className="h-8 w-8 text-yellow-500" />
            <span className="text-2xl font-bold text-foreground">{champion.username}</span>
            <span className="text-muted-foreground">is the Knockout Champion!</span>
            <Crown className="h-8 w-8 text-yellow-500" />
          </CardContent>
        </Card>
      )}

      {/* Bracket rounds displayed horizontally on desktop, vertically on mobile */}
      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
        {activeRounds.map((round) => (
          <div key={round} className="flex-shrink-0 min-w-[280px] lg:flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-3 text-center">
              {roundLabels[round] || round}
            </h3>
            <div className="space-y-3">
              {matchupsByRound.get(round)?.map((matchup) => (
                <KnockoutMatchCard key={matchup.id} matchup={matchup} currentUsername={currentUsername} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Knockout Match Card ---
const KnockoutMatchCard: React.FC<{ matchup: H2hMatchup; currentUsername?: string }> = ({ matchup, currentUsername }) => {
  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();
  
  const PlayerRow = ({ player, points, isWinner, isCurrent }: { 
    player: H2hMatchup['player1']; points: number | null; isWinner: boolean; isCurrent: boolean 
  }) => (
    <div className={cn(
      "flex items-center justify-between px-3 py-2",
      isWinner && "bg-green-500/10",
      isCurrent && "ring-1 ring-primary/30"
    )}>
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          {player?.profilePhoto ? <AvatarImage src={player.profilePhoto} /> : null}
          <AvatarFallback className="text-[10px] bg-muted">
            {player ? getInitials(player.username) : '?'}
          </AvatarFallback>
        </Avatar>
        <span className={cn(
          "text-sm",
          isWinner ? "font-bold text-green-500" : "text-foreground",
          !player && "text-muted-foreground italic"
        )}>
          {player?.username || 'TBD'}
          {isCurrent && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
        </span>
      </div>
      {matchup.resolved && player && (
        <span className={cn("text-sm font-bold", isWinner ? "text-green-500" : "text-muted-foreground")}>
          {points ?? 0}
        </span>
      )}
    </div>
  );

  const p1IsWinner = matchup.resolved && matchup.winnerId === matchup.player1?.id;
  const p2IsWinner = matchup.resolved && matchup.winnerId === matchup.player2?.id;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden bg-card/80">
      <PlayerRow 
        player={matchup.player1} 
        points={matchup.player1Points} 
        isWinner={p1IsWinner}
        isCurrent={matchup.player1?.username === currentUsername}
      />
      <div className="border-t border-border/30" />
      <PlayerRow 
        player={matchup.player2} 
        points={matchup.player2Points} 
        isWinner={p2IsWinner}
        isCurrent={matchup.player2?.username === currentUsername}
      />
      {!matchup.resolved && (matchup.player1 || matchup.player2) && (
        <div className="text-center py-1 text-xs text-muted-foreground bg-muted/30">
          MD {matchup.matchdayNumber}
        </div>
      )}
    </div>
  );
};

export default StandingsPage;
