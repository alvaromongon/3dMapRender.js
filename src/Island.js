// Created by Lebesnec
// https://github.com/lebesnec/island.js
var Island = {
    config: {
        width: 500,
        height: 500,
        perlinWidth: 256,
        perlinHeight: 256,
        allowDebug: false, // if set to true, you can clic on the map to enter "debug" mode. Warning : debug mode is slow to initialize, set to false for faster rendering.
        nbSites: 10000, // nb of voronoi cell
        sitesDistribution: 'hexagon', // distribution of the site : random, square or hexagon
        sitesRandomisation: 80, // will move each site in a random way (in %), for the square or hexagon distribution to look more random
        nbGraphRelaxation: 0, // nb of time we apply the relaxation algo to the voronoi graph (slow !), for the random distribution to look less random
        cliffsThreshold: 0.15,
        lakesThreshold: 0.005, // lake elevation will increase by this value (* the river size) when a new river end inside
        nbRivers: (10000 / 200),
        maxRiversSize: 4,
        shading: 0.35,
        shadeOcean: true
    },
    perlinCanvas: null,
    debug: false, // true if "debug" mode is activated
    voronoi: new Voronoi(),
    diagram: null,
    sites: [],
    seed: -1,
    perlin: null,

    generate: function (userConfig, perlinCanvas) {        
        if (userConfig == undefined) {
            userConfig = {};
        }
        
        this.config.width               = (userConfig.width != undefined                ? userConfig.width              : view.viewSize.width);
        this.config.height              = (userConfig.height != undefined               ? userConfig.height             : view.viewSize.height);
        this.config.perlinWidth         = (userConfig.perlinWidth != undefined          ? userConfig.perlinWidth        : (this.config.width / 3));
        this.config.perlinHeight        = (userConfig.perlinHeight != undefined         ? userConfig.perlinHeight       : (this.config.height / 3));
        this.config.allowDebug          = (userConfig.allowDebug != undefined           ? userConfig.allowDebug         : false);
        this.config.nbSites             = (userConfig.nbSites != undefined              ? userConfig.nbSites            : ((this.config.width * this.config.height) / 100));
        this.config.sitesDistribution   = (userConfig.sitesDistribution != undefined    ? userConfig.sitesDistribution  : 'hexagon');
        this.config.sitesRandomisation  = (userConfig.sitesRandomisation != undefined   ? userConfig.sitesRandomisation : 80);
        this.config.nbGraphRelaxation   = (userConfig.nbGraphRelaxation != undefined    ? userConfig.nbGraphRelaxation  : 0);
        this.config.cliffsThreshold     = (userConfig.cliffsThreshold != undefined      ? userConfig.cliffsThreshold    : 0.15);
        this.config.lakesThreshold      = (userConfig.lakesThreshold != undefined       ? userConfig.lakesThreshold     : 0.005);
        this.config.nbRivers            = (userConfig.nbRivers != undefined             ? userConfig.nbRivers           : (this.config.nbSites / 200));
        this.config.maxRiversSize       = (userConfig.maxRiversSize != undefined        ? userConfig.maxRiversSize      : 4);
        this.config.shading             = (userConfig.shading != undefined              ? userConfig.shading            : 0.35);
        this.config.shadeOcean          = (userConfig.shadeOcean != undefined           ? userConfig.shadeOcean         : true);               
        
        this.seed = Math.random();

        this.perlinCanvas = perlinCanvas;
        this.perlinCanvas.width = this.config.perlinWidth;
        this.perlinCanvas.height = this.config.perlinHeight;
        this.perlin = perlinNoise(this.perlinCanvas, 64, 64, this.seed);
        this.randomSites();

        // These two methods may change the real elavation of the cells
        this.assignOceanCoastAndLand();
        this.assignRivers();

        this.assignRealElevation();

        this.assignMoisture();
        this.assignBiomes();

        console.info("Island map generated");
        
        return { diagram: this.diagram, sites: this.sites };
    },

    randomSites: function (n) {
        var sites = [];

        // create vertices
        if (this.config.sitesDistribution == 'random') {
            for (var i = 0; i < this.config.nbSites; i++) {
                sites.push({
                    x: Math.round(Math.random() * this.config.width),
                    y: Math.round(Math.random() * this.config.height)
                });
            }
        } else {
            var delta = Math.sqrt(this.config.width * this.config.height / this.config.nbSites);
            var rand = this.config.sitesRandomisation * delta / 100;
            var x = 0;
            var y = 0;
            for (var i = 0; i < this.config.nbSites; i++) {
                sites.push({
                    x: Math.max(Math.min(Math.round(x * delta + (Math.random() * rand)), this.config.width), 0),
                    y: Math.max(Math.min(Math.round(y * delta + (Math.random() * rand)), this.config.height), 0)
                });
                x = x + 1;
                if (x * delta > this.config.width) {
                    x = (y % 2 == 1 || this.config.sitesDistribution == 'square' ? 0 : 0.5);
                    y = y + 1;
                }
            }
        }
        this.compute(sites);
        for (var i = 0; i < this.config.nbGraphRelaxation; i++) {
            this.relaxSites();
        }
    },
    
    compute: function (sites) {
        this.sites = sites;
        this.voronoi.recycle(this.diagram);
        var bbox = {xl: 0, xr: this.config.width, yt: 0, yb: this.config.height};
        this.diagram = this.voronoi.compute(sites, bbox);
    },

    relaxSites: function () {
        if (!this.diagram) {
            return;
        }
        var cells = this.diagram.cells,
            iCell = cells.length,
            cell,
            site, sites = [],
            rn, dist;
        var p = 1 / iCell * 0.1;
        while (iCell--) {
            cell = cells[iCell];
            rn = Math.random();
            // probability of apoptosis
            if (rn < p) {
                continue;
            }
            site = this.cellCentroid(cell);
            dist = this.distance(site, cell.site);
            // don't relax too fast
            if (dist > 2) {
                site.x = (site.x + cell.site.x) / 2;
                site.y = (site.y + cell.site.y) / 2;
            }
            // probability of mytosis
            if (rn > (1 - p)) {
                dist /= 2;
                sites.push({
                    x: site.x + (site.x - cell.site.x) / dist,
                    y: site.y + (site.y - cell.site.y) / dist
                });
            }
            sites.push(site);
        }
        this.compute(sites);
    },

    cellArea: function (cell) {
        var area = 0,
            halfedges = cell.halfedges,
            iHalfedge = halfedges.length,
            halfedge,
            p1, p2;
        while (iHalfedge--) {
            halfedge = halfedges[iHalfedge];
            p1 = halfedge.getStartpoint();
            p2 = halfedge.getEndpoint();
            area += p1.x * p2.y;
            area -= p1.y * p2.x;
        }
        area /= 2;
        return area;
    },

    cellCentroid: function (cell) {
        var x = 0,
            y = 0,
            halfedges = cell.halfedges,
            iHalfedge = halfedges.length,
            halfedge,
            v, p1, p2;
        while (iHalfedge--) {
            halfedge = halfedges[iHalfedge];
            p1 = halfedge.getStartpoint();
            p2 = halfedge.getEndpoint();
            v = p1.x * p2.y - p2.x * p1.y;
            x += (p1.x + p2.x) * v;
            y += (p1.y + p2.y) * v;
        }
        v = this.cellArea(cell) * 6;
        return {
            x: x / v,
            y: y / v
        };
    },
    
    assignOceanCoastAndLand: function() {
        // water
        var queue = new Array();
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            cell.elevation = this.getElevation(cell.site);
            cell.water = (cell.elevation <= 0);
            var numWater = 0;
            for (var j = 0; j < cell.halfedges.length; j++) {
                var hedge = cell.halfedges[j];
                // border 
                if (hedge.edge.rSite == null) {
                    cell.border = true;
                    cell.ocean = true;
                    cell.water = true;
                    if (cell.elevation > 0) {
                        cell.elevation = 0;
                    }
                    queue.push(cell);
                }
            }
        }
        
        // ocean
        while (queue.length > 0) {
            var cell = queue.shift();
            var neighbors = cell.getNeighborIds();
            for (var i = 0; i < neighbors.length; i++) {
                var nId = neighbors[i];
                var neighbor = this.diagram.cells[nId];
                if (neighbor.water && !neighbor.ocean) {
                    neighbor.ocean = true;
                    queue.push(neighbor);
                }
            } 
        }
        
        // coast
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            var numOcean = 0;
            var neighbors = cell.getNeighborIds();
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (neighbor.ocean) {
                   numOcean++;
                }
            } 
            cell.coast = (numOcean > 0) && (!cell.water);
            cell.beach = (cell.coast && cell.elevation < this.config.cliffsThreshold);
        }
        
        // cliff
        for (var i = 0; i < this.diagram.edges.length; i++) {
            var edge = this.diagram.edges[i];
            if (edge.lSite != null && edge.rSite != null) {
                var lCell = this.diagram.cells[edge.lSite.voronoiId];
                var rCell = this.diagram.cells[edge.rSite.voronoiId];      
                edge.cliff = (!(lCell.water && rCell.water) && (Math.abs(this.getRealElevation(lCell) - this.getRealElevation(rCell)) >= this.config.cliffsThreshold));
            }            
        }
    }, 
    
    assignRivers: function() {
        for (var i = 0; i < this.config.nbRivers;) {
            var cell = this.diagram.cells[this.getRandomInt(0, this.diagram.cells.length - 1)];
            if (!cell.coast) {
                if (this.setAsRiver(cell, 1)) {
                    cell.source = true;
                    i++;
                }
            }
        }
    },
    
    setAsRiver: function(cell, size) {
        if (!cell.water && !cell.river) {
            cell.river = true;
            cell.riverSize = size;
            var lowerCell = null;
            var riverFlowDirection = null;
            var neighbors = cell.getNeighborIds();
            // we choose the lowest neighbour cell :
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                    lowerCell = neighbor;
                    riverFlowDirection = this.getRiverFlowDirection(cell, neighbor);
                }
            } 
            if (lowerCell.elevation < cell.elevation) {
                // we continue the river to the next lowest cell :
                this.setAsRiver(lowerCell, size);
                cell.nextRiver = lowerCell; 
                lowerCell.flowDirection = riverFlowDirection;
            } else {
                // we are in a hole, so we create a lake :
                cell.water = true;
                this.fillLake(cell);
            }
        } else if (cell.water && !cell.ocean) {
            // we ended in a lake, the water level rise :
            cell.lakeElevation = this.getRealElevation(cell) + (this.config.lakesThreshold * size);
            this.fillLake(cell);
        } else if (cell.river) {
            // we ended in another river, the river size increase :
            cell.riverSize ++;
            var nextRiver = cell.nextRiver;
            while (nextRiver) {
                nextRiver.riverSize ++;
                nextRiver = nextRiver.nextRiver;
            }
        }
        
        return cell.river;
    },
    
    fillLake: function(cell) {
        // if the lake has an exit river he can not longer be filled
        if (cell.exitRiver == null) { 
            var exitRiver = null;
            var exitSource = null;
            var lake = new Array();
            var queue = new Array();
            queue.push(cell);
            
            while (queue.length > 0) {
                var c = queue.shift();
                lake.push(c);
                var neighbors = c.getNeighborIds();
                for (var i = 0; i < neighbors.length; i++) {
                    var nId = neighbors[i];
                    var neighbor = this.diagram.cells[nId];
                    
                    if (neighbor.water && !neighbor.ocean) { // water cell from the same lake
                        if (neighbor.lakeElevation == null || neighbor.lakeElevation < c.lakeElevation) {
                            neighbor.lakeElevation = c.lakeElevation;
                            queue.push(neighbor);
                        }
                    } else { // ground cell adjacent to the lake
                        if (c.elevation < neighbor.elevation) {
                            if (neighbor.elevation - c.lakeElevation < 0) {
                                // we fill the ground with water
                                neighbor.water = true;
                                neighbor.lakeElevation = c.lakeElevation;
                                queue.push(neighbor);
                            }
                        } else {
                            //neighbor.source = true;
                            // we found an new exit for the lake :
                            if (exitRiver == null || exitRiver.elevation > neighbor.elevation) {
                                exitSource = c;
                                exitRiver = neighbor;
                            } 
                        }
                    }
                } 
            }
            
            if (exitRiver != null) {
                // we start the exit river :
                exitSource.river = true;
                exitSource.nextRiver = exitRiver;
                this.setAsRiver(exitRiver, 2);
                // we mark all the lake as having an exit river :
                while (lake.length > 0) {
                    var c = lake.shift();
                    c.exitRiver = exitRiver;
                }
            }
        }
    },

    assignRealElevation: function () {
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            cell.realElevation = this.getRealElevation(cell);
        }
    },

    // Calculate moisture. Freshwater sources spread moisture: rivers and lakes (not ocean). 
    assignMoisture: function() {
        var queue = new Array();
        // lake and river 
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            if ((cell.water || cell.river) && !cell.ocean) {
                cell.moisture = (cell.water ? 1 : 0.9);
                if (!cell.ocean) {
                    queue.push(cell);
                }
            }
        }
        
        while (queue.length > 0) {
            var cell = queue.shift();
            var neighbors = cell.getNeighborIds();
            for (var i = 0; i < neighbors.length; i++) {
                var nId = neighbors[i];
                var neighbor = this.diagram.cells[nId];
                var newMoisture = cell.moisture * 0.9;
                if (neighbor.moisture == null || newMoisture > neighbor.moisture) {
                    neighbor.moisture = newMoisture;
                    queue.push(neighbor);
                }
            } 
        }
        
        // ocean
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            if (cell.ocean) {
                cell.moisture = 1;
            }
        }
    },
    
    assignBiomes: function() {
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            cell.biome = this.getBiome(cell);
        }
    },
    
    getBiome: function (cell) {
        if (cell.ocean) {
            return 'OCEAN';
        } else if (cell.water) {
            if (cell.realElevation < 0.05) return 'MARSH';
            if (cell.realElevation > 0.4) return 'ICE';
            return 'LAKE';
        } else if (cell.beach) {
            return 'BEACH';
        } else if (cell.elevation > 0.4) {
            if (cell.moisture > 0.50) return 'SNOW';
            else if (cell.moisture > 0.33) return 'TUNDRA';
            else if (cell.moisture > 0.16) return 'BARE';
            else return 'SCORCHED';
        } else if (cell.elevation > 0.3) {
            if (cell.moisture > 0.66) return 'TAIGA';
            else if (cell.moisture > 0.33) return 'SHRUBLAND';
            else return 'TEMPERATE_DESERT';
        } else if (cell.elevation > 0.15) {
            if (cell.moisture > 0.83) return 'TEMPERATE_RAIN_FOREST';
            else if (cell.moisture > 0.50) return 'TEMPERATE_DECIDUOUS_FOREST';
            else if (cell.moisture > 0.16) return 'GRASSLAND';
            else return 'TEMPERATE_DESERT';
        } else {
            if (cell.moisture > 0.66) return 'TROPICAL_RAIN_FOREST';
            else if (cell.moisture > 0.33) return 'TROPICAL_SEASONAL_FOREST';
            else if (cell.moisture > 0.16) return 'GRASSLAND';
            else return 'SUBTROPICAL_DESERT';
        }
    },

    getRiverFlowDirection: function (cell, lowerCell) {
        var flowDirection = new Float32Array(2);
        flowDirection[0] = lowerCell.site.x - cell.site.x;
        flowDirection[1] = lowerCell.site.y - cell.site.y;

        return flowDirection;
    },

    // The Perlin-based island combines perlin noise with the radius
    getElevation: function (point) {
        var x = 2 * (point.x / this.config.width - 0.5);
        var y = 2 * (point.y / this.config.height - 0.5);
        var distance = Math.sqrt(x * x + y * y);
        var c = this.getPerlinValue(point); 

        return c - distance;
        //return c - (0.3 + 0.3 * distance * distance);
    },
    
    getPerlinValue: function(point) {
        var x = ((point.x / this.config.width) * this.perlin.width) | 0;
        var y = ((point.y / this.config.height) * this.perlin.height) | 0;        
        var pos = (x + y * this.perlin.width) * 4;
        var data = this.perlin.data;
        var val = data[pos + 0] << 16 | data[pos + 1] << 8 | data[pos + 2]; // rgb to hex
        
        return (val & 0xff) / 255.0;
    },
    
    getRealElevation: function(cell) {
        if (cell.water && cell.lakeElevation != null) {
            return cell.lakeElevation;
        } else if (cell.water && cell.elevation < 0) {
            return -0;
        } else {
            return cell.elevation;
        }
    },
         
    getRandomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    distance: function(a, b) {
        var dx = a.x - b.x,
            dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

};