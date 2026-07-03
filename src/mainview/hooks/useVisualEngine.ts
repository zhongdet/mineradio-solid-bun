import { createEffect, onCleanup } from "solid-js";
import { useVisual } from "../stores/visualStore";
import { useAudio } from "../stores/audioStore";
import { useFx } from "../stores/fxStore";
import { usePerformance } from "./usePerformance";
import { useShelf3D } from "./useShelf3D";
import { useGesture } from "./useGesture";

declare const THREE: any;

const FFT_SIZE = 2048;
const BEAT_FFT_SIZE = 2048;
const SKULL_PRESET_INDEX = 6;
const PLANE_SIZE = 4.8;
const RIPPLE_MAX = 12;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function coverParticleGridForResolution(v: number): number {
  let grid = Math.round(118 * Math.max(0.74, Math.min(1.55, v)));
  grid = Math.max(88, Math.min(183, grid));
  return grid % 2 ? grid : grid + 1;
}

// ── GLSL: Full vertex shader (matches original index.html) ──

const VERT_SHADER = `
precision highp float;
uniform float uTime, uBass, uMid, uTreble, uBeat, uEnergy, uBurstAmt;
uniform float uPreset, uIntensity, uDepth, uPointScale, uSpeed, uTwist;
uniform float uVinylSpin;
uniform float uColorBoost, uScatter, uCoverRes, uBgFade;
uniform float uHasCover, uHasDepth, uEdgeEnabled, uAiBoost;
uniform float uMouseActive, uPixel, uColorMixT, uLoading;
uniform sampler2D uCoverTex, uPrevCoverTex, uEdgeTex, uRippleTex;
uniform int uRippleCount;
uniform vec2 uMouseXY, uHandXY;
uniform float uHandActive, uGestureGrip;
uniform vec3 uTintColor;
uniform float uTintStrength;
attribute vec2 aUv;
attribute float aRand;
varying vec3 vColor;
varying float vBright, vRipple, vEdgeBoost, vAlpha, vSourceLum;

#define PI 3.14159265359

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289v(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return mod289v(((x*34.0)+1.0)*x);}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453123);
}

vec2 safeCoverUv(vec2 uv) {
  return clamp(uv, vec2(0.0012), vec2(0.9988));
}

vec3 sampleNewCoverColor(vec2 uv) {
  return texture2D(uCoverTex, safeCoverUv(uv)).rgb;
}

vec3 samplePrevCoverColor(vec2 uv) {
  return texture2D(uPrevCoverTex, safeCoverUv(uv)).rgb;
}

vec4 sampleEdgeColor(vec2 uv) {
  return texture2D(uEdgeTex, safeCoverUv(uv));
}

float rippleSumAt(vec2 p, out float maxAmp) {
  float sum = 0.0; maxAmp = 0.0;
  for (int ri = 0; ri < 12; ri++) {
    if (ri >= uRippleCount) break;
    float vCoord = (float(ri) + 0.5) / 12.0;
    vec4 rd = texture2D(uRippleTex, vec2(0.5, vCoord));
    float age = rd.z; float str = rd.w;
    if (str < 0.005 || age < 0.0 || age > 2.0) continue;
    float dx = p.x - rd.x, dy = p.y - rd.y;
    float dist = sqrt(dx*dx + dy*dy);
    float lifeN = age / 2.0;
    float fadeIn  = smoothstep(0.0, 0.06, age);
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, lifeN);
    float env = fadeIn * fadeOut;
    float bulgeW = 0.55 + age * 0.80;
    float bulge  = exp(-dist*dist / (2.0 * bulgeW * bulgeW)) * (1.0 - smoothstep(0.0, 0.55, lifeN));
    float waveR  = age * 2.10;
    float ringW  = 0.40 + age * 0.22;
    float ring   = exp(-pow((dist - waveR) / ringW, 2.0));
    float local  = (bulge * 2.4 + ring * 1.30) * env * str;
    sum += local;
    maxAmp = max(maxAmp, abs(local));
  }
  return sum;
}

void main(){
  float t = uTime * uSpeed;
  vec3 pos;
  vec2 sampleUv = safeCoverUv(aUv);
  vec3 newCol = sampleNewCoverColor(sampleUv);
  vec3 prevCol = samplePrevCoverColor(sampleUv);
  vec3 coverColor = mix(prevCol, newCol, clamp(uColorMixT, 0.0, 1.0));
  vec4 edge = sampleEdgeColor(sampleUv);
  float depthVal = edge.r;
  float edgeVal  = edge.g;
  float fgMask   = edge.b;
  float lumVal   = edge.a;
  float maxRippleAmp = 0.0;
  float rippleZ = 0.0;

  vec3 defaultColor = mix(
    vec3(0.36, 0.28, 0.72),
    mix(vec3(0.85, 0.55, 0.95), vec3(0.45, 0.78, 0.95), aUv.x),
    aUv.y
  );
  vColor = mix(defaultColor, coverColor, uHasCover);
  vAlpha = 1.0;

  float K = uIntensity * 1.6;

  // === Preset 0: SILK ===
  if (uPreset < 0.5) {
    pos = position;
    rippleZ = rippleSumAt(pos.xy, maxRippleAmp);
    float midN = snoise(vec3(pos.x*1.4, pos.y*1.4, t*0.55)) * 0.6
               + snoise(vec3(pos.x*2.8+5.0, pos.y*2.8-3.0, t*0.85)) * 0.4;
    float midMask = 0.55 + 0.45 * snoise(vec3(pos.x*0.4, pos.y*0.4, t*0.18));
    float midDisp = midN * uMid * 0.55 * midMask * K;
    float trebleJ = snoise(vec3(pos.x*6.5, pos.y*6.5, t*3.5 + aRand*4.0)) * uTreble * 0.18 * K;
    float bassBreath = snoise(vec3(pos.x*0.35, pos.y*0.35, t*0.4)) * uBass * 0.42 * K;
    float depthZ = (depthVal - 0.5) * uAiBoost * uDepth * 1.40 * uHasDepth;
    pos.z = rippleZ * 1.30 + midDisp + trebleJ + bassBreath + depthZ;
  }
  // === Preset 1: TUNNEL ===
  else if (uPreset < 1.5) {
    float spin = t * 0.12;
    float angle = aUv.x * 2.0 * PI + spin;
    float flow = aUv.y - t * 0.08 * (1.0 + uBass * 0.55);
    flow = fract(flow);
    float zPos = (flow - 0.5) * 9.0;
    float baseR = 2.0 - uBass * 0.28 * K;
    float ripG  = sin(angle * 5.0 + zPos * 1.4 + t * 2.2) * 0.10 * (uMid + uTreble) * K;
    float r = baseR + ripG;
    pos.x = cos(angle) * r;
    pos.y = sin(angle) * r;
    pos.z = zPos;
    sampleUv = safeCoverUv(vec2(aUv.x, flow));
    newCol = sampleNewCoverColor(sampleUv);
    prevCol = samplePrevCoverColor(sampleUv);
    coverColor = mix(prevCol, newCol, clamp(uColorMixT, 0.0, 1.0));
    vColor = mix(defaultColor, coverColor, uHasCover);
    float depthFade = smoothstep(-4.5, 4.5, zPos);
    vColor *= 0.4 + depthFade * 0.7;
  }
  // === Preset 2: ORBIT ===
  else if (uPreset < 2.5) {
    float theta = aUv.x * 2.0 * PI;
    float phi   = (aUv.y - 0.5) * PI;
    float baseR = 2.2;
    float trebFlare = snoise(vec3(theta * 1.5, phi * 1.5, t * 0.7)) * uTreble * 0.85 * K;
    float bassExpand = uBass * 0.35 * K;
    float r = baseR * (1.0 + bassExpand) + trebFlare;
    pos.x = r * cos(phi) * cos(theta);
    pos.y = r * sin(phi);
    pos.z = r * cos(phi) * sin(theta);
    float yaw = t * 0.18;
    float cy = cos(yaw), sy = sin(yaw);
    pos.xz = mat2(cy, -sy, sy, cy) * pos.xz;
  }
  // === Preset 3: VOID ===
  else if (uPreset < 3.5) {
    pos = vec3((aUv.x - 0.5) * 0.01, (aUv.y - 0.5) * 0.01, -90.0);
    vAlpha = 0.0;
    vColor = vec3(0.0);
    maxRippleAmp = 0.0;
  }
  // === Preset 4: VINYL RECORD ===
  else if (uPreset < 4.5) {
    float bassDrive = smoothstep(0.08, 0.78, uBass + uBeat * 0.82);
    float highDrive = smoothstep(0.05, 0.46, uTreble);
    float hiResGuard = smoothstep(1.08, 1.55, uCoverRes);
    float edgeGuard = mix(1.0, 0.38, hiResGuard);
    float depthGuard = mix(1.0, 0.44, hiResGuard);
    float grooveGuard = mix(1.0, 0.48, hiResGuard);
    float beatGuard = mix(1.0, 0.36, hiResGuard);
    vec2 p = (aUv - 0.5) * 5.12;
    float spin = uVinylSpin;
    float cs = cos(spin), sn = sin(spin);
    vec2 rp = mat2(cs, -sn, sn, cs) * p;
    float d = length(p);
    float angle0 = atan(p.y, p.x);
    float recordR = 2.46;
    float coverR = 1.18;
    float recordAlpha = 1.0 - smoothstep(recordR - 0.02, recordR + 0.05, d);
    float coverMask = 1.0 - smoothstep(coverR - 0.012, coverR + 0.018, d);
    float border = exp(-pow((d - coverR) / 0.064, 2.0)) * edgeGuard;
    float outerRim = exp(-pow((d - (recordR - 0.050)) / 0.055, 2.0)) * edgeGuard;
    float vinylN = clamp((d - coverR) / max(0.001, recordR - coverR), 0.0, 1.0);
    pos = vec3(rp * (1.0 + bassDrive * 0.012 * beatGuard + uBeat * 0.026 * beatGuard), 0.0);
    vAlpha = recordAlpha;
    if (coverMask > 0.02) {
      vec2 coverUv = p / (coverR * 2.0) + 0.5;
      newCol = sampleNewCoverColor(coverUv);
      prevCol = samplePrevCoverColor(coverUv);
      coverColor = mix(prevCol, newCol, clamp(uColorMixT, 0.0, 1.0));
      if (hiResGuard > 0.001) {
        vec2 sx = vec2(0.0026, 0.0);
        vec2 sy = vec2(0.0, 0.0026);
        vec3 softNew = (sampleNewCoverColor(coverUv + sx) + sampleNewCoverColor(coverUv - sx) + sampleNewCoverColor(coverUv + sy) + sampleNewCoverColor(coverUv - sy)) * 0.25;
        vec3 softPrev = (samplePrevCoverColor(coverUv + sx) + samplePrevCoverColor(coverUv - sx) + samplePrevCoverColor(coverUv + sy) + samplePrevCoverColor(coverUv - sy)) * 0.25;
        coverColor = mix(coverColor, mix(softPrev, softNew, clamp(uColorMixT, 0.0, 1.0)), hiResGuard * 0.42);
      }
      vColor = mix(defaultColor, coverColor, uHasCover);
      float coverShade = 1.02 + 0.10 * (1.0 - smoothstep(0.0, coverR, d));
      vColor *= coverShade;
      vColor = mix(vColor, vec3(1.0), border * 0.54);
      pos.z = 0.040 + border * 0.026 * depthGuard + uBeat * 0.018 * beatGuard;
      maxRippleAmp = max(maxRippleAmp, border * 0.30 + bassDrive * 0.075 * beatGuard + uBeat * 0.075 * beatGuard);
    } else {
      float groove = 0.5 + 0.5 * sin((d - coverR) * mix(98.0, 58.0, hiResGuard));
      float fineGroove = 0.5 + 0.5 * sin((d - coverR) * mix(170.0, 92.0, hiResGuard) + aRand * 3.0);
      float tick = smoothstep(0.82, 0.995, hash11(floor((angle0 + PI) * 38.0) + floor(d * 72.0) * 2.1));
      vec3 vinyl = vec3(0.052, 0.054, 0.058) + vec3(0.052 * grooveGuard) * groove + vec3(0.026 * grooveGuard) * fineGroove;
      vinyl = mix(vinyl, coverColor * 0.32, 0.18 * (1.0 - vinylN));
      float whiteRing = max(border * 0.92, outerRim * 0.26);
      vColor = mix(vinyl, vec3(0.92, 0.94, 0.94), whiteRing);
      vColor = mix(vColor, vec3(1.0), tick * highDrive * (0.06 + border * 0.12) * grooveGuard);
      pos.z = groove * 0.010 * grooveGuard + border * 0.024 * depthGuard + bassDrive * vinylN * 0.016 * K * beatGuard + tick * highDrive * 0.010 * grooveGuard;
      maxRippleAmp = max(maxRippleAmp, border * 0.32 + outerRim * 0.12 + bassDrive * vinylN * 0.11 * beatGuard + tick * highDrive * 0.10 * grooveGuard + uBeat * vinylN * 0.08 * beatGuard);
    }
  }
  // === Preset 5: WALLPAPER PULSE ===
  else {
    float bassGlow = smoothstep(0.07, 0.78, uBass) * 0.34 + uBeat * 0.014;
    float midGlow = smoothstep(0.07, 0.62, uMid) * 0.42;
    float highGlow = smoothstep(0.04, 0.46, uTreble) * 0.46;
    float lane = aUv.y;
    float transition = clamp(uBurstAmt, 0.0, 1.0);
    if (lane < 0.80) {
      float laneWarp = snoise(vec3(aUv.x * 0.42, lane * 1.7, t * 0.026)) * 0.11 + (hash11(aRand * 73.1) - 0.5) * 0.045;
      float warpedLane = clamp(lane + laneWarp, 0.0, 0.80);
      float bandCoord = warpedLane / 0.80 * 5.65 + snoise(vec3(aUv.x * 0.82, lane * 2.25, t * 0.032)) * 0.62;
      float band = floor(bandCoord);
      float local = fract(bandCoord + hash11(band * 9.13 + aRand * 2.4) * 0.18);
      float bandN = clamp((band + 0.5) / 5.65, 0.0, 1.0);
      float seed = hash11(band * 19.17 + aRand * 31.0);
      float flow = fract(aUv.x + t * (0.0034 + bandN * 0.0038 + seed * 0.0022) + seed * 0.53);
      float arc = (flow - 0.5) * PI * (1.35 + bandN * 0.72 + seed * 0.24);
      float armCurve = sin(arc + bandN * 2.2 + seed * 5.3);
      float spiralRadius = 9.2 + bandN * 11.8 + seed * 6.0 + local * 2.9;
      float x = cos(arc * 0.72 + bandN * 0.92 + seed * 1.3) * spiralRadius + (flow - 0.5) * (13.5 + bandN * 9.5);
      float ribbonPhase = flow * PI * 2.0 * (0.55 + bandN * 0.24 + seed * 0.10) + t * (0.010 + bandN * 0.007) + seed * 5.7;
      float broadWave = sin(ribbonPhase) * 0.92;
      float fineWave = sin(ribbonPhase * (1.36 + seed * 0.62) - t * 0.044 + seed * 5.0) * 0.045;
      float yBase = (bandN - 0.5) * 13.2 + armCurve * (2.3 + bandN * 1.6) + (seed - 0.5) * 1.85 + snoise(vec3(bandN * 2.0, flow * 0.62, seed)) * 0.92;
      float ridgeCenter = 0.43 + (seed - 0.5) * 0.18;
      float ridge = exp(-pow((local - ridgeCenter) / (0.25 + seed * 0.04), 2.0));
      float softMask = smoothstep(0.010, 0.12, lane) * (1.0 - smoothstep(0.72, 0.81, lane));
      float ribbonNoise = snoise(vec3(flow * 1.18 + seed, bandN * 2.0, t * 0.018)) * 0.74;
      float zLayer = mix(-23.5, 15.5, bandN) + (seed - 0.5) * 6.0;
      pos.x = x + ribbonNoise * 1.40 + sin(t * 0.012 + seed * 8.0) * 0.22;
      pos.y = yBase + broadWave + fineWave + (local - 0.5) * (0.58 + ridge * 0.14);
      pos.z = zLayer + broadWave * 1.35 + ribbonNoise * 1.85;
      float pulseLine = 0.5 + 0.5 * sin(ribbonPhase * (1.7 + seed * 0.9) - t * 0.32 + seed * 6.0);
      vec3 aurora = mix(vec3(0.52, 0.86, 1.0), vec3(0.70, 0.58, 1.0), bandN);
      aurora = mix(aurora, vec3(0.96, 0.98, 0.92), bassGlow * 0.05);
      vAlpha = (0.18 + ridge * 0.78 + pulseLine * highGlow * 0.035 + bassGlow * 0.025) * softMask * (0.96 + transition * 0.02);
      vColor = mix(coverColor, aurora, 0.62 + ridge * 0.22) * (0.76 + ridge * 0.86 + pulseLine * highGlow * 0.05 + bassGlow * 0.04);
      maxRippleAmp = max(maxRippleAmp, ridge * (0.12 + midGlow * 0.05) + pulseLine * highGlow * 0.045 + bassGlow * 0.030);
    } else {
      float q = (lane - 0.80) / 0.20;
      float seed = hash11(aRand * 917.0 + floor(q * 130.0));
      float depth = mix(-32.0, 18.0, seed);
      float drift = fract(aUv.x + t * (0.0014 + seed * 0.0048) + seed * 0.63);
      float cluster = snoise(vec3(seed * 2.0, q * 3.2, t * 0.007));
      float x = (drift - 0.5) * (45.0 + seed * 22.0) + cluster * 3.4;
      float y = (hash11(aRand * 331.0 + seed * 5.0) - 0.5) * 22.0 + sin(t * (0.018 + seed * 0.028) + seed * 7.0) * 0.86;
      float z = depth + sin(t * (0.020 + seed * 0.032) + aRand * 8.0) * 1.05;
      float twinkle = pow(0.5 + 0.5 * sin(t * (0.24 + seed * 0.42) + aRand * 17.0), 5.0);
      float dust = smoothstep(0.22, 0.98, hash11(aRand * 661.0 + floor(q * 160.0)));
      pos = vec3(x, y, z);
      vAlpha = dust * (0.16 + twinkle * 0.46 + highGlow * 0.025 + bassGlow * 0.018) * (1.0 - q * 0.06);
      vColor = mix(coverColor, vec3(0.92, 0.97, 1.0), 0.62 + twinkle * 0.14) * (0.72 + twinkle * 0.62 + bassGlow * 0.025);
      maxRippleAmp = max(maxRippleAmp, twinkle * highGlow * 0.055 + dust * bassGlow * 0.030);
    }
    if (transition > 0.001) {
      float bloomT = smoothstep(0.0, 1.0, transition);
      vec2 burstVec = pos.xy + vec2(hash11(aRand * 31.0) - 0.5, hash11(aRand * 47.0) - 0.5) * 0.75;
      vec2 burstDir = burstVec / max(length(burstVec), 0.001);
      pos.xy += burstDir * bloomT * 0.026;
      pos.xy += vec2(snoise(vec3(aRand, t * 0.014, 1.0)), snoise(vec3(aRand, t * 0.014, 5.0))) * bloomT * 0.06;
      pos.xy *= 1.0 + bloomT * 0.014;
      pos.z += (hash11(aRand * 123.0) - 0.5) * bloomT * 0.18;
      vAlpha *= 0.86 + bloomT * 0.22;
      maxRippleAmp = max(maxRippleAmp, bloomT * 0.10);
    }
  }

  // Mouse interaction (SILK only)
  if (uMouseActive > 0.5 && uPreset < 0.5) {
    float mdx = pos.x - uMouseXY.x;
    float mdy = pos.y - uMouseXY.y;
    float md = sqrt(mdx*mdx + mdy*mdy);
    if (md < 1.0) {
      float push = (1.0 - md) * (1.0 - md);
      pos.z += push * 0.55;
    }
  }

  // Hand gesture interaction
  if (uHandActive > 0.01) {
    float hdx = pos.x - uHandXY.x;
    float hdy = pos.y - uHandXY.y;
    float hd = sqrt(hdx*hdx + hdy*hdy);
    float rad = 1.55;
    if (hd < rad) {
      float push = (rad - hd) / rad;
      push = push * push * uHandActive;
      pos.z += push * 1.10;
      vec2 outDir = vec2(hdx, hdy) / max(0.001, hd);
      pos.xy += outDir * push * 0.28;
    }
  }
  if (uGestureGrip > 0.001) {
    float grip = clamp(uGestureGrip, 0.0, 1.0);
    float gripWave = 0.5 + 0.5 * sin(uTime * 2.2 + aRand * 6.2831);
    pos.xy *= mix(1.0, 0.66 + gripWave * 0.035, grip);
    pos.z += grip * (0.18 + uBass * 0.22 + gripWave * 0.10);
  }

  // Scatter / twist
  if (uScatter > 0.001) {
    vec2 jdir = vec2(cos(aRand * 6.2831), sin(aRand * 6.2831));
    pos.xy += jdir * uScatter * (0.05 + uTreble * 0.10);
  }
  if (uTwist > 0.001 && uPreset < 0.5) {
    float ta = uTwist * pos.z * 0.6;
    float cs = cos(ta), sn = sin(ta);
    pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;
  }

  // Color post-processing
  float vinylHiResGuard = smoothstep(1.08, 1.55, uCoverRes) * step(3.5, uPreset) * (1.0 - step(4.5, uPreset));
  float edgeBoost = uEdgeEnabled * edgeVal * mix(1.0, 0.42, vinylHiResGuard);
  vSourceLum = dot(max(vColor, vec3(0.0)), vec3(0.299, 0.587, 0.114));
  float blackParticleGuard = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  vEdgeBoost = edgeBoost * (uPreset > 3.5 ? 0.22 : 1.0) * (1.0 - blackParticleGuard);
  vColor = pow(max(vColor, vec3(0.0)), vec3(1.0 / max(0.35, uColorBoost)));
  float edgeColorMix = edgeBoost * (uPreset > 3.5 ? 0.20 : 0.50) * (1.0 - blackParticleGuard);
  vColor = mix(vColor, vColor + vec3(0.20), edgeColorMix);
  float tintLum = max(max(vColor.r, vColor.g), vColor.b);
  vec3 tintedColor = uTintColor * max(0.24, tintLum * 1.12);
  vColor = mix(vColor, tintedColor, clamp(uTintStrength, 0.0, 1.0) * (1.0 - blackParticleGuard));

  vBright = 0.82 + maxRippleAmp * 0.55 + uBass * 0.10 + edgeBoost * 0.30 + uEnergy * 0.05 + uBurstAmt * 0.40;
  if (uPreset > 4.5) {
    vBright = 0.94 + maxRippleAmp * 0.34 + uBass * 0.020 + uEnergy * 0.026 + uBurstAmt * 0.025;
  } else if (uPreset > 3.5) {
    vBright = 0.94 + maxRippleAmp * 0.64 + uBass * 0.08 + edgeBoost * 0.12 + uEnergy * 0.05 + uBeat * 0.16 + uBurstAmt * 0.16;
  }
  vRipple = clamp(maxRippleAmp * 1.5, 0.0, 1.0);

  if (uHasDepth > 0.5 && uPreset < 0.5) {
    float bgMul = mix(1.0, 0.55, uBgFade * (1.0 - fgMask));
    vBright *= bgMul;
  }
  vBright += uGestureGrip * 0.22;
  float loadingMistSize = 1.0;

  // Loading mist
  if (uLoading > 0.001) {
    float mistSeed = hash11(aRand * 931.7);
    float mistLayer = floor(mistSeed * 4.0);
    float layerN = (mistLayer + 0.5) / 4.0;
    float mistAngle = aRand * 6.2831 + uTime * (0.16 + mistSeed * 0.18) + snoise(vec3(aRand * 2.1, uTime * 0.24, 2.0)) * 1.85;
    float mistR = mix(1.35, 3.15, sqrt(hash11(aRand * 127.3))) * (1.0 + sin(uTime * 0.42 + aRand * 7.0) * 0.13);
    vec2 mistCurl = vec2(
      snoise(vec3(aRand * 4.1, uTime * 0.32, 3.0)),
      snoise(vec3(aRand * 4.7, uTime * 0.30, 8.0))
    );
    float mistBreath = 0.5 + 0.5 * sin(uTime * (0.82 + mistSeed * 0.55) + aRand * 17.0);
    float mistRibbon = sin(mistAngle * (1.35 + layerN * 0.55) + uTime * 0.34 + mistSeed * 4.0);
    float glowPick = smoothstep(0.88, 0.997, hash11(aRand * 1501.0 + mistLayer * 17.0));
    float dustPick = 0.34 + glowPick * 0.66;
    vec3 mistPos = vec3(
      cos(mistAngle) * mistR * (1.24 + mistCurl.x * 0.16) + mistCurl.x * 0.72,
      sin(mistAngle * 0.82 + mistRibbon * 0.25) * mistR * (0.56 + layerN * 0.10) + mistCurl.y * 0.62,
      (layerN - 0.5) * 4.85 + mistCurl.x * 0.56 + mistBreath * 0.36 + mistRibbon * 0.24
    );
    vec3 mistCol = mix(vec3(0.62, 0.86, 0.84), vec3(0.36, 0.46, 0.78), mistSeed);
    mistCol = mix(mistCol, vec3(0.94, 1.0, 0.97), glowPick * (0.45 + mistBreath * 0.35));
    vColor = mix(vColor, mistCol, uLoading * 0.78);
    vBright = mix(vBright, 0.20 + mistBreath * 0.18 + abs(mistCurl.x) * 0.06 + glowPick * (0.72 + abs(mistRibbon) * 0.24), uLoading);
    vAlpha = mix(vAlpha, 0.08 + mistBreath * 0.11 + dustPick * 0.11 + glowPick * 0.30, uLoading);
    pos = mix(pos, mistPos, uLoading);
    loadingMistSize = 1.26 + mistBreath * 0.24 + abs(mistRibbon) * 0.14 + glowPick * 0.78;
  }

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  float depthSize = 36.0 / max(0.5, -mvPos.z);
  float audioBoost = 1.0 + maxRippleAmp * 0.7 + edgeBoost * 0.55 + uBeat * 0.30 + uBurstAmt * 0.5;
  float sz = clamp(depthSize * audioBoost, 1.05, 4.95);
  if (uPreset > 4.5) {
    float flowDrive = uBass * 0.070 + uMid * 0.046 + uTreble * 0.060 + uBurstAmt * 0.090 + uBeat * 0.055;
    sz = clamp(depthSize * (1.05 + flowDrive), 1.00, 5.45);
  } else if (uPreset > 3.5) {
    float ringDrive = uBass * 0.30 + uMid * 0.18 + uTreble * 0.22 + uBeat * 0.30;
    sz = clamp(depthSize * (0.90 + ringDrive * 0.62), 1.05, 3.90);
  }
  sz = mix(sz, sz * loadingMistSize, uLoading);
  gl_PointSize = sz * uPixel * uPointScale;
  gl_Position = projectionMatrix * mvPos;
}
`;

// ── GLSL: Main fragment shader ──

const FRAG_SHADER = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha, uPreset, uParticleDim;
varying vec3 vColor;
varying float vBright, vRipple, vEdgeBoost, vAlpha, vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.02) discard;
  vec3 col = vColor * vBright;
  col = mix(col, col * 1.3 + vec3(0.05), vEdgeBoost * 0.35);
  col = mix(col, col * 1.2, vRipple * 0.4);
  float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  float nonBlack = 1.0 - keepBlack;
  float dotDist = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float readableRim = smoothstep(0.44, 0.94, dotDist) * (1.0 - smoothstep(0.94, 1.08, dotDist)) * tex.a;
  float outLum = dot(col, vec3(0.299, 0.587, 0.114));
  float lightParticle = smoothstep(0.50, 0.82, outLum) * nonBlack;
  float darkParticle = (1.0 - smoothstep(0.20, 0.50, outLum)) * nonBlack;
  col = mix(col, vec3(0.0), readableRim * lightParticle * 0.38);
  col = mix(col, vec3(1.0), readableRim * darkParticle * 0.20);
  col = clamp(col, vec3(0.0), vec3(1.6));
  gl_FragColor = vec4(col, tex.a * uAlpha * uParticleDim * vAlpha);
}
`;

// ── GLSL: Bloom fragment shader ──

const BLOOM_FRAG_SHADER = `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha, uBloomStrength, uPreset, uParticleDim;
varying vec3 vColor;
varying float vBright, vRipple, vEdgeBoost, vAlpha, vSourceLum;

void main(){
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.01) discard;
  float soft = tex.a * tex.a;
  vec3 col = vColor * (0.55 + vBright * 0.62);
  col = mix(col, col + vec3(0.22, 0.18, 0.10), vEdgeBoost * 0.35);
  col = clamp(col, vec3(0.0), vec3(1.8));
  float pulse = 1.0 + vRipple * 0.65;
  float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);
  float bloomKeep = 1.0 - keepBlack * 0.92;
  gl_FragColor = vec4(col, soft * uAlpha * uBloomStrength * uParticleDim * pulse * 0.55 * vAlpha * bloomKeep);
}
`;

// ── Bloom vertex shader: same as main but with uBloomSize ──

const BLOOM_VERT_SHADER = VERT_SHADER
  .replace('uniform float uMouseActive, uPixel, uColorMixT, uLoading;', 'uniform float uMouseActive, uPixel, uColorMixT, uLoading, uBloomSize;')
  .replace('gl_PointSize = sz * uPixel * uPointScale;', 'gl_PointSize = sz * uPixel * uPointScale * uBloomSize;');

// ── Edge/depth texture generation (ported from app.js:9460-9539) ──

function buildEdgeAndDepth(srcCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const W = 256, H = 256, N = W * H;
  const normalized = document.createElement("canvas");
  normalized.width = W;
  normalized.height = H;
  const sctx = normalized.getContext("2d")!;
  sctx.drawImage(srcCanvas, 0, 0, W, H);
  const src = sctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(N);
  const blur = new Float32Array(N);
  const tmp = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const di = i * 4;
    lum[i] = (src[di] * 0.299 + src[di + 1] * 0.587 + src[di + 2] * 0.114) / 255;
  }

  function blurH(s: Float32Array, d: Float32Array, r: number) {
    for (let y = 0; y < H; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += s[y * W + Math.max(0, Math.min(W - 1, x))];
      for (let x = 0; x < W; x++) {
        d[y * W + x] = sum / (2 * r + 1);
        const xR = Math.min(W - 1, x + r + 1), xL = Math.max(0, x - r);
        sum += s[y * W + xR] - s[y * W + xL];
      }
    }
  }

  function blurV(s: Float32Array, d: Float32Array, r: number) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += s[Math.max(0, Math.min(H - 1, y)) * W + x];
      for (let y = 0; y < H; y++) {
        d[y * W + x] = sum / (2 * r + 1);
        const yD = Math.min(H - 1, y + r + 1), yU = Math.max(0, y - r);
        sum += s[yD * W + x] - s[yU * W + x];
      }
    }
  }

  blurH(lum, tmp, 4);
  blurV(tmp, blur, 4);

  const edge = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx = -blur[(y - 1) * W + (x - 1)] - 2 * blur[y * W + (x - 1)] - blur[(y + 1) * W + (x - 1)]
        + blur[(y - 1) * W + (x + 1)] + 2 * blur[y * W + (x + 1)] + blur[(y + 1) * W + (x + 1)];
      const gy = -blur[(y - 1) * W + (x - 1)] - 2 * blur[(y - 1) * W + x] - blur[(y - 1) * W + (x + 1)]
        + blur[(y + 1) * W + (x - 1)] + 2 * blur[(y + 1) * W + x] + blur[(y + 1) * W + (x + 1)];
      edge[y * W + x] = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) * 1.4);
    }
  }

  const depth = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const cx = (x / (W - 1) - 0.5) * 2.0;
      const cy = (y / (H - 1) - 0.5) * 2.0;
      const rr = Math.sqrt(cx * cx + cy * cy);
      const centerBias = 1.0 - Math.min(1, rr * 0.75);
      const bright = blur[i];
      depth[i] = Math.min(1.0, bright * 0.45 + centerBias * 0.55);
    }
  }

  const fg = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    fg[i] = Math.min(1.0, depth[i] * 0.6 + edge[i] * 0.5);
  }

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d")!;
  const imgOut = octx.createImageData(W, H);
  for (let i = 0; i < N; i++) {
    const di = i * 4;
    imgOut.data[di] = Math.round(depth[i] * 255);
    imgOut.data[di + 1] = Math.round(edge[i] * 255);
    imgOut.data[di + 2] = Math.round(fg[i] * 255);
    imgOut.data[di + 3] = Math.round(lum[i] * 255);
  }
  octx.putImageData(imgOut, 0, 0);
  return out;
}

export function useVisualEngine() {
  const visual = useVisual();
  const audio = useAudio();
  const fx = useFx();
  const perf = usePerformance();

  // Three.js objects
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let particles: any = null;
  let shelf3d: any = null;
  let gesture: any = null;
  let bloomParticles: any = null;
  let floatGroup: any = null;
  let backCoverGroup: any = null;
  let uniforms: any = null;
  let animFrameId: number | null = null;
  let initialized = false;
  let prevTime = 0;
  let coverTex: any = null;
  let prevCoverTex: any = null;
  let coverEdgeTex: any = null;

  // Local audio analysis buffers
  let localFrequencyData: Uint8Array | null = null;
  let localTimeDomainData: Uint8Array | null = null;
  let localBeatFrequencyData: Uint8Array | null = null;
  let localBeatTimeDomainData: Uint8Array | null = null;

  // Peak tracking
  let bassPeak = 0.12;
  let midPeak = 0.10;
  let treblePeak = 0.08;
  let energyPeak = 0.030;
  let prevEnergy = 0;
  let beatOnsetFlag = false;
  let scheduledBeatPulse = 0;
  let scheduledBeatFlag = false;
  let beatPulseLocal = 0;

  // Mouse world
  let mouseWorld = { x: 0, y: 0 };
  let mouseActive = false;

  // Ripple system
  const RIPPLE_MAX_LOCAL = RIPPLE_MAX;
  const rippleData = new Float32Array(RIPPLE_MAX_LOCAL * 4);
  let rippleTex: any = null;
  const ripples: { x: number; y: number; age: number; str: number }[] = [];
  let rippleIdx = 0;
  let lastRippleAt = 0;
  let lastBassRising = false;
  const BASS_THRESHOLD = 0.30;
  const RIPPLE_COOLDOWN = 0.32;
  const regions: { x: number; y: number }[] = [];
  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      regions.push({
        x: (rx / 2 - 0.5) * PLANE_SIZE * 0.72,
        y: (ry / 2 - 0.5) * PLANE_SIZE * 0.72,
      });
    }
  }

  // Back cover color array
  let backCoverColorArr: Float32Array | null = null;

  // Float layer arrays
  let floatPositionsArr: Float32Array | null = null;
  let floatBaseArr: Float32Array | null = null;
  let floatPhaseArr: Float32Array | null = null;
  let floatColorArr: Float32Array | null = null;

  // Dynamic grid
  let currentGrid = 118;
  let currentGeometry: any = null;

  function initThreeJs(_canvas: HTMLCanvasElement) {
    if (initialized) return;
    initialized = true;

    // Allocate local FFT buffers
    localFrequencyData = new Uint8Array(FFT_SIZE / 2);
    localTimeDomainData = new Uint8Array(FFT_SIZE);
    localBeatFrequencyData = new Uint8Array(BEAT_FFT_SIZE / 2);
    localBeatTimeDomainData = new Uint8Array(BEAT_FFT_SIZE);

    // Scene
    scene = new THREE.Scene();
    scene.background = null;

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 6.6;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(perf.getRenderPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.background = "transparent";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.tabIndex = 0;

    // Initialize 3D shelf
    shelf3d = useShelf3D(scene, camera);

    // Initialize gesture tracking
    gesture = useGesture();

    const container = document.getElementById("canvas-container");
    if (container) {
      container.appendChild(renderer.domElement);
    }

    // Dot texture (soft radial gradient)
    function makeDotTexture() {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const ctx = cv.getContext("2d")!;
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
      g.addColorStop(0.0, "rgba(255,255,255,0.96)");
      g.addColorStop(0.42, "rgba(255,255,255,0.78)");
      g.addColorStop(0.72, "rgba(255,255,255,0.22)");
      g.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    }
    const dotTexture = makeDotTexture();

    // Cover textures
    coverTex = new THREE.Texture();
    coverTex.minFilter = THREE.LinearFilter;
    coverTex.magFilter = THREE.LinearFilter;
    coverTex.wrapS = THREE.ClampToEdgeWrapping;
    coverTex.wrapT = THREE.ClampToEdgeWrapping;
    prevCoverTex = new THREE.Texture();
    prevCoverTex.minFilter = THREE.LinearFilter;
    prevCoverTex.magFilter = THREE.LinearFilter;

    // Initial 1x1 pixel for cover
    const initCv = document.createElement("canvas");
    initCv.width = initCv.height = 4;
    const initCtx = initCv.getContext("2d")!;
    initCtx.fillStyle = "#1c1c28";
    initCtx.fillRect(0, 0, 4, 4);
    coverTex.image = initCv;
    coverTex.needsUpdate = true;

    // Edge texture
    coverEdgeTex = new THREE.Texture();
    coverEdgeTex.minFilter = THREE.LinearFilter;
    coverEdgeTex.magFilter = THREE.LinearFilter;
    const edgeInit = document.createElement("canvas");
    edgeInit.width = edgeInit.height = 4;
    const edgeCtx = edgeInit.getContext("2d")!;
    edgeCtx.fillStyle = "rgba(128,0,0,255)";
    edgeCtx.fillRect(0, 0, 4, 4);
    coverEdgeTex.image = edgeInit;
    coverEdgeTex.needsUpdate = true;

    // Ripple texture (1x12 float RGBA)
    for (let ri = 0; ri < RIPPLE_MAX_LOCAL; ri++) {
      ripples.push({ x: 0, y: 0, age: -10, str: 0 });
    }
    rippleTex = new THREE.DataTexture(rippleData, 1, RIPPLE_MAX_LOCAL, THREE.RGBAFormat, THREE.FloatType);
    rippleTex.magFilter = THREE.NearestFilter;
    rippleTex.minFilter = THREE.NearestFilter;

    // Uniforms (matching original defaults)
    uniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uEnergy: { value: 0 },
      uBurstAmt: { value: 0 },
      uVinylSpin: { value: 0 },
      uPreset: { value: 0 },
      uIntensity: { value: 0.85 },
      uDepth: { value: 1.0 },
      uPointScale: { value: 1.0 },
      uSpeed: { value: 1.0 },
      uTwist: { value: 0 },
      uColorBoost: { value: 1.1 },
      uScatter: { value: 0 },
      uCoverRes: { value: 1.0 },
      uBgFade: { value: 0.20 },
      uBloomStrength: { value: 0.62 },
      uBloomSize: { value: 2.65 },
      uTintColor: { value: new THREE.Color("#9db8cf") },
      uTintStrength: { value: 0 },
      uCoverTex: { value: coverTex },
      uPrevCoverTex: { value: prevCoverTex },
      uColorMixT: { value: 1.0 },
      uEdgeTex: { value: coverEdgeTex },
      uRippleTex: { value: rippleTex },
      uRippleCount: { value: 0 },
      uDotTex: { value: dotTexture },
      uHasCover: { value: 0 },
      uHasDepth: { value: 0 },
      uEdgeEnabled: { value: 1 },
      uAiBoost: { value: 0 },
      uMouseXY: { value: new THREE.Vector2(-999, -999) },
      uMouseActive: { value: 0 },
      uHandXY: { value: new THREE.Vector2(-999, -999) },
      uHandActive: { value: 0 },
      uGestureGrip: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() },
      uAlpha: { value: 0 },
      uParticleDim: { value: 1 },
      uFloatAlpha: { value: 0 },
      uLoading: { value: 0 },
    };

    // Build initial geometry
    currentGrid = coverParticleGridForResolution(1.0);
    currentGeometry = buildCoverParticleGeometry(currentGrid);

    createParticles();
    createBloomParticles();
    createFloatLayer();

    // Resize
    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (uniforms) uniforms.uPixel.value = renderer.getPixelRatio();
    };
    window.addEventListener("resize", handleResize);

    // Pointer tracking
    const handlePointerMove = (e: MouseEvent) => {
      if (uniforms) {
        uniforms.uMouseXY.value.set(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1,
        );
      }
      mouseWorld.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseWorld.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseActive = true;
      visual.set("pointerTarget", { x: mouseWorld.x * 0.3, y: mouseWorld.y * 0.2 });
    };
    const handlePointerLeave = () => { mouseActive = false; };
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseleave", handlePointerLeave);

    // Orbit controls
    let isDragging = false;
    let lastX = 0, lastY = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === renderer.domElement) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      visual.set("orbit", {
        userTheta: visual.state.orbit.userTheta + dx * 0.005,
        userPhi: Math.max(
          -Math.PI * 0.45,
          Math.min(Math.PI * 0.45, visual.state.orbit.userPhi - dy * 0.005),
        ),
      });
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const handleMouseUp = () => { isDragging = false; };
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Wheel zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const newRadius = Math.max(
        2.4,
        Math.min(14.0, visual.state.orbit.userRadius + e.deltaY * 0.01),
      );
      visual.set("orbit", { userRadius: newRadius });
    };
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

    // Double click to recenter
    const handleDblClick = () => {
      visual.set("orbit", {
        userTheta: 0,
        userPhi: 0.08,
        userRadius: 6.6,
        recentering: true,
      });
    };
    renderer.domElement.addEventListener("dblclick", handleDblClick);

    startRenderLoop();
    console.log("[Mineradio] Three.js initialized");
  }

  function buildCoverParticleGeometry(grid: number) {
    const count = grid * grid;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const aRand = new Float32Array(count);
    const texelStep = 1 / grid;

    for (let i = 0; i < count; i++) {
      const gx = i % grid;
      const gy = Math.floor(i / grid);
      const u = (gx + 0.5) * texelStep;
      const v = (gy + 0.5) * texelStep;
      const px = gx / (grid - 1);
      const py = gy / (grid - 1);
      positions[i * 3] = (px - 0.5) * PLANE_SIZE;
      positions[i * 3 + 1] = (py - 0.5) * PLANE_SIZE;
      positions[i * 3 + 2] = 0;
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
      aRand[i] = Math.random();
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    geo.userData.grid = grid;
    geo.userData.count = count;
    return geo;
  }

  function createParticles() {
    if (!scene || !currentGeometry) return;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      uniforms: uniforms,
      vertexShader: VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    particles = new THREE.Points(currentGeometry, material);
    particles.frustumCulled = false;
    particles.renderOrder = 1;
    scene.add(particles);
  }

  function createBloomParticles() {
    if (!scene || !currentGeometry) return;

    // Bloom reuses main geometry (same as original)
    const bloomMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      uniforms: uniforms,
      vertexShader: BLOOM_VERT_SHADER,
      fragmentShader: BLOOM_FRAG_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    bloomParticles = new THREE.Points(currentGeometry, bloomMat);
    bloomParticles.frustumCulled = false;
    bloomParticles.renderOrder = 0;
    scene.add(bloomParticles);
  }

  // ── Float particle layer (1300 particles) ──

  function createFloatLayer() {
    if (floatGroup) return;
    uniforms.uFloatAlpha.value = 0;
    const FLOAT_COUNT = 1300;
    const fgeo = new THREE.BufferGeometry();
    floatPositionsArr = new Float32Array(FLOAT_COUNT * 3);
    floatBaseArr = new Float32Array(FLOAT_COUNT * 3);
    floatPhaseArr = new Float32Array(FLOAT_COUNT * 3);
    floatColorArr = new Float32Array(FLOAT_COUNT * 3);
    const floatRandArr = new Float32Array(FLOAT_COUNT);
    const floatAmpArr = new Float32Array(FLOAT_COUNT);

    for (let i = 0; i < FLOAT_COUNT; i++) {
      const halo = i < FLOAT_COUNT * 0.76;
      let bx: number, by: number, bz: number;
      if (halo) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.62 + Math.pow(Math.random(), 0.72) * 2.75;
        const lane = (Math.random() - 0.5) * 0.62;
        bx = Math.cos(a) * r;
        by = Math.sin(a) * r * 0.54 + lane;
        bz = (Math.random() - 0.5) * 2.4 - 0.25;
      } else {
        bx = (Math.random() - 0.5) * 8.4;
        by = (Math.random() - 0.5) * 5.8;
        bz = (Math.random() - 0.5) * 5.6;
      }
      floatBaseArr![i * 3] = bx;
      floatBaseArr![i * 3 + 1] = by;
      floatBaseArr![i * 3 + 2] = bz;
      floatPositionsArr![i * 3] = bx;
      floatPositionsArr![i * 3 + 1] = by;
      floatPositionsArr![i * 3 + 2] = bz;
      floatPhaseArr![i * 3] = Math.random() * Math.PI * 2;
      floatPhaseArr![i * 3 + 1] = Math.random() * Math.PI * 2;
      floatPhaseArr![i * 3 + 2] = Math.random() * Math.PI * 2;
      floatAmpArr[i] = 0.15 + Math.random() * 0.35;
      const white = 0.88 + Math.random() * 0.12;
      floatColorArr![i * 3] = white;
      floatColorArr![i * 3 + 1] = white;
      floatColorArr![i * 3 + 2] = white;
      floatRandArr[i] = Math.random();
    }

    fgeo.setAttribute("position", new THREE.BufferAttribute(floatPositionsArr!, 3));
    fgeo.setAttribute("aColor", new THREE.BufferAttribute(floatColorArr!, 3));
    fgeo.setAttribute("aRand", new THREE.BufferAttribute(floatRandArr, 1));
    fgeo.setAttribute("aAmp", new THREE.BufferAttribute(floatAmpArr, 1));
    fgeo.setAttribute("aPhase", new THREE.BufferAttribute(floatPhaseArr!, 3));

    const fvs = `
      uniform float uTime, uBass, uPixel, uFloatAlpha;
      attribute vec3 aColor;
      attribute vec3 aPhase;
      attribute float aRand, aAmp;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec3 pos = position;
        float orbit = uTime * (0.030 + aRand * 0.034);
        float cs = cos(orbit), sn = sin(orbit);
        pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;
        float breathe = 1.0 + sin(uTime * 0.34 + aPhase.x) * 0.045;
        pos.xy *= breathe;
        pos.x += sin(uTime * (0.18 + aRand * 0.05) + aPhase.x) * aAmp * 0.34;
        pos.y += cos(uTime * (0.15 + aRand * 0.06) + aPhase.y) * aAmp * 0.30;
        pos.z += sin(uTime * (0.11 + aRand * 0.04) + aPhase.z) * aAmp * 0.68 + uBass * 0.10 * sin(aRand * 12.0);
        vC = aColor;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        float dist = -mvPos.z;
        float twinkle = 0.62 + 0.38 * sin(uTime * (0.42 + aRand * 0.34) + aPhase.z);
        vA = clamp(0.22 + (5.0 - dist) * 0.10, 0.055, 0.58) * twinkle;
        float sz = clamp(40.0 / max(0.5, dist), 1.3, 4.1);
        gl_PointSize = sz * uPixel;
        gl_Position = projectionMatrix * mvPos;
      }
    `;
    const ffs = `
      uniform sampler2D uDotTex;
      uniform float uFloatAlpha;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec4 tex = texture2D(uDotTex, gl_PointCoord);
        if (tex.a < 0.02) discard;
        gl_FragColor = vec4(vC, tex.a * vA * uFloatAlpha);
      }
    `;
    const fmat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      uniforms: {
        uTime: uniforms!.uTime,
        uBass: uniforms!.uBass,
        uPixel: uniforms!.uPixel,
        uDotTex: uniforms!.uDotTex,
        uFloatAlpha: uniforms!.uFloatAlpha,
      },
      vertexShader: fvs,
      fragmentShader: ffs,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // Fixed: NormalBlending (was AdditiveBlending)
    });
    floatGroup = new THREE.Points(fgeo, fmat);
    floatGroup.frustumCulled = false;
    floatGroup.renderOrder = 2;
    scene.add(floatGroup);
  }

  function destroyFloatLayer() {
    if (!floatGroup) return;
    scene.remove(floatGroup);
    floatGroup.geometry.dispose();
    floatGroup.material.dispose();
    floatGroup = null;
  }

  // ── Back cover layer (3000 particles) ──

  function createBackCoverLayer() {
    if (backCoverGroup) return;
    const BACK_COVER_COUNT = 3000;
    const bg = new THREE.BufferGeometry();
    const bp = new Float32Array(BACK_COVER_COUNT * 3);
    const bc = new Float32Array(BACK_COVER_COUNT * 3);
    const br = new Float32Array(BACK_COVER_COUNT);
    const bu = new Float32Array(BACK_COVER_COUNT * 2);

    for (let i = 0; i < BACK_COVER_COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      bp[i * 3] = (u - 0.5) * PLANE_SIZE;
      bp[i * 3 + 1] = (v - 0.5) * PLANE_SIZE;
      bp[i * 3 + 2] = -1.5 - Math.random() * 0.4;
      bu[i * 2] = 1.0 - u; // mirror X
      bu[i * 2 + 1] = v;
      br[i] = Math.random();
      bc[i * 3] = 0.7;
      bc[i * 3 + 1] = 0.6;
      bc[i * 3 + 2] = 0.8;
    }

    bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    bg.setAttribute("aColor", new THREE.BufferAttribute(bc, 3));
    bg.setAttribute("aRand", new THREE.BufferAttribute(br, 1));
    bg.setAttribute("aUv", new THREE.BufferAttribute(bu, 2));

    const vs = `
      precision highp float;
      uniform float uTime, uBass, uPixel, uAlpha;
      attribute vec3 aColor;
      attribute vec2 aUv;
      attribute float aRand;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec3 pos = position;
        pos.x += sin(uTime * 0.20 + aRand * 8.0) * 0.20;
        pos.y += cos(uTime * 0.18 + aRand * 6.0) * 0.22;
        pos.z += sin(uTime * 0.12 + aRand * 5.0) * 0.18 + uBass * 0.12 * sin(aRand * 11.0);
        vC = aColor;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        float dist = -mvPos.z;
        vA = clamp(0.30 + 0.4 * sin(uTime * 0.6 + aRand * 5.0), 0.10, 0.65);
        float sz = clamp(46.0 / max(0.5, dist), 1.4, 4.5);
        gl_PointSize = sz * uPixel;
        gl_Position = projectionMatrix * mvPos;
      }
    `;
    const fs = `
      precision highp float;
      uniform sampler2D uDotTex;
      uniform float uAlpha;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec4 tex = texture2D(uDotTex, gl_PointCoord);
        if (tex.a < 0.02) discard;
        gl_FragColor = vec4(vC, tex.a * vA * uAlpha);
      }
    `;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      uniforms: {
        uTime: uniforms!.uTime,
        uBass: uniforms!.uBass,
        uPixel: uniforms!.uPixel,
        uDotTex: uniforms!.uDotTex,
        uAlpha: uniforms!.uAlpha,
      },
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    backCoverGroup = new THREE.Points(bg, mat);
    backCoverGroup.frustumCulled = false;
    backCoverColorArr = bc;
    scene.add(backCoverGroup);
  }

  function destroyBackCoverLayer() {
    if (!backCoverGroup) return;
    scene.remove(backCoverGroup);
    backCoverGroup.geometry.dispose();
    backCoverGroup.material.dispose();
    backCoverGroup = null;
    backCoverColorArr = null;
  }

  function refreshBackCoverColorsFromCanvas(srcCanvas: HTMLCanvasElement) {
    if (!backCoverColorArr || !backCoverGroup) return;
    try {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(srcCanvas, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64).data;
      const count = backCoverColorArr.length / 3;
      for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const px = Math.floor(u * 63);
        const py = Math.floor(v * 63);
        const di = (py * 64 + px) * 4;
        backCoverColorArr[i * 3] = imgData[di] / 255;
        backCoverColorArr[i * 3 + 1] = imgData[di + 1] / 255;
        backCoverColorArr[i * 3 + 2] = imgData[di + 2] / 255;
      }
      const posAttr = backCoverGroup.geometry.getAttribute("aColor");
      if (posAttr) posAttr.needsUpdate = true;
    } catch { /* ignore */ }
  }

  // ── Ripple system ──

  function triggerRipple(x: number, y: number, strength: number) {
    const r = ripples[rippleIdx];
    r.x = x;
    r.y = y;
    r.age = 0;
    r.str = strength;
    rippleIdx = (rippleIdx + 1) % RIPPLE_MAX_LOCAL;
  }

  function updateRipples(dt: number, bassVal: number) {
    const isBassHit = bassVal > BASS_THRESHOLD && !lastBassRising;
    lastBassRising = bassVal > BASS_THRESHOLD * 0.75;
    const now = uniforms.uTime.value;
    if (isBassHit && (now - lastRippleAt) > RIPPLE_COOLDOWN) {
      lastRippleAt = now;
      const count = 2 + (Math.random() < 0.5 ? 0 : 1);
      const used: Record<number, boolean> = {};
      for (let k = 0; k < count; k++) {
        let idx: number;
        let tries = 0;
        do { idx = Math.floor(Math.random() * 9); tries++; } while (used[idx] && tries < 12);
        used[idx] = true;
        const reg = regions[idx];
        const jx = reg.x + (Math.random() - 0.5) * 0.7;
        const jy = reg.y + (Math.random() - 0.5) * 0.7;
        const str = 0.65 + bassVal * 1.4 + Math.random() * 0.25;
        triggerRipple(jx, jy, str);
      }
    }

    for (let i = 0; i < RIPPLE_MAX_LOCAL; i++) {
      const r = ripples[i];
      if (r.str > 0.005) {
        r.age += dt;
        if (r.age > 2.0) { r.str = 0; r.age = -10; }
      }
      const off = i * 4;
      rippleData[off] = r.x;
      rippleData[off + 1] = r.y;
      rippleData[off + 2] = r.age;
      rippleData[off + 3] = r.str;
    }
    rippleTex.needsUpdate = true;

    let active = 0;
    for (let i = 0; i < RIPPLE_MAX_LOCAL; i++) if (ripples[i].str > 0.005) active++;
    uniforms.uRippleCount.value = active;
  }

  // ── Audio analysis helpers ──

  function beatBandRms(data: Uint8Array, sampleRate: number, fftSize: number, hz0: number, hz1: number): number {
    const binSize = sampleRate / fftSize;
    const startBin = Math.max(0, Math.floor(hz0 / binSize));
    const endBin = Math.min(data.length, Math.ceil(hz1 / binSize));
    if (endBin <= startBin) return 0;
    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
      const v = data[i] / 255;
      sum += v * v;
    }
    return Math.sqrt(sum / (endBin - startBin));
  }

  function follow(cur: number, next: number, upTau: number, downTau: number, dt: number): number {
    const tau = next > cur ? upTau : downTau;
    return cur + (next - cur) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
  }

  // ── processRealtimeBeatEngine ──

  function processRealtimeBeatEngine(dt: number): any {
    const beatAnalyser = audio.state.beatAnalyser;
    const audioCtx = audio.state.audioCtx;
    const audioEl = audio.state.audio;
    if (!beatAnalyser || !audioCtx || !audioEl || audioEl.paused) return null;
    if (!localBeatFrequencyData || !localBeatTimeDomainData) return null;

    dt = Math.max(0.001, Math.min(0.080, dt || 0.016));
    const dj = visual.state.djMode.active;

    beatAnalyser.getByteFrequencyData(localBeatFrequencyData as Uint8Array<ArrayBuffer>);
    beatAnalyser.getByteTimeDomainData(localBeatTimeDomainData as Uint8Array<ArrayBuffer>);
    const sr = audioCtx.sampleRate || 44100;
    const fftSize = beatAnalyser.fftSize;

    const sub = beatBandRms(localBeatFrequencyData, sr, fftSize, 38, 74);
    const kick = beatBandRms(localBeatFrequencyData, sr, fftSize, 52, 165);
    const body = beatBandRms(localBeatFrequencyData, sr, fftSize, 165, 420);
    const vocal = beatBandRms(localBeatFrequencyData, sr, fftSize, 420, 2600);
    const snap = beatBandRms(localBeatFrequencyData, sr, fftSize, 1800, 9200);
    const low = Math.min(1, kick * 0.86 + sub * 0.42);

    let rms = 0;
    for (let i = 0; i < localBeatTimeDomainData.length; i++) {
      const tv = (localBeatTimeDomainData[i] - 128) / 128;
      rms += tv * tv;
    }
    rms = Math.sqrt(rms / localBeatTimeDomainData.length);

    const rtBeat = visual.state.rtBeat;
    const fastMul = dj ? 0.86 : 1;
    const downMul = dj ? 0.94 : 1;
    const slowMul = dj ? 1.06 : 1;

    const subFast = follow(rtBeat.subFast, sub, 0.018 * fastMul, 0.064 * downMul, dt);
    const subSlow = follow(rtBeat.subSlow, sub, 0.320 * slowMul, 0.520 * slowMul, dt);
    const lowFast = follow(rtBeat.lowFast, low, 0.016 * fastMul, 0.070 * downMul, dt);
    const lowSlow = follow(rtBeat.lowSlow, low, 0.300 * slowMul, 0.540 * slowMul, dt);
    const bodyFast = follow(rtBeat.bodyFast, body, 0.020 * fastMul, 0.082 * downMul, dt);
    const bodySlow = follow(rtBeat.bodySlow, body, 0.360 * slowMul, 0.600 * slowMul, dt);
    const vocalFast = follow(rtBeat.vocalFast, vocal, 0.026 * fastMul, 0.090 * downMul, dt);
    const vocalSlow = follow(rtBeat.vocalSlow, vocal, 0.340 * slowMul, 0.580 * slowMul, dt);
    const snapFast = follow(rtBeat.snapFast, snap, 0.012 * fastMul, 0.060 * downMul, dt);
    const snapSlow = follow(rtBeat.snapSlow, snap, 0.300 * slowMul, 0.520 * slowMul, dt);

    const peakDecay = dj ? 0.988 : 0.990;
    const subPeak = Math.max(rtBeat.subPeak * Math.pow(peakDecay, dt * 60), sub, 0.045);
    const lowPeak = Math.max(rtBeat.lowPeak * Math.pow(dj ? 0.987 : 0.989, dt * 60), low, 0.060);
    const bodyPeak = Math.max(rtBeat.bodyPeak * Math.pow(peakDecay, dt * 60), body, 0.040);
    const vocalPeak = Math.max(rtBeat.vocalPeak * Math.pow(peakDecay, dt * 60), vocal, 0.040);
    const snapPeak = Math.max(rtBeat.snapPeak * Math.pow(peakDecay, dt * 60), snap, 0.035);

    const subFlux = Math.max(0, sub - rtBeat.prevSub);
    const lowFlux = Math.max(0, low - rtBeat.prevLow);
    const bodyFlux = Math.max(0, body - rtBeat.prevBody);
    const vocalFlux = Math.max(0, vocal - rtBeat.prevVocal);
    const snapFlux = Math.max(0, snap - rtBeat.prevSnap);
    const rmsFlux = Math.max(0, rms - rtBeat.prevRms);

    const subRise = Math.max(0, subFast - subSlow);
    const lowRise = Math.max(0, lowFast - lowSlow);
    const bodyRise = Math.max(0, bodyFast - bodySlow);
    const vocalRise = Math.max(0, vocalFast - vocalSlow);
    const snapRise = Math.max(0, snapFast - snapSlow);

    const drumOnset = subRise * 0.88 + subFlux * 0.66 + lowRise * 1.62 + lowFlux * 1.34;
    const musicalOnset = bodyRise * 0.34 + bodyFlux * 0.24 + vocalRise * 0.52 + vocalFlux * 0.36 + snapRise * 0.08 + snapFlux * 0.06 + rmsFlux * 0.20;
    const onset = dj ? drumOnset * 1.05 + musicalOnset * 0.07 : drumOnset + musicalOnset * 0.16;

    const avgTau = onset > rtBeat.onsetAvg ? (dj ? 0.88 : 1.10) : (dj ? 0.30 : 0.34);
    const onsetAvg = follow(rtBeat.onsetAvg, onset, avgTau, avgTau, dt);
    const onsetPeak = Math.max(rtBeat.onsetPeak * Math.pow(dj ? 0.986 : 0.988, dt * 60), onset, 0.032);

    const floor = onsetAvg * (dj ? 0.88 : 0.84);
    const score = clamp01((onset - floor) / Math.max(dj ? 0.013 : 0.014, onsetPeak - floor));

    const subNorm = clamp01(sub / Math.max(0.045, subPeak * (dj ? 0.72 : 0.70)));
    const lowNorm = clamp01(low / Math.max(0.060, lowPeak * (dj ? 0.74 : 0.72)));
    const bodyNorm = clamp01(body / Math.max(0.045, bodyPeak * (dj ? 0.74 : 0.72)));
    const vocalNorm = clamp01(vocal / Math.max(0.045, vocalPeak * 0.72));
    const snapNorm = clamp01(snap / Math.max(0.040, snapPeak * (dj ? 0.78 : 0.72)));

    const nowT = audioEl.currentTime || 0;
    const primedFrames = rtBeat.primedFrames + 1;
    const warmingUp = nowT < rtBeat.warmupUntil || primedFrames < (dj ? 8 : 18);
    const gapFromLast = nowT - rtBeat.lastHitAt;
    const expectedGap = rtBeat.tempoGap > 0 ? rtBeat.tempoGap : 0;
    const phaseWindow = expectedGap > 0 ? Math.max(0.055, Math.min(0.105, expectedGap * 0.16)) : 0;
    const tempoDue = expectedGap > 0 && gapFromLast > expectedGap - phaseWindow && gapFromLast < expectedGap + phaseWindow;

    const lowPresence = Math.max(lowNorm, subNorm * 0.74);
    const lowAttack = lowRise + lowFlux * 0.72 + subRise * 0.58 + subFlux * 0.40;
    const lowDominance = low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10);
    const lowFluxDominance = (lowFlux + subFlux * 0.58) / Math.max(0.001, vocalFlux * 0.72 + bodyFlux * 0.42 + snapFlux * 0.16);

    const voiceMask = dj
      ? (vocalNorm > 0.62 && lowDominance < 0.92 && lowFluxDominance < 1.06 && subNorm < 0.54)
      : (vocalNorm > 0.58 && lowDominance < 0.86 && lowFluxDominance < 1.10);

    let drumGate = lowPresence > (dj ? 0.42 : 0.38) && lowAttack > Math.max(dj ? 0.015 : 0.014, onsetAvg * (dj ? 0.38 : 0.34)) && !voiceMask;
    drumGate = drumGate && (lowDominance > (dj ? 0.86 : 0.72) || lowFluxDominance > (dj ? 1.14 : 1.02) || subNorm > (dj ? 0.62 : 0.56));

    const strongTransient = drumGate && score > (dj ? 0.55 : 0.54) && drumOnset > onsetAvg * (dj ? 0.92 : 0.84);
    const kickTransient = drumGate && score > (dj ? 0.43 : 0.40) && lowAttack > Math.max(dj ? 0.020 : 0.018, onsetAvg * (dj ? 0.54 : 0.46));
    const tempoAssist = tempoDue && rtBeat.tempoConfidence > (dj ? 0.40 : 0.42) && drumGate && lowPresence > (dj ? 0.48 : 0) && score > (dj ? 0.30 : 0.22) && lowAttack > Math.max(0.016, onsetAvg * (dj ? 0.44 : 0.34));

    let candidateHit = strongTransient || kickTransient || tempoAssist;
    if (warmingUp) candidateHit = false;

    const hasTempoLock = expectedGap >= (dj ? 0.32 : 0.42) && expectedGap <= (dj ? 0.92 : 0.88) && rtBeat.tempoConfidence > (dj ? 0.36 : 0.38);
    const lockedWindow = hasTempoLock ? Math.max(0.070, Math.min(0.110, expectedGap * 0.16)) : 0;
    const gapRaw = nowT - rtBeat.lastHitAt;

    let rhythmAccept = false;
    if (candidateHit) {
      if (rtBeat.lastHitAt < 0) {
        rhythmAccept = strongTransient && score > (dj ? 0.58 : 0.62) && lowPresence > (dj ? 0.50 : 0.48);
      } else if (hasTempoLock) {
        const oneBeatErr = Math.abs(gapRaw - expectedGap);
        const twoBeatErr = Math.abs(gapRaw - expectedGap * 2);
        rhythmAccept = oneBeatErr <= lockedWindow && (kickTransient || strongTransient);
        rhythmAccept = rhythmAccept || (twoBeatErr <= lockedWindow * 1.35 && strongTransient && score > (dj ? 0.54 : 0.58));
        rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.55 && strongTransient && lowPresence > (dj ? 0.50 : 0.44));
        if (dj) {
          rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.24 && strongTransient && score > 0.56 && lowDominance > 0.92);
        }
      } else {
        rhythmAccept = gapRaw >= (dj ? 0.340 : 0.460) && strongTransient && score > (dj ? 0.56 : 0.58) && lowPresence > (dj ? 0.50 : 0.44);
      }
    }

    let hit = candidateHit && rhythmAccept;

    const minGap = hasTempoLock ? Math.max(dj ? 0.315 : 0.400, Math.min(dj ? 0.500 : 0.540, expectedGap * (dj ? 0.64 : 0.72))) : (dj ? 0.340 : 0.460);
    if (hit && gapRaw < minGap) {
      hit = false;
    }

    let tempoGap = rtBeat.tempoGap;
    let tempoConfidence = rtBeat.tempoConfidence;

    if (!hit) {
      if (dj) {
        visual.set("djMode", { ...visual.state.djMode, tempoGap, tempoConfidence });
      }
      return { hit: false, score, low: lowNorm, body: bodyNorm, vocal: vocalNorm, snap: snapNorm, tempoConfidence };
    }

    if (rtBeat.lastHitAt > 0) {
      let gap = nowT - rtBeat.lastHitAt;
      while (gap > (dj ? 0.96 : 0.88)) gap *= 0.5;
      while (gap < (dj ? 0.32 : 0.42)) gap *= 2.0;
      if (gap >= (dj ? 0.32 : 0.42) && gap <= (dj ? 0.96 : 0.88)) {
        const tempoEase = hasTempoLock ? (dj ? 0.12 : 0.10) : (dj ? 0.24 : 0.22);
        tempoGap = tempoGap ? tempoGap * (1 - tempoEase) + gap * tempoEase : gap;
        tempoConfidence = Math.min(1, tempoConfidence + (tempoAssist ? 0.04 : 0.18));
      }
    }

    const beatCount = rtBeat.beatCount + 1;
    const strength = dj
      ? clamp01(0.18 + score * 0.38 + lowPresence * 0.34 + Math.min(1.35, lowDominance) * 0.08 + rmsFlux * 0.72)
      : clamp01(0.24 + score * 0.36 + lowPresence * 0.34 + Math.min(1.25, lowDominance) * 0.07 + rmsFlux * 0.95);

    const comboSlot = (beatCount - 1) % 4;
    let combo = comboSlot === 0 ? "downbeat" : comboSlot === 1 ? "push" : comboSlot === 2 ? "drop" : "rebound";
    if (strength > 0.84 && comboSlot !== 0) combo = "accent";

    visual.set("rtBeat", {
      ...rtBeat,
      subFast, subSlow, lowFast, lowSlow, bodyFast, bodySlow,
      vocalFast, vocalSlow, snapFast, snapSlow,
      prevSub: sub, prevLow: low, prevBody: body, prevVocal: vocal, prevSnap: snap, prevRms: rms,
      subPeak, lowPeak, bodyPeak, vocalPeak, snapPeak,
      onsetAvg, onsetPeak,
      lastHitAt: nowT,
      beatCount,
      primedFrames,
      tempoGap,
      tempoConfidence,
      pulse: Math.max(rtBeat.pulse, strength),
      score,
      stats: {
        ...rtBeat.stats,
        hits: rtBeat.stats.hits + 1,
        strong: rtBeat.stats.strong + (strongTransient || kickTransient ? 1 : 0),
        assisted: rtBeat.stats.assisted + (tempoAssist ? 1 : 0),
      },
    });

    if (dj) {
      visual.set("djMode", {
        ...visual.state.djMode,
        tempoGap,
        tempoConfidence,
        lastBeatAt: nowT,
      });
    }

    return {
      hit: true,
      time: dj ? Math.max(0, nowT - 0.026) : nowT,
      strength,
      confidence: dj ? clamp01(score * 0.58 + lowPresence * 0.30 + tempoConfidence * 0.12) : clamp01(score * 0.62 + lowPresence * 0.26 + tempoConfidence * 0.12),
      low: Math.max(0.05, lowPresence),
      body: Math.max(0.02, bodyNorm * (dj ? 0.50 : 0.62)),
      snap: Math.max(0.02, snapNorm * (dj ? 0.86 : 1)),
      mass: dj ? clamp01(lowPresence * 0.84 + bodyNorm * 0.10) : clamp01(lowPresence * 0.76 + bodyNorm * 0.20),
      sharpness: dj ? clamp01(snapNorm * 0.58 + bodyNorm * 0.10) : clamp01(snapNorm * 0.70 + bodyNorm * 0.12),
      tempoAssist,
      tempoGap,
      combo,
      score,
      lowDominance,
      lowDominanceRaw: low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10),
      dj,
    };
  }

  // ── Cover texture loading with edge/depth generation ──

  function loadCoverTexture(url: string) {
    if (!url || !coverTex || !prevCoverTex) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 512;
        const cv = document.createElement("canvas");
        cv.width = cv.height = size;
        const cx = cv.getContext("2d")!;
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const s = Math.min(iw, ih);
        cx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, size, size);

        // Cross-fade: set current as prev
        if (uniforms.uHasCover.value > 0.5 && coverTex.image) {
          const prevW = coverTex.image.width || 256;
          const prevH = coverTex.image.height || 256;
          const prevScale = Math.min(1, 256 / Math.max(prevW, prevH, 1));
          const prevCv = document.createElement("canvas");
          prevCv.width = Math.max(1, Math.round(prevW * prevScale));
          prevCv.height = Math.max(1, Math.round(prevH * prevScale));
          try {
            prevCv.getContext("2d")!.drawImage(coverTex.image, 0, 0, prevCv.width, prevCv.height);
            prevCoverTex.image = prevCv;
            prevCoverTex.needsUpdate = true;
          } catch { /* ignore */ }
        }

        coverTex.image = cv;
        coverTex.needsUpdate = true;
        uniforms.uHasCover.value = 1;
        uniforms.uColorMixT.value = 0;

        // Build edge/depth texture
        const edgeCv = buildEdgeAndDepth(cv);
        coverEdgeTex.image = edgeCv;
        coverEdgeTex.needsUpdate = true;
        uniforms.uHasDepth.value = 1;

        // Refresh back cover colors
        if (backCoverGroup) refreshBackCoverColorsFromCanvas(cv);
      } catch { /* ignore texture errors */ }
    };
    img.onerror = () => { /* ignore load errors */ };
    img.src = url;
  }

  let lastCoverUrl = "";

  // ── Main render loop ──

  function startRenderLoop() {
    prevTime = performance.now();

    function animate() {
      animFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      if (perf.shouldSkipFrame()) return;
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      perf.markRenderFrame();

      uniforms.uTime.value += dt;

      // Cover texture loading
      const coverUrl = visual.state.coverTextureUrl;
      if (coverUrl && coverUrl !== lastCoverUrl) {
        lastCoverUrl = coverUrl;
        loadCoverTexture(coverUrl);
      }

      // Pointer parallax smoothing
      const pTarget = visual.state.pointerTarget;
      const pCurrent = visual.state.pointerParallax;
      visual.set("pointerParallax", {
        x: pCurrent.x + (pTarget.x - pCurrent.x) * 0.040,
        y: pCurrent.y + (pTarget.y - pCurrent.y) * 0.040,
      });

      beatOnsetFlag = false;

      const analyser = audio.state.analyser;
      const audioEl = audio.state.audio;

      if (analyser && audio.state.audioReady && audioEl && !audioEl.paused && localFrequencyData && localTimeDomainData) {
        if (audio.state.audioCtx && audio.state.audioCtx.state === "suspended") {
          audio.state.audioCtx.resume().catch(() => {});
        }

        // Fade in alpha when audio starts playing
        if (uniforms.uAlpha.value < 0.5) {
          uniforms.uAlpha.value = Math.min(1.0, uniforms.uAlpha.value + dt * 0.8);
        }

        analyser.getByteFrequencyData(localFrequencyData as Uint8Array<ArrayBuffer>);
        analyser.getByteTimeDomainData(localTimeDomainData as Uint8Array<ArrayBuffer>);
        const len = localFrequencyData.length;

        const kickEnd = 7;
        const vocalEnd = Math.min(len, 140);
        const midEnd = Math.min(len, 280);

        let bKick = 0, mInst = 0, tHigh = 0, voc = 0, rms = 0;
        for (let i = 0; i < kickEnd; i++) bKick += localFrequencyData[i] / 255;
        for (let i = kickEnd; i < vocalEnd; i++) voc += localFrequencyData[i] / 255;
        for (let i = vocalEnd; i < midEnd; i++) mInst += localFrequencyData[i] / 255;
        for (let i = midEnd; i < len; i++) tHigh += localFrequencyData[i] / 255;
        for (let j = 0; j < localTimeDomainData.length; j++) {
          const tv = (localTimeDomainData[j] - 128) / 128;
          rms += tv * tv;
        }

        bKick /= kickEnd;
        voc /= (vocalEnd - kickEnd);
        mInst /= Math.max(1, midEnd - vocalEnd);
        tHigh /= Math.max(1, len - midEnd);
        rms = Math.sqrt(rms / localTimeDomainData.length);

        bassPeak = Math.max(bassPeak * 0.994, bKick, 0.030);
        midPeak = Math.max(midPeak * 0.993, mInst, 0.026);
        treblePeak = Math.max(treblePeak * 0.992, tHigh, 0.018);
        energyPeak = Math.max(energyPeak * 0.995, rms, 0.030);

        const rb = Math.min(1, Math.pow(bKick / Math.max(0.038, bassPeak * 0.66), 0.78));
        const rm = Math.min(1, Math.pow(mInst / Math.max(0.025, midPeak * 0.70), 0.86));
        const rt = Math.min(1, Math.pow(tHigh / Math.max(0.020, treblePeak * 0.74), 0.92));
        const re = Math.min(1, Math.pow(rms / Math.max(0.034, energyPeak * 0.68), 0.82));
        const bassOnset = Math.max(0, rb - visual.state.smoothBass);
        const energyOnset = Math.max(0, re - prevEnergy);
        prevEnergy = prevEnergy * 0.88 + re * 0.12;

        const realtimeBeat = processRealtimeBeatEngine(dt);

        if (realtimeBeat && realtimeBeat.hit) {
          const waitingForBeatMap = !visual.state.currentBeatMap && (visual.state.beatMapBusy || (audioEl.currentTime || 0) < 18);
          const liveKickFrame = realtimeBeat.low > 0.50 && rb > 0.42 && bassOnset > 0.070 && energyOnset > 0.016;
          const liveStrongHit = realtimeBeat.confidence > 0.76 && realtimeBeat.strength > 0.70 && realtimeBeat.score > 0.56 && liveKickFrame;
          const liveTempoHit = realtimeBeat.tempoAssist && realtimeBeat.confidence > 0.80 && realtimeBeat.strength > 0.66 && realtimeBeat.low > 0.50 && bassOnset > 0.052;
          const liveFallbackOk = waitingForBeatMap ? (liveStrongHit || liveTempoHit) : (realtimeBeat.confidence > 0.84 && realtimeBeat.strength > 0.80 && realtimeBeat.low > 0.54 && (liveKickFrame || realtimeBeat.score > 0.68));

          if (liveFallbackOk) {
            const previewPulseScale = waitingForBeatMap ? 0.68 : 1;
            const rtPulse = Math.min(waitingForBeatMap ? 0.46 : 0.62, realtimeBeat.strength * (realtimeBeat.tempoAssist ? 0.62 : 0.68) * previewPulseScale);
            if (rtPulse > beatPulseLocal + 0.09) beatOnsetFlag = true;
            beatPulseLocal = Math.max(beatPulseLocal, rtPulse);
          }
        } else if (bassOnset > 0.075 && rb > 0.32 && energyOnset > 0.020) {
          beatPulseLocal = Math.max(beatPulseLocal, Math.min(0.12, bassOnset * 0.18));
        }

        beatPulseLocal *= Math.pow(0.36, dt);

        if (scheduledBeatFlag) {
          beatOnsetFlag = true;
          scheduledBeatFlag = false;
        }
        if (scheduledBeatPulse > beatPulseLocal) beatPulseLocal = scheduledBeatPulse;
        scheduledBeatPulse *= Math.pow(0.32, dt);

        function env(prev: number, next: number, attack: number, release: number): number {
          const k = next > prev ? attack : release;
          return prev + (next - prev) * k;
        }

        const smoothBass = env(visual.state.smoothBass, Math.min(0.82, rb * 0.78 + re * 0.025), 0.28, 0.075);
        const smoothMid = env(visual.state.smoothMid, Math.min(0.68, rm * 0.64 + re * 0.025), 0.18, 0.060);
        const smoothTreb = env(visual.state.smoothTreb, Math.min(0.56, rt * 0.54), 0.18, 0.055);
        const smoothEnergy = env(visual.state.smoothEnergy, Math.min(0.72, re), 0.16, 0.055);

        visual.set({
          smoothBass, smoothMid, smoothTreb, smoothEnergy,
          beatPulse: beatPulseLocal,
          beatOnsetFlag,
        });

        // Lyric sun energy
        const sunEnergy = clamp01((smoothEnergy - 0.18) / 0.38);
        const sunVoice = clamp01((voc - 0.11) / 0.34);
        const sunMelody = clamp01((smoothMid - 0.16) / 0.27);
        const sunAir = clamp01((smoothTreb - 0.105) / 0.17);
        let sunRaw = clamp01(sunEnergy * 0.36 + sunVoice * 0.18 + sunMelody * 0.26 + sunAir * 0.20);
        sunRaw = sunRaw * sunRaw * (3 - 2 * sunRaw);
        let lyricSunAvg = visual.state.lyricSunAvg + (sunRaw - visual.state.lyricSunAvg) * 0.006;
        const lyricSunPeak = Math.max(0.48, visual.state.lyricSunPeak * 0.9985, sunRaw);
        const sunThreshold = Math.max(0.78, lyricSunAvg + 0.20, lyricSunPeak * 0.74);
        let sunGate = clamp01((sunRaw - sunThreshold) / Math.max(0.08, 1.0 - sunThreshold));
        sunGate = sunGate * sunGate * (3 - 2 * sunGate);
        let lyricSunHold = visual.state.lyricSunHold + (sunGate - visual.state.lyricSunHold) * (sunGate > visual.state.lyricSunHold ? 0.035 : 0.014);
        const lyricSunTarget = lyricSunHold > 0.16 ? clamp01((lyricSunHold - 0.16) / 0.84) : 0;
        const lyricSunEnergy = visual.state.lyricSunEnergy + (lyricSunTarget - visual.state.lyricSunEnergy) * (lyricSunTarget > visual.state.lyricSunEnergy ? 0.075 : 0.030);

        visual.set({ lyricSunAvg, lyricSunPeak, lyricSunHold, lyricSunTarget, lyricSunEnergy });

        // Update ripple system
        updateRipples(dt, rb);
      } else {
        // Not playing — decay
        visual.set({
          smoothBass: visual.state.smoothBass * 0.91,
          smoothMid: visual.state.smoothMid * 0.91,
          smoothTreb: visual.state.smoothTreb * 0.91,
          smoothEnergy: visual.state.smoothEnergy * 0.91,
          beatPulse: visual.state.beatPulse * 0.82,
          lyricSunTarget: 0,
          lyricSunHold: visual.state.lyricSunHold * 0.90,
          lyricSunEnergy: visual.state.lyricSunEnergy * 0.92,
          lyricSunAvg: visual.state.lyricSunAvg * 0.995,
          lyricSunPeak: Math.max(0.48, visual.state.lyricSunPeak * 0.997),
        });
      }

      // Final bass/mid/treble with intensity scaling
      const fxBass = Math.min(0.90, visual.state.smoothBass * 1.05 + visual.state.beatPulse * 0.18) * fx.state.intensity;
      const fxMid = Math.min(0.72, visual.state.smoothMid * 1.12) * fx.state.intensity;
      const fxTreble = Math.min(0.62, visual.state.smoothTreb * 1.20) * fx.state.intensity;
      const fxAudioEnergy = Math.max(visual.state.smoothEnergy, visual.state.beatPulse * 0.30);

      visual.set({
        bass: fxBass,
        mid: fxMid,
        treble: fxTreble,
        audioEnergy: fxAudioEnergy,
      });

      // Uniforms
      uniforms.uBass.value = fxBass;
      uniforms.uMid.value = fxMid;
      uniforms.uTreble.value = fxTreble;
      uniforms.uBeat.value = visual.state.beatPulse;
      uniforms.uEnergy.value = fxAudioEnergy;

      // Sync FX uniforms
      uniforms.uIntensity.value = fx.state.intensity;
      uniforms.uDepth.value = fx.state.depth;
      uniforms.uPointScale.value = fx.state.point;
      uniforms.uSpeed.value = fx.state.speed;
      uniforms.uTwist.value = fx.state.twist;
      uniforms.uColorBoost.value = fx.state.color;
      uniforms.uScatter.value = fx.state.scatter;
      uniforms.uBgFade.value = fx.state.bgFade;
      uniforms.uBloomStrength.value = fx.state.bloomStrength;
      uniforms.uEdgeEnabled.value = fx.state.edge ? 1 : 0;
      uniforms.uPreset.value = fx.state.preset;

      // Tint color
      if (fx.state.visualTintColor) {
        uniforms.uTintColor.value.set(fx.state.visualTintColor);
      }
      uniforms.uTintStrength.value = fx.state.visualTintMode === "auto" ? 0 : 0.3;

      // Cover cross-fade
      if (uniforms.uColorMixT.value < 1.0) {
        uniforms.uColorMixT.value = Math.min(1.0, uniforms.uColorMixT.value + dt * 2.5);
      }
      uniforms.uMouseActive.value = mouseActive ? 1 : 0;

      // Particle dim
      const skullBackdropDim = fx.state.preset === SKULL_PRESET_INDEX ? 0.58 : 1;
      const shelfDimTarget = skullBackdropDim;
      const shelfDimEase = shelfDimTarget < uniforms.uParticleDim.value ? 0.18 : 0.10;
      uniforms.uParticleDim.value += (shelfDimTarget - uniforms.uParticleDim.value) * Math.min(1, shelfDimEase * Math.max(1, dt * 60));
      uniforms.uBurstAmt.value *= 0.90;

      // Vinyl spin
      const vinylSpeedMul = isFinite(fx.state.speed) ? Math.max(0.05, fx.state.speed) : 1;
      const vinylSpinSpeed = (0.40 + visual.state.smoothBass * 0.09) * vinylSpeedMul;
      uniforms.uVinylSpin.value = (uniforms.uVinylSpin.value + dt * vinylSpinSpeed) % (Math.PI * 2);

      // Float layer alpha
      uniforms.uFloatAlpha.value = fx.state.floatLayer ? 1.0 : 0.0;

      // Loading mist
      uniforms.uLoading.value = 0;

      // Particle visibility
      const skullPresetActive = fx.state.preset === SKULL_PRESET_INDEX;
      if (particles) {
        particles.visible = !skullPresetActive;
      }
      if (bloomParticles) {
        bloomParticles.visible = !skullPresetActive && fx.state.bloom && fx.state.bloomStrength > 0.01;
        if (particles) bloomParticles.rotation.copy(particles.rotation);
      }
      if (floatGroup) {
        floatGroup.visible = !skullPresetActive;
        if (particles) floatGroup.rotation.copy(particles.rotation);
      }
      if (backCoverGroup) {
        backCoverGroup.visible = !skullPresetActive && fx.state.backCover;
        if (particles) backCoverGroup.rotation.copy(particles.rotation);
      }

      // Back cover layer lifecycle
      if (fx.state.backCover && !backCoverGroup) {
        createBackCoverLayer();
      } else if (!fx.state.backCover && backCoverGroup) {
        destroyBackCoverLayer();
      }

      // Orbit camera
      const orbit = visual.state.orbit;
      const theta = orbit.userTheta;
      const phi = orbit.userPhi;
      const radius = orbit.userRadius;
      if (camera) {
        camera.position.x = radius * Math.sin(theta) * Math.cos(phi);
        camera.position.y = radius * Math.sin(phi);
        camera.position.z = radius * Math.cos(theta) * Math.cos(phi);
        camera.lookAt(orbit.lookAt.x, orbit.lookAt.y, orbit.lookAt.z);
      }

      // Thumbnail pulse
      if (visual.state.currentBeatMap || beatPulseLocal > 0.01) {
        const s = 1 + fxBass * 0.08;
        const thumbCoverEl = document.getElementById("thumb-cover");
        if (thumbCoverEl) thumbCoverEl.style.transform = "scale(" + s + ")";
      }

      // Update 3D shelf
      shelf3d.checkModeChange();
      shelf3d.update(dt);

      // Update gesture uniforms
      if (fx.state.cam === "on") {
        const hs = gesture.getHandState();
        uniforms.uHandActive.value += ((hs.active ? 1 : 0) - uniforms.uHandActive.value) * 0.26;
        uniforms.uHandXY.value.set(hs.x, hs.y);
        uniforms.uGestureGrip.value += (hs.grip - uniforms.uGestureGrip.value) * 0.3;
      } else {
        uniforms.uHandActive.value *= 0.9;
        uniforms.uGestureGrip.value *= 0.9;
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  function dispose() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (renderer) {
      renderer.dispose();
      const container = document.getElementById("canvas-container");
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
    destroyFloatLayer();
    destroyBackCoverLayer();
    initialized = false;
    console.log("[Mineradio] Three.js disposed");
  }

  // Auto-init when canvas container is ready
  createEffect(() => {
    const container = document.getElementById("canvas-container");
    if (container && !initialized) {
      initThreeJs(document.createElement("canvas"));
    }
  });

  onCleanup(() => {
    dispose();
  });

  return { dispose };
}

export type VisualEngineHook = ReturnType<typeof useVisualEngine>;
