var MeshDataFactory = {
    diagram: null,
    sites: null,
    width: null,
    height: null,

    create: function (diagram, sites, width, height) {
        if (!diagram || !sites || !width || !height) {
            console.error("TerrainMeshFactory.new method requires a not null diagram, sites and size parameters");
            return;
        }

        this.diagram = diagram;
        this.sites = sites;
        this.width = width;  
        this.height = height;  

        var meshData = new Object();
        meshData.terrain = this.generateMapMetadata();
        meshData.seaBed = this.calculatePointMetadata(null, null, this.width, 0);

        return meshData;
    },

    ///
    /// Generate heights, biome for each point in the plane plus rivers points for the whole map
    ///
    generateMapMetadata: function () {
        var voronoiMap = this.processVoronoiDiagram();

        var size = this.width * this.height;
        var halfWidth = this.width / 2;

        var data = new Object();
        data.elevations = new Array(size);
        data.biomes = new Array(size);

        // For each point in the plane set elevation and biomes
        for (var i = 0; i < size; i++) {
            var point = [i % this.width, Math.floor(i / this.height)];

            // Search the voronoi polygon where the point is located
            // Since we only look for in terrain cells, we need to filter out the under level water points
            var distanceToClosetTerrainSite = this.width;
            var closetTerrainCell = null;
            for (var cll = 0, numCells = voronoiMap.terrainCells.length; cll < numCells; cll++) {
                var distance = this.calculate2dDistance(point,
                    [voronoiMap.terrainCells[cll].site.x, voronoiMap.terrainCells[cll].site.y]);
                if (distance < distanceToClosetTerrainSite) {
                    distanceToClosetTerrainSite = distance;
                    closetTerrainCell = voronoiMap.terrainCells[cll];
                }
            }
            if (closetTerrainCell != null) {
                var result = this.calculateDistanceToClosestNeighborSite(point, closetTerrainCell);
                var pointData = this.calculatePointMetadata(closetTerrainCell, result.neighborCell, distanceToClosetTerrainSite, result.distanceToClosestNeighborSite);

                data.elevations[i] = pointData.elevation;
                data.biomes[i] = pointData.biome;
            }
            else {
                console.log("Impossible to find a closet terrain cell for the given point. This should never happens");
            }

            if (data.elevations[i] > 0) {
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

    calculateDistanceToClosestNeighborSite: function (point, closetTerrainCell) {
        var data = new Object();
        data.distanceToClosestNeighborSite = this.width;
        data.neighborCell = null;

        var neighbors = closetTerrainCell.getNeighborIds();
        for (var j = 0; j < neighbors.length; j++) {
            var neighborCell = this.diagram.cells[neighbors[j]];

            var distanceToNeighborSite = this.calculate2dDistance(point, [neighborCell.site.x, neighborCell.site.y]);
            if (distanceToNeighborSite < data.distanceToClosestNeighborSite) {
                data.distanceToClosestNeighborSite = distanceToNeighborSite;
                data.neighborCell = neighborCell;
            }
        }
        return data;
    },
    calculatePointMetadata: function (closestTerrainCell, closestNeighborCell, distanceToClosestTerrainSite, distanceToClosestNeighborSite) {
        var data = new Object();

        if (closestTerrainCell == null || closestNeighborCell == null) {
            data.elevation = (distanceToClosestTerrainSite / this.width) * (-1.0001);
            data.biome = "OCEAN"; // by default is OCEAN
        } else {

            // If closest neighbor site is closer than closest terrain site, this is OCEAN
            if (distanceToClosestTerrainSite > distanceToClosestNeighborSite) {
                data.elevation = (distanceToClosestTerrainSite / this.width) * (-1.0001);

                if (Math.abs(distanceToClosestTerrainSite - distanceToClosestNeighborSite) <= 2) {
                    data.biome = closestTerrainCell.biome;
                } else {
                    data.biome = "OCEAN"; // by default is OCEAN
                }
            } else {
                var ownSiteRealElevation = closestTerrainCell.realElevation;
                var closestNeighborSiteRealElevation = closestNeighborCell.realElevation;

                data.biome = closestTerrainCell.biome;

                var ownSiteElevationData = ((1 - (distanceToClosestTerrainSite / (distanceToClosestTerrainSite + distanceToClosestNeighborSite))) * ownSiteRealElevation);
                var closestNeighborElevationData = ((1 - (distanceToClosestNeighborSite / (distanceToClosestTerrainSite + distanceToClosestNeighborSite))) * closestNeighborSiteRealElevation);

                data.elevation = ownSiteElevationData + closestNeighborElevationData;
            }

            if (closestTerrainCell.coast && !closestTerrainCell.beach) {
                data.biome = "ROCK";
            }
        }

        return data;
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
}