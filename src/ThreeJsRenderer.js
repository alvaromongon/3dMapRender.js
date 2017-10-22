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
        this.camera.position.z = 200;
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
        this.renderer.setSize(this.config.width*2, this.config.height*2);
        //this.renderer.physicallyCorrectLights = true;
        //this.renderer.gammaInput = true;
        //this.renderer.gammaOutput = true;
        //this.renderer.shadowMap.enabled = true;
        //this.renderer.toneMapping = THREE.ReinhardToneMapping;
        
        // Cells
        //var group = new THREE.Group();        
        //this.renderCells(group);
        //this.scene.add(group);

        //var plane = this.renderHeightMap();
        var plane = this.renderMap(); 
        this.scene.add(plane);

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
        bulbLight.position.z = 300;
        bulbLight.castShadow = true;

        return bulbLight;
    },

    renderHeightMap: function () {
        // The idea is to create an height map from the voronoi data we have
        // http://blog.mastermaps.com/2013/10/terrain-building-with-threejs.html
        // https://codepen.io/Fusty/pen/GJvdWe

        // Create polygons Paths
        var polygonsX = [];
        var polygonsY = [];
        var cells = [];
        this.populatePolygonsAndCells(polygonsX, polygonsY, cells);
        
        // Create the texture
        // https://codepen.io/SereznoKot/pen/vNjJWd
        // https://github.com/mrdoob/three.js/issues/486
        /*
        var side = this.config.width * this.config.height; // power of two textures are better cause powers of two are required by some algorithms. Like ones that decide what color will pixel have if amount of pixels is less than amount of textels (see three.js console error when given non-power-of-two texture)
        var amount = Math.pow(side, 2); // you need 4 values for every pixel in side*side plane
        var data = new Uint8Array(amount);
        for (var i = 0; i < amount; i++) {
            data[i] = Math.random() * 256; // generates random r,g,b,a values from 0 to 1
        }
        */
        

        // Create geometry
        var geometry = new THREE.PlaneBufferGeometry(this.config.width, this.config.height, this.config.width - 1, this.config.height - 1);
        var vertices = geometry.attributes.position.array;

        // Set altitudes
        var halfWith = this.config.width / 2;
        var halfHeight = this.config.height / 2;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3, j += 4) {
            vertices[i+2] = 0; // by default is 0
            var point = [vertices[i] + halfWith, vertices[i + 1] + halfHeight];
            console.log("Evaluating point (" + point[0] + "," + point[1] + ")");

            for (var cll = 0, numCells = cells.length; cll < numCells; cll++) {
                if (this.isPointInPolygon(point[0], point[1], polygonsX[cll], polygonsY[cll])) {
                    vertices[i+2] = cells[cll].realElevation * 100;
                    // geometry.vertices[i].z = data[i] / 65535 * 10;
                    break;
                }
            }
        }
        /*
        var texture = new THREE.DataTexture(data, side, side, THREE.LuminanceFormat, THREE.UnsignedByteType);
        texture.needsUpdate = true;
        var material = new THREE.MeshBasicMaterial({ color: THREE_COLORS["OCEAN"], alphaMap: texture, transparent: false });
        */
        var material = new THREE.MeshPhongMaterial({
            color: THREE_COLORS["GRASSLAND"],
            wireframe: true
        });
        return new THREE.Mesh(geometry, material);
    },

    renderCells: function (group) {
        // Add a layer?
        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid];
            var color = THREE_COLORS[cell.biome].clone();
            
            var cellPoints = [];            
            var start = cell.halfedges[0].getStartpoint();
            cellPoints.push(new THREE.Vector2(start.x, start.y));
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                cellPoints.push(new THREE.Vector2(end.x, end.y));
            }
            var cellShape = new THREE.Shape(cellPoints);
            cellShape.autoClose = true; //just in case
            var cellGeometry = new THREE.ShapeBufferGeometry(cellShape);
            var cellMesh = new THREE.Mesh(cellGeometry, new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide }));
            //cellMesh.position.set(cell.site.x, cell.site.y, 0);
            //mesh.rotation.set(rx, ry, rz);
            //mesh.scale.set(s, s, s);
            group.add(cellMesh);
        }
    },

    renderMap: function () {
        var data = this.generateHeight();

        // var geometry = new THREE.PlaneBufferGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 ); ????
        var geometry = new THREE.PlaneBufferGeometry(this.config.width, this.config.height, this.config.width - 1, this.config.height - 1);
        //geometry.rotateX(- Math.PI / 2);

        // Set altitudes
        var vertices = geometry.attributes.position.array;
        for (var i = 0, j = 0, numVertices = vertices.length; i < numVertices; i += 3 , j ++) {
            vertices[i + 2] = data.elevations[j] * 10;
        }

        texture = new THREE.CanvasTexture(this.generateTexture(data, this.config.width, this.config.height));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    },

    populatePolygonsAndCells(polygonsX, polygonsY, cells) {
        for (var cellid in this.diagram.cells) {
            var polygonX = [];
            var polygonY = [];
            var cell = this.diagram.cells[cellid];

            // No need to process the ocean cells, the elevation there can be set to a fix number
            if (cell.ocean) {
                continue;
            }
            var start = cell.halfedges[0].getStartpoint();
            polygonX.push(start.x);
            polygonY.push(start.y);
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length - 1; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                polygonX.push(end.x);
                polygonY.push(end.y);
            }
            cells.push(cell);
            polygonsX.push(polygonX);
            polygonsY.push(polygonY);
        }
    },

    generateHeight: function () {
        // Create polygons Paths
        var polygonsX = [];
        var polygonsY = [];
        var cells = [];
        this.populatePolygonsAndCells(polygonsX, polygonsY, cells);

        var halfWith = this.config.width / 2;
        var halfHeight = this.config.height / 2;

        var size = this.config.width * this.config.height;
        var data = new Object();
        data.elevations = new Uint8Array(size);
        data.biomes = new Array(size);

        for (var i = 0; i < size; i++) {
            data.elevations[i] = 0; // by default is 0
            data.biomes[i] = "OCEAN"; // by default is OCEAN
            var point = [i % this.config.width, Math.floor(i / this.config.height)];

            for (var cll = 0, numCells = cells.length; cll < numCells; cll++) {
                if (this.isPointInPolygon(point[0], point[1], polygonsX[cll], polygonsY[cll])) {
                    data.elevations[i] = cells[cll].realElevation * 10;
                    data.biomes[i] = cells[cll].biome;
                    break;
                }
            }
        }

        return data;
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
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}