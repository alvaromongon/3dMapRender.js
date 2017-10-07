var ThreeJsRenderer = {
    canvas: null,
    diagram: null,
    sites: null,
    config: null,

    scene: null,
    camera: null,
    renderer: null,

    cube: null,

    render: function (canvas, diagram, sites, config) {
        if (!diagram || !sites || !config) {
            console.error("ThreeJsRenderer.render method requires a not null diagram, sites and config parameters");
            return;
        }
        this.canvas = canvas;
        this.diagram = diagram;
        this.sites = sites;
        this.config = config;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.config.width / this.config.height, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas});
        this.renderer.setSize(this.config.width, this.config.height);

        var geometry = new THREE.BoxGeometry(1, 1, 1);
        var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);

        this.camera.position.z = 5;

        animate();
    },
}

function animate() {
    requestAnimationFrame(animate);

    ThreeJsRenderer.cube.rotation.x += 0.1;
    ThreeJsRenderer.cube.rotation.y += 0.1;

    ThreeJsRenderer.renderer.render(ThreeJsRenderer.scene, ThreeJsRenderer.camera);
}