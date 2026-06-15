import { Fixture } from '../types/fixture.types';
import { H2hMatchup } from '../types/h2h.types';

const palette = {
  ink: '#0f172a',
  muted: '#526f74',
  teal: '#0d949d',
  tealDark: '#08768a',
  pale: '#e6f3f0',
  paleAlt: '#d5e9e6',
  violet: '#d8d4ef',
  white: '#ffffff',
  amber: '#f59e0b',
};

const initials = (name?: string) => (name || 'TBD')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const drawCentered = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  ctx.fillText(text, x - ctx.measureText(text).width / 2, y);
};

const drawFitted = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}...`).width > maxWidth) value = value.slice(0, -1);
  ctx.fillText(`${value.trim()}...`, x, y);
};

const paintBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.pale);
  gradient.addColorStop(0.58, palette.paleAlt);
  gradient.addColorStop(1, palette.violet);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.beginPath();
  ctx.arc(width - 100, 80, 270, 0, Math.PI * 2);
  ctx.fill();
};

const drawTitle = (ctx: CanvasRenderingContext2D, title: string, subtitle: string, width: number) => {
  ctx.fillStyle = palette.ink;
  ctx.font = '900 52px Inter, Arial';
  drawFitted(ctx, title, 62, 88, width - 280);
  ctx.fillStyle = palette.tealDark;
  ctx.font = '800 20px Inter, Arial';
  ctx.fillText(subtitle.toUpperCase(), 64, 128);
  ctx.fillStyle = palette.teal;
  ctx.font = '900 28px Inter, Arial';
  ctx.fillText('MP', width - 120, 88);
};

const drawToken = (ctx: CanvasRenderingContext2D, name: string, x: number, y: number, radius = 25) => {
  ctx.fillStyle = palette.teal;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.white;
  ctx.font = `900 ${Math.max(12, radius * 0.62)}px Inter, Arial`;
  drawCentered(ctx, initials(name), x, y + radius * 0.22);
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create image')), 'image/png');
});

export const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
};

export const createFixtureImage = async (title: string, subtitle: string, fixtures: Fixture[]) => {
  const rows = [...fixtures].sort((a, b) => (a.displayOrder || a.id) - (b.displayOrder || b.id));
  const width = 1400;
  const rowHeight = 94;
  const height = Math.max(760, 225 + rows.length * rowHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, subtitle, width);

  rows.forEach((fixture, index) => {
    const y = 180 + index * rowHeight;
    ctx.fillStyle = index % 2 ? 'rgba(215,232,230,0.9)' : 'rgba(255,255,255,0.72)';
    ctx.fillRect(55, y, width - 110, rowHeight - 8);
    drawToken(ctx, fixture.homeTeam.name, 125, y + 43, 24);
    drawToken(ctx, fixture.awayTeam.name, width - 125, y + 43, 24);
    ctx.fillStyle = palette.ink;
    ctx.font = '850 25px Inter, Arial';
    ctx.textAlign = 'right';
    drawFitted(ctx, fixture.homeTeam.name, 560, y + 51, 385);
    ctx.textAlign = 'left';
    drawFitted(ctx, fixture.awayTeam.name, 840, y + 51, 385);
    ctx.fillStyle = palette.tealDark;
    ctx.font = '900 22px Inter, Arial';
    drawCentered(ctx, fixture.status === 'COMPLETED' ? `${fixture.homeScore} - ${fixture.awayScore}` : 'VS', width / 2, y + 50);
    if (fixture.kickoffAt) {
      ctx.fillStyle = palette.muted;
      ctx.font = '700 14px Inter, Arial';
      drawCentered(ctx, new Date(fixture.kickoffAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }), width / 2, y + 73);
    }
  });
  return canvasToBlob(canvas);
};

export const createH2hImage = async (title: string, subtitle: string, matchups: H2hMatchup[]) => {
  const width = 1400;
  const rowHeight = 105;
  const height = Math.max(760, 225 + matchups.length * rowHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, subtitle, width);

  matchups.forEach((matchup, index) => {
    const y = 180 + index * rowHeight;
    const center = width / 2;
    const ribbon = ctx.createLinearGradient(80, y, width - 80, y);
    ribbon.addColorStop(0, 'rgba(8,118,138,0.95)');
    ribbon.addColorStop(0.45, 'rgba(13,148,157,0.82)');
    ribbon.addColorStop(0.55, 'rgba(155,117,204,0.72)');
    ribbon.addColorStop(1, 'rgba(117,78,169,0.9)');
    ctx.fillStyle = ribbon;
    ctx.fillRect(70, y, width - 140, rowHeight - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(center - 54, y, 108, rowHeight - 16);
    drawToken(ctx, matchup.player1?.username || 'TBD', 145, y + 45, 25);
    drawToken(ctx, matchup.player2?.username || 'BYE', width - 145, y + 45, 25);
    ctx.fillStyle = palette.white;
    ctx.font = '900 27px Inter, Arial';
    ctx.textAlign = 'right';
    drawFitted(ctx, matchup.player1?.username || 'TBD', center - 85, y + 53, 440);
    ctx.textAlign = 'left';
    drawFitted(ctx, matchup.player2?.username || 'BYE', center + 85, y + 53, 440);
    ctx.textAlign = 'left';
    ctx.font = '900 23px Inter, Arial';
    drawCentered(ctx, matchup.resolved ? `${matchup.player1Points ?? 0} - ${matchup.player2Points ?? 0}` : 'VS', center, y + 53);
  });
  return canvasToBlob(canvas);
};

export const createKnockoutImage = async (title: string, matchups: H2hMatchup[]) => {
  const roundOrder = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
  const grouped = new Map<string, H2hMatchup[]>();
  matchups.forEach((matchup) => {
    const round = matchup.knockoutRound || 'ROUND';
    grouped.set(round, [...(grouped.get(round) || []), matchup]);
  });
  const rounds = roundOrder.filter((round) => grouped.has(round));
  if (!rounds.length) rounds.push(...grouped.keys());
  const width = Math.max(1400, 290 * rounds.length + 180);
  const height = 1050;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, 'Knockout bracket', width);

  rounds.forEach((round, roundIndex) => {
    const roundMatchups = [...(grouped.get(round) || [])].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
    const x = 60 + roundIndex * ((width - 180) / Math.max(1, rounds.length));
    const columnWidth = Math.min(245, (width - 240) / Math.max(1, rounds.length));
    ctx.fillStyle = palette.tealDark;
    ctx.font = '900 18px Inter, Arial';
    ctx.fillText(round.replace(/_/g, ' '), x, 185);
    const spacing = 720 / Math.max(1, roundMatchups.length);
    roundMatchups.forEach((matchup, index) => {
      const y = 225 + index * spacing + Math.max(0, (spacing - 92) / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.strokeStyle = palette.teal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, columnWidth, 82, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      ctx.font = '800 16px Inter, Arial';
      drawFitted(ctx, matchup.player1?.username || 'TBD', x + 15, y + 28, columnWidth - 54);
      drawFitted(ctx, matchup.player2?.username || 'BYE', x + 15, y + 62, columnWidth - 54);
      ctx.fillStyle = palette.teal;
      ctx.font = '900 15px Inter, Arial';
      ctx.textAlign = 'right';
      ctx.fillText(matchup.resolved ? String(matchup.player1Points ?? 0) : '-', x + columnWidth - 15, y + 28);
      ctx.fillText(matchup.resolved ? String(matchup.player2Points ?? 0) : '-', x + columnWidth - 15, y + 62);
      ctx.textAlign = 'left';
      if (roundIndex < rounds.length - 1) {
        ctx.strokeStyle = 'rgba(13,148,157,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + columnWidth, y + 41);
        ctx.lineTo(x + columnWidth + 35, y + 41);
        ctx.stroke();
      }
    });
  });

  ctx.fillStyle = palette.amber;
  ctx.beginPath();
  ctx.arc(width - 95, 185, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.white;
  ctx.font = '900 26px Inter, Arial';
  drawCentered(ctx, '1', width - 95, 194);
  return canvasToBlob(canvas);
};
