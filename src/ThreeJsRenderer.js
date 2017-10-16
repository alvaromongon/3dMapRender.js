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
        this.scene.background = new THREE.Color(0xcce0ff);
        this.scene.fog = new THREE.Fog(0xcce0ff, 500, 10000);
        this.scene.add(new THREE.AmbientLight(0x666666));

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, 1, 1, 10000);
        this.camera.position.x = 0;
        this.camera.position.y = 0;
        this.camera.position.z = 1000;
        this.scene.add(this.camera);

        // Ground
        //var groundMaterial = new THREE.MeshPhongMaterial({ color: THREE_COLORS.OCEAN.clone(), side: THREE.DoubleSide })
        //var groundMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.config.width, this.config.height), groundMaterial);
        //this.scene.add(groundMesh);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas});
        this.renderer.setSize(this.config.width, this.config.height);
        
        // Cells
        //var group = new THREE.Group();        
        //this.renderCells(group);
        //this.scene.add(group);

        var plane = this.renderHeightMap();
        this.scene.add(plane);

        // Controls
        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //controls.maxPolarAngle = Math.PI * 0.5;
        controls.minDistance = 1;
        controls.maxDistance = 7500;

        animate();

        console.info("Three render completed");
    },

    renderHeightMap: function () {
        // The idea is to create an height map from the voronoi data we have
        // http://blog.mastermaps.com/2013/10/terrain-building-with-threejs.html
        // https://codepen.io/Fusty/pen/GJvdWe

        // Create polygons Paths
        var polygonsX = [];
        var polygonsY = [];
        var realElevations = [];
        for (var cellid in this.diagram.cells) {
            var polygonX = [];
            var polygonY = [];
            var cell = this.diagram.cells[cellid];

            var start = cell.halfedges[0].getStartpoint();
            polygonX.push(start.x);
            polygonY.push(start.y);
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length-1; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                polygonX.push(end.x);
                polygonY.push(end.y);  
            }
            realElevations.push(cell.realElevation);
            polygonsX.push(polygonX);
            polygonsY.push(polygonY);
            //console.info("Real elevation: " + cell.realElevation);
        }
        
        var geometry = new THREE.PlaneGeometry(this.config.width, this.config.height, this.config.width-1, this.config.height-1);

        // http://paperjs.org/reference/pathitem/#intersect-path
        for (var i = 0, numVertices = geometry.vertices.length; i < numVertices; i++) {
            var point = [geometry.vertices[i].x + this.config.width / 2, geometry.vertices[i].y + this.config.height/2];
            //console.info("Point: " + point.toString());
            
            for (var j = 0, numPolygons = realElevations.length; j < numPolygons; j++) {
                //console.info("Polygon: " + polygons[j]);

                if (this.checkcheck(point[0], point[1], polygonsX[j], polygonsY[j])) {
                    geometry.vertices[i].z = realElevations[j] * 100;
                    //console.info("geometry.vertices[" + i + "] setting real elevation to " + geometry.vertices[i].z + " from polygon " + j);
                    // geometry.vertices[i].z = data[i] / 65535 * 10;
                    break;
                }
            }
        }

        var material = new THREE.MeshPhongMaterial({
            color: 0xdddddd,
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

    inside: function(vs, point) {
            // ray-casting algorithm based on
            // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

            var x = point[0], y = point[1];

            var inside = false;
            for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                var xi = vs[i][0], yi = vs[i][1];
                var xj = vs[j][0], yj = vs[j][1];

                var intersect = ((yi > y) != (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }

            return inside;
    },

    checkcheck: function(x, y, cornersX, cornersY) {
            var i, j = cornersX.length - 1 ;
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