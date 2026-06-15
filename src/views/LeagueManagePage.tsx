import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Copy, Download, Link2, Save, Search, Star, Swords, Target, UserPlus, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import { leagueManagementApi } from '../api/leagueManagementApi';
import { matchdayApi } from '../api/matchdayApi';
import { fixtureApi } from '../api/fixtureApi';
import { h2hApi } from '../api/h2hApi';
import { guestClaimApi } from '../api/guestClaimApi';
import { createH2hImage, createKnockoutImage, downloadBlob } from '../lib/imageExports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const clampScore = (value: number) => Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));

const LeagueManagePage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const id = Number(leagueId);
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'registered' | 'guest'>('registered');
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, { home: number; away: number }>>({});
  const [jokerFixtureId, setJokerFixtureId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimLinks, setClaimLinks] = useState<Record<number, string>>({});

  const { data: league, isLoading } = useQuery({
    queryKey: ['league', id],
    queryFn: () => leagueApi.getLeagueById(id),
    enabled: Number.isFinite(id),
  });
  const canManage = isAdmin || isSuperAdmin || league?.createdBy.id === user?.id || league?.createdBy.username === user?.username;

  const { data: users = [] } = useQuery({
    queryKey: ['league-manage-users', id, search],
    queryFn: () => leagueManagementApi.searchUsers(id, search),
    enabled: !!canManage && mode === 'registered',
  });
  const { data: matchdays = [] } = useQuery({
    queryKey: ['matchdays', league?.division.id],
    queryFn: () => matchdayApi.getMatchdaysByDivision(league!.division.id),
    enabled: !!league,
  });
  const { data: fixtures = [] } = useQuery({
    queryKey: ['fixtures', selectedMatchdayId],
    queryFn: () => fixtureApi.getFixturesByMatchday(selectedMatchdayId!),
    enabled: !!selectedMatchdayId,
  });
  const { data: memberPredictions } = useQuery({
    queryKey: ['managed-predictions', id, selectedMatchdayId, selectedMemberId],
    queryFn: () => leagueManagementApi.getMemberPredictions(id, selectedMatchdayId!, selectedMemberId!),
    enabled: !!canManage && !!selectedMatchdayId && !!selectedMemberId,
  });
  const { data: allMatchups = [] } = useQuery({
    queryKey: ['managed-all-matchups', id, selectedMatchdayId],
    queryFn: () => h2hApi.getAllMatchupsForMatchday(id, selectedMatchdayId!),
    enabled: !!canManage && !!selectedMatchdayId && !!(league?.h2hLeaderboardEnabled || league?.h2hKnockoutEnabled),
  });

  useEffect(() => {
    if (!memberPredictions) return;
    const next: Record<number, { home: number; away: number }> = {};
    memberPredictions.forEach((prediction) => {
      next[prediction.fixtureId] = { home: prediction.predictedHomeScore, away: prediction.predictedAwayScore };
    });
    setScores(next);
    setJokerFixtureId(memberPredictions.find((prediction) => prediction.isJoker)?.fixtureId ?? null);
  }, [memberPredictions]);

  const addMemberMutation = useMutation({
    mutationFn: () => leagueManagementApi.addMember(id, mode === 'registered'
      ? { userId: selectedUserId! }
      : { displayName: guestName, email: guestEmail || undefined }),
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['league', id] });
      setSelectedMemberId(added.id);
      setSelectedUserId(null);
      setGuestName('');
      setGuestEmail('');
      setMessage(`${added.username} was added to the league.`);
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Could not add member'),
  });

  const savePredictionsMutation = useMutation({
    mutationFn: () => leagueManagementApi.saveMemberPredictions(
      id,
      selectedMatchdayId!,
      selectedMemberId!,
      fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        predictedHomeScore: scores[fixture.id]?.home ?? 0,
        predictedAwayScore: scores[fixture.id]?.away ?? 0,
        isJoker: jokerFixtureId === fixture.id,
      })),
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-predictions', id, selectedMatchdayId, selectedMemberId] });
      setMessage('Member predictions saved.');
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Could not save predictions'),
  });

  const createClaimMutation = useMutation({
    mutationFn: (guestUserId: number) => guestClaimApi.createClaim(id, guestUserId),
    onSuccess: async (claim) => {
      setClaimLinks((previous) => ({ ...previous, [claim.guest.id]: claim.claimUrl }));
      setMessage(`Claim link created for ${claim.guest.username}.`);
      setError(null);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(claim.claimUrl);
        setMessage(`Claim link copied for ${claim.guest.username}.`);
      }
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Could not create claim link'),
  });

  if (isLoading) return <div className="min-h-screen bg-stadium grid place-items-center">Loading league...</div>;
  if (!league) return <Navigate to="/leagues" replace />;
  if (!canManage) return <Navigate to={`/leagues/${id}`} replace />;

  const selectedMatchday = matchdays.find((matchday) => matchday.id === selectedMatchdayId);
  const predictionsOpen = selectedMatchday?.predictionsOpen === true;
  const selectableUsers = users.filter((candidate) => !league.members.some((member) => member.id === candidate.id));

  const updateScore = (fixtureId: number, side: 'home' | 'away', value: number) => {
    setScores((previous) => ({
      ...previous,
      [fixtureId]: {
        home: previous[fixtureId]?.home ?? 0,
        away: previous[fixtureId]?.away ?? 0,
        [side]: clampScore(value),
      },
    }));
  };

  const resetPredictionSelection = () => {
    setScores({});
    setJokerFixtureId(null);
    setMessage(null);
    setError(null);
  };

  const exportName = `${league.name}-${selectedMatchday?.name || 'gameweek'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const leaderboardMatchups = allMatchups.filter((matchup) => matchup.format === 'LEADERBOARD');
  const knockoutMatchups = allMatchups.filter((matchup) => matchup.format === 'KNOCKOUT');

  const downloadAllH2h = async () => {
    if (!leaderboardMatchups.length) return;
    const blob = await createH2hImage(`${league.name} H2H Fixtures`, selectedMatchday?.name || 'Gameweek', leaderboardMatchups);
    downloadBlob(blob, `${exportName}-h2h-fixtures.png`);
  };

  const downloadKnockout = async () => {
    if (!knockoutMatchups.length) return;
    const blob = await createKnockoutImage(`${league.name} ${selectedMatchday?.name || 'Knockout'}`, knockoutMatchups);
    downloadBlob(blob, `${exportName}-knockout.png`);
  };

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to={`/leagues/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" /> Back to league</Link>
            <h1 className="text-3xl font-black text-foreground">Manage {league.name}</h1>
            <p className="text-muted-foreground">Add registered or guest players and submit predictions on their behalf.</p>
          </div>
          <Badge variant="secondary">{league.members.length} members</Badge>
        </div>

        {(message || error) && <div className={`rounded-xl border p-4 ${error ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'}`}>{error || message}</div>}

        <Card className="bg-card/85 backdrop-blur-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Add Member</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-fit rounded-xl bg-muted p-1">
              <Button size="sm" variant={mode === 'registered' ? 'default' : 'ghost'} onClick={() => setMode('registered')}>Registered user</Button>
              <Button size="sm" variant={mode === 'guest' ? 'default' : 'ghost'} onClick={() => setMode('guest')}>Guest user</Button>
            </div>
            {mode === 'registered' ? (
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2"><Label>Search users</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Username or email" /></div></div>
                <div className="space-y-2"><Label>User</Label><Select value={selectedUserId ? String(selectedUserId) : ''} onValueChange={(value) => setSelectedUserId(Number(value))}><SelectTrigger><SelectValue placeholder="Select registered user" /></SelectTrigger><SelectContent>{selectableUsers.map((candidate) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.username} ({candidate.email})</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={() => addMemberMutation.mutate()} disabled={!selectedUserId || addMemberMutation.isPending}>Add user</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2"><Label>Guest name</Label><Input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Display name" /></div>
                <div className="space-y-2"><Label>Email (optional)</Label><Input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="guest@example.com" /></div>
                <Button onClick={() => addMemberMutation.mutate()} disabled={!guestName.trim() || addMemberMutation.isPending}>Add guest</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/85 backdrop-blur-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Predict for a Member</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Member</Label><Select value={selectedMemberId ? String(selectedMemberId) : ''} onValueChange={(value) => { resetPredictionSelection(); setSelectedMemberId(Number(value)); }}><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger><SelectContent>{league.members.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.username}{member.isGuest ? ' (guest)' : ''}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Gameweek</Label><Select value={selectedMatchdayId ? String(selectedMatchdayId) : ''} onValueChange={(value) => { resetPredictionSelection(); setSelectedMatchdayId(Number(value)); }}><SelectTrigger><SelectValue placeholder="Select gameweek" /></SelectTrigger><SelectContent>{matchdays.map((matchday) => <SelectItem key={matchday.id} value={String(matchday.id)}>{matchday.name}{matchday.predictionsOpen ? '' : ' (closed)'}</SelectItem>)}</SelectContent></Select></div>
            </div>

            {selectedMatchdayId && !predictionsOpen && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700">Predictions are closed. Existing predictions are view-only.</div>}
            {selectedMemberId && selectedMatchdayId && fixtures.map((fixture) => (
              <div key={fixture.id} className={`fixture-strip rounded-xl p-4 ${jokerFixtureId === fixture.id ? 'ring-2 ring-amber-400' : ''}`}>
                <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
                  <span className="text-center font-black sm:text-right">{fixture.homeTeam.name}</span>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={99} disabled={!predictionsOpen} className="w-20 text-center text-lg font-black" value={scores[fixture.id]?.home ?? 0} onChange={(event) => updateScore(fixture.id, 'home', Number(event.target.value))} />
                    <span className="font-black text-muted-foreground">VS</span>
                    <Input type="number" min={0} max={99} disabled={!predictionsOpen} className="w-20 text-center text-lg font-black" value={scores[fixture.id]?.away ?? 0} onChange={(event) => updateScore(fixture.id, 'away', Number(event.target.value))} />
                  </div>
                  <span className="text-center font-black sm:text-left">{fixture.awayTeam.name}</span>
                </div>
                <div className="mt-3 flex justify-center">
                  <Button type="button" size="sm" variant={jokerFixtureId === fixture.id ? 'warning' : 'outline'} disabled={!predictionsOpen} onClick={() => setJokerFixtureId(jokerFixtureId === fixture.id ? null : fixture.id)} className="gap-1.5"><Star className="h-4 w-4" /> {jokerFixtureId === fixture.id ? 'Joker selected (2x)' : 'Use Joker'}</Button>
                </div>
              </div>
            ))}
            {selectedMemberId && selectedMatchdayId && fixtures.length > 0 && (
              <Button className="gap-2" onClick={() => savePredictionsMutation.mutate()} disabled={!predictionsOpen || savePredictionsMutation.isPending}><Save className="h-4 w-4" /> Save all predictions</Button>
            )}
            {!selectedMemberId || !selectedMatchdayId ? <p className="text-muted-foreground">Select a member and gameweek to load fixtures.</p> : null}
            {savePredictionsMutation.isSuccess && <p className="flex items-center gap-2 text-sm font-bold text-primary"><CheckCircle className="h-4 w-4" /> Predictions saved</p>}
          </CardContent>
        </Card>

        {league.members.some((member) => member.isGuest) && (
          <Card className="bg-card/85 backdrop-blur-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Guest Claim Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">When a guest creates an account, send them a claim link so their predictions, standings, H2H records, and league memberships move to that account.</p>
              {league.members.filter((member) => member.isGuest).map((member) => (
                <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-foreground">{member.username}</p>
                    {claimLinks[member.id] && <p className="mt-1 truncate text-xs text-muted-foreground">{claimLinks[member.id]}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => createClaimMutation.mutate(member.id)} disabled={createClaimMutation.isPending}>
                      <Link2 className="h-4 w-4" />
                      Create Link
                    </Button>
                    {claimLinks[member.id] && (
                      <Button variant="secondary" size="sm" className="gap-1.5" onClick={async () => {
                        await navigator.clipboard?.writeText(claimLinks[member.id]);
                        setMessage(`Claim link copied for ${member.username}.`);
                      }}>
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(league.h2hLeaderboardEnabled || league.h2hKnockoutEnabled) && (
          <Card className="bg-card/85 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><Swords className="h-5 w-5 text-primary" /> All Gameweek Matchups</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {leaderboardMatchups.length > 0 && <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadAllH2h}><Download className="h-4 w-4" /> H2H image</Button>}
                  {knockoutMatchups.length > 0 && <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadKnockout}><Download className="h-4 w-4" /> Knockout image</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md space-y-2">
                <Label>Gameweek</Label>
                <Select value={selectedMatchdayId ? String(selectedMatchdayId) : ''} onValueChange={(value) => { resetPredictionSelection(); setSelectedMatchdayId(Number(value)); }}>
                  <SelectTrigger><SelectValue placeholder="Select gameweek to view all matchups" /></SelectTrigger>
                  <SelectContent>{matchdays.map((matchday) => <SelectItem key={matchday.id} value={String(matchday.id)}>{matchday.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!selectedMatchdayId ? (
                <p className="text-muted-foreground">Select a gameweek to view and download every matchup.</p>
              ) : allMatchups.length === 0 ? (
                <p className="text-muted-foreground">No H2H matchups are available for this gameweek.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {[
                    { title: 'H2H League', icon: <Swords className="h-5 w-5 text-amber-500" />, items: leaderboardMatchups },
                    { title: 'Knockout', icon: <Target className="h-5 w-5 text-red-500" />, items: knockoutMatchups },
                  ].filter((group) => group.items.length > 0).map((group) => (
                    <div key={group.title} className="rounded-[1.25rem] border border-white/60 bg-white/40 p-4">
                      <h3 className="mb-3 flex items-center gap-2 font-black text-foreground">{group.icon}{group.title}</h3>
                      <div className="space-y-2">
                        {group.items.map((matchup) => (
                          <div key={matchup.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-white/60 px-3 py-3 text-sm">
                            <span className="truncate text-right font-bold">{matchup.player1?.username || 'TBD'}</span>
                            <span className="rounded-full bg-primary/10 px-3 py-1 font-black text-primary">{matchup.resolved ? `${matchup.player1Points ?? 0} - ${matchup.player2Points ?? 0}` : 'VS'}</span>
                            <span className="truncate font-bold">{matchup.player2?.username || 'BYE'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LeagueManagePage;
