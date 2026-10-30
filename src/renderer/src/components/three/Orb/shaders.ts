// 3D simplex noise by Ian McEwan and Ashima Arts (webgl-noise, MIT licence).
const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/** Displaces a sphere along its normals with two octaves of moving noise. */
export const orbVertex = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
${noise}
void main() {
  float slow = snoise(normal * 1.4 + vec3(uTime * 0.22));
  float fine = snoise(normal * 3.6 - vec3(uTime * 0.45));
  float displacement = (slow * 0.14 + fine * 0.045) * (0.55 + uEnergy * 1.5) + uPulse * 0.18;
  vec3 displaced = position + normal * displacement;
  vNoise = slow;
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vView = normalize(-mv.xyz);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

/** Aurora colours across the surface, an iridescent sheen at the rim, brighter as energy rises. */
export const orbFragment = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main() {
  float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
  float fresnel = pow(1.0 - facing, 2.4);
  float t = smoothstep(-0.6, 0.8, vNoise);
  vec3 base = mix(uColorA, uColorB, t);
  base = mix(base, uColorC, fresnel * 0.85);
  vec3 sheen = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fresnel * 1.3 + uTime * 0.04));
  vec3 color = mix(base, sheen, 0.18 + 0.22 * fresnel);
  float light = 0.32 + 0.25 * facing + fresnel * (1.15 + uEnergy * 1.6);
  gl_FragColor = vec4(color * light, 1.0);
}
`;

/**
 * Particles on a loose shell. uInflow pulls them into the orb (scanning), uOutflow streams them
 * outward (cleaning); both wrap around so the flow never runs dry.
 */
export const particleVertex = /* glsl */ `
attribute float aRadius;
attribute float aTheta;
attribute float aLift;
attribute float aSpeed;
attribute float aSize;
uniform float uTime;
uniform float uInflow;
uniform float uOutflow;
uniform float uPulse;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  float travel = fract(aSpeed * uTime * 0.16 + aRadius * 3.1);
  float r = aRadius;
  r = mix(r, mix(3.6, 1.08, travel), uInflow);
  r = mix(r, mix(1.08, 3.8, travel), uOutflow);
  r += uPulse * (0.6 + aSpeed) * 0.9;
  float spin = 0.04 + (uInflow + uOutflow) * 0.55 / r;
  float theta = aTheta + uTime * spin * (0.6 + aSpeed);
  float ring = sqrt(1.0 - aLift * aLift);
  vec3 pos = vec3(cos(theta) * r * ring, aLift * r * 0.62, sin(theta) * r * ring);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (16.0 / -mv.z);
  float flowFade = uInflow * smoothstep(0.0, 0.2, travel) * (0.3 + 0.7 * travel)
                 + uOutflow * (1.0 - travel) * smoothstep(0.0, 0.1, travel);
  float idle = 1.0 - min(1.0, uInflow + uOutflow);
  vAlpha = (0.38 * idle + flowFade) * (1.0 - uPulse * 0.5);
}
`;

export const particleFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vAlpha);
}
`;
