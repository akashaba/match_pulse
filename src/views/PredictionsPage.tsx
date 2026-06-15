import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, Save, Target, Trophy, Info, Lock, Eye, Edit, Swords, Star, Download, History } from 'lucide-react';
import { fixtureApi } from '../api/fixtureApi';
import { predictionApi } from '../api/predictionApi';
import { matchdayApi } from '../api/matchdayApi';
import { leagueApi } from '../api/leagueApi';
import { h2hApi } from '../api/h2hApi';
import { standingsApi } from '../api/standingsApi';
import { Fixture } from '../types/fixture.types';
import { H2hMatchup } from '../types/h2h.types';
import { Prediction } from '../types/prediction.types';
import Navbar from '../components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { createFixtureImage, downloadBlob } from '../lib/imageExports';

interface PredictionInput {
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  isJoker?: boolean;
}

const clampScore = (value: number) => Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));

const ScoreStepper: React.FC<{
  label: string;
  value?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, disabled, onChange }) => {
  const displayValue = value ?? '';
  const currentValue = value ?? 0;

  return (
    <div className={cn(
      'prediction-stepper',
      disabled && 'prediction-stepper-disabled'
    )}>
      <span className="sr-only">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled}
        onClick={() => onChange(clampScore(currentValue - 1))}
      >
        -
      </button>
      <input
        type="number"
        min={0}
        max={99}
        value={displayValue}
        placeholder="0"
        disabled={disabled}
        onChange={(event) => onChange(clampScore(Number.parseInt(event.target.value || '0', 10)))}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled}
        onClick={() => onChange(clampScore(currentValue + 1))}
      >
        +
      </button>
    </div>
  );
};

const PredictionsPage: React.FC = () => {
  const { leagueId, matchdayId } = useParams<{ leagueId: string; matchdayId: string }>();
  const queryClient = useQueryClient();
  const [predictions, setPredictions] = useState<{ [key: number]: { home: number; away: number } }>({});
  const [jokerFixtureId, setJokerFixtureId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: matchday, isLoading: matchdayLoading } = useQuery({
    queryKey: ['matchday', matchdayId],
    queryFn: () => matchdayApi.getMatchdayById(Number(matchdayId)),
    enabled: !!matchdayId,
  });

  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['fixtures', matchdayId],
    queryFn: () => fixtureApi.getFixturesByMatchday(Number(matchdayId)),
    enabled: !!matchdayId,
  });

  const { data: existingPredictions } = useQuery({
    queryKey: ['predictions', leagueId, matchdayId],
    queryFn: () => predictionApi.getPredictionsByMatchday(Number(leagueId), Number(matchdayId)),
    enabled: !!leagueId && !!matchdayId,
  });

  const predictionDeadline = matchday ? new Date(matchday.endDate || matchday.startDate) : null;
  const isPredictionsClosed = (() => {
    if (!matchday) return true;
    const deadline = matchday.endDate ? new Date(matchday.endDate) : new Date(matchday.startDate);
    if (matchday.predictionsOpen !== undefined) {
      return !matchday.predictionsOpen || currentTime > deadline.getTime();
    }
    return currentTime > deadline.getTime();
  })();

  const { data: revealedPredictions } = useQuery({
    queryKey: ['allPredictionsReveal', leagueId, matchdayId, isPredictionsClosed],
    queryFn: () => predictionApi.getAllPredictionsForMatchday(Number(matchdayId), Number(leagueId)),
    enabled: !!leagueId && !!matchdayId,
  });

  const { data: matchdaySummary } = useQuery({
    queryKey: ['matchdaySummary', leagueId, matchdayId, isPredictionsClosed],
    queryFn: () => standingsApi.getMatchdaySummary(Number(leagueId), Number(matchdayId)),
    enabled: !!leagueId && !!matchdayId,
  });

  // Fetch league to check H2H flags
  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leagueApi.getLeagueById(Number(leagueId)),
    enabled: !!leagueId,
  });

  const hasH2h = league?.h2hLeaderboardEnabled || league?.h2hKnockoutEnabled;

  // Fetch only the current user's current and previous matchups.
  const { data: myMatchups } = useQuery({
    queryKey: ['matchdayMyH2h', leagueId, matchdayId],
    queryFn: () => h2hApi.getMyMatchupsForMatchday(Number(leagueId), Number(matchdayId), true),
    enabled: !!leagueId && !!matchdayId && hasH2h,
  });

  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();
  const getTeamToken = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const fixtureDate = matchday ? new Date(matchday.startDate) : null;
  const countdownMs = predictionDeadline ? Math.max(0, predictionDeadline.getTime() - currentTime) : 0;
  const countdownText = (() => {
    if (!predictionDeadline) return 'Deadline TBC';
    if (countdownMs <= 0) return 'Locked';
    const days = Math.floor(countdownMs / 86400000);
    const hours = Math.floor((countdownMs % 86400000) / 3600000);
    const minutes = Math.floor((countdownMs % 3600000) / 60000);
    const seconds = Math.floor((countdownMs % 60000) / 1000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  })();
  const renderTeamBadge = (team: Fixture['homeTeam']) => (
    <div className="team-token overflow-hidden">
      {team.badgeUrl ? (
        <img src={team.badgeUrl} alt={`${team.name} badge`} className="h-full w-full object-contain" />
      ) : (
        getTeamToken(team.name)
      )}
    </div>
  );

  const exportBaseName = `${league?.name || 'league'}-${matchday?.name || 'gameweek'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const downloadGameweekFixtures = async () => {
    if (!fixtures?.length) return;
    const blob = await createFixtureImage(
      `${league?.name || 'League'} Fixtures`,
      matchday?.name || 'Gameweek',
      fixtures,
    );
    downloadBlob(blob, `${exportBaseName}-fixtures.png`);
  };

  // Initialize predictions from existing data
  React.useEffect(() => {
    if (!matchday) return;
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [matchday]);

  // Initialize predictions from existing data
  React.useEffect(() => {
    if (existingPredictions !== undefined) {
      if (existingPredictions.length > 0) {
        const predMap: { [key: number]: { home: number; away: number } } = {};
        const joker = existingPredictions.find((pred: any) => pred.isJoker);
        existingPredictions.forEach((pred: any) => {
          predMap[pred.fixtureId] = {
            home: pred.predictedHomeScore,
            away: pred.predictedAwayScore,
          };
        });
        setPredictions(predMap);
        setJokerFixtureId(joker?.fixtureId ?? null);
      } else {
        // Reset predictions if user has no predictions
        setPredictions({});
        setJokerFixtureId(null);
      }
    }
  }, [existingPredictions]);

  const submitPredictionMutation = useMutation({
    mutationFn: (input: PredictionInput) => 
      predictionApi.submitPrediction(Number(leagueId), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to submit prediction');
      setTimeout(() => setError(null), 5000);
    },
  });

  const setPredictionScore = (fixtureId: number, team: 'home' | 'away', score: number) => {
    setPredictions(prev => ({
      ...prev,
      [fixtureId]: {
        home: prev[fixtureId]?.home ?? 0,
        away: prev[fixtureId]?.away ?? 0,
        [team]: clampScore(score),
      },
    }));
  };

  const handlePredictionChange = (fixtureId: number, team: 'home' | 'away', value: string) => {
    setPredictionScore(fixtureId, team, Number.parseInt(value || '0', 10));
  };

  const handleSubmitPrediction = async (fixtureId: number) => {
    const pred = predictions[fixtureId];
    if (pred === undefined || pred.home === undefined || pred.away === undefined) {
      setError('Please enter both scores');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await submitPredictionMutation.mutateAsync({
        fixtureId,
        predictedHomeScore: pred.home,
        predictedAwayScore: pred.away,
        isJoker: jokerFixtureId === fixtureId,
      });
      setSuccess('Prediction saved!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e) {
      // Error handled in mutation
    }
  };

  const handleSubmitAll = async () => {
    if (!fixtures) return;
    
    const incompleteFixtures = fixtures.filter((f: Fixture) => {
      const pred = predictions[f.id];
      return !pred || pred.home === undefined || pred.away === undefined;
    });

    if (incompleteFixtures.length > 0) {
      setError(`Please enter predictions for all ${incompleteFixtures.length} remaining fixtures`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      for (const fixture of fixtures) {
        const pred = predictions[fixture.id];
        if (pred) {
          await submitPredictionMutation.mutateAsync({
            fixtureId: fixture.id,
            predictedHomeScore: pred.home,
            predictedAwayScore: pred.away,
            isJoker: jokerFixtureId === fixture.id,
          });
        }
      }
      setSuccess('All predictions saved!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      // Error handled in mutation
    }
  };

  const predictedCount = fixtures?.filter((fixture) => predictions[fixture.id]?.home !== undefined && predictions[fixture.id]?.away !== undefined).length || 0;
  const completedCount = fixtures?.filter((fixture) => fixture.status === 'COMPLETED').length || 0;
  const totalPoints = existingPredictions?.reduce((sum: number, prediction: any) => sum + (prediction.points || 0), 0) || 0;
  const predictionsByFixture = React.useMemo(() => {
    const grouped = new Map<number, Prediction[]>();
    for (const prediction of revealedPredictions?.predictions || []) {
      if (!grouped.has(prediction.fixtureId)) grouped.set(prediction.fixtureId, []);
      grouped.get(prediction.fixtureId)!.push(prediction);
    }
    return grouped;
  }, [revealedPredictions]);

  const communityScoreStatsByFixture = React.useMemo(() => {
    const stats = new Map<number, Array<{ score: string; count: number; percentage: number }>>();
    for (const [fixtureId, fixturePredictions] of predictionsByFixture.entries()) {
      const scoreCounts = new Map<string, number>();
      for (const prediction of fixturePredictions) {
        const score = `${prediction.predictedHomeScore}-${prediction.predictedAwayScore}`;
        scoreCounts.set(score, (scoreCounts.get(score) || 0) + 1);
      }
      const total = fixturePredictions.length || 1;
      stats.set(
        fixtureId,
        [...scoreCounts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 3)
          .map(([score, count]) => ({
            score,
            count,
            percentage: Math.round((count / total) * 100),
          }))
      );
    }
    return stats;
  }, [predictionsByFixture]);

  if (matchdayLoading || fixturesLoading) {
    return (
      <div className="min-h-screen bg-stadium flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="prediction-hero mb-6 p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Link to={`/leagues/${leagueId}`} className="mb-5 inline-flex">
                <Button variant="secondary" className="gap-2 bg-white/20 text-white hover:bg-white/30">
                  <ArrowLeft className="h-4 w-4" />
                  Back to League
                </Button>
              </Link>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/18 px-3 py-1 text-sm font-bold text-white">
                {isPredictionsClosed ? <Lock className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                {isPredictionsClosed ? 'Prediction Locked' : `Locks in ${countdownText}`}
              </div>
              <h1 className="text-3xl font-black tracking-normal text-white sm:text-5xl">
                {matchday?.name || 'Matchday'}
              </h1>
              <p className="mt-3 max-w-xl text-sm font-medium text-white/82 sm:text-base">
                {isPredictionsClosed
                  ? 'Predictions are sealed. Check your picks, watch results land, and see how the table moves.'
                  : 'Pick scores, choose one Joker for double points, and submit before the deadline.'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
              <div className="prediction-metric">
                <p className="text-xs font-bold uppercase text-white/70">Predicted</p>
                <p className="text-2xl font-black text-white">{predictedCount}/{fixtures?.length || 0}</p>
              </div>
              <div className="prediction-metric">
                <p className="text-xs font-bold uppercase text-white/70">Points</p>
                <p className="text-2xl font-black text-white">{totalPoints}</p>
              </div>
              <div className="prediction-metric">
                <p className="text-xs font-bold uppercase text-white/70">Results</p>
                <p className="text-2xl font-black text-white">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {matchdaySummary && (
          matchdaySummary.revealed === false ? (
            <div className="designed-empty-state mb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="designed-empty-icon">
                  <Lock className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground">Matchday summary unlocks after the deadline</h3>
                  <p className="text-sm text-muted-foreground">
                    Best predictor, most picked score, and surprise result stay hidden until everyone is locked in.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-black uppercase text-muted-foreground">Best Predictor</p>
                  <p className="mt-1 text-lg font-black text-foreground">{matchdaySummary.bestPredictor?.user?.username || 'Awaiting results'}</p>
                  <p className="text-sm font-bold text-primary">{matchdaySummary.bestPredictor?.points || 0} pts</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-black uppercase text-muted-foreground">Biggest Mover</p>
                  <p className="mt-1 text-lg font-black text-foreground">{matchdaySummary.biggestMover?.user?.username || 'Awaiting results'}</p>
                  <p className="text-sm font-bold text-primary">+{matchdaySummary.biggestMover?.lastMatchdayPoints || 0} pts</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-black uppercase text-muted-foreground">Most Predicted Score</p>
                  <p className="mt-1 text-lg font-black text-foreground">{matchdaySummary.mostPredictedScore?.score || 'No picks yet'}</p>
                  <p className="text-sm font-bold text-primary">{matchdaySummary.mostPredictedScore?.count || 0} picks</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-black uppercase text-muted-foreground">Most Surprising Result</p>
                  <p className="mt-1 text-sm font-black text-foreground">{matchdaySummary.mostSurprisingResult?.label || 'Awaiting results'}</p>
                  <p className="text-sm font-bold text-primary">
                    {matchdaySummary.mostSurprisingResult ? `${Math.round((matchdaySummary.mostSurprisingResult.hitRate || 0) * 100)}% called it` : 'Results pending'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Prediction Status Banner */}
        {isPredictionsClosed ? (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>
              <strong>Predictions are closed.</strong> The deadline was {matchday?.endDate ? new Date(matchday.endDate).toLocaleString() : new Date(matchday?.startDate || '').toLocaleString()}.
            </span>
          </div>
        ) : matchday && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>
                <strong>Predictions are open</strong> until {matchday.endDate ? new Date(matchday.endDate).toLocaleString() : new Date(matchday.startDate).toLocaleString()}
              </span>
            </div>
            <div className="rounded-full bg-white/55 px-4 py-2 text-center text-sm font-black text-slate-900">
              Locks in {countdownText}
            </div>
          </div>
        )}

        {!isPredictionsClosed && fixtures && fixtures.length > 0 && (
          <Card className="bg-card/80 backdrop-blur-sm mb-6">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Joker / high-confidence pick</h3>
                    <p className="text-sm text-muted-foreground">Choose the fixture you trust most this matchday and double its points.</p>
                  </div>
                </div>
                <Badge variant={jokerFixtureId ? 'success' : 'warning'} className="text-sm">
                  {jokerFixtureId ? 'Joker selected' : 'No joker selected'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPredictionsClosed && fixtures && fixtures.length > 0 && existingPredictions && existingPredictions.length === 0 && (
          <div className="designed-empty-state mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="designed-empty-icon">
                  <Target className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground">No predictions submitted yet</h3>
                  <p className="text-sm text-muted-foreground">Fill the score boxes below, pick a Joker, then submit all predictions.</p>
                </div>
              </div>
              <Badge variant="warning" className="w-fit text-sm">Deadline active</Badge>
            </div>
          </div>
        )}

        {/* Points Summary for this matchday */}
        {existingPredictions && existingPredictions.length > 0 && fixtures && fixtures.some((f: Fixture) => f.status === 'COMPLETED') && (
          <Card className="bg-card/80 backdrop-blur-sm mb-6 border-t-4 border-t-primary">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-bold text-foreground">Matchday Points</h3>
                    <p className="text-sm text-muted-foreground">
                      {fixtures.filter((f: Fixture) => f.status === 'COMPLETED').length} of {fixtures.length} fixtures completed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    {existingPredictions.reduce((sum: number, p: any) => sum + (p.points || 0), 0)} pts
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {existingPredictions.filter((p: any) => p.points >= 5).length} exact, {existingPredictions.filter((p: any) => p.points === 3).length} correct outcome
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current user's H2H matchup history */}
        {hasH2h && myMatchups && myMatchups.length > 0 && (() => {
          const current = myMatchups.filter((matchup) => matchup.matchdayId === Number(matchdayId));
          const previousNumber = Math.max(-1, ...myMatchups.filter((matchup) => matchup.matchdayId !== Number(matchdayId)).map((matchup) => matchup.matchdayNumber));
          const previous = myMatchups.filter((matchup) => matchup.matchdayNumber === previousNumber);
          const renderMatchupCard = (title: string, items: H2hMatchup[], previousCard = false) => items.length > 0 ? (
            <Card className={`bg-card/80 backdrop-blur-sm border-t-4 ${previousCard ? 'border-t-slate-400' : 'border-t-amber-500'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {previousCard ? <History className="h-5 w-5 text-slate-500" /> : <Swords className="h-5 w-5 text-amber-500" />}
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {items.map((matchup) => (
                  <div key={matchup.id}>
                    <Badge variant={matchup.format === 'KNOCKOUT' ? 'destructive' : 'warning'} className="mb-2">
                      {matchup.format === 'KNOCKOUT' ? 'Knockout' : 'H2H League'}
                    </Badge>
                    <H2hMatchupRow matchup={matchup} myMatchups={myMatchups} getInitials={getInitials} colorScheme={matchup.format === 'KNOCKOUT' ? 'red' : 'amber'} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null;
          return (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              {renderMatchupCard('Your Current Matchup', current)}
              {renderMatchupCard('Your Previous Matchup', previous, true)}
            </div>
          );
        })()}

        {/* Fixtures Card */}
        <Card className="bg-card/80 backdrop-blur-sm mb-6">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {isPredictionsClosed ? 'Your Predictions' : 'Make Your Predictions'}
              {isPredictionsClosed && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
            {fixtures && fixtures.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadGameweekFixtures} className="gap-1.5">
                <Download className="h-4 w-4" />
                Fixtures
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {fixtures && fixtures.length > 0 ? (
              <div className="space-y-4">
                {fixtures.map((fixture: Fixture) => {
                  const userPrediction = existingPredictions?.find((p: any) => p.fixtureId === fixture.id);
                  const hasPredicted = !!userPrediction;
                  const isCompleted = fixture.status === 'COMPLETED';
                  const points = userPrediction?.points ?? 0;
                  const isJokerFixture = jokerFixtureId === fixture.id || userPrediction?.isJoker;
                  const fixturePredictions = predictionsByFixture.get(fixture.id) || [];
                  const communityStats = communityScoreStatsByFixture.get(fixture.id) || [];
                  const communityRevealed = !!revealedPredictions?.revealed;
                  
                  return (
                    <div
                      key={fixture.id}
                      className={cn(
                        'fixture-strip rounded-lg transition-transform hover:-translate-y-0.5',
                        isJokerFixture && 'prediction-card-joker'
                      )}
                    >
                      {/* Fixture Row */}
                      <div className="grid md:grid-cols-[1fr_15rem]">
                        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                          <div className="flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
                            {renderTeamBadge(fixture.homeTeam)}
                            <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.homeTeam.name}</span>
                          </div>

                          <div className="flex flex-col items-center gap-3">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Badge variant={isCompleted ? 'success' : isPredictionsClosed ? 'warning' : 'secondary'}>
                                {isCompleted ? 'Result Final' : isPredictionsClosed ? 'Locked' : 'Open'}
                              </Badge>
                              <Badge variant={communityRevealed ? 'success' : 'secondary'}>
                                {communityRevealed ? `${fixturePredictions.length} community picks` : 'Picks hidden'}
                              </Badge>
                              {isJokerFixture && (
                                <Badge variant="warning" className="font-black">
                                  <Star className="mr-1 h-3 w-3" />
                                  High confidence 2x
                                </Badge>
                              )}
                            </div>
                            {isCompleted ? (
                              <div className="flex items-center gap-3">
                                <span className="text-4xl font-black text-slate-950">{fixture.homeScore}</span>
                                <span className="text-sm font-black uppercase text-slate-400">FT</span>
                                <span className="text-4xl font-black text-slate-950">{fixture.awayScore}</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <ScoreStepper
                                  label={`${fixture.homeTeam.name} score`}
                                  value={predictions[fixture.id]?.home}
                                  onChange={(score) => setPredictionScore(fixture.id, 'home', score)}
                                  disabled={isPredictionsClosed || isCompleted}
                                />
                                <span className="text-2xl font-black text-slate-400">VS</span>
                                <ScoreStepper
                                  label={`${fixture.awayTeam.name} score`}
                                  value={predictions[fixture.id]?.away}
                                  onChange={(score) => setPredictionScore(fixture.id, 'away', score)}
                                  disabled={isPredictionsClosed || isCompleted}
                                />
                              </div>
                            )}
                            {!isPredictionsClosed && !isCompleted && (
                              <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant={jokerFixtureId === fixture.id ? 'warning' : 'outline'}
                                  onClick={() => setJokerFixtureId(jokerFixtureId === fixture.id ? null : fixture.id)}
                                  className="gap-1"
                                >
                                  <Star className="h-4 w-4" />
                                  {jokerFixtureId === fixture.id ? 'High Confidence 2x' : 'Use Joker'}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitPrediction(fixture.id)}
                                  disabled={submitPredictionMutation.isPending}
                                  className="gap-1"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                            {renderTeamBadge(fixture.awayTeam)}
                            <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.awayTeam.name}</span>
                          </div>
                        </div>

                        <div className="fixture-strip-side flex flex-col items-center justify-center gap-1 px-6 py-5 text-center">
                          <span className="text-sm font-semibold uppercase tracking-normal text-white/85">
                            {fixtureDate ? fixtureDate.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Matchday'}
                          </span>
                          <span className="text-3xl font-black">
                            {isCompleted ? 'RESULT' : fixtureDate ? fixtureDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                          </span>
                          {isPredictionsClosed && !isCompleted && (
                            <span className="text-xs font-bold uppercase text-white/70">Locked</span>
                          )}
                          {isJokerFixture && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase text-white">
                              <Star className="h-3 w-3" />
                              Joker 2x
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Results and Points Row - shown when fixture is completed */}
                      {isCompleted && (
                        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 px-5 py-3">
                          <Badge variant="success" className="text-sm">
                            Final: {fixture.homeScore} - {fixture.awayScore}
                          </Badge>
                          {hasPredicted && (
                            <>
                              <Badge variant="secondary" className="text-sm">
                                Your Prediction: {userPrediction.predictedHomeScore} - {userPrediction.predictedAwayScore}
                              </Badge>
                              <Badge 
                                variant={points >= 5 ? 'success' : points >= 3 ? 'warning' : 'destructive'}
                                className="text-sm font-bold"
                              >
                                +{points} pts
                              </Badge>
                              {userPrediction.isJoker && (
                                <Badge variant="warning" className="text-sm font-bold">
                                  <Star className="h-3 w-3 mr-1" />
                                  Joker doubled
                                </Badge>
                              )}
                            </>
                          )}
                          {!hasPredicted && (
                            <Badge variant="destructive" className="text-sm">
                              No prediction made
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {/* Status indicator for closed but not completed fixtures */}
                      {isPredictionsClosed && !isCompleted && (
                        <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-5 py-3">
                          {hasPredicted ? (
                            <Badge variant="secondary" className="text-sm">
                              Your Prediction: {userPrediction.predictedHomeScore} - {userPrediction.predictedAwayScore}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-sm">
                              No prediction made
                            </Badge>
                          )}
                          <Badge variant="warning" className="text-sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Prediction Locked
                          </Badge>
                          {userPrediction?.isJoker && (
                            <Badge variant="warning" className="text-sm">
                              <Star className="h-3 w-3 mr-1" />
                              Joker 2x
                            </Badge>
                          )}
                        </div>
                      )}

                      {communityRevealed && communityStats.length > 0 && (
                        <div className="border-t border-slate-200 px-5 py-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-black uppercase text-slate-500">Most picked scores</p>
                            <Badge variant="secondary">{fixturePredictions.length} picks</Badge>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {communityStats.map((stat) => (
                              <div key={stat.score} className="rounded-2xl bg-white/55 px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-black text-slate-900">{stat.score}</span>
                                  <span className="text-sm font-black text-teal-700">{stat.percentage}%</span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
                                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${stat.percentage}%` }} />
                                </div>
                                <p className="mt-1 text-[11px] font-bold text-slate-500">{stat.count} pick{stat.count === 1 ? '' : 's'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="designed-empty-state text-left">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="designed-empty-icon">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">No fixtures yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Fixtures for this matchday have not been added. Once an admin adds them, prediction cards will appear here.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isPredictionsClosed && fixtures && fixtures.length > 0 && (
              <div className="mt-6 text-center">
                <Button
                  size="lg"
                  onClick={handleSubmitAll}
                  disabled={submitPredictionMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-5 w-5" />
                  {submitPredictionMutation.isPending ? 'Saving...' : 'Submit All Predictions'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scoring Rules */}
        <Card className="bg-card/80 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              League Prediction Reveal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!revealedPredictions?.revealed ? (
              <div className="designed-empty-state">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="designed-empty-icon">
                    <Lock className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">Other predictions are hidden</h3>
                    <p className="text-sm text-muted-foreground">Everyone's picks unlock fixture-by-fixture after the deadline.</p>
                  </div>
                </div>
              </div>
            ) : fixtures && fixtures.length > 0 ? (
              <div className="space-y-4">
                {fixtures.map((fixture) => {
                  const fixturePredictions = predictionsByFixture.get(fixture.id) || [];
                  const communityStats = communityScoreStatsByFixture.get(fixture.id) || [];
                  return (
                    <div key={fixture.id} className="rounded-[1.25rem] border border-white/60 bg-white/45 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-foreground">{fixture.homeTeam.name} vs {fixture.awayTeam.name}</p>
                        <Badge variant="secondary">{fixturePredictions.length} picks</Badge>
                      </div>
                      {communityStats.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {communityStats.map((stat) => (
                            <div key={stat.score} className="rounded-2xl bg-white/55 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-foreground">{stat.score}</span>
                                <span className="text-sm font-black text-primary">{stat.percentage}%</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${stat.percentage}%` }} />
                              </div>
                              <p className="mt-1 text-[11px] font-bold text-muted-foreground">{stat.count} pick{stat.count === 1 ? '' : 's'}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-3">Scoring Rules</h4>
                <div className="grid gap-2 sm:grid-cols-4">
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
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10">
                    <span className="font-bold text-violet-500 text-lg">2x</span>
                    <span className="text-sm text-muted-foreground">Joker doubles one fixture</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/** Row component for displaying a single H2H matchup */
const H2hMatchupRow: React.FC<{
  matchup: H2hMatchup;
  myMatchups?: H2hMatchup[];
  getInitials: (username: string) => string;
  colorScheme: 'amber' | 'red';
}> = ({ matchup, myMatchups, getInitials, colorScheme }) => {
  const isMyMatchup = myMatchups?.some(m => m.id === matchup.id);
  const colors = colorScheme === 'amber' 
    ? { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-500', highlight: 'bg-amber-500/10' }
    : { bg: 'bg-red-500/5', border: 'border-red-500/30', text: 'text-red-500', highlight: 'bg-red-500/10' };
  
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
      isMyMatchup ? `${colors.highlight} ${colors.border} border-2` : `${colors.bg} border-border`,
    )}>
      {/* Player 1 */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className={cn(
          "text-sm font-medium truncate",
          isMyMatchup ? "text-foreground font-bold" : "text-foreground"
        )}>
          {matchup.player1?.username || 'TBD'}
        </span>
        {matchup.player1 && (
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={matchup.player1.profilePhoto || undefined} />
            <AvatarFallback className="text-[9px]">{getInitials(matchup.player1.username)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* VS / Score */}
      <div className="shrink-0 text-center min-w-[60px]">
        {matchup.resolved ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs font-bold text-foreground">{matchup.player1Points ?? 0}</span>
            <span className="text-xs text-muted-foreground">-</span>
            <span className="text-xs font-bold text-foreground">{matchup.player2Points ?? 0}</span>
            <span className="text-[10px] text-muted-foreground ml-0.5">pts</span>
          </div>
        ) : matchup.player2 ? (
          <span className={cn("text-xs font-bold uppercase", colors.text)}>VS</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">BYE</span>
        )}
      </div>

      {/* Player 2 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {matchup.player2 ? (
          <>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={matchup.player2.profilePhoto || undefined} />
              <AvatarFallback className="text-[9px]">{getInitials(matchup.player2.username)}</AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-sm font-medium truncate",
              isMyMatchup ? "text-foreground font-bold" : "text-foreground"
            )}>
              {matchup.player2.username}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">—</span>
        )}
      </div>

      {/* Knockout round badge */}
      {matchup.knockoutRound && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          {matchup.knockoutRound.replace(/_/g, ' ')}
        </Badge>
      )}

      {/* Your matchup indicator */}
      {isMyMatchup && (
        <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", colorScheme === 'amber' ? "bg-amber-500" : "bg-red-500")}>
          YOU
        </Badge>
      )}

      {/* Winner indicator */}
      {matchup.resolved && matchup.winnerId && (
        <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
      )}
    </div>
  );
};

export default PredictionsPage;
