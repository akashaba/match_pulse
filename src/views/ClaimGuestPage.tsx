import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Link2, Loader2, UserCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import { guestClaimApi } from '../api/guestClaimApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ClaimGuestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get('token') || '';

  const { data: claim, isLoading, error } = useQuery({
    queryKey: ['guest-claim', token],
    queryFn: () => guestClaimApi.getClaim(token),
    enabled: !!token,
  });

  const claimMutation = useMutation({
    mutationFn: () => guestClaimApi.claim(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLeagues'] });
      queryClient.invalidateQueries({ queryKey: ['league'] });
      queryClient.invalidateQueries({ queryKey: ['predictionStatus'] });
    },
  });

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />
      <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-8">
        <Card className="w-full max-w-xl bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Claim Guest Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!token ? (
              <p className="text-destructive">This claim link is missing its token.</p>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading claim link...
              </div>
            ) : error || !claim ? (
              <p className="text-destructive">This claim link could not be loaded.</p>
            ) : claim.claimedAt ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700">
                This guest profile has already been claimed.
              </div>
            ) : claim.expired ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                This claim link has expired. Ask the league creator for a fresh link.
              </div>
            ) : claimMutation.isSuccess ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle className="h-5 w-5" />
                    {claimMutation.data.message}
                  </div>
                  <p className="mt-2 text-sm">Transferred leagues: {claimMutation.data.transferredLeagues}</p>
                </div>
                <Link to="/leagues">
                  <Button className="w-full">Go to My Leagues</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/60 bg-white/45 p-4">
                  <p className="text-sm text-muted-foreground">You are about to claim this guest profile:</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{claim.guest.username}</p>
                  <p className="mt-2 text-xs text-muted-foreground">All predictions, standings, H2H records, and league memberships will move to your current account.</p>
                </div>
                {claimMutation.error && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {(claimMutation.error as any).response?.data?.message || 'Could not claim this guest profile.'}
                  </div>
                )}
                <Button className="w-full gap-2" onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
                  <Link2 className="h-4 w-4" />
                  {claimMutation.isPending ? 'Claiming...' : 'Claim Guest History'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClaimGuestPage;
