/**
 * based on Mugen87 / https://github.com/Mugen87 water2 library
 *
 * References:
 *	http://www.valvesoftware.com/publications/2010/siggraph2010_vlachos_waterflow.pdf
 * 	http://graphicsrunner.blogspot.de/2010/08/water-using-flow-maps.html
 *
 */

THREE.TerrainWater = function (geometry, options) {

    THREE.Mesh.call(this, geometry);

    this.type = 'Water';

    var scope = this;

    options = options || {};

    var seaColor = (options.seaColor !== undefined) ? new THREE.Color(options.seaColor) : new THREE.Color(0xFFFFFF);
    var riverColor = (options.riverColor !== undefined) ? new THREE.Color(options.riverColor) : new THREE.Color(0xFFFFFF);
    var lakeColor = (options.lakeColor !== undefined) ? new THREE.Color(options.lakeColor) : new THREE.Color(0xFFFFFF);
    var marshColor = (options.marshColor !== undefined) ? new THREE.Color(options.marshColor) : new THREE.Color(0xFFFFFF);
    var textureWidth = options.textureWidth || 512;
    var textureHeight = options.textureHeight || 512;
    var clipBias = options.clipBias || 0;
    //var flowDirection = options.flowDirection || [] //new THREE.Vector2(1, 0);
    var flowSpeed = options.flowSpeed || 0.03;
    var seaReflectivity = options.seaReflectivity || 0.02;
    var riverReflectivity = options.riverReflectivity || 0.02;
    var lakeReflectivity = options.lakeReflectivity || 0.02;
    var marshReflectivity = options.marshReflectivity || 0.02;
    var scale = options.scale || 1;
    var shader = options.shader || THREE.TerrainWater.WaterShader;

    var textureLoader = new THREE.TextureLoader();

    var flowMap = options.flowMap || undefined;
    var normalMap0 = options.normalMap0 || textureLoader.load('textures/water/Water_1_M_Normal.jpg');
    var normalMap1 = options.normalMap1 || textureLoader.load('textures/water/Water_2_M_Normal.jpg');

    var width = options.width || 1.0;
    var height = options.height || 1.0;

    var cycle = 0.15; // a cycle of a flow map phase
    var halfCycle = cycle * 0.5;
    var textureMatrix = new THREE.Matrix4();
    var clock = new THREE.Clock();

    // internal components

    if (THREE.Reflector === undefined) {

        console.error('THREE.TerrainWater: Required component THREE.Reflector not found.');
        return;

    }

    if (THREE.Refractor === undefined) {

        console.error('THREE.TerrainWater: Required component THREE.Refractor not found.');
        return;

    }

    var reflector = new THREE.Reflector(width, height, {
        textureWidth: textureWidth,
        textureHeight: textureHeight,
        clipBias: clipBias
    });

    var refractor = new THREE.Refractor(width, height, {
        textureWidth: textureWidth,
        textureHeight: textureHeight,
        clipBias: clipBias
    });

    reflector.matrixAutoUpdate = false;
    refractor.matrixAutoUpdate = false;

    // material

    this.material = new THREE.ShaderMaterial({
        //attributes: shader.attributes,
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib['fog'],
            shader.uniforms
        ]),
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        transparent: true,
        fog: true
    });

    if (flowMap !== undefined) {

        this.material.defines.USE_FLOWMAP = '';
        this.material.uniforms.tFlowMap = {
            type: 't',
            value: flowMap
        };

    } /*else {

        this.material.uniforms.flowDirection = {
            type: 'v2',
            value: flowDirection
        };

    }*/

    // maps

    normalMap0.wrapS = normalMap0.wrapT = THREE.RepeatWrapping;
    normalMap1.wrapS = normalMap1.wrapT = THREE.RepeatWrapping;

    this.material.uniforms.tReflectionMap.value = reflector.getRenderTarget().texture;
    this.material.uniforms.tRefractionMap.value = refractor.getRenderTarget().texture;
    this.material.uniforms.tNormalMap0.value = normalMap0;
    this.material.uniforms.tNormalMap1.value = normalMap1;

    // water

    this.material.uniforms.seaColor.value = seaColor;
    this.material.uniforms.riverColor.value = riverColor;
    this.material.uniforms.lakeColor.value = lakeColor;
    this.material.uniforms.marshColor.value = marshColor;
    this.material.uniforms.seaReflectivity.value = seaReflectivity;
    this.material.uniforms.riverReflectivity.value = riverReflectivity;
    this.material.uniforms.lakeReflectivity.value = lakeReflectivity;
    this.material.uniforms.marshReflectivity.value = marshReflectivity;
    this.material.uniforms.textureMatrix.value = textureMatrix;

    // inital values

    this.material.uniforms.config.value.x = 0; // flowMapOffset0
    this.material.uniforms.config.value.y = halfCycle; // flowMapOffset1
    this.material.uniforms.config.value.z = halfCycle; // halfCycle
    this.material.uniforms.config.value.w = scale; // scale

    // functions

    function updateTextureMatrix(camera) {

        textureMatrix.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        );

        textureMatrix.multiply(camera.projectionMatrix);
        textureMatrix.multiply(camera.matrixWorldInverse);
        textureMatrix.multiply(scope.matrixWorld);

    }

    function updateFlow() {

        var delta = clock.getDelta();
        var config = scope.material.uniforms.config;

        config.value.x += flowSpeed * delta; // flowMapOffset0
        config.value.y = config.value.x + halfCycle; // flowMapOffset1

        // Important: The distance between offsets should be always the value of "halfCycle".
        // Moreover, both offsets should be in the range of [ 0, cycle ].
        // This approach ensures a smooth water flow and avoids "reset" effects.

        if (config.value.x >= cycle) {

            config.value.x = 0;
            config.value.y = halfCycle;

        } else if (config.value.y >= cycle) {

            config.value.y = config.value.y - cycle;

        }

    }

    //

    this.onBeforeRender = function (renderer, scene, camera) {

        updateTextureMatrix(camera);
        updateFlow();

        scope.visible = false;

        reflector.matrixWorld.copy(scope.matrixWorld);
        refractor.matrixWorld.copy(scope.matrixWorld);

        reflector.onBeforeRender(renderer, scene, camera);
        refractor.onBeforeRender(renderer, scene, camera);

        scope.visible = true;

    };

};

THREE.TerrainWater.prototype = Object.create(THREE.Mesh.prototype);
THREE.TerrainWater.prototype.constructor = THREE.TerrainWater;

THREE.TerrainWater.WaterShader = {

    uniforms: {

        'seaColor': {
            type: 'c',
            value: null
        },
        'riverColor': {
            type: 'c',
            value: null
        },
        'lakeColor': {
            type: 'c',
            value: null
        },
        'marshColor': {
            type: 'c',
            value: null
        },

        'seaReflectivity': {
            type: 'f',
            value: 0
        },
        'riverReflectivity': {
            type: 'f',
            value: 0
        },
        'lakeReflectivity': {
            type: 'f',
            value: 0
        },
        'marshReflectivity': {
            type: 'f',
            value: 0
        },

        'tReflectionMap': {
            type: 't',
            value: null
        },

        'tRefractionMap': {
            type: 't',
            value: null
        },

        'tNormalMap0': {
            type: 't',
            value: null
        },

        'tNormalMap1': {
            type: 't',
            value: null
        },

        'textureMatrix': {
            type: 'm4',
            value: null
        },

        'config': {
            type: 'v4',
            value: new THREE.Vector4()
        }

    },

    vertexShader: [

        '#include <fog_pars_vertex>',

        'attribute float biome;', //Attributes are values that are applied to individual vertices
        'attribute vec2 flowDirection;', //Attributes are values that are applied to individual vertices

        'uniform mat4 textureMatrix;',

        'varying vec4 vCoord;',
        'varying vec2 vUv;',
        'varying vec3 vToEye;',
        'varying vec2 vflowDirection;', //Varyings are variables declared in the vertex shader that we want to share with the fragment shader
        'varying float vBiome;', //Varyings are variables declared in the vertex shader that we want to share with the fragment shader

        'void main() {',

        '	vUv = uv;',
        '	vBiome = biome;',
        '	vflowDirection = flowDirection;',
        '	vCoord = textureMatrix * vec4( position, 1.0 );',

        '	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
        '	vToEye = cameraPosition - worldPosition.xyz;',

        '	vec4 mvPosition =  viewMatrix * worldPosition;', // used in fog_vertex
        '	gl_Position = projectionMatrix * mvPosition;', // real deal of the vertex file

        '	#include <fog_vertex>',

        '}'

    ].join('\n'),

    fragmentShader: [

        '#include <fog_pars_fragment>',        

        'uniform sampler2D tReflectionMap;',
        'uniform sampler2D tRefractionMap;',
        'uniform sampler2D tNormalMap0;',
        'uniform sampler2D tNormalMap1;',

        '#ifdef USE_FLOWMAP',
        '	uniform sampler2D tFlowMap;',
        //'#else',
        //'	uniform vec2 flowDirection;',
        '#endif',

        'uniform vec3 seaColor;',
        'uniform vec3 riverColor;',
        'uniform vec3 lakeColor;',
        'uniform vec3 marshColor;',
        'uniform float seaReflectivity;',
        'uniform float riverReflectivity;',
        'uniform float lakeReflectivity;',
        'uniform float marshReflectivity;',
        'uniform vec4 config;',

        'varying vec4 vCoord;',
        'varying vec2 vUv;',
        'varying vec3 vToEye;',
        'varying float vBiome;', //Varyings are variables declared in the vertex shader that we want to share with the fragment shader
        'varying vec2 vflowDirection;', //Varyings are variables declared in the vertex shader that we want to share with the fragment shader

        'void main() {',

        '	float flowMapOffset0 = config.x;',
        '	float flowMapOffset1 = config.y;',
        '	float halfCycle = config.z;',
        '	float scale = config.w;',
        
        '	vec3 color = riverColor;',
        '	float reflectivity = riverReflectivity;',
        '	vec3 toEye = normalize( vToEye );',

        // determine flow direction
        '	vec2 flow;',
        '	#ifdef USE_FLOWMAP',
        '		flow = texture2D( tFlowMap, vUv ).rg * 2.0 - 1.0;',
        '	#else',
        '		flow = vflowDirection;',
        '	#endif',
        '	flow.x *= - 1.0;',

        // determine color and reflectivity
        // by default is river values, so I do not need to evaluate those
        '   if(vBiome == 10.0) { reflectivity = seaReflectivity; color = seaColor; }',
        '   if(vBiome == 0.0) { reflectivity = seaReflectivity; color = seaColor; }',
        '   if(vBiome == 20.0) { reflectivity = lakeReflectivity; color = lakeColor; }',        
        '   if(vBiome == 50.0) { reflectivity = marshReflectivity; color = marshColor; }',

        // sample normal maps (distort uvs with flowdata)
        '	vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );',
        '	vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );',

        // linear interpolate to get the final normal color
        '	float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;',
        '	vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );',

        // calculate normal vector
        '	vec3 normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );',

        // calculate the fresnel term to blend reflection and refraction maps
        '	float theta = max( dot( toEye, normal ), 0.0 );',
        '	float reflectance = reflectivity + ( 1.0 - reflectivity ) * pow( ( 1.0 - theta ), 5.0 );',

        // calculate final uv coords
        '	vec3 coord = vCoord.xyz / vCoord.w;',
        '	vec2 uv = coord.xy + coord.z * normal.xz * 0.05;',

        '	vec4 reflectColor = texture2D( tReflectionMap, uv );',
        '	vec4 refractColor = texture2D( tRefractionMap, uv );',

        // multiply water color with the mix of both textures
        '	gl_FragColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );', // real deal of the vertex file

        '	#include <tonemapping_fragment>',
        '	#include <encodings_fragment>',
        '	#include <fog_fragment>',

        '}'

    ].join('\n')
};