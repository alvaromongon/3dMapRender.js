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

        // Scene
        this.scene = new THREE.Scene();
        //this.scene.background = new THREE.Color(0xcce0ff);
        //this.scene.fog = new THREE.Fog(0xcce0ff, 500, 10000);
        //this.scene.add(new THREE.AmbientLight(0x666666));

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, 1, 1, 10000);
        this.camera.position.x = 0;
        this.camera.position.y = 0;
        this.camera.position.z = this.config.width * 4;
        this.scene.add(this.camera);

        // Light
        this.light = this.renderLight();
        this.scene.add(this.light);

        // Ground
        //var groundMaterial = new THREE.MeshPhongMaterial({ color: THREE_COLORS.OCEAN.clone(), side: THREE.DoubleSide })
        //var groundMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.config.width, this.config.height), groundMaterial);
        //this.scene.add(groundMesh);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas});
        this.renderer.setSize(this.config.width*4, this.config.height*4);
        //this.renderer.physicallyCorrectLights = true;
        //this.renderer.gammaInput = true;
        //this.renderer.gammaOutput = true;
        //this.renderer.shadowMap.enabled = true;
        //this.renderer.toneMapping = THREE.ReinhardToneMapping;

        var plane = this.renderMap();         

        // Controls
        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //controls.maxPolarAngle = Math.PI * 0.5;
        controls.minDistance = 1;
        controls.maxDistance = 7500;

        animate();

        console.info("Three render completed");
    },

    renderLight: function () {
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

        return bulbLight;
    },

    renderMap: function () {
        var metadata = this.generateMapMetadata();

        var elevationMultiplayer = 100;

        var terrain = this.renderTerrain(metadata, elevationMultiplayer);
        this.scene.add(terrain);
    },  

    renderTerrain: function (metadata, elevationMultiplayer) {
        // var geometry = new THREE.PlaneBufferGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 ); ????
        var geometry = new THREE.PlaneBufferGeometry(this.config.width * 4, this.config.height * 4, this.config.width - 1, this.config.height - 1);
        //geometry.rotateX(- Math.PI / 2);

        // Set altitudes
        var vertices = geometry.attributes.position.array;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3, j++) {
            vertices[i + 2] = metadata.elevations[j] * elevationMultiplayer;
        }

        texture = new THREE.CanvasTexture(this.generateTexture(metadata, this.config.width, this.config.height));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    },  

    ///
    /// Generate heights, biome for each point in the plane plus rivers points for the whole map
    ///
    generateMapMetadata: function () {
        var voronoiMap = this.processVoronoiDiagram();

        var halfWith = this.config.width / 2;
        var halfHeight = this.config.height / 2;
        var size = this.config.width * this.config.height;

        var data = new Object();
        data.elevations = new Array(size);
        data.biomes = new Array(size);
        data.rivers = new Array(0);
        data.riverPaths = voronoiMap.riverPaths;
            
        // For each point in the plane set elevation and biomes
        for (var i = 0; i < size; i++) {
            data.elevations[i] = 0; // by default is 0
            data.biomes[i] = "OCEAN"; // by default is OCEAN
            var point = [i % this.config.width, Math.floor(i / this.config.height)];

            // Search the polygon in the voronoi where the point is and calculate elevation and biome
            for (var cll = 0, numCells = voronoiMap.terrainCells.length; cll < numCells; cll++) {
                // TODO: Should we calculate point polygon like this or just by nearest nbSite?
                if (this.isPointInPolygon(point[0], point[1], voronoiMap.polygonsX[cll], voronoiMap.polygonsY[cll])) {
                    data.elevations[i] = this.calculatePointRealElevation(point, voronoiMap.terrainCells[cll]);
                    data.biomes[i] = voronoiMap.terrainCells[cll].biome;                    
                    break;
                }
            }

            // Search if the point is contained in any of the river lines
            var found = false;
            for (var j = 0, numRivers = data.riverPaths.length; !found && j < numRivers; j++) {  
                for (var k = 0, numPoints = data.riverPaths[j].length; k < numPoints - 1; k++) {
                    var distance = this.pointDistanceToLine(point[0], point[1], data.riverPaths[j][k][0], data.riverPaths[j][k][1], data.riverPaths[j][k + 1][0], data.riverPaths[j][k + 1][1]);
                    if (distance < 1)                    
                    {
                        data.biomes[i] = "RIVER";

                        //console.log("point [" + point[0] + "," + point[1] + "] with distance " + distance);
                        found = true;
                        break;
                    }                    
                }
            }
        }

        return data;
    },

    /// 
    /// Process voronoi diagram to create a more adecuated for 3d rendering data structure
    ///
    processVoronoiDiagram: function() {
        var voronoiMap = new Object();
        voronoiMap.polygonsX = [];
        voronoiMap.polygonsY = [];
        voronoiMap.terrainCells = [];
        voronoiMap.riverPaths = [];

        for (var cellid in this.diagram.cells) {
            var polygonX = []; //polygon X coordinates for this cell
            var polygonY = []; //polygon Y coordinates for this cell            
            var cell = this.diagram.cells[cellid]; // this cell

            // No need to process the ocean cells, the elevation there can be set to a fix number
            if (cell.ocean) {
                continue;
            }

            // Build voronoi polygons information
            var start = cell.halfedges[0].getStartpoint();
            polygonX.push(start.x);
            polygonY.push(start.y);
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length - 1; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                polygonX.push(end.x);
                polygonY.push(end.y);
            }
            // Add polygons to voronoi map
            voronoiMap.terrainCells.push(cell);
            voronoiMap.polygonsX.push(polygonX);
            voronoiMap.polygonsY.push(polygonY);

            // Build river paths if needed
            if (cell.nextRiver) {
                var riverPath = []; // river path points
                //riverPath.strokeWidth = Math.min(cell.riverSize, this.config.maxRiversSize);
                var x, y;
                if (cell.water) {                    
                    x = cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2;
                    y = cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2;
                } else {
                    x = cell.site.x;
                    y = cell.site.y;
                    
                }
                riverPath.push([x, y])

                if (cell.nextRiver && !cell.nextRiver.water) {
                    x = cell.nextRiver.site.x;
                    y = cell.nextRiver.site.y;
                } else {
                    x = cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2;
                    y = cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2;
                }
                riverPath.push([x, y])

                voronoiMap.riverPaths.push(riverPath);
            }
        }

        return voronoiMap;
    },

    generateTexture: function(data, width, height) {
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
        canvasScaled.width = width * 4;
        canvasScaled.height = height * 4;

        context = canvasScaled.getContext('2d');
        context.scale(4, 4);
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

    calculatePointRealElevation: function (point, cell) {
        var distanceToOwnSite = this.calculate2dDistance(point, [cell.site.x, cell.site.y]);
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
}

function animate() {
    requestAnimationFrame(animate);
    
    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}