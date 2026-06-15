import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus, Users, Trophy, ChevronRight, Hash, Swords, Target } from 'lucide-react';
import { leagueApi } from '../api/leagueApi';
import { adminApi } from '../api/adminApi';
import { Division } from '../types/league.types';
import Navbar from '../components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LeaguesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledInvite = React.useRef<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    divisionId: 0,
    overallStandingsEnabled: true,
    h2hLeaderboardEnabled: false,
    h2hKnockoutEnabled: false,
  });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const { data: leagues = [], isLoading } = useQuery({
    queryKey: ['userLeagues'],
    queryFn: leagueApi.getUserLeagues,
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: adminApi.getAllDivisions,
  });

  const createMutation = useMutation({
    mutationFn: leagueApi.createLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLeagues'] });
      setShowCreateModal(false);
      setCreateData({ name: '', divisionId: 1, overallStandingsEnabled: true, h2hLeaderboardEnabled: false, h2hKnockoutEnabled: false });
    },
  });

  const joinMutation = useMutation({
    mutationFn: leagueApi.joinLeague,
    onSuccess: (joinedLeague) => {
      queryClient.invalidateQueries({ queryKey: ['userLeagues'] });
      setShowJoinModal(false);
      setJoinCode('');
      setJoinError('');
      navigate(`/leagues/${joinedLeague.id}`, { replace: true });
    },
    onError: (error: any) => {
      setJoinError(error.response?.data?.message || 'Failed to join league');
      setShowJoinModal(true);
    },
  });

  React.useEffect(() => {
    const inviteCode = searchParams.get('join')?.toUpperCase().slice(0, 6);
    if (!inviteCode || handledInvite.current === inviteCode) return;
    handledInvite.current = inviteCode;
    setJoinCode(inviteCode);
    joinMutation.mutate({ code: inviteCode });
  }, [searchParams]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createData);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinMutation.mutate({ code: joinCode.toUpperCase() });
  };

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              My Leagues
            </h1>
            <p className="text-muted-foreground mt-1">Manage your prediction leagues</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => {
              setCreateData({ name: '', divisionId: 0, overallStandingsEnabled: true, h2hLeaderboardEnabled: false, h2hKnockoutEnabled: false });
              queryClient.invalidateQueries({ queryKey: ['divisions'] });
              setShowCreateModal(true);
            }} className="gap-2">
              <Plus className="h-4 w-4" />
              Create League
            </Button>
            <Button onClick={() => setShowJoinModal(true)} variant="warning" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Join League
            </Button>
          </div>
        </div>

        {/* Leagues Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : leagues && Array.isArray(leagues) && leagues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {leagues.map((league) => (
              <Card key={league.id} className="league-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="league-card-mark">
                      {league.division?.logoUrl ? (
                        <img src={league.division.logoUrl} alt={`${league.division.name} logo`} className="h-11 w-11 object-contain" />
                      ) : (
                        <Trophy className="h-7 w-7" />
                      )}
                    </div>
                    <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-black text-primary">
                      {league.code}
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-2xl">
                    {league.name}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {league.members.length} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      {league.division?.name}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/40 p-2">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Players</p>
                      <p className="text-lg font-black text-foreground">{league.members.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Formats</p>
                      <p className="text-lg font-black text-foreground">
                        {[league.overallStandingsEnabled, league.h2hLeaderboardEnabled, league.h2hKnockoutEnabled].filter(Boolean).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Code</p>
                      <p className="text-lg font-black text-foreground">{league.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
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
                  <Link to={`/leagues/${league.id}`}>
                    <Button className="w-full gap-2">
                      View League
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="designed-empty-state">
            <CardContent className="grid gap-8 p-0 lg:grid-cols-[1fr_22rem] lg:items-center">
              <div>
                <div className="designed-empty-icon mb-4">
                  <Trophy className="h-8 w-8" />
                </div>
                <h3 className="text-3xl font-semibold text-foreground mb-2">Build your first competition</h3>
                <p className="text-muted-foreground mb-6 max-w-xl">
                  Create a league for your group or join with an invite code. Once fixtures are live, everyone predicts scores and races up the table.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => {
                    setCreateData({ name: '', divisionId: 0, overallStandingsEnabled: true, h2hLeaderboardEnabled: false, h2hKnockoutEnabled: false });
                    queryClient.invalidateQueries({ queryKey: ['divisions'] });
                    setShowCreateModal(true);
                  }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create League
                  </Button>
                  <Button onClick={() => setShowJoinModal(true)} variant="outline" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Join League
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/60 bg-white/40 p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Sample league</p>
                    <h4 className="text-lg font-bold">Weekend Legends</h4>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">6 members</span>
                </div>
                <div className="space-y-3">
                  {[
                    ['Andrea', 21],
                    ['Maya', 17],
                    ['Sam', 14],
                  ].map(([name, points], index) => (
                    <div key={name} className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2">
                      <span className="text-sm font-semibold">{index + 1}. {name}</span>
                      <span className="text-sm font-bold text-primary">{points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create League Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Create League
              </DialogTitle>
              <DialogDescription>
                Create a new prediction league and invite your friends
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leagueName">League Name</Label>
                <Input
                  id="leagueName"
                  type="text"
                  placeholder="Enter league name"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="division">Division</Label>
                <Select
                  value={createData.divisionId ? String(createData.divisionId) : ''}
                  onValueChange={(value) => setCreateData({ ...createData, divisionId: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((div: Division) => (
                      <SelectItem key={div.id} value={String(div.id)}>{div.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label>Competition Formats</Label>
                <p className="text-sm text-muted-foreground">Select at least one format for your league</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createData.overallStandingsEnabled}
                      onChange={(e) => setCreateData({ ...createData, overallStandingsEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-medium text-foreground">Overall Standings</span>
                        <p className="text-xs text-muted-foreground">Classic leaderboard based on prediction points</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createData.h2hLeaderboardEnabled}
                      onChange={(e) => setCreateData({ ...createData, h2hLeaderboardEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-amber-500" />
                      <div>
                        <span className="font-medium text-foreground">H2H Leaderboard</span>
                        <p className="text-xs text-muted-foreground">Round-robin head-to-head matchups each week</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createData.h2hKnockoutEnabled}
                      onChange={(e) => setCreateData({ ...createData, h2hKnockoutEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-500" />
                      <div>
                        <span className="font-medium text-foreground">H2H Knockout</span>
                        <p className="text-xs text-muted-foreground">Bracket-style elimination tournament</p>
                      </div>
                    </div>
                  </label>
                </div>
                {!createData.overallStandingsEnabled && !createData.h2hLeaderboardEnabled && !createData.h2hKnockoutEnabled && (
                  <p className="text-sm text-destructive">Please select at least one format</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || !createData.divisionId || (!createData.overallStandingsEnabled && !createData.h2hLeaderboardEnabled && !createData.h2hKnockoutEnabled)}>
                {createMutation.isPending ? 'Creating...' : 'Create League'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Join League Modal */}
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-500" />
                Join League
              </DialogTitle>
              <DialogDescription>
                Enter the 6-character code to join an existing league
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">League Code</Label>
                <Input
                  id="joinCode"
                  type="text"
                  placeholder="Enter 6-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  className="uppercase tracking-widest text-center text-lg font-mono"
                />
              </div>
              {joinError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {joinError}
                </div>
              )}
              <Button type="submit" variant="warning" className="w-full" disabled={joinMutation.isPending}>
                {joinMutation.isPending ? 'Joining...' : 'Join League'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LeaguesPage;
