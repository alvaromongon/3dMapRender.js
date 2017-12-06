var THREE_COLORS = {
    OCEAN: { color: new THREE.Color('#f7ecc0'), code: 10 },
    BEACH: { color: new THREE.Color('#ffe98d'), code: 11 },

    LAKE: { color: new THREE.Color('#535353'), code: 20 },
    //LAKE_SIDE: { color: new THREE.Color('#ffe98d'), code: 21 },

    RIVER: { color: new THREE.Color('#535353'), code: 30 },
    //RIVER_SIDE: { color: new THREE.Color('#ffe98d'), code: 31 },

    SOURCE: { color: new THREE.Color('#535353'), code: 40 },
    
    MARSH: { color: new THREE.Color('#994d00'), code: 50 }, //cienage
    
    ICE: { color: new THREE.Color('#b3deff'), code: 60 },
    ROCK: { color: new THREE.Color('#535353'), code: 70 },
    LAVA: { color: new THREE.Color('#e22222'), code: 80 },

    SNOW: { color: new THREE.Color('#f8f8f8'), code: 90 },
    TUNDRA: { color: new THREE.Color('#ddddbb'), code: 100 },
    BARE: { color: new THREE.Color('#bbbbbb'), code: 110 },
    SCORCHED: { color: new THREE.Color('#999999'), code: 120 },
    TAIGA: { color: new THREE.Color('#ccd4bb'), code: 130 },
    SHRUBLAND: { color: new THREE.Color('#c4ccbb'), code: 140 },
    TEMPERATE_DESERT: { color: new THREE.Color('#e4e8ca'), code: 150 },
    TEMPERATE_RAIN_FOREST: { color: new THREE.Color('#a4c4a8'), code: 160 },
    TEMPERATE_DECIDUOUS_FOREST: { color: new THREE.Color('#b4c9a9'), code: 170 },
    GRASSLAND: { color: new THREE.Color('#c4d4aa'), code: 180 },
    TROPICAL_RAIN_FOREST: { color: new THREE.Color('#9cbba9'), code: 190 },
    TROPICAL_SEASONAL_FOREST: { color: new THREE.Color('#a9cca4'), code: 200 },
    SUBTROPICAL_DESERT: { color: new THREE.Color('#e9ddc7'), code: 210 }
};

var ThreeJsRenderer = {
    canvas: null,
    config: null,
    width: null,
    height: null,

    scene: null,
    camera: null,
    light: null,
    renderer: null,

    render: function (canvas, meshData, width, height) {
        if (!width || !height) {
            console.error("ThreeJsRenderer.new method requires a not width and height parameters");
            return;
        }
        this.canvas = canvas;
        this.width = width;
        this.height = height;   

        // Variables to sync different rendered parts
        var sizeMultiplier = 8;
        var elevationMultiplier = this.width * 0.6;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color().setHSL(0.6, 0, 1);
        this.scene.fog = new THREE.Fog(this.scene.background, 1, this.width * sizeMultiplier * 2);

        // Camera // (fov, aspect, near, far)
        this.camera = new THREE.PerspectiveCamera(75, 1, 1, this.width * sizeMultiplier * 10); 
        this.camera.position.x = -this.width * sizeMultiplier/2;
        this.camera.position.y = this.width * sizeMultiplier;
        this.camera.position.z = 0;
        this.scene.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerWidth);
        //this.renderer.setSize(this.width * sizeMultiplier, this.height * sizeMultiplier);
        //this.renderer.physicallyCorrectLights = true;
        //this.renderer.gammaInput = true;
        //this.renderer.gammaOutput = true;
        //this.renderer.shadowMap.enabled = true;
        //this.renderer.toneMapping = THREE.ReinhardToneMapping;

        this.renderMap(sizeMultiplier, elevationMultiplier, meshData);
        //this.renderSkyBox(sizeMultiplier, elevationMultiplier);
        //this.renderLights();
        this.renderBackgroundAndLight(sizeMultiplier, elevationMultiplier);

        // Controls
        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //controls.maxPolarAngle = Math.PI * 0.5;
        controls.minDistance = 1;
        controls.maxDistance = this.width * sizeMultiplier;

        animate();

        //console.info("Three render completed");
    },    

    ///
    /// Render voronoi map
    ///
    renderMap: function (sizeMultiplier, elevationMultiplier, meshData) {           

        this.renderGroundAndWater(meshData.terrain, elevationMultiplier, sizeMultiplier, this.scene);       

        var oceanBed = this.renderOceanBed(THREE_COLORS["OCEAN"].color, sizeMultiplier);
        oceanBed.rotateX(Math.PI * - 0.5);
        oceanBed.position.y = -0.5 * elevationMultiplier;
        this.scene.add(oceanBed);
    },

    ///
    /// Render ground and water
    ///
    renderGroundAndWater: function (metadata, elevationMultiplier, sizeMultiplier, scene) {

        var groundGeometry = new THREE.PlaneBufferGeometry(
            this.width * sizeMultiplier, this.height * sizeMultiplier,
            this.width - 1, this.height - 1);

        var waterGeometry = new THREE.PlaneBufferGeometry(
            this.width * sizeMultiplier, this.height * sizeMultiplier,
            this.width - 1, this.height - 1);
        waterGeometry.addAttribute('flowDirection', new THREE.BufferAttribute(metadata.flowDirections, 2));        

        // Set altitudes
        var groundVertices = groundGeometry.attributes.position.array;
        var waterVertices = waterGeometry.attributes.position.array;
        var biomeCodes = new Float32Array(waterGeometry.parameters.width*waterGeometry.parameters.height);
        for (var i = 0, j = 0, numVertices = groundVertices.length; i < numVertices; i += 3, j++) {
            groundVertices[i + 2] = this.calculateTerrainElevation(metadata.elevations[j], metadata.biomes[j], elevationMultiplier);
            waterVertices[i + 2] = this.calculateTerrainWaterElevation(metadata.elevations[j], metadata.biomes[j], elevationMultiplier);
            biomeCodes[j] = THREE_COLORS[metadata.biomes[j]].code;
        }
        waterGeometry.addAttribute('biome', new THREE.BufferAttribute(biomeCodes, 1));

        // TERRAIN
        groundTexture = new THREE.CanvasTexture(this.generateGroundTexture(metadata, this.width, this.height, sizeMultiplier));
        groundTexture.wrapS = THREE.ClampToEdgeWrapping;
        groundTexture.wrapT = THREE.ClampToEdgeWrapping;

        var groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        groundMaterial.needsUpdate = true;
        var ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotateX(Math.PI * - 0.5);
        scene.add(ground);

        // WATER
        var waterExtendedGeometry = new THREE.PlaneBufferGeometry(this.width * sizeMultiplier * 4, this.height * sizeMultiplier * 4);
        var flowDirectionExtended = new Float32Array(waterExtendedGeometry.parameters.width*waterExtendedGeometry.parameters.height*2);
        var biomesExtended = new Float32Array(waterExtendedGeometry.parameters.width*waterExtendedGeometry.parameters.height);
        waterExtendedGeometry.addAttribute('flowDirection', new THREE.BufferAttribute(flowDirectionExtended, 2));
        waterExtendedGeometry.addAttribute('biome', new THREE.BufferAttribute(biomesExtended, 1));

        var waterGeometryMerged = waterGeometry.join(waterExtendedGeometry);
        var water = new THREE.TerrainWater(waterGeometryMerged, {
            seaColor: new THREE.Color('#ffffff'),
            riverColor: new THREE.Color('#ffffff'),
            lakeColor: new THREE.Color('#ffffff'),
            marshColor: new THREE.Color('#ffffff'),
            scale: 4,
            textureWidth: 1024,
            textureHeight: 1024,
            flowSpeed: 0.02,
            seaReflectivity: 0.7,
            riverReflectivity: 0.6,
            lakeReflectivity: 0.7,
            marshReflectivity: 0.5,
            width: waterGeometry.parameters.width,
            height: waterGeometry.parameters.height
        });
        water.rotateX(Math.PI * - 0.5);
        scene.add(water);
    },

    ///
    /// Render the rest of the ocen botton since the need to give a endless terrain apperance
    ///
    renderOceanBed: function (seaBedColor, sizeMultiplier) {
        var oceanBedGeometry = new THREE.PlaneBufferGeometry(this.width * sizeMultiplier * 4, this.height * sizeMultiplier * 4);
        var oceanBedMaterial = new THREE.MeshBasicMaterial({ color: seaBedColor }); //, side: THREE.DoubleSide });
        var oceanBed = new THREE.Mesh(oceanBedGeometry, oceanBedMaterial);

        return oceanBed;
    },

    ///
    /// Calculate real terrain elevations
    ///
    calculateTerrainElevation: function (vertexElevation, vertexBiome, elevationMultiplier) {
        var elevation = vertexElevation * elevationMultiplier;

        if (vertexBiome == "RIVER" || vertexBiome == "LAKE") {
            elevation = elevation * (((elevation / elevationMultiplier) * 0.10) + 0.90); //Cave river course and lake bed
        } else if (vertexBiome == "MARSH"){ 
            elevation = elevation * 0.95 // cienaga, pantano
        }
        return elevation;
    },

    ///
    /// Calculate real terrain warter elevations
    ///
    calculateTerrainWaterElevation: function (vertexElevation, vertexBiome, elevationMultiplier) {   
                      
        var elevation = 0.0

        if (vertexBiome == "RIVER" || vertexBiome == "LAKE" || vertexBiome == "MARSH") {
            elevation = vertexElevation * elevationMultiplier;
        }
        else if (vertexBiome != "OCEAN") {
            elevation = vertexElevation * elevationMultiplier * 0.95;
        }

        return elevation;
    },

    ///
    /// Generate ground texture
    ///
    generateGroundTexture: function (data, width, height, sizeMultiplier) {
        var canvas, canvasScaled, context, image, imageData,
        level, diff, vector3, sun, shade;

        vector3 = new THREE.Vector3(0, 0, 0);

        sun = new THREE.Vector3(1, 1, 1);
        sun.normalize();

        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        context = canvas.getContext('2d');
        context.fillStyle = '#000';
        context.fillRect(0, 0, width, height);

        image = context.getImageData(0, 0, canvas.width, canvas.height);
        imageData = image.data;

        for (var i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
            // Do not apply shades
            imageData[i] = THREE_COLORS[data.biomes[j]].color.r * 255;
            imageData[i + 1] = THREE_COLORS[data.biomes[j]].color.g * 255;
            imageData[i + 2] = THREE_COLORS[data.biomes[j]].color.b * 255;
            /*
            vector3.x = data.elevations[j - 2] - data.elevations[j + 2];
            vector3.y = 2;
            vector3.z = data.elevations[j - width * 2] - data.elevations[j + width * 2];
            vector3.normalize();

            shade = vector3.dot(sun);

            imageData[i] = THREE_COLORS[data.biomes[j]].r * 255 * shade;  //(96 + shade * 128) * (0.5 + data.elevations[j] * 0.007);
            imageData[i + 1] = THREE_COLORS[data.biomes[j]].g * 255 * shade; //(32 + shade * 96) * (0.5 + data.elevations[j] * 0.007);
            imageData[i + 2] = THREE_COLORS[data.biomes[j]].b * 255 * shade; //(shade * 96) * (0.5 + data.elevations[j] * 0.007);
            */
        }

        context.putImageData(image, 0, 0);

        // Scaled 4x

        canvasScaled = document.createElement('canvas');
        canvasScaled.width = width * sizeMultiplier;
        canvasScaled.height = height * sizeMultiplier;

        context = canvasScaled.getContext('2d');
        context.scale(sizeMultiplier, sizeMultiplier);
        context.drawImage(canvas, 0, 0);

        image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
        imageData = image.data;

        for (var i = 0, l = imageData.length; i < l; i += 4) {

            var v = ~~(Math.random() * 5);

            imageData[i] += v;
            imageData[i + 1] += v;
            imageData[i + 2] += v;

        }

        context.putImageData(image, 0, 0);

        return canvasScaled;
    },

    ///
    /// Render Skybox
    ///
    renderSkyBox: function (sizeMultiplier, elevationMultiplier) {
        var cubeTextureLoader = new THREE.CubeTextureLoader();
        cubeTextureLoader.setPath('textures/cube/skybox/');

        var cubeTexture = cubeTextureLoader.load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg',
        ]);

        var cubeShader = THREE.ShaderLib['cube'];
        cubeShader.uniforms['tCube'].value = cubeTexture;

        var skyBoxMaterial = new THREE.ShaderMaterial({
            fragmentShader: cubeShader.fragmentShader,
            vertexShader: cubeShader.vertexShader,
            uniforms: cubeShader.uniforms,
            side: THREE.BackSide
        });

        var skyBoxSize = this.width * sizeMultiplier * 2;
        var skyBox = new THREE.Mesh(new THREE.BoxBufferGeometry(skyBoxSize, skyBoxSize, skyBoxSize), skyBoxMaterial);
        this.scene.add(skyBox);
    },

    ///
    /// Render light
    ///
    renderLights: function () {
        var ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
        this.scene.add(ambientLight);

        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(- 1, 1, 1);
        this.scene.add(directionalLight);
    },

    ///
    /// Render background images and lights
    ///
    renderBackgroundAndLight: function (sizeMultiplier, elevationMultiplier) {
        var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
        hemiLight.color.setHSL(0.6, 1, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        hemiLight.position.set(0, this.width, 0);
        this.scene.add(hemiLight);

        var hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
        this.scene.add(hemiLightHelper);
        

        var vertexShader = document.getElementById('vertexShader').textContent;
        var fragmentShader = document.getElementById('fragmentShader').textContent;
        var uniforms = {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        uniforms.topColor.value.copy(hemiLight.color);

        this.scene.fog.color.copy(uniforms.bottomColor.value);

        // ( radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength )
        var skyGeo = new THREE.SphereGeometry(this.width * sizeMultiplier * 2, 32, 15);
        var skyMat = new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: uniforms, side: THREE.BackSide });

        var sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}