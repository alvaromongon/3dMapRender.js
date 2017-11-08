var THREE_COLORS = {
    OCEAN: new THREE.Color('#82caff'),
    BEACH: new THREE.Color('#ffe98d'),
    LAKE: new THREE.Color('#2f9ceb'),
    RIVER: new THREE.Color('#369eea'),
    SOURCE: new THREE.Color('#00f'),
    MARSH: new THREE.Color('#2ac6d3'),
    ICE: new THREE.Color('#b3deff'),
    ROCK: new THREE.Color('#535353'),
    LAVA: new THREE.Color('#e22222'),

    SNOW: new THREE.Color('#f8f8f8'),
    TUNDRA: new THREE.Color('#ddddbb'),
    BARE: new THREE.Color('#bbbbbb'),
    SCORCHED: new THREE.Color('#999999'),
    TAIGA: new THREE.Color('#ccd4bb'),
    SHRUBLAND: new THREE.Color('#c4ccbb'),
    TEMPERATE_DESERT: new THREE.Color('#e4e8ca'),
    TEMPERATE_RAIN_FOREST: new THREE.Color('#a4c4a8'),
    TEMPERATE_DECIDUOUS_FOREST: new THREE.Color('#b4c9a9'),
    GRASSLAND: new THREE.Color('#c4d4aa'),
    TROPICAL_RAIN_FOREST: new THREE.Color('#9cbba9'),
    TROPICAL_SEASONAL_FOREST: new THREE.Color('#a9cca4'),
    SUBTROPICAL_DESERT: new THREE.Color('#e9ddc7')
};

var ThreeJsRenderer = {
    canvas: null,
    diagram: null,
    sites: null,
    config: null,

    scene: null,
    camera: null,
    light: null,
    renderer: null,

    render: function (canvas, diagram, sites, config) {
        if (!diagram || !sites || !config) {
            console.error("ThreeJsRenderer.render method requires a not null diagram, sites and config parameters");
            return;
        }
        this.canvas = canvas;
        this.diagram = diagram;
        this.sites = sites;
        this.config = config;

        var sizeMultiplayer = 4;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color().setHSL(0.6, 0, 1);
        this.scene.fog = new THREE.Fog(this.scene.background, 1, 5000);

        // Camera 
        this.camera = new THREE.PerspectiveCamera(75, 1, 1, 10000); // (fov, aspect, near, far)
        this.camera.position.x = 0;
        this.camera.position.y = this.config.width * sizeMultiplayer;
        this.camera.position.z = 0;
        this.scene.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(this.config.width * sizeMultiplayer, this.config.height * sizeMultiplayer);
        //this.renderer.physicallyCorrectLights = true;
        //this.renderer.gammaInput = true;
        //this.renderer.gammaOutput = true;
        //this.renderer.shadowMap.enabled = true;
        //this.renderer.toneMapping = THREE.ReinhardToneMapping;

        this.renderMap(sizeMultiplayer);
        this.renderSkyBox();
        this.renderLight();

        // Controls
        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //controls.maxPolarAngle = Math.PI * 0.5;
        controls.minDistance = 1;
        controls.maxDistance = this.config.width * sizeMultiplayer;

        animate();

        console.info("Three render completed");
    },    

    ///
    /// Render voronoi map
    ///
    renderMap: function (sizeMultiplayer) {
        var metadata = this.generateMapMetadata();
        
        var elevationMultiplayer = this.config.width * 0.4;

        var terrain = this.renderMapTerrain(metadata, elevationMultiplayer, sizeMultiplayer);
        terrain.rotateX(Math.PI * - 0.5);
        this.scene.add(terrain);

        var sea = this.renderMapSea(sizeMultiplayer);
        sea.rotateX(Math.PI * - 0.5);
        sea.position.y = 0.1
        this.scene.add(sea);
    },

    ///
    /// Render skybox
    ///
    renderSkyBox: function (sizeMultiplayer) {
        var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
        hemiLight.color.setHSL(0.6, 1, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        hemiLight.position.set(0, 0, 100);
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

        var skyGeo = new THREE.SphereGeometry(4000, 32, 15); // ( radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength )
        var skyMat = new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: uniforms, side: THREE.BackSide });

        var sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    },

    ///
    /// Render scene lights
    ///
    renderLight: function () {
        /*
        var bulbGeometry = new THREE.SphereGeometry(5, 16, 8);
        bulbLight = new THREE.PointLight(0xffee88, 1, 1000, 2);
        bulbMat = new THREE.MeshStandardMaterial({
            emissive: 0xffffee,
            emissiveIntensity: 1,
            color: 0x000000
        });
        bulbLight.add(new THREE.Mesh(bulbGeometry, bulbMat));
        bulbLight.position.x = 0;
        bulbLight.position.y = 0;
        bulbLight.position.z = this.config.width * 4;
        bulbLight.castShadow = true;

        this.scene.add(bulbLight);
        */

        //this.scene.add(THREE.AmbientLight(0xcccccc, 0.4));

        /*
        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(- 1, 1, 1);
        this.scene.add(directionalLight);
        */        
    },

    ///
    /// Generate heights, biome for each point in the plane plus rivers points for the whole map
    ///
    generateMapMetadata: function () {
        var voronoiMap = this.processVoronoiDiagram();

        var size = this.config.width * this.config.height;

        var data = new Object();
        data.elevations = new Array(size);
        data.biomes = new Array(size);

        // For each point in the plane set elevation and biomes
        for (var i = 0; i < size; i++) {
            var point = [i % this.config.width, Math.floor(i / this.config.height)];

            // Search the voronoi polygon where the point is located
            // Since we only look for in terrain cells, we need to filter out the under level water points
            var distanceToClosetSite = this.config.width;
            var closetTerrainCell = null;
            for (var cll = 0, numCells = voronoiMap.terrainCells.length; cll < numCells; cll++) {
                var distance = this.calculate2dDistance(point,
                    [voronoiMap.terrainCells[cll].site.x, voronoiMap.terrainCells[cll].site.y]);
                if (distance < distanceToClosetSite) {
                    distanceToClosetSite = distance;
                    closetTerrainCell = voronoiMap.terrainCells[cll];
                }
            }
            if (closetTerrainCell != null) {
                var pointRealElevation = this.calculatePointRealElevation(point, closetTerrainCell, distanceToClosetSite);
                if (pointRealElevation < 0) {
                    data.elevations[i] = 0; // by default is 0
                    data.biomes[i] = "OCEAN"; // by default is OCEAN
                    continue;
                }
                data.elevations[i] = pointRealElevation;
                data.biomes[i] = closetTerrainCell.biome;
            }
            else {
                console.log("Impossible to find a closet terrain cell for the given point. This should never happens");
            }

            // Search if the point is contained in any of the river segments and assign RIVER biome
            for (var j = 0, numSegments = voronoiMap.riverPaths.length; j < numSegments; j++) {
                var distance = this.pointDistanceToLine(
                    point[0], point[1],
                    voronoiMap.riverPaths[j].x1, voronoiMap.riverPaths[j].y1,
                    voronoiMap.riverPaths[j].x2, voronoiMap.riverPaths[j].y2);
                if (distance < 1) {
                    data.biomes[i] = "RIVER";
                    //console.log("point [" + point[0] + "," + point[1] + "] with distance " + distance);
                    break;
                }
            }
        }

        return data;
    },

    /// 
    /// Process voronoi diagram to create a more adecuated for 3d rendering data structure
    ///
    processVoronoiDiagram: function () {
        var voronoiMap = new Object();
        voronoiMap.terrainCells = [];
        voronoiMap.riverPaths = [];

        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid]; // this cell

            // Only process the terrain cells
            if (cell.ocean) {
                continue;
            }
            voronoiMap.terrainCells.push(cell);

            // Build river paths if needed
            if (cell.nextRiver) {
                var riverSegment = new Object();
                //riverSegment.width = Math.min(cell.riverSize, this.config.maxRiversSize);
                var x, y;
                if (cell.water) {
                    x = cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2;
                    y = cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2;
                } else {
                    x = cell.site.x;
                    y = cell.site.y;

                }
                riverSegment.x1 = x;
                riverSegment.y1 = y;

                if (cell.nextRiver && !cell.nextRiver.water) {
                    x = cell.nextRiver.site.x;
                    y = cell.nextRiver.site.y;
                } else {
                    x = cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2;
                    y = cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2;
                }
                riverSegment.x2 = x;
                riverSegment.y2 = y;

                voronoiMap.riverPaths.push(riverSegment);
            }
        }

        return voronoiMap;
    },

    ///
    /// Render terrain
    ///
    renderMapTerrain: function (metadata, elevationMultiplayer, sizeMultiplayer) {
        // var geometry = new THREE.PlaneBufferGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 ); ????
        var geometry = new THREE.PlaneBufferGeometry(
            this.config.width * sizeMultiplayer, this.config.height * sizeMultiplayer,
            this.config.width - 1, this.config.height - 1);
        //geometry.rotateX(- Math.PI / 2);

        // Set altitudes
        var vertices = geometry.attributes.position.array;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3, j++) {
            vertices[i + 2] = metadata.elevations[j] * elevationMultiplayer;
        }

        texture = new THREE.CanvasTexture(this.generateGroundTexture(metadata, this.config.width, this.config.height, sizeMultiplayer));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
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
            
            vector3.x = data.elevations[j - 2] - data.elevations[j + 2];
            vector3.y = 2;
            vector3.z = data.elevations[j - width * 2] - data.elevations[j + width * 2];
            vector3.normalize();

            shade = vector3.dot(sun);
            
            imageData[i] = THREE_COLORS[data.biomes[j]].r * 255 * shade;  //(96 + shade * 128) * (0.5 + data.elevations[j] * 0.007);
            imageData[i + 1] = THREE_COLORS[data.biomes[j]].g * 255 * shade; //(32 + shade * 96) * (0.5 + data.elevations[j] * 0.007);
            imageData[i + 2] = THREE_COLORS[data.biomes[j]].b * 255 * shade; //(shade * 96) * (0.5 + data.elevations[j] * 0.007);
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
    /// Render sea water
    ///
    renderMapSea: function (sizeMultiplayer) {
        var water = new THREE.Water(this.config.width * sizeMultiplayer, this.config.height * sizeMultiplayer, {
            scale: 4,
            textureWidth: 1024,
            textureHeight: 1024,
            flowDirection: new THREE.Vector2(0, 0),
        });

        return water;
    },

    calculatePointRealElevation: function (point, cell, distanceToOwnSite) {
        var ownSiteRealElevation = cell.realElevation;

        var distanceToClosestSites = 999999;
        var closestSiteRealElevation = 0;

        var neighbors = cell.getNeighborIds();
        for (var j = 0; j < neighbors.length; j++) {
            var neighborCell = this.diagram.cells[neighbors[j]];

            var distanceToNeighborSite = this.calculate2dDistance(point, [neighborCell.site.x, neighborCell.site.y]);
            if (distanceToNeighborSite < distanceToClosestSites) {
                distanceToClosestSites = distanceToNeighborSite;
                closestSiteRealElevation = neighborCell.realElevation;
            }
        }

        return ((1-(distanceToOwnSite / (distanceToOwnSite + distanceToClosestSites))) * ownSiteRealElevation) +
            ((1-(distanceToClosestSites / (distanceToOwnSite + distanceToClosestSites))) * closestSiteRealElevation);
    },
    calculate2dDistance: function (point1, point2) {
        var a = point1[0] - point2[0];
        var b = point1[1] - point2[1];
        return Math.sqrt(a * a + b * b);
    },    
    pointDistanceToLine: function (x, y, x1, y1, x2, y2) {

        var A = x - x1;
        var B = y - y1;
        var C = x2 - x1;
        var D = y2 - y1;

        var dot = A * C + B * D;
        var len_sq = C * C + D * D;
        var param = -1;
        if (len_sq != 0) //in case of 0 length line
            param = dot / len_sq;

        var xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        }
        else if (param > 1) {
            xx = x2;
            yy = y2;
        }
        else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        var dx = x - xx;
        var dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    },  

    ///
    /// This method is not being used anymore
    ///
    isPointInPolygon: function (x, y, cornersX, cornersY) {
        var i, j = cornersX.length - 1;
        var oddNodes = false;

        var polyX = cornersX;
        var polyY = cornersY;

        for (i = 0; i < cornersX.length; i++) {
            if ((polyY[i] < y && polyY[j] >= y || polyY[j] < y && polyY[i] >= y) && (polyX[i] <= x || polyX[j] <= x)) {
                oddNodes ^= (polyX[i] + (y - polyY[i]) / (polyY[j] - polyY[i]) * (polyX[j] - polyX[i]) < x);
            }
            j = i;
        }

        return oddNodes;
    },
}

function animate() {
    requestAnimationFrame(animate);
    
    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}