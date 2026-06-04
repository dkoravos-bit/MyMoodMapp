/**
 * Sound Lab Service — MyMoodMapp
 *
 * Uses expo-audio (replaces deprecated expo-av) for native audio playback.
 * All Audio calls happen inside async functions triggered by user interaction —
 * never at module evaluation time to prevent native bridge crashes.
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';
import { FrequencyPreset } from '@/constants/sounds';
import {
  getSoundFilePath as _getSoundFilePath,
  ensureSoundCached as _ensureSoundCached,
} from './soundCache';

// ─── expo-audio lazy loader (replaces expo-av) ─────────────────────────────
// Loaded via require() inside functions so the native audio session
// is never initialized during bundle evaluation.
let _eaCreatePlayer: any = null;
let _eaSetMode: any = null;
let _eaAudioSession: any = null;

function _getExpoAudio(): { createAudioPlayer: any; setAudioModeAsync: any; AudioSession: any } | null {
  if (Platform.OS === 'web') return null;
  if (_eaCreatePlayer) return { createAudioPlayer: _eaCreatePlayer, setAudioModeAsync: _eaSetMode, AudioSession: _eaAudioSession };
  try {
    const ea = require('expo-audio');
    _eaCreatePlayer = ea.createAudioPlayer;
    _eaSetMode = ea.setAudioModeAsync;
    // AudioSession is expo-audio's native iOS audio session manager
    // It exposes setCategory('Playback') which enables true background/lockscreen audio
    _eaAudioSession = ea.AudioSession ?? null;
    return { createAudioPlayer: _eaCreatePlayer, setAudioModeAsync: _eaSetMode, AudioSession: _eaAudioSession };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TRACKING
// ─────────────────────────────────────────────────────────────────────────────

export interface SoundSession {
  id: string; userId: string; soundId: string; soundName: string;
  soundCategory: string; durationSeconds: number; timerMinutes?: number;
  moodBefore?: number; moodAfter?: number; createdAt: string;
}
export interface SoundCorrelation {
  soundId: string; soundName: string; sessionCount: number;
  avgMoodDelta: number; improvementRate: number;
}

export async function logSoundSession(
  userId: string, soundId: string, soundName: string,
  soundCategory: string, durationSeconds: number,
  options?: { timerMinutes?: number; moodBefore?: number; moodAfter?: number },
): Promise<void> {
  if (!userId || durationSeconds < 5) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from('sound_sessions').insert({
      user_id: userId, sound_id: soundId, sound_name: soundName,
      sound_category: soundCategory, duration_seconds: durationSeconds,
      timer_minutes: options?.timerMinutes ?? null,
      mood_before: options?.moodBefore ?? null,
      mood_after: options?.moodAfter ?? null,
    });
  } catch {}
}

export async function getSoundCorrelations(userId: string): Promise<SoundCorrelation[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sound_sessions').select('sound_id,sound_name,mood_before,mood_after')
      .eq('user_id', userId).not('mood_before', 'is', null).not('mood_after', 'is', null);
    if (error || !data?.length) return [];
    const map = new Map<string, { name: string; deltas: number[] }>();
    for (const row of data) {
      if (!map.has(row.sound_id)) map.set(row.sound_id, { name: row.sound_name, deltas: [] });
      map.get(row.sound_id)!.deltas.push(row.mood_after - row.mood_before);
    }
    const result: SoundCorrelation[] = [];
    map.forEach((val, soundId) => {
      const avg = val.deltas.reduce((s, d) => s + d, 0) / val.deltas.length;
      const improved = val.deltas.filter(d => d > 0).length;
      result.push({
        soundId, soundName: val.name, sessionCount: val.deltas.length,
        avgMoodDelta: Math.round(avg * 10) / 10,
        improvementRate: Math.round((improved / val.deltas.length) * 100),
      });
    });
    return result.sort((a, b) => b.improvementRate - a.improvementRate);
  } catch { return []; }
}

export async function getRecentSessions(userId: string, limit = 5): Promise<SoundSession[]> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('sound_sessions').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((r: any) => ({
      id: r.id, userId: r.user_id, soundId: r.sound_id, soundName: r.sound_name,
      soundCategory: r.sound_category, durationSeconds: r.duration_seconds,
      timerMinutes: r.timer_minutes, moodBefore: r.mood_before,
      moodAfter: r.mood_after, createdAt: r.created_at,
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DSP PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

interface SampleGen { next(): number; }

function makePinkGen(gain = 0.25): SampleGen {
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  return { next() {
    const w = Math.random()*2-1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    const s=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*gain; b6=w*0.115926; return s;
  }};
}
function makeWhiteGen(gain=0.55): SampleGen { return { next() { return (Math.random()*2-1)*gain; }}; }
function makeBrownGen(gain=1.1): SampleGen {
  let last=0;
  return { next() { const w=Math.random()*2-1; last=(last+0.02*w)/1.02; return last*gain; }};
}
function makeBlueGen(gain=0.42): SampleGen {
  let prev=0;
  return { next() { const w=Math.random()*2-1; const s=(w-prev)*gain; prev=w; return s; }};
}
function makeGreyGen(): SampleGen {
  const p=makePinkGen(0.22), w=makeWhiteGen(0.04);
  return { next() { return p.next()+w.next(); }};
}

class LP1 { private y=0; constructor(private c:number){} process(x:number){const r=this.c*this.y+(1-this.c)*(isFinite(x)?x:0);this.y=isFinite(r)?r:0;return this.y;} }
class HP1 { private x1=0;private y1=0; constructor(private r:number){} process(x:number){const xi=isFinite(x)?x:0;const y=this.r*(this.y1+xi-this.x1);this.x1=xi;this.y1=isFinite(y)?y:0;return this.y1;} }
class BPF2 { private lp=0;private bp=0; constructor(private f:number,private q:number,private sr:number){}
  process(x:number){const xi=isFinite(x)?x:0;const f=2*Math.sin(Math.PI*Math.min(this.f,this.sr*0.48)/this.sr);this.lp+=f*this.bp;const hp=xi-this.lp-this.bp/this.q;const nb=this.bp+f*hp;this.bp=isFinite(nb)?nb:0;return this.bp;} }
class NoiseBurst { private amp=0;private decay=0.985; fire(a:number,dec=0.985){this.amp=a;this.decay=dec;}
  next(){if(this.amp<0.00005)return 0;const s=(Math.random()*2-1)*this.amp;this.amp*=this.decay;return s;} }
class TonedBurst { private amp=0;private phase=0;private freq=1000;private decay=0.99;
  fire(hz:number,a:number,dec:number){this.freq=hz;this.amp=a;this.decay=dec;this.phase=Math.random()*Math.PI*2;}
  next(sr:number){if(this.amp<0.0001)return 0;this.phase+=2*Math.PI*this.freq/sr;const s=Math.sin(this.phase)*this.amp;this.amp*=this.decay;return s;} }
class SmoothLFO { private phase=0; constructor(private rate:number,private sr:number,ip=0){this.phase=ip;}
  next(){this.phase+=2*Math.PI*this.rate/this.sr;return Math.sin(this.phase);} }

// ─────────────────────────────────────────────────────────────────────────────
// SOUND GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

function makeRainLightGen(sr: number): SampleGen {
  const hissNoise=makePinkGen(1.0),hissHP1=new HP1(0.975),hissHP2=new HP1(0.970),hissLP=new LP1(0.45);
  const leafDrops:NoiseBurst[]=Array.from({length:16},()=>new NoiseBurst());
  const groundDrops:NoiseBurst[]=Array.from({length:12},()=>new NoiseBurst());
  const glassDrops:NoiseBurst[]=Array.from({length:8},()=>new NoiseBurst());
  let ldi=0,gdi=0,gldi=0;
  const gustLFO=new SmoothLFO(0.05,sr,0),microLFO=new SmoothLFO(0.22,sr,Math.PI*0.7);
  const leafBP=new BPF2(5500,0.4,sr),groundBP=new BPF2(1800,0.6,sr);
  return { next() {
    const intensity=Math.max(0.2,0.55+0.25*(0.5+0.5*gustLFO.next())+0.20*(0.5+0.5*microLFO.next()));
    const baseRate=intensity*0.0025;
    if(Math.random()<baseRate*2.8){leafDrops[ldi%16].fire(0.25+Math.random()*0.40,0.950+Math.random()*0.020);ldi++;}
    if(Math.random()<baseRate*1.4){groundDrops[gdi%12].fire(0.18+Math.random()*0.28,0.960+Math.random()*0.015);gdi++;}
    if(Math.random()<baseRate*0.4){glassDrops[gldi%8].fire(0.10+Math.random()*0.15,0.940+Math.random()*0.025);gldi++;}
    const raw=hissNoise.next(),hiss=hissHP2.process(hissHP1.process(raw));
    const hissSmooth=hiss*0.7+hissLP.process(raw)*0.3;
    let s=hissSmooth*intensity*0.85;
    for(const d of leafDrops)s+=leafBP.process(d.next())*0.60;
    for(const d of groundDrops)s+=groundBP.process(d.next())*0.50;
    for(const d of glassDrops)s+=d.next()*0.40;
    return s*0.78;
  }};
}
function makeRainHeavyGen(sr:number):SampleGen{const lightRain=makeRainLightGen(sr),roarNoise=makePinkGen(1.0),roarHP=new HP1(0.960),roarLP=new LP1(0.50);const splashes:NoiseBurst[]=Array.from({length:10},()=>new NoiseBurst());const splashBP=new BPF2(900,0.5,sr);let si=0;const roarLFO=new SmoothLFO(0.03,sr);return{next(){const roarEnv=0.70+0.30*(0.5+0.5*roarLFO.next());if(Math.random()<0.0035*roarEnv){splashes[si%10].fire(0.45+Math.random()*0.45,0.965+Math.random()*0.015);si++;}const rawRoar=roarNoise.next(),roar=roarHP.process(rawRoar)*0.5+roarLP.process(rawRoar)*0.5;let s=lightRain.next()*0.65+roar*roarEnv*0.55;for(const sp of splashes)s+=splashBP.process(sp.next())*0.65;return s*0.90;}};}
function makeThunderstormGen(sr:number):SampleGen{const rain=makeRainHeavyGen(sr);let thunderAmp=0.0;const thunderLP1=new LP1(0.9997),thunderLP2=new LP1(0.9993);let nextThunder=Math.floor(sr*(6+Math.random()*14)),tc=0;const echoDelays=[0,Math.floor(sr*0.20),Math.floor(sr*0.45)],echoAmps=[1.0,0.55,0.28];const echoBufs:Float32Array[]=echoDelays.map(d=>new Float32Array(d+1));const echoPos:number[]=echoDelays.map(()=>0);return{next(){tc++;if(tc>=nextThunder){thunderAmp=0.9+Math.random()*0.1;nextThunder=tc+Math.floor(sr*(10+Math.random()*20));}const raw=Math.random()*2-1,rumble=thunderLP2.process(thunderLP1.process(raw))*thunderAmp;if(thunderAmp>0.0001)thunderAmp*=0.9997;let echo=0;for(let e=0;e<3;e++){if(echoDelays[e]>0){echo+=echoBufs[e][echoPos[e]]*echoAmps[e];echoBufs[e][echoPos[e]]=rumble;echoPos[e]=(echoPos[e]+1)%echoDelays[e];}else echo+=rumble*echoAmps[e];}return rain.next()*0.68+echo*0.45;}};}
function makeOceanGen(sr:number):SampleGen{const basePeriods=[3.7*sr,5.1*sr,4.3*sr];const waves=basePeriods.map((period,i)=>({period,phase:Math.random()*period,amp:[0.60,0.28,0.12][i]}));const rushWhite=makeWhiteGen(1.0),foamPink=makePinkGen(0.8),deepBrown=makeBrownGen(0.7);const rushBP=new BPF2(1600,0.5,sr),rushHP=new HP1(0.945),foamLP=new LP1(0.80),recessHP=new HP1(0.960),deepLP1=new LP1(0.9996),deepLP2=new LP1(0.9992);const swellLFO=new SmoothLFO(0.008,sr);return{next(){const swellMod=0.80+0.20*(0.5+0.5*swellLFO.next());let env=0;for(const w of waves){w.phase=(w.phase+1)%w.period;const prog=w.phase/w.period;let wenv:number;if(prog<0.50){wenv=Math.pow(prog/0.50,3.0)*0.08;}else if(prog<0.68){const t2=(prog-0.50)/0.18;wenv=0.08+Math.pow(t2,1.5)*0.92;}else if(prog<0.76){wenv=1.0;}else{const t2=(prog-0.76)/0.24;wenv=1.0*Math.pow(1.0-t2,0.65);}env+=wenv*w.amp;}env=Math.max(0,Math.min(1,env))*swellMod;const rumble=deepLP2.process(deepLP1.process(deepBrown.next()));const rumbleMix=(0.10+0.90*env)*rumble*0.32;const rawR=rushWhite.next();const rush=rushHP.process(rushBP.process(rawR))*0.55+rawR*0.45;const lapEnv=Math.pow(Math.max(0,env-0.15)/0.85,1.3);const lapMix=rush*lapEnv*0.90;const recessEnv=env*Math.max(0,1.0-lapEnv*1.2);const foamMix=foamLP.process(foamPink.next())*recessEnv*0.40+recessHP.process(foamPink.next())*recessEnv*0.25;return rumbleMix+lapMix+foamMix;}};}
function makeOceanDeepGen(sr:number):SampleGen{const ocean=makeOceanGen(sr),rain=makeRainHeavyGen(sr);let thunderAmp=0.0;const tLP1=new LP1(0.9998),tLP2=new LP1(0.9995);let nextThunder=Math.floor(sr*(12+Math.random()*20)),tc=0;return{next(){tc++;if(tc>=nextThunder){thunderAmp=0.55+Math.random()*0.35;nextThunder=tc+Math.floor(sr*(15+Math.random()*30));}const raw=Math.random()*2-1,rumble=tLP2.process(tLP1.process(raw))*thunderAmp;if(thunderAmp>0.0001)thunderAmp*=0.9998;return ocean.next()*0.62+rain.next()*0.50+rumble*0.55;}};}
function makeCreekGen(sr:number):SampleGen{const white=makeWhiteGen(1.0),lp1=new LP1(0.72),lp2=new LP1(0.60),hp=new HP1(0.88),bp1=new BPF2(600,0.5,sr),bp2=new BPF2(1400,0.4,sr),bp3=new BPF2(2800,0.3,sr);const bubbles:TonedBurst[]=Array.from({length:14},()=>new TonedBurst());let bi=0;const splashes:NoiseBurst[]=Array.from({length:8},()=>new NoiseBurst());let si=0;const fl1=new SmoothLFO(0.11,sr,0),fl2=new SmoothLFO(0.07,sr,Math.PI*0.7),fl3=new SmoothLFO(0.031,sr,Math.PI*1.3);return{next(){const flow=0.50+0.28*(0.5+0.5*fl1.next())+0.12*(0.5+0.5*fl2.next())+0.10*(0.5+0.5*fl3.next());if(Math.random()<0.0018*flow){bubbles[bi%14].fire(280+Math.random()*620,0.10+Math.random()*0.16,0.980+Math.random()*0.012);bi++;}if(Math.random()<0.0006*flow){splashes[si%8].fire(0.20+Math.random()*0.25,0.970+Math.random()*0.015);si++;}const raw=white.next();const shaped=hp.process(lp2.process(lp1.process(raw)))*0.30+bp1.process(raw)*0.35+bp2.process(raw)*0.25+bp3.process(raw)*0.10;let s=shaped*flow*0.80;for(const b of bubbles)s+=b.next(sr)*0.55;for(const sp of splashes)s+=sp.next()*0.45;return s*0.85;}};}
function makeFireGen(sr:number,outdoor=false):SampleGen{const body=makeBrownGen(1.0),bodyLP1=new LP1(0.82),bodyLP2=new LP1(0.75),crackNoise=makeWhiteGen(1.0),crackBP1=new BPF2(550,0.6,sr),crackBP2=new BPF2(1100,0.5,sr);const POOL=outdoor?18:12;const crackBursts:NoiseBurst[]=Array.from({length:POOL},()=>new NoiseBurst()),sparkRings:TonedBurst[]=Array.from({length:8},()=>new TonedBurst());let cbi=0,sri=0;const crackRate=outdoor?0.0030:0.0016;const fl1=new SmoothLFO(2.1,sr),fl2=new SmoothLFO(3.7,sr,Math.PI*0.5),fl3=new SmoothLFO(0.55,sr,Math.PI*1.1),fl4=new SmoothLFO(7.3,sr,Math.PI*0.3);return{next(){const f1=0.5+0.5*fl1.next(),f2=0.5+0.5*fl2.next(),f3=0.5+0.5*fl3.next(),f4=0.5+0.5*fl4.next();const flutter=0.35+0.30*f1+0.20*f2+0.10*f3+0.05*f4;if(Math.random()<crackRate){crackBursts[cbi%POOL].fire(0.35+Math.random()*0.50,0.968+Math.random()*0.015);cbi++;if(Math.random()<0.25){sparkRings[sri%8].fire(600+Math.random()*1800,0.06+Math.random()*0.10,0.985+Math.random()*0.010);sri++;}}const bodyRaw=bodyLP2.process(bodyLP1.process(body.next())),cn=crackNoise.next();const crackLayer=crackBP1.process(cn)*0.55+crackBP2.process(cn)*0.45;let s=bodyRaw*flutter*0.70+crackLayer*flutter*0.30;for(const c of crackBursts)s+=c.next()*0.55;for(const r of sparkRings)s+=r.next(sr)*0.45;return s*(outdoor?0.95:0.88);}};}
function makeFireRainGen(sr:number):SampleGen{const fire=makeFireGen(sr,false),rain=makeRainLightGen(sr);return{next(){return fire.next()*0.58+rain.next()*0.45;}};}
function makeForestGen(sr:number):SampleGen{const wind=makePinkGen(1.0),windLP=new LP1(0.90),windHP=new HP1(0.93),windBP=new BPF2(1800,0.4,sr);const gL1=new SmoothLFO(0.045,sr),gL2=new SmoothLFO(0.018,sr,Math.PI),gL3=new SmoothLFO(0.008,sr,Math.PI*0.6);const species=[{baseHz:3100,sweepHz:-800,chirpSecs:0.14,minGap:1.8,maxGap:4.5,amp:0.11,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(0.5+Math.random()*2.5)),harmonic:2.01},{baseHz:4200,sweepHz:600,chirpSecs:0.08,minGap:0.6,maxGap:2.0,amp:0.08,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(1.0+Math.random()*3.0)),harmonic:1.0},{baseHz:2200,sweepHz:300,chirpSecs:0.22,minGap:3.0,maxGap:8.0,amp:0.13,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(2.0+Math.random()*4.0)),harmonic:3.02},{baseHz:3800,sweepHz:-200,chirpSecs:0.06,minGap:0.3,maxGap:1.2,amp:0.07,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(0.2+Math.random()*1.0)),harmonic:1.99},{baseHz:380,sweepHz:-40,chirpSecs:0.35,minGap:4.0,maxGap:12.0,amp:0.09,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(3.0+Math.random()*6.0)),harmonic:2.0},{baseHz:5200,sweepHz:-300,chirpSecs:0.10,minGap:2.0,maxGap:6.0,amp:0.06,phase:0,env:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(1.5+Math.random()*3.5)),harmonic:1.0}];return{next(){const gust=0.45+0.30*(0.5+0.5*gL1.next())+0.15*(0.5+0.5*gL2.next())+0.10*(0.5+0.5*gL3.next());const rawWind=wind.next();const shapedWind=windHP.process(windLP.process(rawWind))*0.6+windBP.process(rawWind)*0.4;let s=shapedWind*gust*0.52;for(const b of species){b.nextCall--;if(b.nextCall<=0){b.chirpLen=Math.floor(sr*b.chirpSecs*(0.8+Math.random()*0.4));b.chirpT=0;b.env=0;b.nextCall=Math.floor(sr*(b.minGap+Math.random()*(b.maxGap-b.minGap)));}if(b.chirpT<b.chirpLen&&b.chirpLen>0){const progress=b.chirpT/b.chirpLen,hz=Math.max(20,b.baseHz+b.sweepHz*progress);b.phase+=2*Math.PI*hz/sr;if(b.phase>6283)b.phase-=Math.floor(b.phase/6.283185)*6.283185;if(progress<0.08)b.env=progress/0.08;else if(progress>0.82)b.env=(1-progress)/(1-0.82);else b.env=1.0;const fundamental=Math.sin(b.phase),harmonic=b.harmonic>1.0?Math.sin(b.phase*b.harmonic)*0.28:0,vibrato=b.chirpSecs>0.18?1.0+0.04*Math.sin(2*Math.PI*6.5*b.chirpT/sr):1.0,contrib=(fundamental+harmonic)*b.env*b.amp*vibrato;if(isFinite(contrib))s+=contrib;b.chirpT++;}}return s*0.88;}};}
function makeCricketsGen(sr:number):SampleGen{const breeze=makePinkGen(0.12),breezeLP=new LP1(0.94),breezeLFO=new SmoothLFO(0.015,sr);const crickets=[{chirpHz:4200,chirpRate:17,burstCount:3,burstGap:0.6,amp:0.085,phase:0,env:0,chirpT:0,inChirp:false,chirpLen:0,burstIdx:0,nextChirpT:0,nextBurstT:Math.floor(sr*(0.1+Math.random()*0.5))},{chirpHz:3850,chirpRate:20,burstCount:8,burstGap:0.9,amp:0.065,phase:0,env:0,chirpT:0,inChirp:false,chirpLen:0,burstIdx:0,nextChirpT:0,nextBurstT:Math.floor(sr*(0.3+Math.random()*0.8))},{chirpHz:2800,chirpRate:9,burstCount:2,burstGap:1.2,amp:0.055,phase:0,env:0,chirpT:0,inChirp:false,chirpLen:0,burstIdx:0,nextChirpT:0,nextBurstT:Math.floor(sr*(0.5+Math.random()*1.2))},{chirpHz:4500,chirpRate:14,burstCount:5,burstGap:0.4,amp:0.035,phase:0,env:0,chirpT:0,inChirp:false,chirpLen:0,burstIdx:0,nextChirpT:0,nextBurstT:Math.floor(sr*(0.2+Math.random()*0.6))},{chirpHz:2200,chirpRate:12,burstCount:4,burstGap:0.8,amp:0.048,phase:0,env:0,chirpT:0,inChirp:false,chirpLen:0,burstIdx:0,nextChirpT:0,nextBurstT:Math.floor(sr*(0.4+Math.random()*1.0))}];let frogEnv=0,nextFrog=Math.floor(sr*(6+Math.random()*15)),frogT=0;const frogLP=new LP1(0.82);let owlEnv=0,owlPhase=0,nextOwl=Math.floor(sr*(18+Math.random()*40)),owlT=0;return{next(){const breezeEnv=0.35+0.35*(0.5+0.5*breezeLFO.next());let s=breezeLP.process(breeze.next())*breezeEnv;for(const c of crickets){c.nextChirpT--;c.nextBurstT--;if(c.nextBurstT<=0&&!c.inChirp){c.burstIdx=0;c.inChirp=true;c.chirpLen=Math.floor(sr*(0.85/c.chirpRate)*(0.9+Math.random()*0.2));c.chirpT=0;c.env=0;c.nextBurstT=Math.floor(sr*(c.burstGap*(0.8+Math.random()*0.4)));}if(c.nextChirpT<=0&&c.inChirp&&c.burstIdx<c.burstCount){c.chirpLen=Math.floor(sr*(0.85/c.chirpRate)*(0.9+Math.random()*0.2));c.chirpT=0;c.nextChirpT=Math.floor(sr*(1.0/c.chirpRate)*(0.95+Math.random()*0.1));}if(c.chirpT<c.chirpLen&&c.chirpLen>0){const prog=c.chirpT/c.chirpLen,hz=c.chirpHz*(1.0+0.015*Math.sin(2*Math.PI*2.5*c.chirpT/sr));c.phase+=2*Math.PI*hz/sr;if(c.phase>6283)c.phase-=Math.floor(c.phase/6.283185)*6.283185;if(prog<0.06)c.env=prog/0.06;else if(prog>0.88)c.env=(1-prog)/0.12;else c.env=1.0;const contrib=(Math.sin(c.phase)*0.72+Math.sin(c.phase*2.0)*0.28)*c.env*c.amp;if(isFinite(contrib))s+=contrib;c.chirpT++;if(c.chirpT>=c.chirpLen){c.burstIdx++;if(c.burstIdx>=c.burstCount)c.inChirp=false;}}}nextFrog--;if(nextFrog<=0){frogEnv=0.18+Math.random()*0.12;nextFrog=Math.floor(sr*(5+Math.random()*12));frogT=0;}if(frogEnv>0.0001){frogT++;const fHz=180+20*Math.sin(2*Math.PI*22*frogT/sr);s+=frogLP.process(Math.sin(2*Math.PI*fHz*frogT/sr))*frogEnv;frogEnv*=0.9988;}nextOwl--;if(nextOwl<=0){owlEnv=0.12+Math.random()*0.08;nextOwl=Math.floor(sr*(20+Math.random()*50));owlT=0;}if(owlEnv>0.0001){owlT++;const oHz=380+30*Math.sin(2*Math.PI*0.8*owlT/sr);owlPhase+=2*Math.PI*oHz/sr;const oDur=sr*0.5,oFade=owlT<oDur?(owlT/oDur<0.1?owlT/(oDur*0.1):owlT/oDur>0.8?(1-owlT/oDur)/0.2:1.0):0;s+=Math.sin(owlPhase)*owlEnv*oFade;if(owlT>oDur)owlEnv=0;}return s*0.88;}};}
function makeMeadowGen(sr:number):SampleGen{const wind=makePinkGen(1.0),windLP=new LP1(0.88),windHP=new HP1(0.92),windBP=new BPF2(1200,0.35,sr);const gust1=new SmoothLFO(0.035,sr,0),gust2=new SmoothLFO(0.012,sr,Math.PI*0.5),gust3=new SmoothLFO(0.065,sr,Math.PI*1.2);const beeSpecs=[{hz:220,driftHz:18,lfoRate:3.2,phase:0,active:false,nextOn:Math.floor(sr*(1+Math.random()*4)),onTime:0,offTime:0},{hz:245,driftHz:22,lfoRate:2.9,phase:0,active:false,nextOn:Math.floor(sr*(2+Math.random()*5)),onTime:0,offTime:0},{hz:180,driftHz:14,lfoRate:3.6,phase:0,active:false,nextOn:Math.floor(sr*(3+Math.random()*6)),onTime:0,offTime:0}];const beeEnvs=beeSpecs.map(()=>0.0);const distantBird={phase:0,env:0,hz:0,chirpT:0,chirpLen:0,nextCall:Math.floor(sr*(4+Math.random()*8))};return{next(){const gustEnv=0.40+0.28*(0.5+0.5*gust1.next())+0.18*(0.5+0.5*gust2.next())+0.14*(0.5+0.5*gust3.next());const rawW=wind.next();let s=(windHP.process(windLP.process(rawW))*0.55+windBP.process(rawW)*0.45)*gustEnv*0.62;for(let bi=0;bi<beeSpecs.length;bi++){const bee=beeSpecs[bi];if(!bee.active){bee.nextOn--;if(bee.nextOn<=0){bee.active=true;bee.onTime=Math.floor(sr*(1.5+Math.random()*4.0));bee.offTime=0;beeEnvs[bi]=0;bee.nextOn=Math.floor(sr*(5+Math.random()*12));}}else{bee.offTime++;const fadeLen=Math.floor(sr*0.3);if(bee.offTime<fadeLen)beeEnvs[bi]=bee.offTime/fadeLen;else if(bee.offTime>bee.onTime-fadeLen)beeEnvs[bi]=Math.max(0,(bee.onTime-bee.offTime)/fadeLen);else beeEnvs[bi]=1.0;const wingFlutter=0.7+0.3*Math.sin(2*Math.PI*bee.lfoRate*bee.offTime/sr),hz=bee.hz+bee.driftHz*Math.sin(2*Math.PI*0.4*bee.offTime/sr);bee.phase+=2*Math.PI*hz/sr;const buzz=Math.sin(bee.phase)*0.6+(Math.sin(bee.phase)>0?0.4:-0.4);s+=buzz*beeEnvs[bi]*0.028*wingFlutter;if(bee.offTime>=bee.onTime)bee.active=false;}}distantBird.nextCall--;if(distantBird.nextCall<=0){distantBird.hz=2600+Math.random()*2000;distantBird.chirpLen=Math.floor(sr*(0.08+Math.random()*0.18));distantBird.chirpT=0;distantBird.env=0;distantBird.nextCall=Math.floor(sr*(3+Math.random()*9));}if(distantBird.chirpT<distantBird.chirpLen){const prog=distantBird.chirpT/distantBird.chirpLen;distantBird.phase+=2*Math.PI*distantBird.hz/sr;distantBird.env=prog<0.1?prog/0.1:prog>0.85?(1-prog)/0.15:1.0;s+=Math.sin(distantBird.phase)*distantBird.env*0.045;distantBird.chirpT++;}return s*0.90;}};}
function makeCafeGen(sr:number):SampleGen{const pink=makePinkGen(0.30),lp=new LP1(0.72),F1=new LP1(0.78),F2=new LP1(0.65);const voiceBursts:NoiseBurst[]=Array.from({length:6},()=>new NoiseBurst()),clinkBursts:TonedBurst[]=Array.from({length:3},()=>new TonedBurst());let vi=0,ci=0;return{next(){let s=lp.process(F2.process(F1.process(pink.next())))*1.1;if(Math.random()<0.00012){voiceBursts[vi%6].fire(0.35+Math.random()*0.25);vi++;}if(Math.random()<0.000015){clinkBursts[ci%3].fire(2800+Math.random()*1200,0.5+Math.random()*0.4,0.990+Math.random()*0.005);ci++;}for(const v of voiceBursts)s+=v.next()*0.5;for(const c of clinkBursts)s+=c.next(sr)*0.65;return s*0.78;}};}
function makeTrainGen(sr:number):SampleGen{const brown=makeBrownGen(1.1),lp=new LP1(0.82);const clackPeriod=Math.floor(sr/2.6),clackVar=Math.floor(clackPeriod*0.08);let nextClack=clackPeriod,t=0;const clackBursts:NoiseBurst[]=Array.from({length:4},()=>new NoiseBurst());let ci=0;return{next(){t++;if(t>=nextClack){clackBursts[ci%4].fire(0.55+Math.random()*0.35,0.970+Math.random()*0.012);ci++;nextClack=t+clackPeriod+Math.floor((Math.random()-0.5)*clackVar*2);}let s=lp.process(brown.next())*0.7;for(const c of clackBursts)s+=c.next()*0.9;return s*0.88;}};}
function makeVinylGen():SampleGen{const white=makeWhiteGen(0.06),lp1=new LP1(0.82),lp2=new LP1(0.88);const pops:NoiseBurst[]=Array.from({length:4},()=>new NoiseBurst());let pi=0;return{next(){if(Math.random()<0.000035){pops[pi%4].fire(0.3+Math.random()*0.4,0.972+Math.random()*0.012);pi++;}let s=lp2.process(lp1.process(white.next()));for(const p of pops)s+=p.next()*0.7;return s*1.2;}};}
function makeSaturnGen(sr:number):SampleGen{const brown=makeBrownGen(0.6),lp=new LP1(0.96);let t=0;const lfos=[{rate:0.031,depth:18,base:28},{rate:0.047,depth:12,base:44},{rate:0.019,depth:8,base:62}];const phases=lfos.map(()=>0);return{next(){t++;let tone=0;for(let i=0;i<lfos.length;i++){phases[i]+=2*Math.PI*lfos[i].rate/sr;const freq=lfos[i].base+lfos[i].depth*Math.sin(phases[i]);tone+=Math.sin(2*Math.PI*freq*t/sr)*0.05;}return lp.process(brown.next())*0.55+tone;}};}
function makeSolarWindGen(sr:number):SampleGen{const pink=makePinkGen(0.18),lp=new LP1(0.97);let t=0;const sweeps=[{rate:0.015,depth:55,base:90},{rate:0.022,depth:35,base:140}];const phases=sweeps.map(()=>0);return{next(){t++;let s=lp.process(pink.next())*0.8;for(let i=0;i<sweeps.length;i++){phases[i]+=2*Math.PI*sweeps[i].rate/sr;const f=sweeps[i].base+sweeps[i].depth*Math.sin(phases[i]);s+=Math.sin(2*Math.PI*f*t/sr)*0.045;}return s;}};}
function makeVoidGen(sr:number):SampleGen{const white=makeWhiteGen(0.007);let t=0;const drones=[{hz:40.0,amp:0.028,phase:0},{hz:63.5,amp:0.018,phase:0},{hz:111.2,amp:0.012,phase:0},{hz:27.5,amp:0.022,phase:0}];return{next(){t++;let s=white.next();for(const d of drones){d.phase+=2*Math.PI*d.hz/sr;s+=Math.sin(d.phase)*d.amp;}return s;}};}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export type GeneratedSoundType =
  | 'white' | 'pink' | 'brown' | 'blue' | 'grey'
  | 'rain_light' | 'rain_heavy' | 'thunderstorm' | 'creek'
  | 'ocean' | 'ocean_deep'
  | 'forest' | 'crickets' | 'meadow'
  | 'fire' | 'campfire' | 'fire_rain'
  | 'cafe' | 'train' | 'vinyl'
  | 'space' | 'solar_wind' | 'void';

const SOUND_ID_TO_TYPE: Record<string, GeneratedSoundType> = {
  white_noise:'white',pink_noise:'pink',brown_noise:'brown',blue_noise:'blue',grey_noise:'grey',
  light_rain:'rain_light',heavy_rain:'rain_heavy',creek:'creek',waterfall:'creek',
  ocean_gentle:'ocean',ocean_deep:'ocean',
  fireplace:'fire',campfire:'campfire',fire_rain:'fire_rain',
  forest_dawn:'forest',night_crickets:'crickets',meadow:'meadow',
  coffee_shop:'cafe',train:'train',vinyl_static:'vinyl',
  saturn:'space',jupiter:'solar_wind',solar_wind:'solar_wind',space_void:'void',
};

export function canGenerateSound(soundId: string): boolean { return soundId in SOUND_ID_TO_TYPE; }

export function buildSeamlessWavForId(soundId: string): string | null {
  const type = SOUND_ID_TO_TYPE[soundId];
  if (!type) return null;
  return buildSeamlessWav(type);
}

function makeGenerator(type: GeneratedSoundType, sr: number): SampleGen {
  switch (type) {
    case 'white': return makeWhiteGen();
    case 'pink': return makePinkGen(0.25);
    case 'brown': return makeBrownGen(1.1);
    case 'blue': return makeBlueGen();
    case 'grey': return makeGreyGen();
    case 'rain_light': return makeRainLightGen(sr);
    case 'rain_heavy': return makeRainHeavyGen(sr);
    case 'thunderstorm': return makeThunderstormGen(sr);
    case 'creek': return makeCreekGen(sr);
    case 'ocean': return makeOceanGen(sr);
    case 'ocean_deep': return makeOceanDeepGen(sr);
    case 'fire': return makeFireGen(sr, false);
    case 'campfire': return makeFireGen(sr, true);
    case 'fire_rain': return makeFireRainGen(sr);
    case 'forest': return makeForestGen(sr);
    case 'crickets': return makeCricketsGen(sr);
    case 'meadow': return makeMeadowGen(sr);
    case 'cafe': return makeCafeGen(sr);
    case 'train': return makeTrainGen(sr);
    case 'vinyl': return makeVinylGen();
    case 'space': return makeSaturnGen(sr);
    case 'solar_wind': return makeSolarWindGen(sr);
    case 'void': return makeVoidGen(sr);
    default: return makePinkGen(0.25);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE64 / WAV BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encodeBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  const parts: string[] = [];
  for (let i = 0; i < len; i += 3) {
    const b0=bytes[i],b1=i+1<len?bytes[i+1]:0,b2=i+2<len?bytes[i+2]:0;
    parts.push(B64_CHARS[b0>>2],B64_CHARS[((b0&3)<<4)|(b1>>4)],i+1<len?B64_CHARS[((b1&15)<<2)|(b2>>6)]:'=',i+2<len?B64_CHARS[b2&63]:'=');
  }
  return parts.join('');
}

const NATIVE_SR = 22050;
const LOOP_SECS_MAP: Partial<Record<GeneratedSoundType, number>> = {
  white:10,pink:10,brown:10,blue:10,grey:10,
  rain_light:12,rain_heavy:12,thunderstorm:12,creek:12,ocean:12,ocean_deep:12,
  fire:12,campfire:12,fire_rain:12,forest:12,crickets:12,meadow:12,
  cafe:12,train:12,vinyl:12,space:12,solar_wind:12,void:12,
};
const XFADE_SECS = 2.5;
let _genToken = 0;

function buildSeamlessWav(type: GeneratedSoundType): string {
  const loopSecs=LOOP_SECS_MAP[type]??12,loopN=Math.ceil(NATIVE_SR*loopSecs),xfadeN=Math.ceil(NATIVE_SR*XFADE_SECS),totalN=loopN+xfadeN;
  const gen=makeGenerator(type,NATIVE_SR),raw=new Float32Array(totalN);
  for(let i=0;i<totalN;i++)raw[i]=gen.next();
  for(let i=0;i<xfadeN;i++){const t=i/xfadeN,fo=Math.cos(t*Math.PI*0.5),fi=Math.sin(t*Math.PI*0.5);raw[loopN-xfadeN+i]=raw[loopN-xfadeN+i]*fo+raw[i]*fi;}
  for(let i=0;i<totalN;i++){if(!isFinite(raw[i]))raw[i]=0;}
  let peak=0;for(let i=0;i<loopN;i++){const a=Math.abs(raw[i]);if(a>peak)peak=a;}
  const scale=(peak>0.01&&isFinite(peak))?0.707/peak:1;
  const buf=new Uint8Array(44+loopN*2);
  buf[0]=0x52;buf[1]=0x49;buf[2]=0x46;buf[3]=0x46;const fs=44+loopN*2-8;buf[4]=fs&0xff;buf[5]=(fs>>8)&0xff;buf[6]=(fs>>16)&0xff;buf[7]=(fs>>24)&0xff;
  buf[8]=0x57;buf[9]=0x41;buf[10]=0x56;buf[11]=0x45;buf[12]=0x66;buf[13]=0x6d;buf[14]=0x74;buf[15]=0x20;
  buf[16]=16;buf[17]=0;buf[18]=0;buf[19]=0;buf[20]=1;buf[21]=0;buf[22]=1;buf[23]=0;
  buf[24]=NATIVE_SR&0xff;buf[25]=(NATIVE_SR>>8)&0xff;buf[26]=(NATIVE_SR>>16)&0xff;buf[27]=(NATIVE_SR>>24)&0xff;
  const br=NATIVE_SR*2;buf[28]=br&0xff;buf[29]=(br>>8)&0xff;buf[30]=(br>>16)&0xff;buf[31]=(br>>24)&0xff;
  buf[32]=2;buf[33]=0;buf[34]=16;buf[35]=0;buf[36]=0x64;buf[37]=0x61;buf[38]=0x74;buf[39]=0x61;
  const ds=loopN*2;buf[40]=ds&0xff;buf[41]=(ds>>8)&0xff;buf[42]=(ds>>16)&0xff;buf[43]=(ds>>24)&0xff;
  for(let i=0;i<loopN;i++){const s=Math.max(-1,Math.min(1,raw[i]*scale));const v=Math.max(-32768,Math.min(32767,s<0?Math.round(s*32768):Math.round(s*32767)));buf[44+i*2]=v&0xff;buf[44+i*2+1]=(v>>8)&0xff;}
  return `data:audio/wav;base64,${encodeBase64(buf)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CDN URLs
// ─────────────────────────────────────────────────────────────────────────────

const DSP_ONLY_IDS = new Set(['white_noise','pink_noise','brown_noise','blue_noise','grey_noise']);

const REAL_AUDIO_CDN_URLS: Record<string, string[]> = {
  light_rain:   ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/rain/light-rain.mp3'],
  heavy_rain:   ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/rain/heavy-rain.mp3'],
  creek:        ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/river.mp3'],
  waterfall:    ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/waterfall.mp3','https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/river.mp3'],
  ocean_gentle: ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/waves.mp3','https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/river.mp3'],
  ocean_deep:   ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/places/underwater.mp3','https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/waterfall.mp3'],
  forest_dawn:  ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/animals/birds.mp3'],
  night_crickets:['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/animals/crickets.mp3'],
  meadow:       ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/howling-wind.mp3'],
  fireplace:    ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/campfire.mp3'],
  campfire:     ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/campfire.mp3'],
  fire_rain:    ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/campfire.mp3'],
  coffee_shop:  ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/places/cafe.mp3'],
  train:        ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/transport/inside-a-train.mp3'],
  vinyl_static: ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/things/ceiling-fan.mp3'],
  saturn:       ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/places/underwater.mp3'],
  solar_wind:   ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/nature/howling-wind.mp3'],
  space_void:   ['https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio/places/underwater.mp3'],
};

const CDN = 'https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio';
const CDN_SOUND_URLS: Partial<Record<string, string>> = {
  light_rain:`${CDN}/rain/light-rain.mp3`,heavy_rain:`${CDN}/rain/heavy-rain.mp3`,
  creek:`${CDN}/nature/river.mp3`,waterfall:`${CDN}/nature/waterfall.mp3`,
  forest_dawn:`${CDN}/animals/birds.mp3`,night_crickets:`${CDN}/animals/crickets.mp3`,
  meadow:`${CDN}/nature/howling-wind.mp3`,fireplace:`${CDN}/nature/campfire.mp3`,
  campfire:`${CDN}/nature/campfire.mp3`,fire_rain:`${CDN}/nature/campfire.mp3`,
  ocean_deep:`${CDN}/places/underwater.mp3`,coffee_shop:`${CDN}/places/cafe.mp3`,
  train:`${CDN}/transport/inside-a-train.mp3`,vinyl_static:`${CDN}/things/ceiling-fan.mp3`,
  saturn:`${CDN}/places/underwater.mp3`,solar_wind:`${CDN}/nature/howling-wind.mp3`,
  space_void:`${CDN}/places/underwater.mp3`,
};

export function getCdnUrl(soundId: string): string | null {
  return CDN_SOUND_URLS[soundId] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE PLAYER (expo-audio)
// ─────────────────────────────────────────────────────────────────────────────

// Crossfade duration in seconds — long enough to be inaudible, short enough
// to not require too much look-ahead buffering.
const NATIVE_XFADE_SECS = 3.0;
// How far before the end of the track we trigger the crossfade.
// Must be > NATIVE_XFADE_SECS to give the second player time to load.
const NATIVE_XFADE_LOOKAHEAD_SECS = NATIVE_XFADE_SECS + 0.8;

interface XfadeState {
  /** The currently audible player (fading out or at full volume) */
  active: any;
  /** The next player being prepared / already fading in */
  next: any | null;
  /** Scheduled timeout id for the next crossfade trigger */
  scheduleTimer: ReturnType<typeof setTimeout> | null;
  /** Volume ramp interval for both players */
  rampInterval: ReturnType<typeof setInterval> | null;
  /** Target volume (user-controlled) */
  targetVol: number;
  /** URI of the track — needed to recreate next player */
  uri: string;
  /** Metadata for lockscreen */
  meta?: { name: string; category: string; emoji: string };
  /** Whether the whole engine has been stopped */
  stopped: boolean;
  /** Duration of the track in seconds (detected after load) */
  duration: number;
}

let _xfade: XfadeState | null = null;
let _avSessionSecs = 0;
let _avSessionTimer: ReturnType<typeof setInterval> | null = null;

/** Safely destroy a player without throwing */
function _destroyPlayer(p: any): void {
  if (!p) return;
  try { p.pause(); } catch {}
  try { p.remove(); } catch {}
}

/**
 * Create a new expo-audio player for a URI, configure it for crossfade
 * (loop = false so we can control the boundary ourselves), set volume and
 * register the lockscreen handler on iOS.
 */
async function _makeCrossfadePlayer(
  uri: string,
  volume: number,
  meta?: { name: string; category: string; emoji: string },
): Promise<any> {
  const ea = _getExpoAudio();
  if (!ea?.createAudioPlayer) throw new Error('Audio unavailable');

  let playUri = uri;
  if (uri.startsWith('data:')) {
    try {
      const fs = require('expo-file-system');
      if (fs?.cacheDirectory) {
        const hash = uri.slice(22, 54).replace(/[^a-zA-Z0-9]/g, '');
        const tmpPath = `${fs.cacheDirectory}mm_snd_${hash}.wav`;
        const info = await fs.getInfoAsync(tmpPath);
        if (!info.exists) {
          const base64 = uri.split(',')[1];
          await fs.writeAsStringAsync(tmpPath, base64, { encoding: fs.EncodingType.Base64 });
        }
        playUri = tmpPath;
      }
    } catch {}
  }

  const player = ea.createAudioPlayer({ uri: playUri });
  player.volume = volume;
  // loop = false: we handle looping via dual-player crossfade
  player.loop = false;

  if (Platform.OS === 'ios' && meta) {
    try {
      if (typeof player.setActiveForLockScreen === 'function') {
        player.setActiveForLockScreen(true, {
          title: meta.name ?? 'Ambient Sound',
          artist: 'MyMoodMapp · Mood Lab',
          albumTitle: meta.category ?? 'Soundscapes',
        });
      }
    } catch {}
  }

  return player;
}

/**
 * Ramp `player.volume` from `from` to `to` over `durationMs` ms.
 * Returns the interval id so the caller can cancel it if needed.
 */
function _rampVolume(
  player: any,
  from: number,
  to: number,
  durationMs: number,
): ReturnType<typeof setInterval> {
  const STEPS = 30;
  const stepMs = durationMs / STEPS;
  const delta = (to - from) / STEPS;
  let step = 0;
  try { player.volume = from; } catch {}
  const id = setInterval(() => {
    step++;
    const next = from + delta * step;
    try { player.volume = Math.max(0, Math.min(1, next)); } catch {}
    if (step >= STEPS) {
      clearInterval(id);
      try { player.volume = to; } catch {}
      if (to === 0) { _destroyPlayer(player); }
    }
  }, stepMs) as ReturnType<typeof setInterval>;
  return id;
}

/**
 * Schedule the next crossfade: `secsBeforeEnd` seconds before the current
 * active player's track ends, prepare the next player and crossfade.
 */
function _scheduleNativeCrossfade(state: XfadeState, secsBeforeEnd: number): void {
  if (state.stopped || secsBeforeEnd <= 0) return;
  const ms = Math.max(50, (secsBeforeEnd - NATIVE_XFADE_LOOKAHEAD_SECS) * 1000);
  state.scheduleTimer = setTimeout(async () => {
    if (state.stopped) return;
    try {
      // Build the incoming player
      const nextPlayer = await _makeCrossfadePlayer(state.uri, 0, state.meta);
      if (state.stopped) { _destroyPlayer(nextPlayer); return; }
      state.next = nextPlayer;

      // Start the next player silently then fade it in
      nextPlayer.play();
      if (Platform.OS === 'ios') {
        try {
          const ea2 = _getExpoAudio();
          if (ea2?.AudioSession?.setActive) await ea2.AudioSession.setActive(true);
        } catch {}
      }

      const xfadeMs = NATIVE_XFADE_SECS * 1000;

      // Fade out active player
      _rampVolume(state.active, state.targetVol, 0, xfadeMs);
      // Fade in next player (this also becomes the new active)
      _rampVolume(nextPlayer, 0, state.targetVol, xfadeMs);

      // Swap active/next after crossfade completes
      setTimeout(() => {
        if (state.stopped) return;
        state.active = nextPlayer;
        state.next = null;

        // Detect duration of new player and schedule the following crossfade
        let waited = 0;
        const poll = setInterval(() => {
          waited += 100;
          const dur = _getPlayerDuration(state.active);
          if (dur > 1 || waited > 5000) {
            clearInterval(poll);
            if (!state.stopped) {
              state.duration = dur > 1 ? dur : state.duration;
              _scheduleNativeCrossfade(state, state.duration);
            }
          }
        }, 100);
      }, xfadeMs + 100);
    } catch {
      // If crossfade setup fails, fall back to simple loop on current player
      if (!state.stopped) {
        try { state.active.loop = true; } catch {}
      }
    }
  }, ms) as ReturnType<typeof setTimeout>;
}

/** Attempt to read duration from expo-audio player across API variants */
function _getPlayerDuration(player: any): number {
  if (!player) return 0;
  try {
    // expo-audio >= 2.x
    const d = player.duration ?? player.durationMillis;
    if (typeof d === 'number' && d > 0) return d > 1000 ? d / 1000 : d;
    // status-based API
    const s = player.getStatusAsync?.();
    if (s?.durationMillis) return s.durationMillis / 1000;
  } catch {}
  return 0;
}

export async function configureAudioSession(_isPro = false): Promise<void> {
  if (Platform.OS === 'web') return;
  const ea = _getExpoAudio();
  if (!ea) return;

  // PRIMARY: AudioSession.setCategory('Playback') is the correct iOS-native way to
  // configure AVAudioSession for background/lockscreen/silent-mode playback.
  // setAudioModeAsync alone is NOT sufficient on iOS 17+ — it does not reliably
  // set the AVAudioSession category to AVAudioSessionCategoryPlayback.
  if (Platform.OS === 'ios' && ea.AudioSession) {
    try {
      await ea.AudioSession.setCategory('Playback');
    } catch {}
    try {
      // Also set active so the session takes effect immediately
      if (ea.AudioSession.setActive) await ea.AudioSession.setActive(true);
    } catch {}
  }

  // SECONDARY: setAudioModeAsync for cross-platform configuration and Android support.
  // CRITICAL: expo-audio uses DIFFERENT property names than expo-av:
  //   expo-av:    playsInSilentModeIOS / allowsRecordingIOS / staysActiveInBackground
  //   expo-audio: playsInSilentMode    / allowsRecording    / shouldPlayInBackground
  // Using expo-av names in expo-audio silently no-ops — this was why lockscreen audio failed.
  if (ea.setAudioModeAsync) {
    try {
      await ea.setAudioModeAsync({
        allowsRecording:        false,   // expo-audio property (NOT allowsRecordingIOS)
        playsInSilentMode:      true,    // expo-audio property (NOT playsInSilentModeIOS)
        shouldPlayInBackground: true,    // expo-audio property (NOT staysActiveInBackground)
        interruptionMode:       'doNotMix', // prevents other audio from interrupting/stopping playback
      });
    } catch {
      // Ignore — some expo-audio versions have no-op setAudioModeAsync
    }
  }
}

export function isLockscreenAudioSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const g = global as any;
    if (g.expo?.modules?.ExpoGo || g.__expoIsClient === true) return false;
  } catch {}
  return true;
}

/**
 * Start crossfade-looping playback of a URI on native.
 * Returns the XfadeState so `stopAmbientSound` can tear it down.
 */
async function _startCrossfadeEngine(
  uri: string,
  volume: number,
  meta?: { name: string; category: string; emoji: string },
): Promise<XfadeState> {
  const state: XfadeState = {
    active: null, next: null,
    scheduleTimer: null, rampInterval: null,
    targetVol: volume,
    uri, meta,
    stopped: false, duration: 0,
  };

  // Build the first player at full volume
  const player = await _makeCrossfadePlayer(uri, volume, meta);
  state.active = player;

  // Play it
  player.play();

  if (Platform.OS === 'ios') {
    try {
      const ea2 = _getExpoAudio();
      if (ea2?.AudioSession?.setActive) await ea2.AudioSession.setActive(true);
    } catch {}
  }

  // Poll for duration then schedule first crossfade
  let waited = 0;
  const poll = setInterval(() => {
    waited += 100;
    const dur = _getPlayerDuration(state.active);
    if (dur > 1 || waited > 6000) {
      clearInterval(poll);
      if (!state.stopped) {
        // For short files or when duration isn't readable, fall back to loop = true
        if (dur < NATIVE_XFADE_LOOKAHEAD_SECS + 1) {
          try { state.active.loop = true; } catch {}
        } else {
          state.duration = dur;
          _scheduleNativeCrossfade(state, dur);
        }
      }
    }
  }, 100);

  return state;
}

function _startSessionTimer(): void {
  _avSessionSecs = 0;
  if (_avSessionTimer) clearInterval(_avSessionTimer);
  _avSessionTimer = setInterval(() => { _avSessionSecs++; }, 1000);
}

export async function playAmbientSound(
  soundId: string,
  volume = 0.7,
  _isPro = false,
  _meta?: { name: string; category: string; emoji: string },
): Promise<void> {
  const myToken = ++_genToken;

  // Stop previous sound non-blocking
  if (_xfade) {
    const old = _xfade;
    _xfade = null;
    old.stopped = true;
    if (old.scheduleTimer) clearTimeout(old.scheduleTimer);
    if (old.rampInterval) clearInterval(old.rampInterval);
    _destroyPlayer(old.active);
    _destroyPlayer(old.next);
  }
  if (_avSessionTimer) { clearInterval(_avSessionTimer); _avSessionTimer = null; }
  _avSessionSecs = 0;

  if (Platform.OS === 'web') return;

  // Ensure audio session is active before playing.
  // configureAudioSession may have been called at startup, but calling it again
  // here guarantees the session is in playback mode even if the recording flow
  // changed it or the app returned from background without re-configuring.
  try { await configureAudioSession(_isPro); } catch {}

  const isDsp = DSP_ONLY_IDS.has(soundId);

  // ── Helper: start crossfade engine and store state ────────────────────────
  const startWithUri = async (uri: string) => {
    if (myToken !== _genToken) return;
    const state = await _startCrossfadeEngine(uri, volume, _meta);
    if (myToken !== _genToken) {
      state.stopped = true;
      _destroyPlayer(state.active);
      return;
    }
    _xfade = state;
    _startSessionTimer();
  };

  // DSP noise colors
  if (isDsp) {
    try {
      const cached = await _getSoundFilePath(soundId);
      if (cached && myToken === _genToken) { await startWithUri(cached); return; }
    } catch {}
    const type = SOUND_ID_TO_TYPE[soundId];
    if (!type || myToken !== _genToken) return;
    const uri = await new Promise<string>((res, rej) => setTimeout(() => { try { res(buildSeamlessWav(type)); } catch(e){ rej(e); } }, 0));
    if (myToken !== _genToken) return;
    await startWithUri(uri);
    _ensureSoundCached(soundId).catch(() => {});
    return;
  }

  // Real audio — CDN / cache
  const cdnUrls = REAL_AUDIO_CDN_URLS[soundId];
  if (!cdnUrls) {
    const type = SOUND_ID_TO_TYPE[soundId];
    if (!type || myToken !== _genToken) return;
    try {
      const cached = await _getSoundFilePath(soundId);
      if (cached && myToken === _genToken) { await startWithUri(cached); return; }
    } catch {}
    const uri = await new Promise<string>((res, rej) => setTimeout(() => { try { res(buildSeamlessWav(type)); } catch(e){ rej(e); } }, 0));
    if (myToken !== _genToken) return;
    await startWithUri(uri);
    _ensureSoundCached(soundId).catch(() => {});
    return;
  }

  let cached: string | null = null;
  try { cached = await _getSoundFilePath(soundId); } catch {}
  if (myToken !== _genToken) return;

  const firstUrl = cached ?? cdnUrls[0];
  try {
    await startWithUri(firstUrl);
    if (!cached) _ensureSoundCached(soundId).catch(() => {});
    return;
  } catch {}

  for (let i = 1; i < cdnUrls.length; i++) {
    if (myToken !== _genToken) return;
    try { await startWithUri(cdnUrls[i]); return; } catch {}
  }
}

export async function stopAmbientSound(): Promise<number> {
  const elapsed = _avSessionSecs;
  _genToken++;
  if (_avSessionTimer) { clearInterval(_avSessionTimer); _avSessionTimer = null; }
  _avSessionSecs = 0;

  if (_xfade) {
    const state = _xfade;
    _xfade = null;
    state.stopped = true;
    if (state.scheduleTimer) clearTimeout(state.scheduleTimer);
    if (state.rampInterval) clearInterval(state.rampInterval);
    _destroyPlayer(state.active);
    _destroyPlayer(state.next);
  }

  return elapsed;
}

export async function setAmbientVolume(volume: number): Promise<void> {
  const v = Math.max(0, Math.min(1, volume));
  if (_xfade) {
    _xfade.targetVol = v;
    try { if (_xfade.active) _xfade.active.volume = v; } catch {}
    // Don't update next — it's in the middle of a ramp
  }
}

export async function pauseAmbientSound(): Promise<void> {
  if (_xfade) {
    try { _xfade.active?.pause(); } catch {}
    try { _xfade.next?.pause(); } catch {}
  }
}

export async function resumeAmbientSound(): Promise<void> {
  if (_xfade) {
    try { _xfade.active?.play(); } catch {}
    try { _xfade.next?.play(); } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB AUDIO ENGINE
// ─────────────────────────────────────────────────────────────────────────────

let _noiseCtx: any = null;
let _noiseGain: any = null;
let _noiseProcessor: any = null;
let _noiseActive = false;
let _noiseGen: SampleGen | null = null;
let _noiseSessionSeconds = 0;
let _noiseSessionTimer: ReturnType<typeof setInterval> | null = null;
let _cdnAudioBuffer: any = null;
let _cdnStopFlag = false;
let _cdnNextStartTime = 0;
let _cdnActiveGains: any[] = [];

function getAudioCtxClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).AudioContext || (window as any).webkitAudioContext || null;
}
function hasWebAudio(): boolean {
  return typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext);
}

const WEB_XFADE_S = 2.5;

function _scheduleCdnSource(ctx: any, masterGain: any, startTime: number, targetVol: number): void {
  if (_cdnStopFlag || !_cdnAudioBuffer) return;
  const duration = _cdnAudioBuffer.duration as number;
  const srcGain = ctx.createGain();
  srcGain.connect(masterGain);
  _cdnActiveGains.push(srcGain);
  const src = ctx.createBufferSource();
  src.buffer = _cdnAudioBuffer;
  src.connect(srcGain);
  srcGain.gain.setValueAtTime(0, startTime);
  srcGain.gain.linearRampToValueAtTime(targetVol, startTime + WEB_XFADE_S);
  const fadeOutStart = startTime + duration - WEB_XFADE_S;
  srcGain.gain.setValueAtTime(targetVol, fadeOutStart);
  srcGain.gain.linearRampToValueAtTime(0, startTime + duration);
  src.start(startTime);
  const nextStart = startTime + duration - WEB_XFADE_S;
  const scheduleDelay = Math.max(0, (nextStart - ctx.currentTime - 0.5) * 1000);
  setTimeout(() => {
    if (_cdnStopFlag) return;
    _cdnActiveGains = _cdnActiveGains.filter(g => { try { return g !== srcGain; } catch { return false; } });
    _scheduleCdnSource(ctx, masterGain, nextStart, targetVol);
  }, scheduleDelay);
  src.onended = () => { try { srcGain.disconnect(); } catch {} };
}

export function playGeneratedSound(soundId: string, volume = 0.7): boolean {
  if (Platform.OS !== 'web') return false;
  stopGeneratedSound();
  const cdnUrl = getCdnUrl(soundId);
  if (cdnUrl) {
    if (!hasWebAudio()) {
      try {
        const el = (window as any).Audio ? new (window as any).Audio(cdnUrl) : null;
        if (!el) return false;
        el.loop = true; el.volume = volume; el.play().catch(() => {});
        _noiseCtx = { _fallbackEl: el, close() { el.pause(); el.src = ''; } };
        _noiseActive = true; _noiseSessionSeconds = 0;
        if (_noiseSessionTimer) clearInterval(_noiseSessionTimer);
        _noiseSessionTimer = setInterval(() => { _noiseSessionSeconds++; }, 1000);
        return true;
      } catch { return false; }
    }
    const AudioCtxClass = getAudioCtxClass();
    if (!AudioCtxClass) return false;
    try {
      const ctx = new AudioCtxClass();
      _noiseCtx = ctx; _cdnStopFlag = false; _cdnAudioBuffer = null; _cdnActiveGains = [];
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);
      _noiseGain = masterGain;
      const startSession = () => {
        _noiseActive = true; _noiseSessionSeconds = 0;
        if (_noiseSessionTimer) clearInterval(_noiseSessionTimer);
        _noiseSessionTimer = setInterval(() => { _noiseSessionSeconds++; }, 1000);
      };
      const loadAndSchedule = () => {
        fetch(cdnUrl).then(r => r.arrayBuffer()).then(ab => ctx.decodeAudioData(ab))
          .then(audioBuffer => {
            if (_cdnStopFlag) return;
            _cdnAudioBuffer = audioBuffer;
            _cdnNextStartTime = ctx.currentTime + 0.05;
            _scheduleCdnSource(ctx, masterGain, _cdnNextStartTime, volume);
            startSession();
          })
          .catch(() => {
            if (_cdnStopFlag) return;
            const el = new (window as any).Audio(cdnUrl);
            el.loop = true; el.volume = volume; el.crossOrigin = 'anonymous';
            try { const src = ctx.createMediaElementSource(el); src.connect(masterGain); } catch {}
            el.play().catch(() => {}); (ctx as any).__fallbackEl = el; startSession();
          });
      };
      if (ctx.state === 'suspended') { ctx.resume().then(loadAndSchedule).catch(() => {}); }
      else { loadAndSchedule(); }
      return true;
    } catch { return false; }
  }
  if (!hasWebAudio()) return false;
  const type = SOUND_ID_TO_TYPE[soundId];
  if (!type) return false;
  try {
    const AudioCtxClass = getAudioCtxClass();
    if (!AudioCtxClass) return false;
    _noiseCtx = new AudioCtxClass();
    _noiseGen = makeGenerator(type, _noiseCtx.sampleRate);
    const startGraph = (ctx: any) => {
      _noiseGain = ctx.createGain();
      _noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      _noiseGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
      _noiseGain.connect(ctx.destination);
      _noiseProcessor = ctx.createScriptProcessor(2048, 0, 1);
      const gen = _noiseGen!;
      _noiseProcessor.onaudioprocess = (e: any) => {
        const out = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < out.length; i++) { const s = gen.next(); out[i] = isFinite(s) ? s : 0; }
      };
      _noiseProcessor.connect(_noiseGain);
      _noiseActive = true; _noiseSessionSeconds = 0;
      if (_noiseSessionTimer) clearInterval(_noiseSessionTimer);
      _noiseSessionTimer = setInterval(() => { _noiseSessionSeconds++; }, 1000);
    };
    if (_noiseCtx.state === 'suspended') { _noiseCtx.resume().then(() => startGraph(_noiseCtx)).catch(() => {}); }
    else { startGraph(_noiseCtx); }
    return true;
  } catch { return false; }
}

export function stopGeneratedSound(): number {
  const elapsed = _noiseSessionSeconds;
  if (_noiseSessionTimer) { clearInterval(_noiseSessionTimer); _noiseSessionTimer = null; }
  _noiseSessionSeconds = 0;
  _cdnStopFlag = true; _cdnAudioBuffer = null; _cdnActiveGains = [];
  if (_noiseGain && _noiseCtx && typeof _noiseCtx.currentTime === 'number') {
    try {
      _noiseGain.gain.setValueAtTime(0, _noiseCtx.currentTime);
      const ctx = _noiseCtx, proc = _noiseProcessor;
      const el = ctx.__fallbackEl ?? ctx._fallbackEl;
      if (el) { try { el.pause(); el.src = ''; } catch {} }
      setTimeout(() => { try { proc?.disconnect(); } catch {} try { ctx?.close(); } catch {} }, 200);
    } catch {}
  } else if (_noiseCtx) { try { _noiseCtx.close?.(); } catch {} }
  _noiseProcessor = null; _noiseGain = null; _noiseCtx = null; _noiseGen = null; _noiseActive = false;
  return elapsed;
}

export function setGeneratedSoundVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  if (_noiseGain && _noiseCtx && typeof _noiseCtx.currentTime === 'number') {
    try { _noiseGain.gain.setValueAtTime(v, _noiseCtx.currentTime); } catch {}
    for (const g of _cdnActiveGains) { try { g.gain.setValueAtTime(v, _noiseCtx.currentTime); } catch {} }
  }
}

export function isGeneratedSoundPlaying(): boolean { return _noiseActive; }
export function getNoiseSessionSeconds(): number { return _noiseSessionSeconds; }

// ─────────────────────────────────────────────────────────────────────────────
// TONE PLAYER
// ─────────────────────────────────────────────────────────────────────────────

let _audioCtx: any = null;
let _gainNode: any = null;
let _leftOsc: any = null;
let _rightOsc: any = null;
let _toneActive = false;
let _toneSound: any = null;
let _toneNativeActive = false;

export function isToneSupported(): boolean { return true; }

function buildToneWav(hz: number, leftHz?: number, rightHz?: number): string {
  const targetSecs=30,refHz=(leftHz&&rightHz)?Math.abs(rightHz-leftHz):hz;
  const cycles=Math.max(1,Math.round(refHz*targetSecs)),loopSecs=cycles/refHz,N=Math.ceil(NATIVE_SR*loopSecs);
  const buf=new Uint8Array(44+N*2),raw=new Float32Array(N);
  if(leftHz&&rightHz){for(let i=0;i<N;i++){const t=i/NATIVE_SR;raw[i]=(Math.sin(2*Math.PI*leftHz*t)+Math.sin(2*Math.PI*rightHz*t))*0.42;}}
  else{for(let i=0;i<N;i++)raw[i]=Math.sin(2*Math.PI*hz*i/NATIVE_SR)*0.55;}
  buf[0]=0x52;buf[1]=0x49;buf[2]=0x46;buf[3]=0x46;const fs=44+N*2-8;buf[4]=fs&0xff;buf[5]=(fs>>8)&0xff;buf[6]=(fs>>16)&0xff;buf[7]=(fs>>24)&0xff;
  buf[8]=0x57;buf[9]=0x41;buf[10]=0x56;buf[11]=0x45;buf[12]=0x66;buf[13]=0x6d;buf[14]=0x74;buf[15]=0x20;
  buf[16]=16;buf[17]=0;buf[18]=0;buf[19]=0;buf[20]=1;buf[21]=0;buf[22]=1;buf[23]=0;
  buf[24]=NATIVE_SR&0xff;buf[25]=(NATIVE_SR>>8)&0xff;buf[26]=(NATIVE_SR>>16)&0xff;buf[27]=(NATIVE_SR>>24)&0xff;
  const br=NATIVE_SR*2;buf[28]=br&0xff;buf[29]=(br>>8)&0xff;buf[30]=(br>>16)&0xff;buf[31]=(br>>24)&0xff;
  buf[32]=2;buf[33]=0;buf[34]=16;buf[35]=0;buf[36]=0x64;buf[37]=0x61;buf[38]=0x74;buf[39]=0x61;
  const ds=N*2;buf[40]=ds&0xff;buf[41]=(ds>>8)&0xff;buf[42]=(ds>>16)&0xff;buf[43]=(ds>>24)&0xff;
  for(let i=0;i<N;i++){const s=Math.max(-1,Math.min(1,raw[i]));const v=Math.max(-32768,Math.min(32767,s<0?Math.round(s*32768):Math.round(s*32767)));buf[44+i*2]=v&0xff;buf[44+i*2+1]=(v>>8)&0xff;}
  return `data:audio/wav;base64,${encodeBase64(buf)}`;
}

export async function playTone(freq: FrequencyPreset, volume = 0.3): Promise<void> {
  await stopToneAsync();
  if (Platform.OS === 'web' && hasWebAudio()) {
    try {
      const AudioCtxClass = getAudioCtxClass(); if (!AudioCtxClass) return;
      _audioCtx = new AudioCtxClass();
      _gainNode = _audioCtx.createGain();
      _gainNode.gain.setValueAtTime(0, _audioCtx.currentTime);
      _gainNode.gain.linearRampToValueAtTime(volume, _audioCtx.currentTime + 2.0);
      _gainNode.connect(_audioCtx.destination);
      if (freq.category === 'binaural' && freq.leftHz && freq.rightHz) {
        const merger = _audioCtx.createChannelMerger(2); merger.connect(_gainNode);
        _leftOsc = _audioCtx.createOscillator(); _leftOsc.frequency.setValueAtTime(freq.leftHz, _audioCtx.currentTime); _leftOsc.type='sine';
        const lG = _audioCtx.createGain(); lG.gain.value=1; _leftOsc.connect(lG); lG.connect(merger,0,0); _leftOsc.start();
        _rightOsc = _audioCtx.createOscillator(); _rightOsc.frequency.setValueAtTime(freq.rightHz, _audioCtx.currentTime); _rightOsc.type='sine';
        const rG = _audioCtx.createGain(); rG.gain.value=1; _rightOsc.connect(rG); rG.connect(merger,0,1); _rightOsc.start();
      } else {
        _leftOsc = _audioCtx.createOscillator(); _leftOsc.frequency.setValueAtTime(freq.hz, _audioCtx.currentTime); _leftOsc.type='sine';
        _leftOsc.connect(_gainNode); _leftOsc.start();
      }
      _toneActive = true;
    } catch {}
  } else {
    try {
      await configureAudioSession();
      const ea = _getExpoAudio();
      if (!ea?.createAudioPlayer) return;
      const uri = buildToneWav(freq.hz, freq.leftHz, freq.rightHz);
      const player = ea.createAudioPlayer({ uri });
      player.volume = 1.0;
      player.loop = true;
      player.play();
      _toneSound = player; _toneNativeActive = true;
    } catch {}
  }
}

export function stopTone(): void { stopToneAsync().catch(() => {}); }

export async function stopToneAsync(): Promise<void> {
  if (_gainNode && _audioCtx) {
    try {
      _gainNode.gain.setValueAtTime(0, _audioCtx.currentTime);
      const ctx=_audioCtx,lo=_leftOsc,ro=_rightOsc;
      setTimeout(() => { try{lo?.stop();}catch{} try{ro?.stop();}catch{} try{ctx?.close();}catch{} }, 100);
    } catch {}
  }
  _leftOsc=null; _rightOsc=null; _gainNode=null; _audioCtx=null; _toneActive=false;
  if (_toneSound) { try { _toneSound.pause(); _toneSound.remove(); } catch {} _toneSound=null; }
  _toneNativeActive = false;
}

export function setToneVolume(volume: number): void {
  if (Platform.OS==='web' && _gainNode && _audioCtx) {
    try { _gainNode.gain.setValueAtTime(Math.max(0,Math.min(1,volume)), _audioCtx.currentTime); } catch {}
  } else if (_toneSound) {
    try { _toneSound.volume = Math.max(0, Math.min(1, volume)); } catch {}
  }
}

export function isTonePlaying(): boolean { return _toneActive || _toneNativeActive; }
export function getSessionSeconds(): number { return _avSessionSecs; }
