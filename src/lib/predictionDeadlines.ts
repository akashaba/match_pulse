import { Fixture } from '../types/fixture.types';
import { Matchday } from '../types/matchday.types';

export const FIXTURE_PREDICTION_LOCK_MS = 5 * 60 * 1000;

export const getFixtureKickoffTime = (fixture: Fixture, matchday?: Pick<Matchday, 'startDate'> | null) => {
  const value = fixture.kickoffAt || matchday?.startDate;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const getFixturePredictionDeadline = (fixture: Fixture, matchday?: Pick<Matchday, 'startDate'> | null) => {
  if (fixture.predictionDeadline) {
    const deadline = new Date(fixture.predictionDeadline).getTime();
    if (Number.isFinite(deadline)) return deadline;
  }
  const kickoffTime = getFixtureKickoffTime(fixture, matchday);
  return kickoffTime === null ? null : kickoffTime - FIXTURE_PREDICTION_LOCK_MS;
};

export const isFixturePredictionOpen = (
  fixture: Fixture,
  matchday?: Pick<Matchday, 'startDate' | 'status'> | null,
  now = Date.now(),
) => {
  const deadline = getFixturePredictionDeadline(fixture, matchday);
  if (deadline === null && fixture.predictionsOpen !== undefined) return fixture.predictionsOpen && fixture.status !== 'COMPLETED';
  return fixture.status !== 'COMPLETED'
    && matchday?.status !== 'COMPLETED'
    && deadline !== null
    && now < deadline;
};

export const hasFixtureStarted = (fixture: Fixture, matchday?: Pick<Matchday, 'startDate'> | null, now = Date.now()) => {
  const kickoffTime = getFixtureKickoffTime(fixture, matchday);
  return kickoffTime !== null && now >= kickoffTime;
};
