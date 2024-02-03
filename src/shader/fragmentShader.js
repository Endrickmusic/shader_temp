const fragmentShader = `

uniform float uTime;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vColor;

float PI = 3.1415926;

#define MAX_STEPS 40
#define MAX_DIST 40.
#define SURF_DIST .005
#define samples 32
#define LOD 2
	
	float hash(vec2 n) {
		return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 184.5453);
	}
	
	float noise(vec2 n) {
		const vec2 d = vec2(0.0, 1.0);
		vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
		return mix(mix(hash(b), hash(b + d.yx), f.x), mix(hash(b + d.xy), hash(b + d.yy), f.x), f.y);
	}
	
	float sdSphere( vec3 p, float s ) { return length(p)-s; }
	
	
	float smin( float a, float b, float k ) {
		float h = max(k-abs(a-b), 0.0);
		return min(a, b) - h*h*0.25/k; 
	}
	
	float getDist(vec3 p) {
		float final = MAX_DIST;
		float uTime = uTime; 
		p = p - vec3(0.,.5, 5.);
		for (int i = 0; i < 10; i++) {
			float iF = float(i);
			float fi = iF + floor(iF / 5.);
			vec3 pos = p;
			pos.xy += vec2(sin(uTime + fi), cos(uTime + fi * 2.)) * 0.5;
			pos.z += sin(uTime * cos(float(i * 4))) * 0.2;
			float r = sin(fi + 1.) * .25;
			float n = min(sin(pos.z * iF * 5.), cos(pos.x * pos.y * iF * 10.)) * 0.1;
			float bubble = sdSphere(pos + vec3(n) * 0.1 - vec3(0.05), r);
			
			final = smin(final, bubble, 0.4);
		}
	
		
		return final;
	}
	float rayMarch(vec3 ro, vec3 rd) {
		float dO=0.;
		float matId = -1.;
		
		for(int i=0; i<MAX_STEPS; i++) {
			vec3 p = ro + rd*dO;
			float res = getDist(p);
			float dS = res;
			dO += dS;
			
			if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
		}
		
		return dO;
	}
	
	vec3 normals(vec3 p, float of ) {
		float d = getDist(p);
		vec2 e = vec2(of, 0);
		
		vec3 n = d - vec3(
			getDist(p-e.xyy),
			getDist(p-e.yxy),
			getDist(p-e.yyx));
		
		return normalize(n);
	}
	
	float diffuse(vec3 p, vec3 n, vec3 lp) {
		vec3 l = normalize(lp-p);
		float dif = clamp(dot(n, l), 0., 1.);
	
		return dif;
	}
	
	float gaussian(vec2 i) {
	const float sigma = float(samples) * .25;
		return exp( -.5* dot(i/=sigma,i) ) / ( 6.28 * sigma*sigma );
	}
	
	vec4 blur(sampler2D sp, vec2 U, vec2 scale) {
		const int  sLOD = 1 << LOD;
		vec4 O = vec4(0);
		int s = samples/sLOD;
		
		for ( int i = 0; i < s*s; i++ ) {
			vec2 d = vec2(i%s, i/s)*float(sLOD) - float(samples)/2.;
			O += gaussian(d) * texture(sp, U + scale * d);
		}
		
		return O / O.a;
	}
	
	
	void main() {

		vec3 col = vec3(0.0);
		
		float uTime = uTime * 2.;
        
        // camera position
		vec3 ro = vec3(-1.0, -1., 1.);
		vec3 rd = normalize(vec3(vUv.x, vUv.y + 0.2 , 2.));
		vec3 ld =  vec3(0., 0., 1.);
		float d = rayMarch(ro, rd);
		vec3 p = ro + rd * d;
		vec3 n = normals(p, 0.03);
		float dif = diffuse(p, n, ld); 
		float fresnel = smoothstep(0.5, 0.3, dot(-rd, n));
		vec3 oil = vec3(noise(n.xy * 2.7), noise(n.xy * 3.), noise(n.xy * 3.3)); 
		
		vec2 camUV = vUv;
		vec4 cam1 = texture2D(texture01, camUV);
		camUV += n.xy * 0.05 * dif;
		vec3 cam2 = blur(texture01, camUV, 1./uResolution.xy).xyz * 0.8;
		vec3 dispersion = vec3(0.);
		dispersion.r = texture2D(texture01, vec2(camUV.x - n.x * 0.0095,camUV.y)).r;
		dispersion.b = texture2D(texture01, vec2(camUV.x + n.y * 0.0095, camUV.y)).b;
		dispersion.g = texture2D(texture01, camUV).g;
	
		col = dif * cam2;
		col += cam2 * 0.15;         
		col += oil * 0.4;
		col += fresnel * 0.3;
		col = mix(col, dispersion, (abs(n.x) + abs(n.y)) * 0.3);
		
		if (d > MAX_DIST) { 
            // Set the alpha to 0 for parts outside the raymarched object
            gl_FragColor = vec4(1.,1.,1.,0.0);
        } else {
            // Set the alpha to 1 for parts inside the raymarched object
            gl_FragColor = vec4(col, 1.0);
	}
}


`

export default fragmentShader