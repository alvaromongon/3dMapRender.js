// Based on original version created by Lebesnec
// https://github.com/lebesnec/island.js
var PAPER_COLORS = {
    OCEAN: new paper.Color('#82caff'),
    BEACH: new paper.Color('#ffe98d'),
    LAKE: new paper.Color('#2f9ceb'),
    RIVER: new paper.Color('#369eea'),
    SOURCE: new paper.Color('#00f'),
    MARSH: new paper.Color('#2ac6d3'),
    ICE: new paper.Color('#b3deff'),
    ROCK: new paper.Color('#535353'),
    LAVA: new paper.Color('#e22222'),

    SNOW: new paper.Color('#f8f8f8'),
    TUNDRA: new paper.Color('#ddddbb'),
    BARE: new paper.Color('#bbbbbb'),
    SCORCHED: new paper.Color('#999999'),
    TAIGA: new paper.Color('#ccd4bb'),
    SHRUBLAND: new paper.Color('#c4ccbb'),
    TEMPERATE_DESERT: new paper.Color('#e4e8ca'),
    TEMPERATE_RAIN_FOREST: new paper.Color('#a4c4a8'),
    TEMPERATE_DECIDUOUS_FOREST: new paper.Color('#b4c9a9'),
    GRASSLAND: new paper.Color('#c4d4aa'),
    TROPICAL_RAIN_FOREST: new paper.Color('#9cbba9'),
    TROPICAL_SEASONAL_FOREST: new paper.Color('#a9cca4'),
    SUBTROPICAL_DESERT: new paper.Color('#e9ddc7')
};

var PaperRenderer = {
    canvas: null,
    diagram: null,
    sites: null,
    config: null,
    cellsLayer: null,
    riversLayer: null,
    debugLayer: null,

    render: function (canvas, diagram, sites, config) {
        if (!canvas || !diagram || !sites || !config) {
            console.error("PaperRenderer.render method requires a not null canvas, diagram, sites and config parameters");
            return;
        }
        this.canvas = canvas;
        this.diagram = diagram;
        this.sites = sites;
        this.config = config;

        paper.install(window);
        paper.setup(this.canvas);

        this.cellsLayer = new paper.Layer({ name: 'cell' });
        this.riversLayer = new paper.Layer({ name: 'rivers' });
        this.debugLayer = new paper.Layer({ name: 'debug', visible: false });

        this.renderCells();
        this.renderRivers();
        this.renderEdges();
        this.renderSites();

        paper.view.draw();

        //console.info("Paper render completed");
    },
    
    renderCells: function() {
        this.cellsLayer.activate();
        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid];
            var color = this.getCellColor(cell);

            var cellPath = new Path();
            cellPath.strokeWidth = 1;
            cellPath.strokeColor = color;
            cellPath.fillColor = color;
            var start = cell.halfedges[0].getStartpoint();
            cellPath.add(new Point(start.x, start.y));
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                cellPath.add(new Point(end.x, end.y));
            }
            cellPath.closed = true;
        }
    },
    
    renderRivers: function() {
        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid];
            if (cell.nextRiver) {
                this.riversLayer.activate();
                var riverPath = new Path();
                riverPath.strokeWidth = Math.min(cell.riverSize, this.config.maxRiversSize);
                var riverColor = PAPER_COLORS.RIVER.clone();
                riverColor.brightness = riverColor.brightness - this.getShade(cell);
                riverPath.strokeColor = riverColor;
                riverPath.strokeCap = 'round';
                if (cell.water) {
                    riverPath.add(new Point(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2));
                } else {
                    riverPath.add(new Point(cell.site.x, cell.site.y));
                }
                if (cell.nextRiver && !cell.nextRiver.water) {
                    riverPath.add(new Point(cell.nextRiver.site.x, cell.nextRiver.site.y));
                } else {
                    riverPath.add(new Point(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2));
                }
            }
            // source :
            if (this.config.allowDebug && cell.source) {
                this.debugLayer.activate();
                var circle = new Path.Circle(new Point(cell.site.x, cell.site.y), 3);
                circle.fillColor = PAPER_COLORS.SOURCE;
            }
        }
    },
    
    renderEdges: function() {
        if (this.config.allowDebug) {
            this.debugLayer.activate();
            var edges = this.diagram.edges,
                iEdge = edges.length,
                edge, v;
            while (iEdge--) {
                edge = edges[iEdge];
                var edgePath = new Path();
                edgePath.strokeWidth = 1;

                if (edge.cliff) {
                    edgePath.strokeWidth = 1;
                    edgePath.strokeCap = 'round';
                    edgePath.strokeColor = PAPER_COLORS.ROCK;
                } else {
                    edgePath.strokeWidth = 1;
                    edgePath.strokeColor = '#000';
                }
                v = edge.va;
                edgePath.add(new Point(v.x, v.y));
                v = edge.vb;
                edgePath.add(new Point(v.x, v.y));
            }
        }
    },
    
    renderSites: function() {
        if (this.config.allowDebug) {
            this.debugLayer.activate();
            // sites :
            var sites = this.sites,
                iSite = sites.length;
            while (iSite--) {
                v = sites[iSite];
                var circle = new Path.Circle(new Point(v.x, v.y), 1);
                circle.fillColor = '#0f0';
            }

            // values :
            for (var i = 0; i < this.diagram.cells.length; i++) {
                var cell = this.diagram.cells[i];
                var text = new PointText(new Point(cell.site.x, cell.site.y));
                text.fillColor = '#f00';
                text.fontSize = '8px';
                text.content = Math.ceil(cell.realElevation * 100);
            }
        }
    },

    getCellColor: function (cell) {
        var c = PAPER_COLORS[cell.biome].clone();
        c.brightness = c.brightness - this.getShade(cell);

        return c;
    },

    getShade: function (cell) {
        if (this.config.shading == 0) {
            return 0;

        } else if (cell.ocean) {
            return (this.config.shadeOcean ? - cell.elevation : 0);

        } else if (cell.water) {
            return 0;

        } else {
            var lowerCell = null;
            var upperCell = null;
            var neighbors = cell.getNeighborIds();
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                    lowerCell = neighbor;
                }
                if (upperCell == null || neighbor.elevation > upperCell.elevation) {
                    upperCell = neighbor;
                }
            }

            var angleRadian = Math.atan2(upperCell.site.x - lowerCell.site.x, upperCell.site.y - lowerCell.site.y);
            var angleDegree = angleRadian * (180 / Math.PI);
            var diffElevation = (upperCell.realElevation - lowerCell.realElevation);

            if (diffElevation + this.config.shading < 1) {
                diffElevation = diffElevation + this.config.shading;
            }

            return ((Math.abs(angleDegree) / 180) * diffElevation);
        }
    },

    toggleDebug: function () {
        this.debug = !this.debug;
        this.debugLayer.visible = this.debug;
    },
}