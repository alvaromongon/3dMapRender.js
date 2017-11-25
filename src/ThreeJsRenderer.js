var THREE_COLORS = {
    OCEAN_WATER: { color: new THREE.Color('#82caff'), code: 0 },
    OCEAN: { color: new THREE.Color('#fbf8e5'), code: 1 },
    BEACH: { color: new THREE.Color('#ffe98d'), code: 2 },
    LAKE: { color: new THREE.Color('#2f9ceb'), code: 3 },
    RIVER: { color: new THREE.Color('#369eea'), code: 4 },
    RIVER_WATER: { color: new THREE.Color('#369eea'), code: 5 },
    SOURCE: { color: new THREE.Color('#00f'), code: 6 },
    MARSH: { color: new THREE.Color('#2ac6d3'), code: 7 },
    ICE: { color: new THREE.Color('#b3deff'), code: 8 },
    ROCK: { color: new THREE.Color('#535353'), code: 9 },
    LAVA: { color: new THREE.Color('#e22222'), code: 10 },

    SNOW: { color: new THREE.Color('#f8f8f8'), code: 11 },
    TUNDRA: { color: new THREE.Color('#ddddbb'), code: 12 },
    BARE: { color: new THREE.Color('#bbbbbb'), code: 13 },
    SCORCHED: { color: new THREE.Color('#999999'), code: 14 },
    TAIGA: { color: new THREE.Color('#ccd4bb'), code: 15 },
    SHRUBLAND: { color: new THREE.Color('#c4ccbb'), code: 16 },
    TEMPERATE_DESERT: { color: new THREE.Color('#e4e8ca'), code: 17 },
    TEMPERATE_RAIN_FOREST: { color: new THREE.Color('#a4c4a8'), code: 18 },
    TEMPERATE_DECIDUOUS_FOREST: { color: new THREE.Color('#b4c9a9'), code: 19 },
    GRASSLAND: { color: new THREE.Color('#c4d4aa'), code: 20 },
    TROPICAL_RAIN_FOREST: { color: new THREE.Color('#9cbba9'), code: 21 },
    TROPICAL_SEASONAL_FOREST: { color: new THREE.Color('#a9cca4'), code: 22 },
    SUBTROPICAL_DESERT: { color: new THREE.Color('#e9ddc7'), code: 23 }
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
        var sizeMultiplayer = 8;
        var elevationMultiplayer = this.width * 0.6;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color().setHSL(0.6, 0, 1);
        this.scene.fog = new THREE.Fog(this.scene.background, 1, this.width * sizeMultiplayer * 2);

        // Camera // (fov, aspect, near, far)
        this.camera = new THREE.PerspectiveCamera(75, 1, 1, this.width * sizeMultiplayer * 10); 
        this.camera.position.x = -this.width * sizeMultiplayer/2;
        this.camera.position.y = this.width * sizeMultiplayer;
        this.camera.position.z = 0;
        this.scene.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerWidth);
        //this.renderer.setSize(this.width * sizeMultiplayer, this.height * sizeMultiplayer);
        //this.renderer.physicallyCorrectLights = true;
        //this.renderer.gammaInput = true;
        //this.renderer.gammaOutput = true;
        //this.renderer.shadowMap.enabled = true;
        //this.renderer.toneMapping = THREE.ReinhardToneMapping;

        this.renderMap(sizeMultiplayer, elevationMultiplayer, meshData);
        this.renderBackgroundAndLight(sizeMultiplayer, elevationMultiplayer);

        // Controls
        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //controls.maxPolarAngle = Math.PI * 0.5;
        controls.minDistance = 1;
        controls.maxDistance = this.width * sizeMultiplayer;

        animate();

        //console.info("Three render completed");
    },    

    ///
    /// Render voronoi map
    ///
    renderMap: function (sizeMultiplayer, elevationMultiplayer, meshData) {
        
        var terrain = this.renderTerrain(meshData.terrain, elevationMultiplayer, sizeMultiplayer);
        terrain.rotateX(Math.PI * - 0.5);
        this.scene.add(terrain);
        
        
        var terrainWater = this.renderTerrainWater(meshData.terrain, elevationMultiplayer, sizeMultiplayer);
        terrainWater.rotateX(Math.PI * - 0.5);
        this.scene.add(terrainWater);    
        
        
        var oceanBed = this.renderOceanBed(meshData.seaBed, sizeMultiplayer);
        oceanBed.rotateX(Math.PI * - 0.5);
        oceanBed.position.y = meshData.seaBed.elevation;
        this.scene.add(oceanBed);
        
        
        var ocean = this.renderSeaWater(sizeMultiplayer);
        ocean.rotateX(Math.PI * - 0.5);
        ocean.position.y = 0.1;
        this.scene.add(ocean);
        
    },

    ///
    /// Render terrain
    ///
    renderTerrain: function (metadata, elevationMultiplayer, sizeMultiplayer) {
        var geometry = new THREE.PlaneBufferGeometry(
            this.width * sizeMultiplayer, this.height * sizeMultiplayer,
            this.width - 1, this.height - 1);

        // Set altitudes
        var vertices = geometry.attributes.position.array;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3, j++) {
            vertices[i + 2] = this.calculateTerrainElevation(metadata.elevations[j], metadata.biomes[j], elevationMultiplayer);
        }

        texture = new THREE.CanvasTexture(this.generateGroundTexture(metadata, this.width, this.height, sizeMultiplayer));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    },  

    ///
    /// Render  river and lakes water
    ///
    renderTerrainWater: function (metadata, elevationMultiplayer, sizeMultiplayer) {
        var geometry = new THREE.PlaneBufferGeometry(
            this.width * sizeMultiplayer, this.height * sizeMultiplayer,
            this.width - 1, this.height - 1);

        // Set altitudes
        var vertices = geometry.attributes.position.array;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3, j++) {
            vertices[i + 2] = this.calculateTerrainWaterElevation(metadata.elevations[j], metadata.biomes[j], elevationMultiplayer);
        }

        var water = new THREE.TerrainWater(geometry, {
            color: THREE_COLORS["RIVER_WATER"].color,
            scale: 4,
            textureWidth: 1024,
            textureHeight: 1024,
            flowDirection: new THREE.Vector2(0, 0),
            surfaceData: metadata
        });

        return water;
    },

    ///
    /// Render the rest of the ocen botton since the need to give a endless terrain apperance
    ///
    renderOceanBed: function (metadata, sizeMultiplayer) {
        var oceanBedGeometry = new THREE.PlaneBufferGeometry(this.width * sizeMultiplayer * 4, this.height * sizeMultiplayer * 4);
        var oceanBedMaterial = new THREE.MeshBasicMaterial({ color: THREE_COLORS[metadata.biome].color }); //, side: THREE.DoubleSide });
        var oceanBed = new THREE.Mesh(oceanBedGeometry, oceanBedMaterial);

        return oceanBed;
    },

    ///
    /// Render sea water
    ///
    renderSeaWater: function (sizeMultiplayer) {
        var water = new THREE.Water(this.width * sizeMultiplayer * 4, this.height * sizeMultiplayer * 4, {
            color: THREE_COLORS["OCEAN_WATER"].color,
            scale: 4,
            textureWidth: 1024,
            textureHeight: 1024,
            flowDirection: new THREE.Vector2(0, 0)
        });

        return water;
    },

    ///
    /// Calculate real terrain elevations
    ///
    calculateTerrainElevation: function (vertexElevation, vertexBiome, elevationMultiplayer) {
        var elevation = vertexElevation * elevationMultiplayer;

        if (vertexBiome == "RIVER" || vertexBiome == "LAKE") {
            elevation = elevation * 0.85; //Cave river course and lake bed
        } 
        return elevation;
    },

    ///
    /// Calculate real terrain warter elevations
    ///
    calculateTerrainWaterElevation: function (vertexElevation, vertexBiome, elevationMultiplayer) {
        return vertexElevation * elevationMultiplayer;
    },

    ///
    /// Generate ground texture
    ///
    generateGroundTexture: function (data, width, height, sizeMultiplayer) {
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
        canvasScaled.width = width * sizeMultiplayer;
        canvasScaled.height = height * sizeMultiplayer;

        context = canvasScaled.getContext('2d');
        context.scale(sizeMultiplayer, sizeMultiplayer);
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
    /// Render background images and lights
    ///
    renderBackgroundAndLight: function (sizeMultiplayer, elevationMultiplayer) {
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
        var skyGeo = new THREE.SphereGeometry(this.width * sizeMultiplayer * 2, 32, 15);
        var skyMat = new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: uniforms, side: THREE.BackSide });

        var sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}