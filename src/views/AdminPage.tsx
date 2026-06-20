import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Calendar, Target, Trophy, Save, CheckCircle, AlertTriangle, Plus, Trash2, Layers, Users, ImageIcon, UserPlus, Star, Clock3, Globe2 } from 'lucide-react';
import { adminApi, CreateMatchdayRequest, CreateFixtureRequest, UpdateResultRequest, CreateDivisionRequest, CreateTeamRequest, AdminPredictionInput } from '../api/adminApi';
import { matchdayApi } from '../api/matchdayApi';
import { fixtureApi } from '../api/fixtureApi';
import { Division, Team, Sport } from '../types/league.types';
import { Matchday } from '../types/matchday.types';
import { Fixture } from '../types/fixture.types';
import Navbar from '../components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getFixtureKickoffTime, isFixturePredictionOpen } from '../lib/predictionDeadlines';

type AdminTab = 'divisions' | 'teams' | 'matchdays' | 'fixtures' | 'results' | 'league-members';

const clampScore = (value: number) => Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));
const getTeamToken = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const toUtcIsoString = (localDateTime: string) => new Date(localDateTime).toISOString();

const toLocalDateTimeInput = (isoDateTime?: string) => {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const DateTimeField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}> = ({ id, label, value, onChange, required }) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  const preview = value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(value))
    : null;

  return (
    <div className="space-y-2 rounded-2xl border border-white/60 bg-white/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700">
          <Globe2 className="h-3 w-3" /> {timeZone}
        </span>
      </div>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        {preview || 'Choose a date and time in your current timezone.'}
      </p>
    </div>
  );
};

const AdminScoreStepper: React.FC<{
  label: string;
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled = false }) => {
  const currentValue = value ?? 0;
  return (
    <div className="prediction-stepper">
      <span className="sr-only">{label}</span>
      <button type="button" disabled={disabled} aria-label={`Decrease ${label}`} onClick={() => onChange(clampScore(currentValue - 1))}>
        -
      </button>
      <input
        type="number"
        min={0}
        max={99}
        value={value ?? ''}
        placeholder="0"
        disabled={disabled}
        onChange={(event) => onChange(clampScore(Number.parseInt(event.target.value || '0', 10)))}
      />
      <button type="button" disabled={disabled} aria-label={`Increase ${label}`} onClick={() => onChange(clampScore(currentValue + 1))}>
        +
      </button>
    </div>
  );
};

const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('divisions');
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedLeagueMatchdayId, setSelectedLeagueMatchdayId] = useState<number | null>(null);
  const [selectedLeagueMemberId, setSelectedLeagueMemberId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);

  // Division form state
  const [divisionForm, setDivisionForm] = useState({
    name: '',
    code: '',
    sportId: 0,
    logoPath: '',
    logoPreviewUrl: '',
  });
  const [divisionEdits, setDivisionEdits] = useState<Record<number, { name: string; code: string; logoPath: string; logoPreviewUrl: string }>>({});

  // Team form state
  const [teamForm, setTeamForm] = useState({
    name: '',
    code: '',
    badgePath: '',
    badgePreviewUrl: '',
  });
  const [teamEdits, setTeamEdits] = useState<Record<number, { name: string; code: string; badgePath: string; badgePreviewUrl: string }>>({});

  // Matchday form state
  const [matchdayForm, setMatchdayForm] = useState({
    name: '',
    number: 1,
    startDate: '',
  });

  // Fixture form state
  const [fixtureForm, setFixtureForm] = useState({
    homeTeamId: 0,
    awayTeamId: 0,
    kickoffAt: '',
    displayOrder: 0,
  });
  const [fixtureTeamSearch, setFixtureTeamSearch] = useState('');
  const [bulkFixturesText, setBulkFixturesText] = useState('');

  // Result form state
  const [resultForm, setResultForm] = useState<{ [key: number]: { homeScore: number; awayScore: number } }>({});
  const [memberMode, setMemberMode] = useState<'registered' | 'guest'>('registered');
  const [memberForm, setMemberForm] = useState({
    userId: 0,
    displayName: '',
    email: '',
  });
  const [adminPredictions, setAdminPredictions] = useState<Record<number, { home: number; away: number }>>({});
  const [adminJokerFixtureId, setAdminJokerFixtureId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Queries
  const { data: sports } = useQuery({
    queryKey: ['sports'],
    queryFn: adminApi.getAllSports,
  });

  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: adminApi.getAllDivisions,
  });

  const { data: adminLeagues } = useQuery({
    queryKey: ['adminLeagues'],
    queryFn: adminApi.getAllLeagues,
  });

  const selectedLeague = adminLeagues?.find((league) => league.id === selectedLeagueId);

  const { data: registeredUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminApi.getUsers(),
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', selectedDivisionId],
    queryFn: () => adminApi.getTeamsByDivision(selectedDivisionId!),
    enabled: !!selectedDivisionId,
  });

  const { data: matchdays } = useQuery({
    queryKey: ['matchdays', selectedDivisionId],
    queryFn: () => matchdayApi.getMatchdaysByDivision(selectedDivisionId!),
    enabled: !!selectedDivisionId,
  });

  const { data: fixtures } = useQuery({
    queryKey: ['fixtures', selectedMatchdayId],
    queryFn: () => fixtureApi.getFixturesByMatchday(selectedMatchdayId!),
    enabled: !!selectedMatchdayId,
  });

  const { data: leagueMatchdays } = useQuery({
    queryKey: ['leagueMatchdays', selectedLeague?.division?.id],
    queryFn: () => matchdayApi.getMatchdaysByDivision(selectedLeague!.division.id),
    enabled: !!selectedLeague?.division?.id,
  });

  const selectedLeagueMatchday = leagueMatchdays?.find((matchday) => matchday.id === selectedLeagueMatchdayId);

  const { data: leagueFixtures } = useQuery({
    queryKey: ['leagueFixtures', selectedLeagueMatchdayId],
    queryFn: () => fixtureApi.getFixturesByMatchday(selectedLeagueMatchdayId!),
    enabled: !!selectedLeagueMatchdayId,
  });
  const openLeagueFixtures = React.useMemo(
    () => (leagueFixtures || []).filter((fixture) => isFixturePredictionOpen(fixture, selectedLeagueMatchday, currentTime)),
    [leagueFixtures, selectedLeagueMatchday, currentTime]
  );
  const adminPredictionsLocked = !!leagueFixtures?.length && openLeagueFixtures.length === 0;

  const { data: selectedMemberPredictions } = useQuery({
    queryKey: ['adminMemberPredictions', selectedLeagueId, selectedLeagueMatchdayId, selectedLeagueMemberId],
    queryFn: () => adminApi.getMemberPredictions(selectedLeagueId!, selectedLeagueMatchdayId!, selectedLeagueMemberId!),
    enabled: !!selectedLeagueId && !!selectedLeagueMatchdayId && !!selectedLeagueMemberId,
  });

  // Division Mutations
  const createDivisionMutation = useMutation({
    mutationFn: adminApi.createDivision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setSuccess('Division created successfully!');
      setDivisionForm({ name: '', code: '', sportId: 0, logoPath: '', logoPreviewUrl: '' });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create division');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateDivisionMutation = useMutation({
    mutationFn: ({ divisionId, request }: { divisionId: number; request: Partial<CreateDivisionRequest> }) =>
      adminApi.updateDivision(divisionId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setDivisionEdits((prev) => {
        const next = { ...prev };
        delete next[variables.divisionId];
        return next;
      });
      setSuccess('Division updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update division');
      setTimeout(() => setError(null), 5000);
    },
  });

  const deleteDivisionMutation = useMutation({
    mutationFn: adminApi.deleteDivision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setSuccess('Division deleted successfully!');
      setSelectedDivisionId(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to delete division');
      setTimeout(() => setError(null), 5000);
    },
  });

  // Team Mutations
  const createTeamMutation = useMutation({
    mutationFn: adminApi.createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSuccess('Team created successfully!');
      setTeamForm({ name: '', code: '', badgePath: '', badgePreviewUrl: '' });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create team');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ teamId, request }: { teamId: number; request: Partial<CreateTeamRequest> }) =>
      adminApi.updateTeam(teamId, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setTeamEdits((prev) => {
        const next = { ...prev };
        delete next[variables.teamId];
        return next;
      });
      setSuccess('Team updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update team');
      setTimeout(() => setError(null), 5000);
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: adminApi.deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSuccess('Team removed from division successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to remove team');
      setTimeout(() => setError(null), 5000);
    },
  });

  // Matchday Mutations
  const createMatchdayMutation = useMutation({
    mutationFn: adminApi.createMatchday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchdays'] });
      setSuccess('Matchday created successfully!');
      setMatchdayForm({ name: '', number: 1, startDate: '' });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create matchday');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateMatchdayStatusMutation = useMutation({
    mutationFn: ({ matchdayId, status }: { matchdayId: number; status: string }) =>
      adminApi.updateMatchdayStatus(matchdayId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchdays'] });
      setSuccess('Matchday status updated!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update status');
      setTimeout(() => setError(null), 5000);
    },
  });

  const createFixtureMutation = useMutation({
    mutationFn: adminApi.createFixture,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setSuccess('Fixture created successfully!');
      setFixtureForm({ homeTeamId: 0, awayTeamId: 0, kickoffAt: '', displayOrder: 0 });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create fixture');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateResultMutation = useMutation({
    mutationFn: ({ fixtureId, request }: { fixtureId: number; request: UpdateResultRequest }) =>
      adminApi.updateFixtureResult(fixtureId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setSuccess('Result updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update result');
      setTimeout(() => setError(null), 5000);
    },
  });

  const bulkCreateFixturesMutation = useMutation({
    mutationFn: (fixtures: Array<{ homeTeamId: number; awayTeamId: number; kickoffAt?: string }>) => {
      if (!selectedMatchdayId) throw new Error('Please select a matchday first');
      return adminApi.bulkCreateFixtures(selectedMatchdayId, fixtures);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setBulkFixturesText('');
      setSuccess('Fixtures uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || err.response?.data?.message || 'Failed to upload fixtures');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateFixtureMetadataMutation = useMutation({
    mutationFn: ({ fixtureId, request }: { fixtureId: number; request: { kickoffAt?: string | null; displayOrder?: number } }) =>
      adminApi.updateFixtureMetadata(fixtureId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setSuccess('Fixture updated!');
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const reorderFixturesMutation = useMutation({
    mutationFn: (orders: Array<{ fixtureId: number; displayOrder: number }>) => adminApi.reorderFixtures(orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setSuccess('Fixtures reordered!');
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const addLeagueMemberMutation = useMutation({
    mutationFn: () => {
      if (!selectedLeagueId) throw new Error('Please select a league first');
      if (memberMode === 'registered') {
        if (!memberForm.userId) throw new Error('Please select a registered user');
        return adminApi.addLeagueMember(selectedLeagueId, { userId: memberForm.userId });
      }
      if (!memberForm.displayName.trim()) throw new Error('Guest display name is required');
      return adminApi.addLeagueMember(selectedLeagueId, {
        displayName: memberForm.displayName.trim(),
        email: memberForm.email.trim() || undefined,
      });
    },
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ['adminLeagues'] });
      queryClient.invalidateQueries({ queryKey: ['league', String(selectedLeagueId)] });
      setSelectedLeagueMemberId(member.id);
      setMemberForm({ userId: 0, displayName: '', email: '' });
      setSuccess('League member added successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || err.response?.data?.message || 'Failed to add league member');
      setTimeout(() => setError(null), 5000);
    },
  });

  const saveMemberPredictionsMutation = useMutation({
    mutationFn: (predictions: AdminPredictionInput[]) => {
      if (!selectedLeagueId || !selectedLeagueMatchdayId || !selectedLeagueMemberId) {
        throw new Error('Please select a league, matchday, and member first');
      }
      return adminApi.saveMemberPredictions(
        selectedLeagueId,
        selectedLeagueMatchdayId,
        selectedLeagueMemberId,
        predictions
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMemberPredictions'] });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
      queryClient.invalidateQueries({ queryKey: ['h2hStandings'] });
      setSuccess('Member predictions saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.message || err.response?.data?.message || 'Failed to save predictions');
      setTimeout(() => setError(null), 5000);
    },
  });

  useEffect(() => {
    if (!leagueFixtures) return;
    const loaded: Record<number, { home: number; away: number }> = {};
    const existingJoker = selectedMemberPredictions?.find((prediction) => prediction.isJoker);
    for (const fixture of leagueFixtures) {
      const existing = selectedMemberPredictions?.find((prediction) => prediction.fixtureId === fixture.id);
      loaded[fixture.id] = {
        home: existing?.predictedHomeScore ?? 0,
        away: existing?.predictedAwayScore ?? 0,
      };
    }
    setAdminPredictions(loaded);
    setAdminJokerFixtureId(existingJoker?.fixtureId ?? null);
  }, [leagueFixtures, selectedMemberPredictions]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Handlers
  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!divisionForm.name.trim()) {
      setError('Division name is required');
      return;
    }
    if (!divisionForm.code.trim()) {
      setError('Division code is required');
      return;
    }
    if (!divisionForm.sportId) {
      setError('Please select a sport');
      return;
    }
    
    const request: CreateDivisionRequest = {
      name: divisionForm.name,
      code: divisionForm.code,
      sportId: divisionForm.sportId,
      logoPath: divisionForm.logoPath || undefined,
    };
    createDivisionMutation.mutate(request);
  };

  const getDivisionDraft = (division: Division) => (
    divisionEdits[division.id] ?? {
      name: division.name,
      code: division.code,
      logoPath: division.logoPath ?? '',
      logoPreviewUrl: division.logoUrl ?? '',
    }
  );

  const setDivisionDraft = (division: Division, updates: Partial<{ name: string; code: string; logoPath: string; logoPreviewUrl: string }>) => {
    const draft = getDivisionDraft(division);
    setDivisionEdits((prev) => ({
      ...prev,
      [division.id]: { ...draft, ...updates },
    }));
  };

  const handleUpdateDivision = (division: Division) => {
    const draft = getDivisionDraft(division);
    if (!draft.name.trim()) {
      setError('Division name is required');
      return;
    }
    if (!draft.code.trim()) {
      setError('Division code is required');
      return;
    }

    updateDivisionMutation.mutate({
      divisionId: division.id,
      request: {
        name: draft.name.trim(),
        code: draft.code.trim().toUpperCase(),
        logoPath: draft.logoPath,
      },
    });
  };

  const handleDeleteDivision = (divisionId: number) => {
    if (window.confirm('Are you sure you want to delete this division? This will also delete all teams, matchdays, and fixtures in this division.')) {
      deleteDivisionMutation.mutate(divisionId);
    }
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedDivisionId) {
      setError('Please select a division first');
      return;
    }
    if (!teamForm.name.trim()) {
      setError('Team name is required');
      return;
    }
    if (!teamForm.code.trim()) {
      setError('Team code is required');
      return;
    }
    
    const request: CreateTeamRequest = {
      name: teamForm.name,
      code: teamForm.code,
      divisionId: selectedDivisionId,
      badgePath: teamForm.badgePath || undefined,
    };
    createTeamMutation.mutate(request);
  };

  const getTeamDraft = (team: Team) => (
    teamEdits[team.id] ?? {
      name: team.name,
      code: team.code,
      badgePath: team.badgePath ?? '',
      badgePreviewUrl: team.badgeUrl ?? '',
    }
  );

  const setTeamDraft = (team: Team, updates: Partial<{ name: string; code: string; badgePath: string; badgePreviewUrl: string }>) => {
    const draft = getTeamDraft(team);
    setTeamEdits((prev) => ({
      ...prev,
      [team.id]: { ...draft, ...updates },
    }));
  };

  const handleUpdateTeam = (team: Team) => {
    const draft = getTeamDraft(team);
    if (!draft.name.trim()) {
      setError('Team name is required');
      return;
    }
    if (!draft.code.trim()) {
      setError('Team code is required');
      return;
    }

    updateTeamMutation.mutate({
      teamId: team.id,
      request: {
        name: draft.name.trim(),
        code: draft.code.trim().toUpperCase(),
        divisionId: selectedDivisionId ?? team.division?.id,
        badgePath: draft.badgePath,
      },
    });
  };

  const handleDeleteTeam = (teamId: number) => {
    if (window.confirm('Are you sure you want to remove this team from the division?')) {
      deleteTeamMutation.mutate(teamId);
    }
  };

  const handleCreateMatchday = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedDivisionId) {
      setError('Please select a division first');
      return;
    }
    if (!matchdayForm.name.trim()) {
      setError('Matchday name is required');
      return;
    }
    if (!matchdayForm.number || matchdayForm.number < 1) {
      setError('Matchday number must be at least 1');
      return;
    }
    if (!matchdayForm.startDate) {
      setError('Start date is required');
      return;
    }
    
    const request: CreateMatchdayRequest = {
      name: matchdayForm.name,
      number: matchdayForm.number,
      divisionId: selectedDivisionId,
      startDate: toUtcIsoString(matchdayForm.startDate),
    };
    createMatchdayMutation.mutate(request);
  };

  const handleCreateFixture = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedDivisionId) {
      setError('Please select a division first');
      return;
    }
    if (!selectedMatchdayId) {
      setError('Please select a matchday first');
      return;
    }
    if (!fixtureForm.homeTeamId || fixtureForm.homeTeamId === 0) {
      setError('Please select a home team');
      return;
    }
    if (!fixtureForm.awayTeamId || fixtureForm.awayTeamId === 0) {
      setError('Please select an away team');
      return;
    }
    if (fixtureForm.homeTeamId === fixtureForm.awayTeamId) {
      setError('Home and away teams must be different');
      return;
    }
    
    const request: CreateFixtureRequest = {
      matchdayId: selectedMatchdayId,
      homeTeamId: fixtureForm.homeTeamId,
      awayTeamId: fixtureForm.awayTeamId,
      kickoffAt: fixtureForm.kickoffAt ? new Date(fixtureForm.kickoffAt).toISOString() : undefined,
      displayOrder: fixtureForm.displayOrder || undefined,
    };
    createFixtureMutation.mutate(request);
  };

  const handleBulkFixtureUpload = () => {
    if (!teams || !selectedMatchdayId) {
      setError('Please select a division and matchday first');
      return;
    }
    const teamLookup = new Map<string, Team>();
    teams.forEach((team) => {
      teamLookup.set(team.name.toLowerCase(), team);
      teamLookup.set(team.code.toLowerCase(), team);
    });

    const rows = bulkFixturesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const fixturesToCreate = rows.map((line) => {
        const [homeRaw, awayRaw, kickoffRaw] = line.split(',').map((part) => part.trim());
        const home = teamLookup.get((homeRaw || '').toLowerCase());
        const away = teamLookup.get((awayRaw || '').toLowerCase());
        if (!home || !away || home.id === away.id) {
          throw new Error(`Could not parse fixture row: ${line}`);
        }
        return {
          homeTeamId: home.id,
          awayTeamId: away.id,
          kickoffAt: kickoffRaw ? new Date(kickoffRaw).toISOString() : undefined,
        };
      });

      bulkCreateFixturesMutation.mutate(fixturesToCreate);
    } catch (err: any) {
      setError(err.message || 'Could not parse fixture upload');
      setTimeout(() => setError(null), 5000);
    }
  };

  const moveFixture = (fixtureId: number, direction: -1 | 1) => {
    if (!fixtures) return;
    const ordered = [...fixtures].sort((a, b) => (a.displayOrder || a.id) - (b.displayOrder || b.id));
    const index = ordered.findIndex((fixture) => fixture.id === fixtureId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[index], swapped[targetIndex]] = [swapped[targetIndex], swapped[index]];
    reorderFixturesMutation.mutate(swapped.map((fixture, nextIndex) => ({ fixtureId: fixture.id, displayOrder: nextIndex + 1 })));
  };

  const handleUpdateResult = (fixtureId: number) => {
    const result = resultForm[fixtureId];
    if (result === undefined) {
      setError('Please enter both scores');
      return;
    }
    updateResultMutation.mutate({
      fixtureId,
      request: { homeScore: result.homeScore, awayScore: result.awayScore },
    });
  };

  const handleStatusChange = (matchdayId: number, status: string) => {
    updateMatchdayStatusMutation.mutate({ matchdayId, status });
  };

  const handleAdminPredictionChange = (fixtureId: number, side: 'home' | 'away', value: string) => {
    setAdminPredictionScore(fixtureId, side, Number.parseInt(value || '0', 10));
  };

  const setAdminPredictionScore = (fixtureId: number, side: 'home' | 'away', score: number) => {
    setAdminPredictions((prev) => ({
      ...prev,
      [fixtureId]: {
        home: prev[fixtureId]?.home ?? 0,
        away: prev[fixtureId]?.away ?? 0,
        [side]: clampScore(score),
      },
    }));
  };

  const handleSaveMemberPredictions = () => {
    if (!openLeagueFixtures.length) {
      setError('No fixtures are currently open for prediction entry.');
      return;
    }
    if (!leagueFixtures || leagueFixtures.length === 0) {
      setError('No fixtures found for this matchday');
      return;
    }

    const predictions = openLeagueFixtures.map((fixture) => ({
      fixtureId: fixture.id,
      predictedHomeScore: adminPredictions[fixture.id]?.home ?? 0,
      predictedAwayScore: adminPredictions[fixture.id]?.away ?? 0,
      isJoker: adminJokerFixtureId === fixture.id,
    }));
    saveMemberPredictionsMutation.mutate(predictions);
  };

  const handleAssetUpload = async (
    file: File | undefined,
    assetType: 'division-logo' | 'team-badge',
    entityId: number | undefined,
    onUploaded: (asset: { path: string; publicUrl: string }) => void
  ) => {
    if (!file) return;
    setError(null);
    setUploadingAsset(`${assetType}-${entityId ?? 'new'}`);

    try {
      const asset = await adminApi.uploadAsset(file, assetType, entityId);
      onUploaded(asset);
      setSuccess('Image uploaded successfully. Save the record to keep it.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload image');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploadingAsset(null);
    }
  };

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

  const renderAdminEmpty = (icon: React.ReactNode, title: string, message: string) => (
    <div className="designed-empty-state">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="designed-empty-icon">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-500" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage matchdays, fixtures, and results</p>
        </div>

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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
          <TabsList className="admin-shell-card mb-6 flex h-auto w-full flex-wrap justify-start gap-1 p-2">
            <TabsTrigger value="divisions" className="gap-2">
              <Layers className="h-4 w-4" />
              Divisions
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="matchdays" className="gap-2">
              <Calendar className="h-4 w-4" />
              Matchdays
            </TabsTrigger>
            <TabsTrigger value="fixtures" className="gap-2">
              <Trophy className="h-4 w-4" />
              Fixtures
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <Target className="h-4 w-4" />
              Results
            </TabsTrigger>
            <TabsTrigger value="league-members" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Divisions Tab */}
          <TabsContent value="divisions">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Create New Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateDivision} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="divisionName">Name</Label>
                        <Input
                          id="divisionName"
                          type="text"
                          placeholder="e.g., Premier League"
                          value={divisionForm.name}
                          onChange={(e) => setDivisionForm({ ...divisionForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="divisionCode">Code</Label>
                        <Input
                          id="divisionCode"
                          type="text"
                          placeholder="e.g., EPL"
                          maxLength={10}
                          value={divisionForm.code}
                          onChange={(e) => setDivisionForm({ ...divisionForm, code: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="divisionSport">Sport</Label>
                        <Select
                          value={divisionForm.sportId ? String(divisionForm.sportId) : ''}
                          onValueChange={(value) => setDivisionForm({ ...divisionForm, sportId: Number(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="-- Select Sport --" />
                          </SelectTrigger>
                          <SelectContent>
                            {sports?.map((sport: Sport) => (
                              <SelectItem key={sport.id} value={String(sport.id)}>{sport.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="divisionLogo">Logo</Label>
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-background">
                            {divisionForm.logoPreviewUrl ? (
                              <img src={divisionForm.logoPreviewUrl} alt="Division logo preview" className="h-full w-full object-contain" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            id="divisionLogo"
                            type="file"
                            accept="image/*"
                            disabled={uploadingAsset === 'division-logo-new'}
                            onChange={(e) => handleAssetUpload(e.target.files?.[0], 'division-logo', undefined, (asset) => {
                              setDivisionForm({ ...divisionForm, logoPath: asset.path, logoPreviewUrl: asset.publicUrl });
                            })}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={createDivisionMutation.isPending}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {createDivisionMutation.isPending ? 'Creating...' : 'Create Division'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Existing Divisions</CardTitle>
                </CardHeader>
                <CardContent>
                  {divisions && divisions.length > 0 ? (
                    <div className="space-y-3">
                      {divisions.map((div: Division) => {
                        const draft = getDivisionDraft(div);
                        return (
                          <div key={div.id} className="p-4 rounded-lg bg-muted/50">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                              <div className="flex items-center gap-3 lg:w-[220px]">
                                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-background">
                                  {draft.logoPreviewUrl ? (
                                    <img src={draft.logoPreviewUrl} alt={`${draft.name} logo`} className="h-full w-full object-contain" />
                                  ) : (
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <Badge variant="secondary">{div.code}</Badge>
                              </div>
                              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`division-${div.id}-name`}>Name</Label>
                                  <Input
                                    id={`division-${div.id}-name`}
                                    value={draft.name}
                                    onChange={(e) => setDivisionDraft(div, { name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`division-${div.id}-code`}>Code</Label>
                                  <Input
                                    id={`division-${div.id}-code`}
                                    value={draft.code}
                                    maxLength={10}
                                    onChange={(e) => setDivisionDraft(div, { code: e.target.value.toUpperCase() })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`division-${div.id}-logo`}>Logo</Label>
                                  <Input
                                    id={`division-${div.id}-logo`}
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingAsset === `division-logo-${div.id}`}
                                    onChange={(e) => handleAssetUpload(e.target.files?.[0], 'division-logo', div.id, (asset) => {
                                      setDivisionDraft(div, { logoPath: asset.path, logoPreviewUrl: asset.publicUrl });
                                    })}
                                  />
                                  {draft.logoPath && (
                                    <p className="truncate text-xs text-muted-foreground">{draft.logoPath}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateDivision(div)}
                                  disabled={updateDivisionMutation.isPending}
                                  className="gap-1"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteDivision(div.id)}
                                  disabled={deleteDivisionMutation.isPending}
                                  className="gap-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderAdminEmpty(<Layers className="h-7 w-7" />, 'No divisions yet', 'Create a division to organize teams, fixtures, and standings.')
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Select Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedDivisionId ? String(selectedDivisionId) : ''}
                    onValueChange={(value) => {
                      setSelectedDivisionId(Number(value) || null);
                      setSelectedMatchdayId(null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Division --" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions?.map((div: Division) => (
                        <SelectItem key={div.id} value={String(div.id)}>{div.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Add New Team</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="teamName">Team Name</Label>
                        <Input
                          id="teamName"
                          type="text"
                          placeholder="e.g., Manchester United"
                          value={teamForm.name}
                          onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamCode">Team Code</Label>
                        <Input
                          id="teamCode"
                          type="text"
                          placeholder="e.g., MUN"
                          maxLength={50}
                          value={teamForm.code}
                          onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamBadge">Badge</Label>
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border bg-background">
                            {teamForm.badgePreviewUrl ? (
                              <img src={teamForm.badgePreviewUrl} alt="Team badge preview" className="h-full w-full object-contain" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            id="teamBadge"
                            type="file"
                            accept="image/*"
                            disabled={uploadingAsset === 'team-badge-new'}
                            onChange={(e) => handleAssetUpload(e.target.files?.[0], 'team-badge', undefined, (asset) => {
                              setTeamForm({ ...teamForm, badgePath: asset.path, badgePreviewUrl: asset.publicUrl });
                            })}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!selectedDivisionId || createTeamMutation.isPending}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {createTeamMutation.isPending ? 'Adding...' : 'Add Team'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Teams in Division</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDivisionId ? (
                    <p className="text-muted-foreground">Please select a division first</p>
                  ) : teams && teams.length > 0 ? (
                    <div className="grid gap-3">
                      {teams.map((team: Team) => {
                        const draft = getTeamDraft(team);
                        return (
                          <div key={team.id} className="p-4 rounded-lg bg-muted/50">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                              <div className="flex items-center gap-3 lg:w-[220px]">
                                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border bg-background">
                                  {draft.badgePreviewUrl ? (
                                    <img src={draft.badgePreviewUrl} alt={`${draft.name} badge`} className="h-full w-full object-contain" />
                                  ) : (
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{team.name}</p>
                                  <p className="text-xs text-muted-foreground">{team.code}</p>
                                </div>
                              </div>
                              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`team-${team.id}-name`}>Team Name</Label>
                                  <Input
                                    id={`team-${team.id}-name`}
                                    value={draft.name}
                                    onChange={(e) => setTeamDraft(team, { name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`team-${team.id}-code`}>Team Code</Label>
                                  <Input
                                    id={`team-${team.id}-code`}
                                    value={draft.code}
                                    maxLength={50}
                                    onChange={(e) => setTeamDraft(team, { code: e.target.value.toUpperCase() })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`team-${team.id}-badge`}>Badge</Label>
                                  <Input
                                    id={`team-${team.id}-badge`}
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingAsset === `team-badge-${team.id}`}
                                    onChange={(e) => handleAssetUpload(e.target.files?.[0], 'team-badge', team.id, (asset) => {
                                      setTeamDraft(team, { badgePath: asset.path, badgePreviewUrl: asset.publicUrl });
                                    })}
                                  />
                                  {draft.badgePath && (
                                    <p className="truncate text-xs text-muted-foreground">{draft.badgePath}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateTeam(team)}
                                  disabled={updateTeamMutation.isPending}
                                  className="gap-1"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTeam(team.id)}
                                  disabled={deleteTeamMutation.isPending}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderAdminEmpty(<Users className="h-7 w-7" />, 'No teams in this division', 'Add teams and upload badges so fixtures look polished across the app.')
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Matchdays Tab */}
          <TabsContent value="matchdays">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Select Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedDivisionId ? String(selectedDivisionId) : ''}
                    onValueChange={(value) => {
                      setSelectedDivisionId(Number(value) || null);
                      setSelectedMatchdayId(null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Division --" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions?.map((div: Division) => (
                        <SelectItem key={div.id} value={String(div.id)}>{div.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Create New Matchday</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateMatchday} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="matchdayName">Name</Label>
                        <Input
                          id="matchdayName"
                          type="text"
                          placeholder="e.g., Matchday 1"
                          value={matchdayForm.name}
                          onChange={(e) => setMatchdayForm({ ...matchdayForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="matchdayNumber">Matchday Number</Label>
                        <Input
                          id="matchdayNumber"
                          type="number"
                          min={1}
                          value={matchdayForm.number}
                          onChange={(e) => setMatchdayForm({ ...matchdayForm, number: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                    </div>
                    <DateTimeField
                      id="startDate"
                      label="Gameweek starts"
                      value={matchdayForm.startDate}
                      onChange={(startDate) => setMatchdayForm({ ...matchdayForm, startDate })}
                      required
                    />
                    <Button
                      type="submit"
                      disabled={!selectedDivisionId || createMatchdayMutation.isPending}
                    >
                      {createMatchdayMutation.isPending ? 'Creating...' : 'Create Matchday'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Existing Matchdays</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDivisionId ? (
                    <p className="text-muted-foreground">Please select a division first</p>
                  ) : matchdays && matchdays.length > 0 ? (
                    <div className="space-y-3">
                      {matchdays.map((matchday: Matchday) => {
                        const effectiveStatus = matchday.computedStatus || matchday.status;
                        return (
                          <div key={matchday.id} className="p-4 rounded-lg bg-muted/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <strong className="text-foreground">{matchday.name}</strong>
                                {getStatusBadge(effectiveStatus)}
                                {matchday.predictionsOpen && (
                                  <span className="text-primary text-xs flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Active
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Starts: {new Date(matchday.startDate).toLocaleString()}
                                {matchday.endDate ? ` - Ends: ${new Date(matchday.endDate).toLocaleString()}` : ''}
                              </p>
                            </div>
                            <Select
                              value={matchday.status}
                              onValueChange={(status) => handleStatusChange(matchday.id, status)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UPCOMING">UPCOMING</SelectItem>
                                <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                                <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderAdminEmpty(<Calendar className="h-7 w-7" />, 'No matchdays yet', 'Create matchdays or gameweeks to open prediction rounds.')
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fixtures Tab */}
          <TabsContent value="fixtures">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Select Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedDivisionId ? String(selectedDivisionId) : ''}
                    onValueChange={(value) => {
                      setSelectedDivisionId(Number(value) || null);
                      setSelectedMatchdayId(null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Division --" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions?.map((div: Division) => (
                        <SelectItem key={div.id} value={String(div.id)}>{div.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Select Matchday</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedMatchdayId ? String(selectedMatchdayId) : ''}
                    onValueChange={(value) => setSelectedMatchdayId(Number(value) || null)}
                    disabled={!selectedDivisionId}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Matchday --" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchdays?.map((md: Matchday) => (
                        <SelectItem key={md.id} value={String(md.id)}>{md.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Create New Fixture</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const usedTeamIds = new Set(
                      fixtures?.flatMap((f: Fixture) => [f.homeTeam.id, f.awayTeam.id]) || []
                    );
                    const search = fixtureTeamSearch.trim().toLowerCase();
                    const availableHomeTeams = teams?.filter((t: Team) => !usedTeamIds.has(t.id) && (!search || t.name.toLowerCase().includes(search) || t.code.toLowerCase().includes(search))) || [];
                    const availableAwayTeams = availableHomeTeams.filter((t: Team) => t.id !== fixtureForm.homeTeamId);
                    const allTeamsUsed = teams && teams.length > 0 && availableHomeTeams.length === 0;
                    
                    return allTeamsUsed ? (
                      <p className="text-muted-foreground italic">
                        All teams have been assigned to fixtures for this matchday.
                      </p>
                    ) : (
                      <form onSubmit={handleCreateFixture} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="fixtureTeamSearch">Team search</Label>
                          <Input
                            id="fixtureTeamSearch"
                            value={fixtureTeamSearch}
                            onChange={(event) => setFixtureTeamSearch(event.target.value)}
                            placeholder="Search by team name or code"
                          />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Home Team ({availableHomeTeams.length} available)</Label>
                            <Select
                              value={fixtureForm.homeTeamId ? String(fixtureForm.homeTeamId) : ''}
                              onValueChange={(value) => setFixtureForm({ ...fixtureForm, homeTeamId: Number(value), awayTeamId: 0 })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="-- Select Home Team --" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableHomeTeams.map((team: Team) => (
                                  <SelectItem key={team.id} value={String(team.id)}>
                                    <span className="inline-flex items-center gap-2">
                                      {team.badgeUrl && <img src={team.badgeUrl} alt="" className="h-5 w-5 object-contain" />}
                                      {team.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Away Team ({availableAwayTeams.length} available)</Label>
                            <Select
                              value={fixtureForm.awayTeamId ? String(fixtureForm.awayTeamId) : ''}
                              onValueChange={(value) => setFixtureForm({ ...fixtureForm, awayTeamId: Number(value) })}
                              disabled={fixtureForm.homeTeamId === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="-- Select Away Team --" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableAwayTeams.map((team: Team) => (
                                  <SelectItem key={team.id} value={String(team.id)}>
                                    <span className="inline-flex items-center gap-2">
                                      {team.badgeUrl && <img src={team.badgeUrl} alt="" className="h-5 w-5 object-contain" />}
                                      {team.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DateTimeField
                            id="fixtureKickoff"
                            label="Fixture kickoff"
                            value={fixtureForm.kickoffAt}
                            onChange={(kickoffAt) => setFixtureForm({ ...fixtureForm, kickoffAt })}
                          />
                          <div className="space-y-2">
                            <Label htmlFor="fixtureOrder">Order</Label>
                            <Input
                              id="fixtureOrder"
                              type="number"
                              min={1}
                              value={fixtureForm.displayOrder || ''}
                              onChange={(event) => setFixtureForm({ ...fixtureForm, displayOrder: Number(event.target.value) || 0 })}
                              placeholder="Auto"
                            />
                          </div>
                        </div>
                        <Button
                          type="submit"
                          disabled={!selectedMatchdayId || createFixtureMutation.isPending || fixtureForm.homeTeamId === 0 || fixtureForm.awayTeamId === 0}
                        >
                          {createFixtureMutation.isPending ? 'Creating...' : 'Create Fixture'}
                        </Button>
                      </form>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Bulk Fixture Upload</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    One fixture per line: home team, away team, optional kickoff date. Team name or code both work.
                  </p>
                  <textarea
                    value={bulkFixturesText}
                    onChange={(event) => setBulkFixturesText(event.target.value)}
                    placeholder={"Arsenal, Chelsea, 2026-08-12 19:30\nLiverpool, MCI, 2026-08-12 21:00"}
                    className="min-h-32 w-full rounded-[1rem] border border-input bg-white/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    type="button"
                    onClick={handleBulkFixtureUpload}
                    disabled={!selectedMatchdayId || !bulkFixturesText.trim() || bulkCreateFixturesMutation.isPending}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {bulkCreateFixturesMutation.isPending ? 'Uploading...' : 'Upload Fixtures'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Fixtures in Selected Matchday</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedMatchdayId ? (
                    <p className="text-muted-foreground">Please select a matchday first</p>
                  ) : fixtures && fixtures.length > 0 ? (
                    <div className="space-y-3">
                      {[...fixtures].sort((a, b) => (a.displayOrder || a.id) - (b.displayOrder || b.id)).map((fixture: Fixture, index) => (
                        <div key={fixture.id} className="p-4 rounded-lg bg-muted/50">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center justify-center gap-4">
                            <span className="font-semibold text-foreground">{fixture.homeTeam.name}</span>
                            <Badge variant={fixture.status === 'COMPLETED' ? 'success' : 'secondary'}>
                              {fixture.status === 'COMPLETED' ? `${fixture.homeScore} - ${fixture.awayScore}` : 'vs'}
                            </Badge>
                            <span className="font-semibold text-foreground">{fixture.awayTeam.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Input
                                type="datetime-local"
                                className="w-full sm:w-56"
                                title={`Displayed in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                                value={toLocalDateTimeInput(fixture.kickoffAt)}
                                onChange={(event) => updateFixtureMetadataMutation.mutate({
                                  fixtureId: fixture.id,
                                  request: { kickoffAt: event.target.value ? toUtcIsoString(event.target.value) : null },
                                })}
                              />
                              <Button type="button" variant="outline" size="sm" onClick={() => moveFixture(fixture.id, -1)} disabled={index === 0 || reorderFixturesMutation.isPending}>
                                Up
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => moveFixture(fixture.id, 1)} disabled={index === fixtures.length - 1 || reorderFixturesMutation.isPending}>
                                Down
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderAdminEmpty(<Trophy className="h-7 w-7" />, 'No fixtures yet', 'Add fixtures for this matchday so users can submit predictions.')
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Select Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedDivisionId ? String(selectedDivisionId) : ''}
                    onValueChange={(value) => {
                      setSelectedDivisionId(Number(value) || null);
                      setSelectedMatchdayId(null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Division --" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions?.map((div: Division) => (
                        <SelectItem key={div.id} value={String(div.id)}>{div.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Select Matchday to Update Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedMatchdayId ? String(selectedMatchdayId) : ''}
                    onValueChange={(value) => setSelectedMatchdayId(Number(value) || null)}
                    disabled={!selectedDivisionId}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- Select Matchday --" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchdays?.map((md: Matchday) => (
                        <SelectItem key={md.id} value={String(md.id)}>{md.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Update Fixture Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedMatchdayId ? (
                    <p className="text-muted-foreground">Please select a matchday first</p>
                  ) : fixtures && fixtures.length > 0 ? (
                    <div className="space-y-4">
                      {fixtures.map((fixture: Fixture) => {
                        const selectedMatchday = matchdays?.find((md: Matchday) => md.id === selectedMatchdayId);
                        const dateValue = fixture.kickoffAt || selectedMatchday?.startDate;
                        const fixtureDate = dateValue ? new Date(dateValue) : null;
                        const homeScore = resultForm[fixture.id]?.homeScore ?? fixture.homeScore ?? 0;
                        const awayScore = resultForm[fixture.id]?.awayScore ?? fixture.awayScore ?? 0;
                        const renderTeamBadge = (team: Fixture['homeTeam']) => (
                          <div className="team-token overflow-hidden">
                            {team.badgeUrl ? (
                              <img src={team.badgeUrl} alt={`${team.name} badge`} className="h-full w-full object-contain" />
                            ) : getTeamToken(team.name)}
                          </div>
                        );

                        return (
                          <div key={fixture.id} className="fixture-strip overflow-hidden rounded-lg transition-transform hover:-translate-y-0.5">
                            <div className="grid md:grid-cols-[1fr_15rem]">
                              <div className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                <div className="flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
                                  {renderTeamBadge(fixture.homeTeam)}
                                  <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.homeTeam.name}</span>
                                </div>

                                <div className="flex flex-col items-center gap-3">
                                  <Badge variant={fixture.status === 'COMPLETED' ? 'success' : 'secondary'}>
                                    {fixture.status === 'COMPLETED' ? 'Result saved' : 'Enter result'}
                                  </Badge>
                                  <div className="flex items-center justify-center gap-2">
                                    <AdminScoreStepper
                                      label={`${fixture.homeTeam.name} score`}
                                      value={homeScore}
                                      onChange={(score) => setResultForm((previous) => ({
                                        ...previous,
                                        [fixture.id]: { homeScore: score, awayScore },
                                      }))}
                                    />
                                    <span className="text-2xl font-black text-slate-400">VS</span>
                                    <AdminScoreStepper
                                      label={`${fixture.awayTeam.name} score`}
                                      value={awayScore}
                                      onChange={(score) => setResultForm((previous) => ({
                                        ...previous,
                                        [fixture.id]: { homeScore, awayScore: score },
                                      }))}
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateResult(fixture.id)}
                                    disabled={updateResultMutation.isPending}
                                    className="gap-1"
                                  >
                                    <Save className="h-4 w-4" />
                                    Save Result
                                  </Button>
                                </div>

                                <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                                  {renderTeamBadge(fixture.awayTeam)}
                                  <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.awayTeam.name}</span>
                                </div>
                              </div>

                              <div className="fixture-strip-side flex flex-col items-center justify-center gap-1 px-6 py-5 text-center">
                                <span className="text-sm font-semibold uppercase tracking-normal text-white/85">
                                  {fixtureDate && !Number.isNaN(fixtureDate.getTime())
                                    ? fixtureDate.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                                    : 'Matchday'}
                                </span>
                                <span className="text-3xl font-black">
                                  {fixture.status === 'COMPLETED'
                                    ? 'RESULT'
                                    : fixtureDate && !Number.isNaN(fixtureDate.getTime())
                                      ? fixtureDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                      : 'TBD'}
                                </span>
                                <span className="text-xs font-bold uppercase text-white/70">
                                  {fixture.status === 'COMPLETED' ? `${fixture.homeScore} - ${fixture.awayScore}` : 'Awaiting score'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderAdminEmpty(<Target className="h-7 w-7" />, 'No results to update', 'Fixtures will appear here after you select a matchday with scheduled games.')
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* League Members Tab */}
          <TabsContent value="league-members">
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    League Members and Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>League</Label>
                      <Select
                        value={selectedLeagueId ? String(selectedLeagueId) : ''}
                        onValueChange={(value) => {
                          setSelectedLeagueId(Number(value) || null);
                          setSelectedLeagueMemberId(null);
                          setSelectedLeagueMatchdayId(null);
                          setAdminPredictions({});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select league" />
                        </SelectTrigger>
                        <SelectContent>
                          {adminLeagues?.map((league) => (
                            <SelectItem key={league.id} value={String(league.id)}>
                              {league.name} ({league.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Member</Label>
                      <Select
                        value={selectedLeagueMemberId ? String(selectedLeagueMemberId) : ''}
                        onValueChange={(value) => setSelectedLeagueMemberId(Number(value) || null)}
                        disabled={!selectedLeague}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLeague?.members.map((member) => (
                            <SelectItem key={member.id} value={String(member.id)}>
                              {member.username}{member.isGuest ? ' (guest)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Matchday / Gameweek</Label>
                      <Select
                        value={selectedLeagueMatchdayId ? String(selectedLeagueMatchdayId) : ''}
                        onValueChange={(value) => setSelectedLeagueMatchdayId(Number(value) || null)}
                        disabled={!selectedLeague}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select matchday" />
                        </SelectTrigger>
                        <SelectContent>
                          {leagueMatchdays?.map((matchday: Matchday) => (
                            <SelectItem key={matchday.id} value={String(matchday.id)}>
                              {matchday.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                <Card className="bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Add Member</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex rounded-md border bg-muted/40 p-1">
                      <button
                        type="button"
                        onClick={() => setMemberMode('registered')}
                        className={cn(
                          "flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                          memberMode === 'registered' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                      >
                        Registered
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberMode('guest')}
                        className={cn(
                          "flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                          memberMode === 'guest' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                      >
                        Guest
                      </button>
                    </div>

                    {memberMode === 'registered' ? (
                      <div className="space-y-2">
                        <Label>Registered User</Label>
                        <Select
                          value={memberForm.userId ? String(memberForm.userId) : ''}
                          onValueChange={(value) => setMemberForm({ ...memberForm, userId: Number(value) })}
                          disabled={!selectedLeague}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select registered user" />
                          </SelectTrigger>
                          <SelectContent>
                            {registeredUsers?.map((registeredUser) => (
                              <SelectItem key={registeredUser.id} value={String(registeredUser.id)}>
                                {registeredUser.username} ({registeredUser.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="guestName">Guest Name</Label>
                          <Input
                            id="guestName"
                            value={memberForm.displayName}
                            onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                            placeholder="e.g., Dad, Sarah, Office Pool"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="guestEmail">Email Optional</Label>
                          <Input
                            id="guestEmail"
                            type="email"
                            value={memberForm.email}
                            onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                            placeholder="guest@example.com"
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => addLeagueMemberMutation.mutate()}
                      disabled={!selectedLeagueId || addLeagueMemberMutation.isPending}
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      {addLeagueMemberMutation.isPending ? 'Adding...' : 'Add to League'}
                    </Button>

                    {selectedLeague && (
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="mb-2 text-sm font-medium text-foreground">Current Members</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLeague.members.map((member) => (
                            <Badge key={member.id} variant={member.isGuest ? 'warning' : 'secondary'}>
                              {member.username}{member.isGuest ? ' guest' : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Add Member Predictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedLeagueId || !selectedLeagueMemberId || !selectedLeagueMatchdayId ? (
                      <p className="text-muted-foreground">Select a league, member, and matchday first.</p>
                    ) : leagueFixtures && leagueFixtures.length > 0 ? (
                      <div className="space-y-4">
                        {adminPredictionsLocked && (
                          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                              <p className="font-bold">No fixtures are open</p>
                              <p className="text-sm">Saved picks are read-only once each fixture reaches its five-minute pre-kickoff cutoff.</p>
                            </div>
                          </div>
                        )}
                        <div className="rounded-2xl border border-violet-200/60 bg-violet-500/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-600">
                                <Star className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground">Member Joker / high-confidence pick</p>
                                <p className="text-sm text-muted-foreground">Select one fixture to double this member's points.</p>
                              </div>
                            </div>
                            <Badge variant={adminJokerFixtureId ? 'success' : 'warning'}>
                              {adminJokerFixtureId ? 'Joker selected' : 'No Joker selected'}
                            </Badge>
                          </div>
                        </div>

                        {leagueFixtures.map((fixture: Fixture) => {
                          const isJokerFixture = adminJokerFixtureId === fixture.id;
                          const fixtureOpen = isFixturePredictionOpen(fixture, selectedLeagueMatchday, currentTime);
                          const fixtureKickoffTime = getFixtureKickoffTime(fixture, selectedLeagueMatchday);
                          const fixtureDate = fixtureKickoffTime ? new Date(fixtureKickoffTime) : null;
                          const teamToken = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                          const teamBadge = (team: Fixture['homeTeam']) => (
                            <div className="team-token overflow-hidden">
                              {team.badgeUrl ? (
                                <img src={team.badgeUrl} alt={`${team.name} badge`} className="h-full w-full object-contain" />
                              ) : (
                                teamToken(team.name)
                              )}
                            </div>
                          );

                          return (
                            <div
                              key={fixture.id}
                              className={cn(
                                'fixture-strip rounded-lg transition-transform hover:-translate-y-0.5',
                                isJokerFixture && 'prediction-card-joker'
                              )}
                            >
                              <div className="grid md:grid-cols-[1fr_14rem]">
                                <div className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                  <div className="flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
                                    {teamBadge(fixture.homeTeam)}
                                    <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.homeTeam.name}</span>
                                  </div>

                                  <div className="flex flex-col items-center gap-3">
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      <Badge variant={fixture.status === 'COMPLETED' ? 'success' : fixtureOpen ? 'secondary' : 'warning'}>
                                        {fixture.status === 'COMPLETED' ? `Final ${fixture.homeScore}-${fixture.awayScore}` : fixtureOpen ? 'Prediction Entry' : 'Locked'}
                                      </Badge>
                                      {isJokerFixture && (
                                        <Badge variant="warning" className="font-black">
                                          <Star className="mr-1 h-3 w-3" />
                                          High confidence 2x
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      <AdminScoreStepper
                                        label={`${fixture.homeTeam.name} score`}
                                        value={adminPredictions[fixture.id]?.home}
                                        onChange={(score) => setAdminPredictionScore(fixture.id, 'home', score)}
                                        disabled={!fixtureOpen}
                                      />
                                      <span className="text-2xl font-black text-slate-400">VS</span>
                                      <AdminScoreStepper
                                        label={`${fixture.awayTeam.name} score`}
                                        value={adminPredictions[fixture.id]?.away}
                                        onChange={(score) => setAdminPredictionScore(fixture.id, 'away', score)}
                                        disabled={!fixtureOpen}
                                      />
                                    </div>

                                    <Button
                                      size="sm"
                                      variant={isJokerFixture ? 'warning' : 'outline'}
                                      onClick={() => setAdminJokerFixtureId(isJokerFixture ? null : fixture.id)}
                                      disabled={!fixtureOpen}
                                      className="gap-1"
                                    >
                                      <Star className="h-4 w-4" />
                                      {isJokerFixture ? 'High Confidence 2x' : 'Use Joker'}
                                    </Button>
                                  </div>

                                  <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                                    {teamBadge(fixture.awayTeam)}
                                    <span className="text-sm font-black uppercase text-slate-900 sm:text-base">{fixture.awayTeam.name}</span>
                                  </div>
                                </div>

                                <div className="fixture-strip-side flex flex-col items-center justify-center gap-1 px-6 py-5 text-center">
                                  <span className="text-sm font-semibold uppercase tracking-normal text-white/85">
                                    {fixtureDate ? fixtureDate.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }) : selectedLeague?.name || 'League'}
                                  </span>
                                  <span className="text-2xl font-black">
                                    {fixture.status === 'COMPLETED' ? 'RESULT' : fixtureOpen ? 'ADMIN PICK' : 'LOCKED'}
                                  </span>
                                  <span className="text-xs font-bold uppercase text-white/70">
                                    {fixtureDate ? fixtureDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'For selected member'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <Button
                          onClick={handleSaveMemberPredictions}
                          disabled={!openLeagueFixtures.length || saveMemberPredictionsMutation.isPending}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {saveMemberPredictionsMutation.isPending ? 'Saving...' : 'Save Member Predictions'}
                        </Button>
                      </div>
                    ) : (
                      renderAdminEmpty(<Target className="h-7 w-7" />, 'No predictions can be entered yet', 'Select a matchday with fixtures before adding member predictions.')
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
