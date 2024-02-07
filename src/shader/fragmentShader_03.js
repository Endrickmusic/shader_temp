//Ocean shader with noise waves and slope based subsurface scattering.

//Based on:
//https://www.shadertoy.com/view/Ms2SD1
//https://unitywatershader.wordpress.com/
//https://www.alanzucconi.com/2017/08/30/fast-subsurface-scattering-1/
//https://www.fxguide.com/fxfeatured/assassins-creed-iii-the-tech-behind-or-beneath-the-action/

//Average the results of a 2x2 region of subpixel samples for antialiasing.
//#define AA

//Raymarching
const int MAX_STEPS = 300;
const float MAX_DIST = 1800.0;
const float EPSILON = 1e-4;

//Wave extent and noise field scale.
const float HEIGHT = 24.0;
const float SCALE = 0.035;
float waveSpeed = 0.005;

//Octaves of FBM.
const int shapeLimit = 3;
const int normalLimit = 8;

const vec3 skyColour = vec3(0.09, 0.33, 0.81);
const vec3 sunLightColour = vec3(1);
const vec3 sunColour = sunLightColour;

float specularStrength = 100.0;
float shininess = 2048.0;
const vec3 specularColour = sunLightColour;

//In a circle of 2*PI
const float sunLocation = 0.0;
//0: horizon, 1: zenith
const float sunHeight = 0.35;

const float diffuseStrength = 0.2;
const vec3 diffuseColour = diffuseStrength * vec3(0.05,0.45,0.65);

float ambientStrength = 0.5;
vec3 ambientColour = 0.5 * diffuseColour;

vec3 scatterColour = vec3(0.05, 0.8, 0.7);
float power = 8.0;
float scale = 0.4;
float distortion = 0.2;
float scatterStrength = 0.3;

const float angle = 3.14;

const float s = sin(angle);
const float c = cos(angle);
const mat2 rotation = mat2(c, s, -s, c);

float saturate(float x){
	return clamp(x, 0.0, 1.0);
}

vec3 rayDirection(float fieldOfView, vec2 fragCoord) {
    vec2 xy = fragCoord - iResolution.xy / 2.0;
    float z = (0.5 * iResolution.y) / tan(radians(fieldOfView) / 2.0);
    return normalize(vec3(xy, -z));
}

//https://www.geertarien.com/blog/2017/07/30/breakdown-of-the-lookAt-function-in-OpenGL/
mat3 lookAt(vec3 camera, vec3 targetDir, vec3 up){
  vec3 zaxis = normalize(targetDir);    
  vec3 xaxis = normalize(cross(zaxis, up));
  vec3 yaxis = cross(xaxis, zaxis);

  return mat3(xaxis, yaxis, -zaxis);
}

//Darken sky when looking up and add a white haze at the horizon.
vec3 getSkyColour(vec3 rayDir){
    return mix(vec3(1), mix(skyColour, 0.2*skyColour, rayDir.y), 
               smoothstep(-0.5, 0.25, rayDir.y));
}

//By iq
float noised( in vec2 x ){
    vec2 f = fract(x);
    vec2 u = f*f*(3.0-2.0*f);
  
    vec2 p = floor(x);
	float a = textureLod( iChannel1, (p+vec2(0.5,0.5))*0.00390625, 0.0 ).x;
	float b = textureLod( iChannel1, (p+vec2(1.5,0.5))*0.00390625, 0.0 ).x;
	float c = textureLod( iChannel1, (p+vec2(0.5,1.5))*0.00390625, 0.0 ).x;
	float d = textureLod( iChannel1, (p+vec2(1.5,1.5))*0.00390625, 0.0 ).x;
    
	float res = (a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y);
    res = res - 0.5;
    return res;
}

float fbm(vec3 pos, int limit){
    float res = 0.0;
    float freq = 1.0;
    float amp = 1.0;
    
    for(int i = 0; i < 9; i++){ 
        if(i == limit){break;}

       	res += noised(freq*(pos.xz+iTime*(waveSpeed*float(9-i+1))))*amp;

        freq *= 1.75;
        amp *= 0.5;
        
        pos.xz *= rotation;
    }
	return res;
}

//Get height of waves at xz coordinates.
float getHeight(vec3 pos, int limit){
    return HEIGHT*fbm(SCALE*pos, limit);
}

//Binary search for 0 crossing given two points on either side of the surface.
float bisection(vec3 start, vec3 rayDir, float near_, float far_){
    float midpoint = (far_ + near_) * 0.5;
    //Sample point
    vec3 p = vec3(0);
    float near = near_;
    float far = far_;
    float height = 0.0;
    //Difference between sample point and water height.
    float diff = 0.0;
    
    for(int i = 0; i < 8; i++){
        p = start + rayDir * midpoint;
        height = getHeight(p, shapeLimit);
        diff = p.y - height;
        
        if(abs(diff) < EPSILON){
        	break;
        }else{
            
            if(diff < EPSILON){
                //Point is below waves
                //Search first half
                far = midpoint;
            }else{
                //Point is above waves
                //Search second half
                near = midpoint;
            }
            midpoint = (far + near) * 0.5;
        }
    }
    return midpoint;
}

//Assume normalised vectors.
bool getPlaneIntersection(vec3 org, vec3 ray, vec3 planePoint, vec3 normal, out float t){
    float denom = dot(normal, ray); 
    if (denom > 1e-6) { 
        vec3 p0l0 = planePoint - org; 
        t = dot(p0l0, normal) / denom; 
        return (t >= 0.0); 
    } 
 
    return false; 
}

float getIntersection(vec3 start, vec3 rayDir, float maxDist){
	//Distance between sample points. Set according to previous sample.
    float stepSize = 0.0;
    //Height of the waves.
    float height = 0.0;
    //Length of the ray.
    float dist = 0.0;
    //Difference between sample point and wave heights.
    float diff = 0.0;
    
    //Start ray tracing from intersection with xz-plane at y == 1.1*HEIGHT.
    float distToStart = 0.0;
    bool hitsPlane = getPlaneIntersection(start, rayDir, vec3(0.0, 1.1*HEIGHT, 0.0), 
                                          vec3(0,-1,0), distToStart);
    if(hitsPlane){
        dist = distToStart;
    }
    
    for(int i = 0; i < MAX_STEPS; i++){
        //Sample point
        vec3 p = start + rayDir * dist;
        
        //The height of the waves at the xz coordinates of the sample point.
        height = getHeight(p, shapeLimit);
        
        diff = abs(p.y - height);
        
        //If sample point is close enough to the water surface, return distance.
        if(diff < EPSILON){
            return dist;
        }
        //If height of sample point is less than the height of the waves,
        //the ray has hit the water. Use bisection to find the 0 crossing.
        if(p.y < height){
        	dist = bisection(start, rayDir, dist - stepSize, dist);
            return dist;
        }
        
        //Static step size misses features and leads to banding. 
        //Set the step size to a fraction of the distance above the waves.
        //Could also have a small step size which increases with distance, giving 
        //detailed results close to the camera and reaching far. However, 
        //this approach is used in many shaders and seems to give best results.
        stepSize = diff * 0.5;
        
        //Increment ray
        dist += stepSize;
        
        if(dist > MAX_DIST){
        	return MAX_DIST;
        }
    }
    return dist;
}

//https://iquilezles.org/articles/normalsSDF
//https://stackoverflow.com/questions/33736199/calculating-normals-for-a-height-map
vec3 getNormal(vec3 p, float t, int limit){
    
	//Making the normal sample distance depend on the ray length and resolution
    //leads to less noise.
    float eps = (0.05 / iResolution.y) * pow(t, 1.55);
    
    //Central difference method for estimating the derivatives and normal of a surface.
    /*
    float left = getHeight(vec3(p.x-eps, p.y, p.z), limit);
    float right = getHeight(vec3(p.x+eps, p.y, p.z), limit);
    float top = getHeight(vec3(p.x, p.y, p.z-eps), limit);
    float bottom = getHeight(vec3(p.x, p.y, p.z+eps), limit);
    
    float uy = right-left;
    vec3 u = normalize(vec3(2.0*eps, uy, 0.0));

   	float vy = bottom-top;
    vec3 v = normalize(vec3(0.0, vy, 2.0*eps));
    
    return normalize(cross(v,u));
    */
    
    //The above is equivalent to the following:
    return normalize(vec3( 
        getHeight(vec3(p.x-eps, p.y, p.z), limit) 
        - getHeight(vec3(p.x+eps, p.y, p.z), limit),
        
        2.0*eps,
        
        getHeight(vec3(p.x, p.y, p.z-eps), limit) 
        - getHeight(vec3(p.x, p.y, p.z+eps), limit) 
    ));
}

//https://learnopengl.com/PBR/Theory
float fresnelSchlick(vec3 cameraPos, vec3 position, vec3 normal){
    float cosTheta = dot(normal, normalize(cameraPos - position));
	float F0 = 0.02;
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

//Return colour of surface fragment based on light information.
vec3 shading(vec3 cameraPos, vec3 position, vec3 normal, vec3 rayDir, 
             float dist, vec3 lightDirection){
    
	vec3 result = vec3(0.0); 
    
	vec3 halfwayDir = normalize(lightDirection - rayDir);  
	float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);

	//Colour of light sharply reflected into the camera.
	vec3 specular = spec * specularColour * sunLightColour; 
	
	//How much a fragment faces the sun.
	float sun = max(dot(normal, lightDirection), 0.0);
    //Main sunlight contribution.
    vec3 sunLight = sun * sunLightColour;
    
    //How much the fragment faces up.
    float sky = max(dot(normal, vec3(0,1,0)), 0.0);
    //Sky light. A blue light from directly above.
	vec3 skyLight = sky * skyColour;
    
    //Combine light
    result += 0.1 * sunLight;
    result += 0.1 * skyLight;
    
    //Sample point height in the wave.
    float heightFraction = (position.y + HEIGHT) / (2.0 * HEIGHT);
    
    //Lighten the water when looking towards the horizon and darken it straight down.
    vec3 col = mix(ambientColour, 0.5*scatterColour, pow(0.5+0.5*rayDir.y, 2.0));
    
    //Light and material interaction.
    result *= diffuseColour;
    result += ambientStrength * col + specularStrength * specular;
    
    //Fake subsurface scattering based on light direction and surface normal.
    //https://www.alanzucconi.com/2017/08/30/fast-subsurface-scattering-1/
    vec3 h = normalize(-lightDirection + normal * distortion);
	float vDotH = pow(saturate(dot(rayDir, -h)), power) * scale;
    
    //Scattering in stronger closer to the camera and higher in the wave.
    result += 	scatterStrength * pow((1.0-dist/MAX_DIST), 4.0) * 
        		heightFraction * vDotH * scatterColour;
    
    //Reflection of the sky.
    vec3 reflectedDir = normalize(reflect(rayDir, normal));
    vec3 reflectedCol = getSkyColour(reflectedDir);
    float fresnel = saturate(fresnelSchlick(cameraPos, position, normal));
   	result = mix(result, 0.5*reflectedCol, fresnel);

    return result;
}

float getGlow(float dist, float radius, float intensity){
    dist = max(dist, 1e-6);
	return pow(radius/dist, intensity);	
}

//https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 ACESFilm(vec3 x){
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
        
    //Camera position is persistent and calculated in BufferA.
    vec3 cameraPos = texelFetch(iChannel0, ivec2(0.5, 1.5), 0).xyz;
    vec3 targetDir = -cameraPos;
    vec3 up = vec3(0.0, 1.0, 0.0);
    //Get the view matrix from the camera orientation.
    mat3 viewMatrix = lookAt(cameraPos, targetDir, up);
    
    vec3 lightDirection = normalize(vec3(sin(sunLocation), sunHeight, cos(sunLocation)));
    vec3 col = vec3(0);
    vec3 rayDir;
    bool skyVisible = false;
    
    #ifdef AA
    
    for(int i = 0; i <= 1; i++) {
        for(int j = 0; j <= 1; j++) {

            //Get the default direction of the ray (along the negative Z direction).
            rayDir = rayDirection(40.0, fragCoord+vec2(i,j)/2.0);
            
            #else
            
            rayDir = rayDirection(40.0, fragCoord);
            
            #endif


            //Transform the ray to point in the correct direction.
            rayDir = normalize(viewMatrix * rayDir);

            float dist = MAX_DIST;
            
            //Only render water for rays pointing down.
            if(rayDir.y < 0.0){
                //Find the distance to where the ray stops.
                dist = getIntersection(cameraPos, rayDir, MAX_DIST);
            }

            if(dist == MAX_DIST){
                skyVisible = true;
                col += getSkyColour(rayDir);
            }else{
                vec3 position = cameraPos + rayDir * dist;
                int limit = normalLimit;
				float xzDist = length(cameraPos.xz - position.xz);
                
                //Reduce normal detail after a certain distance.
                if(xzDist > 0.3*MAX_DIST){
                    limit = 4;
                }

                vec3 normal = getNormal(position, xzDist, limit);
                col += shading(cameraPos, position, normal, rayDir, dist, lightDirection);
            }

            #ifdef AA
        }
    }

    col *= 0.25;
    
    #endif

    //Display the sun as a glow in the light direction.
    if(skyVisible){
        float mu = dot(rayDir, lightDirection);
        col += sunColour*getGlow(1.0-mu, 0.0005, 1.0);
    }
    
    //Tonemapping.
    col = ACESFilm(col);

    //Gamma correction 1.0/2.2 = 0.4545...
    col = pow(col, vec3(0.4545));

    //Output to screen.
    fragColor = vec4(col, 1.0);
}